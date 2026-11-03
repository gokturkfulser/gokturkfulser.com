// Testler için: sahte GitHub contents API, sahte Access (RSA anahtarı + imzalı JWT) ve örnek gece/sözlük dosyaları. Ağ yok.
import { DEPO, type Bagimlilik, type Env } from './ortam.ts';
import { ESIT, type OyunDurumu } from './form.ts';

export const TOKEN = 'ghp_SAHTE_GIZLI_TOKEN_0123456789';
export const TAKIM = 'https://takim.cloudflareaccess.com';
export const AUD = 'aud-etiketi-123';
export const ORIJIN = 'https://kontrol.gokturkfulser.com';

export const GECE_YOLU = 'site/src/content/top10/2026-27/2026-11-01.yaml';
export const GECE_YOLU_2 = 'site/src/content/top10/2026-27/2026-10-31.yaml';
export const SOZLUK_YOLU = 'site/src/content/top10/oyuncu-adlari.yaml';

const LF = String.fromCharCode(10);

/** 5 oyunluk top5 gecesi (sitenin dosya düzeninde: yorumlar, tırnaklı zaman, kontrol alanı). */
export const geceMetni = (tarih = '2026-11-01', inceleme: string | null = 'bekliyor', ekstra: string[] = []) =>
  [
    '# Gemini ile üretildi: 2026-11-02T22:13:46.680Z, model gemini-3.8-flash',
    '',
    `tarih: ${tarih}`,
    'video: https://www.youtube.com/watch?v=abcdefghijk',
    'tur: top5',
    'kaynak: gemini',
    ...(inceleme ? [`inceleme: ${inceleme}`] : []),
    ...ekstra,
    'oyunlar:',
    '  # güven: orta (oy 2/3)',
    '  # diğer: Ada Bee + Tomas Veltri 1/3',
    '  # pay: A lobs, B finishes.',
    '  - sira: 1',
    '    eylem: alley_oop',
    '    etiketler: [ poster ]',
    '    aciklama: A lobs to B for the slam.',
    '    rakip: Dario Fenn',
    '    zaman: "02:05"',
    '    katkilar:',
    '      - { oyuncu: Mirko Daval, takim: SAS, rol: pasor, pay: 70 }',
    '      - { oyuncu: Tomas Veltri, takim: SAS, rol: bitiren, pay: 30 }',
    '    kontrol:',
    '      guven: orta',
    '      oy: 2/3',
    '      alternatifler:',
    '        - "diğer: Ada Bee + Tomas Veltri 1/3"',
    '      uyarilar:',
    '        - pay oyu 2/3',
    '      model_guveni:',
    '        - yüksek',
    "        - 'pay: A lobs, B finishes.'",
    ...[2, 3, 4, 5].flatMap((n) => [
      '  # güven: yüksek (oy 3/3)',
      `  - sira: ${n}`,
      '    eylem: smac',
      `    zaman: "0${6 - n}:10"`,
      '    katkilar:',
      `      - { oyuncu: Oyuncu Numara${'x'.repeat(n)}, takim: NYK, rol: bitiren, pay: 100 }`,
      '    kontrol:',
      '      guven: yuksek',
      '      oy: 3/3',
    ]),
  ].join(LF) + LF;

export const SOZLUK_METNI = '# Oyuncu adı sözlüğü' + LF + 'Svi Mykhailiuk: [Sviatoslav Mykhailiuk]' + LF + 'Brayden Burries: [Braden Burries]' + LF;

const blobSha = async (metin: string): Promise<string> => {
  const bayt = new TextEncoder().encode(metin);
  const ust = new TextEncoder().encode(`blob ${bayt.length}\0`);
  const tum = new Uint8Array(ust.length + bayt.length);
  tum.set(ust);
  tum.set(bayt, ust.length);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-1', tum))].map((b) => b.toString(16).padStart(2, '0')).join('');
};
const b64 = (m: string) => btoa(String.fromCharCode(...new TextEncoder().encode(m)));
const json = (nesne: unknown, durum = 200) => new Response(JSON.stringify(nesne), { status: durum, headers: { 'Content-Type': 'application/json' } });

export type GitHubIstegi = { yontem: string; yol: string; yetki: string | null; govde?: { message: string; content: string; sha: string; branch: string } };

