// Top 10 kontrol düzenleyicisi: istek işleyici (nba-daily-top10-control.gokturkfulser.com, Cloudflare Access arkasında). Her istek önce Access JWT doğrulamasından geçer;
// GitHub'a yalnızca iki beyaz listeli yol türü (gece dosyaları, ad sözlüğü) üzerinden, sabit repo ve main dalı ile erişilir.
import { erisimDogrula } from './erisim.ts';
import { geceOku, durumlariDogrula, formdanDurumlar, oyundanDurum, type OyunGirdisi } from './form.ts';
import { geceyiYenidenYaz } from './gece-yaml.ts';
import { CakismaHatasi, GitHub, GitHubHatasi } from './github.ts';
import { gelistirmeModu, type Bagimlilik, type Env } from './ortam.ts';
import { geceSayfasi, hataSayfasi, listeSayfasi, sozlukSayfasi } from './sayfalar.ts';
import { sozlukHaritasiOlustur, sozlukOku, takmaAdEkle } from './sozluk.ts';
import { geceYolu, SOZLUK_YOLU, TOP10_DIZINI, YolHatasi } from './yollar.ts';
import type { KontrolGirdisi } from '../../site/src/lib/top10-kontrol.ts';
import type { Oyun } from '../../site/src/lib/top10.ts';

/** Liste sayfasında okunan en yeni gece sayısı (her gece ayrı bir GitHub isteği; Workers alt istek sınırına karşı). */
export const LISTE_SINIRI = 40;
const PARALEL = 8;

const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'none'; form-action 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'";

