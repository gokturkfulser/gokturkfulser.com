// Cloudflare Access doğrulaması. Her istekte `Cf-Access-Jwt-Assertion` başlığındaki JWT, Access'in açık anahtarlarıyla (RS256) doğrulanır:
// imza, `iss` (takım alan adı), `aud` (uygulamanın AUD etiketi), `exp`/`nbf`. Başlık yoksa ya da doğrulama geçmezse istek reddedilir (403).
// Kaynak: developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
// (başlık adı, açık anahtarlar https://<ekip>.cloudflareaccess.com/cdn-cgi/access/certs, iss = takım alan adı, aud = AUD etiketi).
import { gelistirmeModu, type Bagimlilik, type Env } from './ortam.ts';

export type ErisimSonucu = { tamam: true; eposta?: string; gelistirme?: boolean } | { tamam: false; neden: string };

type Jwk = JsonWebKey & { kid?: string };
type Onbellek = { anahtarlar: Jwk[]; zaman: number };
const onbellek = new Map<string, Onbellek>();
const TTL_MS = 10 * 60 * 1000;
const YENILEME_ARALIGI_MS = 60 * 1000;
const SAPMA_SN = 30;

/** Testler için. */
export const anahtarOnbelleginiSifirla = () => onbellek.clear();

const b64urlBayt = (s: string): Uint8Array<ArrayBuffer> => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
const b64urlJson = (s: string): any => JSON.parse(new TextDecoder().decode(b64urlBayt(s)));

/** "https://x.cloudflareaccess.com", "x.cloudflareaccess.com/" → "https://x.cloudflareaccess.com". Geçersizse null. */
export function takimAdresi(ham: string | undefined): string | null {
  if (!ham) return null;
  const metin = /^https?:\/\//i.test(ham.trim()) ? ham.trim() : `https://${ham.trim()}`;
  try {
    const u = new URL(metin);
    return u.protocol === 'https:' && u.hostname.includes('.') ? `https://${u.hostname}` : null;
  } catch {
    return null;
  }
}

async function anahtarlariGetir(takim: string, dep: Bagimlilik, zorla: boolean): Promise<Jwk[]> {
  const o = onbellek.get(takim);
  const simdi = dep.simdi();
  if (o && !zorla && simdi - o.zaman < TTL_MS) return o.anahtarlar;
  if (o && zorla && simdi - o.zaman < YENILEME_ARALIGI_MS) return o.anahtarlar; // bilinmeyen kid ile art arda yenileme saldırısı yok
  const r = await dep.fetch(`${takim}/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error(`Access anahtarları alınamadı (${r.status})`);
  const v = (await r.json()) as { keys?: Jwk[] };
  if (!Array.isArray(v.keys) || v.keys.length === 0) throw new Error('Access anahtar listesi boş');
  onbellek.set(takim, { anahtarlar: v.keys, zaman: simdi });
  return v.keys;
}

export async function erisimDogrula(istek: Request, env: Env, dep: Bagimlilik): Promise<ErisimSonucu> {
  if (gelistirmeModu(env, istek.url)) return { tamam: true, eposta: 'gelistirme@yerel', gelistirme: true };
  const takim = takimAdresi(env.ACCESS_TEAM_DOMAIN);
  if (!takim || !env.ACCESS_AUD) return { tamam: false, neden: 'Access yapılandırılmamış (ACCESS_TEAM_DOMAIN / ACCESS_AUD)' };
  const jwt = istek.headers.get('Cf-Access-Jwt-Assertion');
  if (!jwt) return { tamam: false, neden: 'Cf-Access-Jwt-Assertion başlığı yok' };
  const parcalar = jwt.split('.');
  if (parcalar.length !== 3 || parcalar.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) return { tamam: false, neden: 'JWT biçimi geçersiz' };
  try {
    const baslik = b64urlJson(parcalar[0]!);
    if (baslik.alg !== 'RS256' || typeof baslik.kid !== 'string') return { tamam: false, neden: 'JWT algoritması/kid geçersiz' };
    let anahtarlar = await anahtarlariGetir(takim, dep, false);
    let jwk = anahtarlar.find((k) => k.kid === baslik.kid);
    if (!jwk) {
      anahtarlar = await anahtarlariGetir(takim, dep, true);
      jwk = anahtarlar.find((k) => k.kid === baslik.kid);
    }
    if (!jwk) return { tamam: false, neden: 'JWT anahtarı (kid) bilinmiyor' };
    const anahtar = await crypto.subtle.importKey('jwk', { ...jwk, ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const imzaGecerli = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', anahtar, b64urlBayt(parcalar[2]!), new TextEncoder().encode(`${parcalar[0]}.${parcalar[1]}`));
    if (!imzaGecerli) return { tamam: false, neden: 'JWT imzası geçersiz' };
    const v = b64urlJson(parcalar[1]!);
    const sn = Math.floor(dep.simdi() / 1000);
    if (v.iss !== takim) return { tamam: false, neden: 'JWT iss uyuşmuyor' };
    const aud = Array.isArray(v.aud) ? v.aud : [v.aud];
    if (!aud.includes(env.ACCESS_AUD)) return { tamam: false, neden: 'JWT aud uyuşmuyor' };
    if (typeof v.exp !== 'number' || v.exp + SAPMA_SN < sn) return { tamam: false, neden: 'JWT süresi dolmuş' };
    if (typeof v.nbf === 'number' && v.nbf - SAPMA_SN > sn) return { tamam: false, neden: 'JWT henüz geçerli değil' };
    const eposta = typeof v.email === 'string' ? v.email : undefined;
    if (env.ACCESS_IZINLI_EPOSTA && eposta?.toLowerCase() !== env.ACCESS_IZINLI_EPOSTA.trim().toLowerCase()) return { tamam: false, neden: 'e-posta izinli değil' };
    return { tamam: true, eposta };
  } catch {
    return { tamam: false, neden: 'JWT doğrulanamadı' };
  }
}