/** Sahte GitHub: bellekte dosyalar; sha = git blob sha'sı; PUT'ta sha uyuşmazsa 409. */
export function sahteGitHub(baslangic: Record<string, string>) {
  const depo = new Map(Object.entries(baslangic));
  const istekler: GitHubIstegi[] = [];
  const commitler: { mesaj: string; yol: string; metin: string; dal: string; sha: string }[] = [];
  const yanit = async (girdi: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(girdi));
    const yontem = init?.method ?? 'GET';
    const m = new RegExp(`^/repos/${DEPO.sahip}/${DEPO.ad.replace('.', '\\.')}/contents/(.+)$`).exec(url.pathname);
    const yetki = new Headers(init?.headers).get('Authorization');
    if (!m || url.hostname !== 'api.github.com') return json({ message: 'Not Found' }, 404);
    const yol = m[1]!.split('/').map(decodeURIComponent).join('/');
    const govde = init?.body ? JSON.parse(String(init.body)) : undefined;
    istekler.push({ yontem, yol, yetki, govde });
    if (yetki !== `Bearer ${TOKEN}`) return json({ message: 'Bad credentials' }, 401);
    if (yontem === 'GET') {
      if (depo.has(yol)) {
        const metin = depo.get(yol)!;
        return json({ type: 'file', path: yol, sha: await blobSha(metin), encoding: 'base64', content: b64(metin).replace(/(.{60})/g, '$1\n') });
      }
      const oge = new Map<string, { name: string; type: string; sha: string }>();
      for (const [p, metin] of depo) {
        if (!p.startsWith(`${yol}/`)) continue;
        const [ilk, ...geri] = p.slice(yol.length + 1).split('/');
        oge.set(ilk!, { name: ilk!, type: geri.length ? 'dir' : 'file', sha: geri.length ? 'agac' : await blobSha(metin) });
      }
      return oge.size ? json([...oge.values()]) : json({ message: 'Not Found' }, 404);
    }
    if (yontem === 'PUT') {
      if (!depo.has(yol)) return json({ message: 'Not Found' }, 404);
      const mevcut = await blobSha(depo.get(yol)!);
      if (govde.sha !== mevcut) return json({ message: `${yol} does not match ${mevcut}` }, 409);
      const metin = new TextDecoder().decode(Uint8Array.from(atob(govde.content), (c) => c.charCodeAt(0)));
      depo.set(yol, metin);
      commitler.push({ mesaj: govde.message, yol, metin, dal: govde.branch, sha: govde.sha });
      return json({ content: { sha: await blobSha(metin), path: yol }, commit: { message: govde.message } });
    }
    return json({ message: 'Method Not Allowed' }, 405);
  };
  return { depo, istekler, commitler, fetch: yanit as typeof fetch, sha: (yol: string) => blobSha(depo.get(yol)!) };
}

const b64url = (bayt: Uint8Array | string) => {
  const b = typeof bayt === 'string' ? new TextEncoder().encode(bayt) : bayt;
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** Sahte Access: RSA anahtar çifti, JWKS ve imzalı JWT üretimi. */
export async function sahteAccess(kid = 'anahtar-1') {
  const cift = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const jwk = { ...(await crypto.subtle.exportKey('jwk', cift.publicKey)), kid, alg: 'RS256', use: 'sig' };
  const imzala = async (yuk: Record<string, unknown>, baslik: Record<string, unknown> = {}, anahtar: CryptoKey = cift.privateKey) => {
    const ust = `${b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT', ...baslik }))}.${b64url(JSON.stringify(yuk))}`;
    const imza = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', anahtar, new TextEncoder().encode(ust)));
    return `${ust}.${b64url(imza)}`;
  };
  let certIstegi = 0;
  const certFetch = async (): Promise<Response> => {
    certIstegi++;
    return json({ keys: [jwk] });
  };
  return { jwk, kid, ozel: cift.privateKey, imzala, certFetch, certIstegiSayisi: () => certIstegi, simdi: Math.floor(Date.now() / 1000) };
}

export const gecerliYuk = (simdi: number, ek: Record<string, unknown> = {}) => ({ iss: TAKIM, aud: [AUD], email: 'goktrk@example.com', exp: simdi + 600, iat: simdi - 5, nbf: simdi - 5, ...ek });

export function ortam(ek: Partial<Env> = {}): Env {
  return { ASSETS: { fetch: async () => new Response('varlik', { headers: { 'Content-Type': 'text/css' } }) }, GITHUB_TOKEN_KONTROL: TOKEN, ACCESS_TEAM_DOMAIN: TAKIM, ACCESS_AUD: AUD, ...ek };
}

/** Access sertifika adresi ve GitHub'ı tek fetch'te birleştirir. */
export function birlesikFetch(github: { fetch: typeof fetch }, access: { certFetch: () => Promise<Response> }): Bagimlilik['fetch'] {
  return (async (girdi: RequestInfo | URL, init?: RequestInit) => {
    const adres = String(girdi);
    if (adres.startsWith(`${TAKIM}/cdn-cgi/access/certs`)) return access.certFetch();
    if (adres.startsWith('https://api.github.com/')) return github.fetch(girdi, init);
    throw new Error(`beklenmeyen dış istek: ${adres}`);
  }) as typeof fetch;
}

/** Form durumundan gönderilecek alanlar (tarayıcının göndereceği biçimde). */
export function durumdanForm(durumlar: readonly OyunDurumu[], ek: Record<string, string> = {}): URLSearchParams {
  const f = new URLSearchParams();
  for (const d of durumlar) {
    f.set(`o${d.sira}_kn`, String(d.katkilar.length));
    f.set(`o${d.sira}_eylem`, d.eylem);
    for (const e of d.etiketler) f.append(`o${d.sira}_etiket`, e);
    f.set(`o${d.sira}_rakip`, d.rakip);
    f.set(`o${d.sira}_aciklama`, d.aciklama);
    f.set(`o${d.sira}_bolusum`, d.bolusum || ESIT);
    d.katkilar.forEach((k, i) => {
      f.set(`o${d.sira}_k${i}_oyuncu`, k.oyuncu);
      f.set(`o${d.sira}_k${i}_takim`, k.takim);
      f.set(`o${d.sira}_k${i}_rol`, k.rol);
    });
  }
  for (const [k, v] of Object.entries(ek)) f.set(k, v);
  return f;
}