function guvenli(yanit: Response): Response {
  const k = new Response(yanit.body, yanit);
  k.headers.set('Content-Security-Policy', CSP);
  k.headers.set('Cache-Control', 'no-store');
  k.headers.set('X-Content-Type-Options', 'nosniff');
  // 'no-referrer' olsaydı tarayıcı same-origin POST'larda `Origin: null` gönderir ve CSRF denetimi (ayniKaynak) gerçek istekleri de reddederdi.
  k.headers.set('Referrer-Policy', 'same-origin');
  k.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return k;
}
const html = (govde: string, durum = 200) => guvenli(new Response(govde, { status: durum, headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
const yonlendir = (adres: string) => guvenli(new Response(null, { status: 303, headers: { Location: adres } }));

function githubIstemci(env: Env, dep: Bagimlilik, adres: string): GitHub | null {
  if (!env.GITHUB_TOKEN_KONTROL) return null;
  // Sahte GitHub adresi yalnızca yerel geliştirme bayrağıyla: token başka bir adrese gönderilemez.
  const taban = gelistirmeModu(env, adres) && env.GITHUB_API_TABANI ? env.GITHUB_API_TABANI : undefined;
  return new GitHub(env.GITHUB_TOKEN_KONTROL, dep.fetch, taban);
}

/** İstek aynı kaynaktan mı geliyor? (Access çerezi kimlik doğrular; tarayıcıdan çapraz site POST'u engellenir.) */
function ayniKaynak(istek: Request): boolean {
  const origin = istek.headers.get('Origin');
  if (origin) return origin === new URL(istek.url).origin;
  const site = istek.headers.get('Sec-Fetch-Site');
  return site === 'same-origin' || site === 'none';
}

async function paralelOku(yollar: string[], gh: GitHub): Promise<{ yol: string; sonuc: Awaited<ReturnType<GitHub['oku']>> | Error }[]> {
  const cikti: { yol: string; sonuc: Awaited<ReturnType<GitHub['oku']>> | Error }[] = new Array(yollar.length);
  let sira = 0;
  await Promise.all(
    Array.from({ length: Math.min(PARALEL, yollar.length) }, async () => {
      while (sira < yollar.length) {
        const i = sira++;
        cikti[i] = await gh.oku(yollar[i]!).then((sonuc) => ({ yol: yollar[i]!, sonuc }), (e: Error) => ({ yol: yollar[i]!, sonuc: e }));
      }
    }),
  );
  return cikti;
}

async function listeIstegi(gh: GitHub): Promise<Response> {
  const sezonlar = (await gh.listele(TOP10_DIZINI)).filter((o) => o.tur === 'dir' && /^\d{4}-\d{2}$/.test(o.ad)).map((o) => o.ad).sort().reverse();
  const dosyalar: { id: string; yol: string }[] = [];
  for (const s of sezonlar.slice(0, 2)) {
    for (const o of await gh.listele(`${TOP10_DIZINI}/${s}`)) {
      const m = /^(\d{4}-\d{2}-\d{2})\.yaml$/.exec(o.ad);
      if (o.tur === 'file' && m) dosyalar.push({ id: `${s}/${m[1]}`, yol: `${TOP10_DIZINI}/${s}/${o.ad}` });
    }
  }
  dosyalar.sort((a, b) => b.id.localeCompare(a.id));
  const secilen = dosyalar.slice(0, LISTE_SINIRI);
  const girdiler: KontrolGirdisi[] = [];
  const okunamayan: string[] = [];
  for (const { yol, sonuc } of await paralelOku(secilen.map((d) => d.yol), gh)) {
    const id = secilen.find((d) => d.yol === yol)!.id;
    if (sonuc instanceof Error || sonuc === null) {
      okunamayan.push(`${id}: ${sonuc instanceof Error ? sonuc.message : 'dosya bulunamadı'}`);
      continue;
    }
    const g = geceOku(sonuc.metin);
    if (g.tamam) girdiler.push({ id, gece: g.gece as unknown as KontrolGirdisi['gece'] });
    else okunamayan.push(`${id}: ${g.hata}`);
  }
  return html(listeSayfasi(girdiler, okunamayan, dosyalar.length > secilen.length));
}

/** Şemadan geçmiş oyun → dosyaya yazılacak girdi (değişiklik yapılmadan; onaylama için). */
const oyundanGirdi = (o: Oyun): OyunGirdisi => ({
  sira: o.sira,
  ...(o.eylem ? { eylem: o.eylem } : {}),
  ...(o.etiketler?.length ? { etiketler: [...o.etiketler] } : {}),
  ...(o.aciklama ? { aciklama: o.aciklama } : {}),
  ...(o.rakip ? { rakip: o.rakip } : {}),
  katkilar: o.katkilar.map((k) => ({ oyuncu: k.oyuncu, takim: k.takim, rol: k.rol, ...(k.pay !== undefined ? { pay: k.pay } : {}) })),
});

const donus = (tarih: string, ok: string) => `/gece/${tarih}?ok=${ok}`;

async function geceGet(tarih: string, url: URL, gh: GitHub): Promise<Response> {
  const dosya = await gh.oku(geceYolu(tarih));
  if (!dosya) return html(hataSayfasi('Gece bulunamadı', `${tarih} için gece dosyası yok.`, { href: '/', ad: 'Geceler' }), 404);
  const g = geceOku(dosya.metin);
  if (!g.tamam) return html(hataSayfasi('Gece okunamadı', g.hata, { href: '/', ad: 'Geceler' }), 422);
  const sozluk = sozlukOku((await gh.oku(SOZLUK_YOLU))?.metin ?? null);
  const adlar = [...new Set([...Object.keys(sozluk), ...g.gece.oyunlar.flatMap((o) => [...o.katkilar.map((k) => k.oyuncu), ...(o.rakip ? [o.rakip] : [])])])].sort((a, b) => a.localeCompare(b, 'tr'));
  const id = `${geceYolu(tarih).split('/').slice(-2).join('/').replace(/\.yaml$/, '')}`;
  return html(geceSayfasi({ id, gece: g.gece as never, sha: dosya.sha, durumlar: g.gece.oyunlar.map((o) => oyundanDurum(o as never)), adlar, ok: url.searchParams.get('ok') }));
}

async function gecePost(tarih: string, istek: Request, gh: GitHub): Promise<Response> {
  const yol = geceYolu(tarih);
  const form = await istek.formData();
  const islem = String(form.get('islem') ?? '');
  if (!['kaydet', 'kaydet-onayla', 'onayla'].includes(islem)) return html(hataSayfasi('Geçersiz istek', 'Bilinmeyen işlem.'), 400);
  const gonderilenSha = String(form.get('sha') ?? '');
  const mevcut = await gh.oku(yol);
  if (!mevcut) return html(hataSayfasi('Gece bulunamadı', `${tarih} için gece dosyası yok.`, { href: '/', ad: 'Geceler' }), 404);
  const cakisma = () => html(hataSayfasi('Dosya değişti, yeniden yükleyin', 'Bu gece dosyası siz düzenlerken başka biri ya da bot tarafından değiştirildi. Hiçbir şey kaydedilmedi; sayfayı yeniden yükleyip değişikliklerinizi tekrar yapın.', { href: `/gece/${tarih}`, ad: 'Yeniden yükle' }), 409);
  if (!gonderilenSha || gonderilenSha !== mevcut.sha) return cakisma();
  const g = geceOku(mevcut.metin);
  if (!g.tamam) return html(hataSayfasi('Gece okunamadı', g.hata, { href: '/', ad: 'Geceler' }), 422);
  const id = yol.split('/').slice(-2).join('/').replace(/\.yaml$/, '');

  let oyunlar: OyunGirdisi[];
  if (islem === 'onayla') {
    oyunlar = g.gece.oyunlar.map((o) => oyundanGirdi(o as never));
  } else {
    const sozluk = await gh.oku(SOZLUK_YOLU);
    const durumlar = formdanDurumlar(form, g.gece.oyunlar.map((o) => o.sira));
    const sonuc = durumlariDogrula(g.ham, durumlar, sozlukHaritasiOlustur(sozluk?.metin ?? null));
    if (!sonuc.tamam) {
      const adlar = [...new Set([...Object.keys(sozlukOku(sozluk?.metin ?? null)), ...durumlar.flatMap((d) => d.katkilar.map((k) => k.oyuncu))])].filter(Boolean);
      return html(geceSayfasi({ id, gece: g.gece as never, sha: mevcut.sha, durumlar, oyunHatalari: sonuc.oyun, genelHatalar: sonuc.genel, adlar }), 422);
    }
    oyunlar = sonuc.oyunlar;
  }
  const onay = islem !== 'kaydet';
  let yeni: string;
  try {
    yeni = geceyiYenidenYaz(mevcut.metin, oyunlar, onay ? { inceleme: 'onaylandi' } : {});
  } catch (e) {
    return html(hataSayfasi('Kaydedilemedi', `Dosya yazım doğrulaması başarısız (commit atılmadı): ${(e as Error).message}`, { href: `/gece/${tarih}`, ad: 'Geri dön' }), 500);
  }
  if (yeni === mevcut.metin) return yonlendir(donus(tarih, 'degisiklik-yok'));
  try {
    await gh.yaz(yol, yeni, mevcut.sha, onay ? `top10: onay ${tarih}` : `top10: elle düzenleme ${tarih}`);
  } catch (e) {
    if (e instanceof CakismaHatasi) return cakisma();
    throw e;
  }
  return yonlendir(donus(tarih, onay ? 'onaylandi' : 'kaydedildi'));
}

async function sozlukGet(url: URL, gh: GitHub): Promise<Response> {
  const dosya = await gh.oku(SOZLUK_YOLU);
  if (!dosya) return html(hataSayfasi('Sözlük bulunamadı', 'oyuncu-adlari.yaml repoda yok.'), 404);
  return html(sozlukSayfasi({ sozluk: sozlukOku(dosya.metin), sha: dosya.sha, ok: url.searchParams.get('ok') }));
}

async function sozlukPost(istek: Request, gh: GitHub): Promise<Response> {
  const form = await istek.formData();
  const kanonik = String(form.get('kanonik') ?? '');
  const takma = String(form.get('takma') ?? '');
  const gonderilenSha = String(form.get('sha') ?? '');
  const mevcut = await gh.oku(SOZLUK_YOLU);
  if (!mevcut) return html(hataSayfasi('Sözlük bulunamadı', 'oyuncu-adlari.yaml repoda yok.'), 404);
  const cakisma = () => html(hataSayfasi('Dosya değişti, yeniden yükleyin', 'Ad sözlüğü siz düzenlerken değişti. Hiçbir şey kaydedilmedi.', { href: '/sozluk', ad: 'Yeniden yükle' }), 409);
  if (!gonderilenSha || gonderilenSha !== mevcut.sha) return cakisma();
  const s = takmaAdEkle(mevcut.metin, kanonik, takma);
  if ('hata' in s) return html(sozlukSayfasi({ sozluk: sozlukOku(mevcut.metin), sha: mevcut.sha, hata: s.hata, kanonik, takma }), 422);
  try {
    await gh.yaz(SOZLUK_YOLU, s.metin, mevcut.sha, 'top10: ad sözlüğü');
  } catch (e) {
    if (e instanceof CakismaHatasi) return cakisma();
    throw e;
  }
  return yonlendir('/sozluk?ok=eklendi');
}

export async function isle(istek: Request, env: Env, dep: Bagimlilik): Promise<Response> {
  // 1) Kimlik: her istek (statik varlıklar dahil, run_worker_first) önce Access JWT doğrulamasından geçer.
  const erisim = await erisimDogrula(istek, env, dep);
  if (!erisim.tamam) return guvenli(new Response('Erişim reddedildi', { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
  const url = new URL(istek.url);
  const yontem = istek.method.toUpperCase();
  if (yontem === 'POST' && !ayniKaynak(istek)) return guvenli(new Response('Erişim reddedildi', { status: 403 }));
  if (yontem !== 'GET' && yontem !== 'HEAD' && yontem !== 'POST') return guvenli(new Response('Yöntem desteklenmiyor', { status: 405 }));

  if (url.pathname === '/favicon.ico') return guvenli(new Response(null, { status: 204 }));
  // 2) Statik varlıklar
  if (yontem !== 'POST' && (url.pathname === '/stil.css' || url.pathname === '/uygulama.js' || url.pathname.startsWith('/fonts/'))) return guvenli(await env.ASSETS.fetch(istek));

  // 3) Sayfalar
  const gh = githubIstemci(env, dep, istek.url);
  if (!gh) return html(hataSayfasi('Yapılandırma eksik', 'GITHUB_TOKEN_KONTROL secret\'ı tanımlı değil (kontrol/DEPLOY.md).'), 500);
  try {
    const gece = /^\/gece\/(\d{4}-\d{2}-\d{2})\/?$/.exec(url.pathname);
    if (url.pathname === '/' && yontem !== 'POST') return await listeIstegi(gh);
    if (gece) return yontem === 'POST' ? await gecePost(gece[1]!, istek, gh) : await geceGet(gece[1]!, url, gh);
    if (url.pathname === '/sozluk') return yontem === 'POST' ? await sozlukPost(istek, gh) : await sozlukGet(url, gh);
    return html(hataSayfasi('Sayfa bulunamadı', 'Bu adres yok.', { href: '/', ad: 'Geceler' }), 404);
  } catch (e) {
    if (e instanceof YolHatasi) return html(hataSayfasi('Geçersiz yol', 'İstenen yol izinli değil.'), 400);
    if (e instanceof GitHubHatasi) return html(hataSayfasi('GitHub hatası', e.message), e.durum === 404 ? 404 : 502);
    // Hata ayrıntısı (olası iç bilgi) yanıta yazılmaz.
    return html(hataSayfasi('Beklenmeyen hata', 'İstek işlenemedi.'), 500);
  }
}
