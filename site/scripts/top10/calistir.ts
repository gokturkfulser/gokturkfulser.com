// scripts/top10 giriş noktası: yeni "Top 10/5 Plays of the Night" videolarını bulur, Gemini ile gece dosyasını üretir, site şemasıyla
// doğrular ve site/src/content/top10/<sezon>/<tarih>.yaml olarak yazar. Commit/push bu betiğin işi değildir (workflow yapar).
//
//   pnpm site:top10 2026-11-01 https://www.youtube.com/watch?v=ID       tek gece (konumsal: tarih, url)
//   pnpm --filter site top10 --otomatik                                  son 3 ABD gecesi (workflow bunu kullanır)
//   pnpm --filter site top10 --tarih 2026-11-01 [--url ...] [--uzerine-yaz] [--zorla]
//   pnpm --filter site top10 --dosya liste.txt                           her satır "YYYY-AA-GG url" (# yorum)
//   pnpm --filter site top10 --otomatik --baslangic 2026-10-20 [--bitis 2026-10-31]   geçmiş geceleri toplu doldurma (en çok 31 gün; bitiş varsayılan dün, ABD saati)
//   ... --oylama N              aynı video N kez bağımsız işlenir, satır satır çoğunluk oylaması (varsayılan 3; 1 = oylamasız)
//   ... --kuru                  dosyaya yazmaz; terminale ve git'e girmeyen scripts/top10/cikti/ klasörüne JSON
//   ... --ortamdan              workflow_dispatch girdilerini (GIRDI_TARIH, GIRDI_URL, GIRDI_UZERINE_YAZ) bayraklara çevirir
//
// Uydurma koruması: Gemini'ye gitmeden önce adres biçimi doğrulanır; videonun meta verisi (başlık, süre, açıklama, gizlilik) YouTube Data API'den
// zorunlu alınır; her çalıştırmanın çıktısı videoyla tutarlılık için denetlenir (gece.ts → dogrula); satırlar çoğunluk oylamasıyla birleştirilir
// (oylama.ts) ve güven oylamadan türetilir.
// Ortam: YOUTUBE_API_KEY (zorunlu), GEMINI_API_KEY (üretim gerektiğinde), GEMINI_MODEL, GEMINI_COZUNURLUK (isteğe bağlı; varsayılan high),
// GITHUB_STEP_SUMMARY (varsa özet yazılır).
// Çıkış kodu: 0 = tamam ("henüz video yok" dahil); 1 = bulunan videolardan hiçbiri işlenemedi ya da API hatası; 2 = kullanım/ortam hatası.
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as yamlOku } from 'yaml';
import { top10Sema } from '../../src/lib/top10-sema.ts';
import type { Gece } from '../../src/lib/top10.ts';
import { adlariUygula, sozlukHaritasi, sozlukHatasi, type AdHaritasi, type AdSozlugu } from '../../src/lib/top10-adlar.ts';
import { EN_COK_ARALIK_GUN, EN_COK_OYLAMA, PENCERE_GUN, PENCERE_SAAT_DILIMI, tokenSiniri, VARSAYILAN_MODEL, VARSAYILAN_OYLAMA, YOUTUBE_API_TABANI, type Cozunurluk } from './ayarlar.ts';
import { baslikCoz } from './baslik.ts';
import { dogrula, hamAdlariniUygula, sezonKlasoru, yamlDogrula, type OyunNotu, type Uretilen } from './gece.ts';
import { cozunurlukCoz, geceUret, istemHazirla, istemOku, ISTEM_DOSYASI, type Kullanim } from './gemini.ts';
import { oylamaSonrasi } from './oylama.ts';
import { aralikTarihleri, karar, pencereTarihleri, planla, type Mevcut, type Plan } from './otomatik.ts';
import { aralikOzeti, ozetMarkdown, toplamSatiri, tokenRaporu, type GeceSonucu, type TokenCagrisi } from './ozet.ts';
import { aralikVideolari, sonVideolar, videoAdresi, videoKimligi, videoMeta, type FetchFn, type VideoMeta } from './youtube.ts';

const burasi = dirname(fileURLToPath(import.meta.url));
export const ICERIK_KLASORU = resolve(burasi, '../../src/content/top10');
/** --kuru çıktıları; .gitignore'dadır, repoya girmez. */
export const CIKTI_KLASORU = resolve(burasi, 'cikti');

export type Bagimliliklar = {
  env: Record<string, string | undefined>;
  fetchFn: FetchFn;
  simdi: () => Date;
  icerikKlasoru: string;
  yaz: (satir: string) => void;
  /** Verilirse özet Markdown bu dosyaya eklenir (GITHUB_STEP_SUMMARY). */
  ozetDosyasi?: string;
  /** İstem dosyası (varsayılan scripts/top10/istem.md); her çalıştırmada okunur. */
  istemDosyasi?: URL | string;
  /** --kuru JSON çıktıları (varsayılan scripts/top10/cikti). */
  ciktiKlasoru?: string;
  /** Liste dosyası (--dosya) okuyucusu; testte değiştirilebilir. */
  dosyaOku?: (yol: string) => string;
};

type Secenekler = { otomatik: boolean; tarih?: string; url?: string; dosya?: string; uzerineYaz: boolean; kuru: boolean; oylama: number; zorla: boolean; baslangic?: string; bitis?: string };

class KullanimHatasi extends Error {}

/** workflow_dispatch girdileri → betik bayrakları. Girdi yoksa --otomatik; tarih/url varsa tek gece; `uzerine_yaz` işaretliyse --uzerine-yaz. */
export function dispatchArgumanlari(env: Record<string, string | undefined>): string[] {
  const tarih = env.GIRDI_TARIH?.trim();
  const url = env.GIRDI_URL?.trim();
  if (!tarih && !url) return ['--otomatik'];
  const a: string[] = [];
  if (tarih) a.push('--tarih', tarih);
  if (url) a.push('--url', url);
  if (env.GIRDI_UZERINE_YAZ?.trim() === 'true') a.push('--uzerine-yaz');
  return a;
}

const TARIH_KALIBI = /^\d{4}-\d{2}-\d{2}$/;
const ADRES_BICIMLERI = 'youtube.com/watch?v=<11 karakterlik kimlik>, youtu.be/<kimlik> ya da youtube.com/shorts/<kimlik>';

/** Geçerli bir YouTube video adresi mi? (yer tutucu "...", kısa/uzun kimlik, başka site → hayır). Değilse açıklayıcı hata. */
export function adresDogrula(url: string): string {
  const id = videoKimligi(url);
  if (!id) throw new KullanimHatasi(`Geçersiz YouTube adresi: "${url}". Kabul edilen biçimler: ${ADRES_BICIMLERI} (kimlik [A-Za-z0-9_-]{11}).`);
  return id;
}

export function argumanlar(argv: readonly string[]): Secenekler {
  const s: Secenekler = { otomatik: false, uzerineYaz: false, kuru: false, oylama: VARSAYILAN_OYLAMA, zorla: false };
  for (let i = 0; i < argv.length; i++) {
    const ham = argv[i] ?? '';
    // `--bayrak=değer` biçimi yalnızca bayraklarda ayrılır (url içindeki `=` bozulmasın).
    const [ad, deger] = (ham.startsWith('--') ? ham.split('=', 2) : [ham, undefined]) as [string, string | undefined];
    const sonraki = () => deger ?? argv[++i];
    if (ad === '--otomatik') s.otomatik = true;
    else if (ad === '--uzerine-yaz') s.uzerineYaz = true;
    else if (ad === '--kuru') s.kuru = true;
    else if (ad === '--zorla') s.zorla = true;
    else if (ad === '--tarih') s.tarih = sonraki();
    else if (ad === '--url') s.url = sonraki();
    else if (ad === '--dosya') s.dosya = sonraki();
    else if (ad === '--oylama') s.oylama = Number(sonraki());
    else if (ad === '--baslangic') s.baslangic = sonraki();
    else if (ad === '--bitis') s.bitis = sonraki();
    else if (ad === '--tekrar') throw new KullanimHatasi('--tekrar kaldırıldı: --oylama N aynı videoyu N kez işler ve satır satır oylar; farklı çıkan satırlar oy oranı ve alternatifleriyle gösterilir.');
    else if (!ad.startsWith('--') && TARIH_KALIBI.test(ad)) s.tarih = ad; // konumsal: tarih
    else if (!ad.startsWith('--') && /^https?:\/\//i.test(ad)) s.url = ad; // konumsal: url (geçerliliği aşağıda denetlenir)
    else throw new KullanimHatasi(`Bilinmeyen argüman: ${ad}`);
  }
  if (s.otomatik && (s.tarih || s.url || s.dosya)) throw new KullanimHatasi('--otomatik ile --tarih/--url/--dosya birlikte kullanılmaz.');
  if (s.otomatik && s.uzerineYaz) throw new KullanimHatasi('--uzerine-yaz yalnızca tek gece (--tarih/--url) ya da liste (--dosya) modunda, elle kullanılır.');
  if (s.otomatik && s.zorla) throw new KullanimHatasi('--zorla otomatik modda kullanılamaz.');
  if (s.dosya && (s.tarih || s.url)) throw new KullanimHatasi('--dosya ile --tarih/--url birlikte kullanılmaz.');
  if ((s.baslangic || s.bitis) && !s.otomatik) throw new KullanimHatasi('--baslangic/--bitis yalnızca --otomatik ile kullanılır.');
  if (s.bitis && !s.baslangic) throw new KullanimHatasi('--bitis için --baslangic de verilmeli.');
  for (const [ad, t] of [['--baslangic', s.baslangic], ['--bitis', s.bitis]] as const) if (t !== undefined && !TARIH_KALIBI.test(t)) throw new KullanimHatasi(`${ad} YYYY-AA-GG olmalı: ${t}`);
  if (!Number.isInteger(s.oylama) || s.oylama < 1 || s.oylama > EN_COK_OYLAMA) throw new KullanimHatasi(`--oylama 1 ile ${EN_COK_OYLAMA} arasında bir tam sayı olmalı (varsayılan ${VARSAYILAN_OYLAMA}).`);
  if (!s.otomatik && !s.tarih && !s.url && !s.dosya) throw new KullanimHatasi('Kullanım: --otomatik | <YYYY-AA-GG> <url> | --tarih YYYY-AA-GG [--url ...] [--uzerine-yaz] [--zorla] | --dosya liste.txt  (+ --oylama N, --kuru)');
  if (s.tarih && !TARIH_KALIBI.test(s.tarih)) throw new KullanimHatasi(`--tarih YYYY-AA-GG olmalı: ${s.tarih}`);
  if (s.url) adresDogrula(s.url); // Gemini'ye (ve hiçbir API'ye) gitmeden çıkış 2
  return s;
}

/** Liste dosyası: her satır "YYYY-AA-GG url"; boş satırlar ve # yorumları atlanır (satır sonu # yorumu da). */
export function listeAyristir(metin: string): { tarih: string; url: string }[] {
  const girdiler: { tarih: string; url: string }[] = [];
  metin.split(/\r?\n/).forEach((ham, i) => {
    const satir = ham.replace(/(^|\s)#.*$/, '').trim();
    if (!satir) return;
    const [tarih, url, fazla] = satir.split(/\s+/);
    if (!tarih || !url || fazla !== undefined || !TARIH_KALIBI.test(tarih) || !videoKimligi(url)) {
      throw new KullanimHatasi(`Liste dosyası ${i + 1}. satır geçersiz (beklenen: "YYYY-AA-GG youtube-adresi"; adres biçimi: ${ADRES_BICIMLERI}): ${ham.trim()}`);
    }
    girdiler.push({ tarih, url });
  });
  if (girdiler.length === 0) throw new KullanimHatasi('Liste dosyasında hiç gece yok.');
  return girdiler;
}

const yol = (klasor: string, tarih: string) => join(klasor, sezonKlasoru(tarih), `${tarih}.yaml`);

/** Dosyanın mevcut durumu: kaynak/inceleme alanları (yoksa varsayılanlar karar() içinde uygulanır). */
export function mevcutOku(klasor: string, tarih: string): Mevcut {
  const dosya = yol(klasor, tarih);
  if (!existsSync(dosya)) return { dosyaVar: false };
  try {
    const veri = yamlOku(readFileSync(dosya, 'utf8')) as Record<string, unknown> | null;
    const kaynak = veri?.kaynak === 'gemini' ? 'gemini' : 'elle';
    const inceleme = veri?.inceleme === 'onaylandi' ? 'onaylandi' : veri?.inceleme === 'bekliyor' ? 'bekliyor' : undefined;
    return { dosyaVar: true, kaynak, inceleme };
  } catch {
    return { dosyaVar: true, okunamadi: true };
  }
}

/** Mevcut top10 verisi (ad benzerliği karşılaştırması için): şemadan geçenler, `taslak: true` olmayanlar, `haric` tarihi hariç. */
export function mevcutGeceleriOku(klasor: string, haric: string): Gece[] {
  const geceler: Gece[] = [];
  if (!existsSync(klasor)) return geceler;
  for (const sezon of readdirSync(klasor, { withFileTypes: true })) {
    if (!sezon.isDirectory()) continue;
    for (const dosya of readdirSync(join(klasor, sezon.name))) {
      if (!dosya.endsWith('.yaml') || dosya === `${haric}.yaml`) continue;
      try {
        const sonuc = top10Sema.safeParse(yamlOku(readFileSync(join(klasor, sezon.name, dosya), 'utf8')));
        if (sonuc.success && !sonuc.data.taslak) geceler.push(sonuc.data as unknown as Gece);
      } catch {
        /* okunamayan dosya karşılaştırmaya girmez */
      }
    }
  }
  return geceler;
}

/** Oyuncu adı sözlüğü (src/content/top10/oyuncu-adlari.yaml: kanonik ad → takma adlar). Betik sözlüğü yalnızca OKUR; değiştirmez. Dosya yoksa boş; geçersizse (çakışma) hata. */
export function sozlukOku(klasor: string): { harita: AdHaritasi; kanonikAdlar: string[]; tumAdlar: string[] } {
  const dosya = join(klasor, 'oyuncu-adlari.yaml');
  if (!existsSync(dosya)) return { harita: new Map(), kanonikAdlar: [], tumAdlar: [] };
  const veri = (yamlOku(readFileSync(dosya, 'utf8')) ?? {}) as Record<string, unknown>;
  const sozluk: Record<string, string[]> = {};
  for (const [kanonik, takmalar] of Object.entries(veri)) sozluk[kanonik] = Array.isArray(takmalar) ? takmalar.map(String) : [];
  const hata = sozlukHatasi(sozluk as AdSozlugu);
  if (hata) throw new KullanimHatasi(`oyuncu-adlari.yaml geçersiz: ${hata}`);
  return { harita: sozlukHaritasi(sozluk), kanonikAdlar: Object.keys(sozluk), tumAdlar: Object.entries(sozluk).flatMap(([k, t]) => [k, ...t]) };
}

/** Terminal için güven satırı. Oylamada: "[güven: orta (oy 2/3; diğer: A + B 1/3)]"; oylamasızda: "[güven: orta: gerekçe]". */
export function guvenMetni(n: OyunNotu): string {
  const ad = n.guven === 'high' ? 'yüksek' : n.guven === 'medium' ? 'orta' : 'düşük';
  if (!n.oy) return `[güven: ${ad}${n.guvenNedeni ? `: ${n.guvenNedeni}` : ''}]`;
  const ayrinti = [`oy ${n.oy.oran}${n.oy.uzlasmaYok ? ', uzlaşma yok' : ''}`, ...(n.oy.seviye === 'yuksek' ? [] : [`eylem ${n.oy.eylemOran}`, `pay ${n.oy.payOran}`, ...n.oy.alternatifler])];
  const model = (n.modelGuvenleri ?? []).filter((m) => m.guven !== 'high' && m.neden).map((m) => m.neden);
  return `[güven: ${ad} (${ayrinti.join('; ')})${model.length ? `; model: ${model.join(' | ')}` : ''}]`;
}

export async function calistir(argv: readonly string[], bag: Bagimliliklar): Promise<{ kod: number; sonuclar: GeceSonucu[]; ozet: string }> {
  const model = bag.env.GEMINI_MODEL?.trim() || VARSAYILAN_MODEL;
  let sonuclar: GeceSonucu[] = [];
  const toplam: { sureSn?: number; islenenSn?: number; cagriSayisi?: number; kullanim?: Kullanim } = {};
  const cagrilar: TokenCagrisi[] = [];
  const modelSurumleri = new Set<string>();
  /** YouTube Data API istekleri (her list çağrısı 1 kota birimi: playlistItems.list, videos.list, channels.list). */
  const sayac = { istek: 0, sayfa: 0 };
  const yt: FetchFn = (girdi, init) => {
    const u = String(girdi);
    if (u.startsWith(YOUTUBE_API_TABANI)) {
      sayac.istek += 1;
      if (u.includes('/playlistItems')) sayac.sayfa += 1;
    }
    return bag.fetchFn(girdi, init);
  };
  let aralikModu = false;
  let taramaNotu = '';
  let cozunurluk: Cozunurluk = 'high';
  let oylamaSayisi: number | undefined;
  const kullanimEkle = (k?: Kullanim) => {
    if (!k) return;
    const t = (toplam.kullanim ??= {});
    for (const alan of ['girdi', 'cikti', 'dusunme', 'toplam'] as const) if (k[alan] !== undefined) t[alan] = (t[alan] ?? 0) + k[alan]!;
  };
  let mod = '';
  const bitir = (kod: number) => {
    const kotaSatiri = sayac.istek > 0 ? `YouTube API: ${sayac.istek} istek ≈ ${sayac.istek} kota birimi (list çağrısı başına 1); oynatma listesi sayfası: ${sayac.sayfa}${taramaNotu ? `; ${taramaNotu}` : ''}` : '';
    if (sonuclar.length) {
      bag.yaz(toplamSatiri(toplam));
      if (kotaSatiri) bag.yaz(kotaSatiri);
      if (aralikModu) for (const l of aralikOzeti(sonuclar)) bag.yaz(l);
      if (cagrilar.length) {
        const r = tokenRaporu(cagrilar);
        bag.yaz('Token kullanımı (çağrı başına):');
        for (const x of r.satirlar) bag.yaz(`  ${x}`);
        bag.yaz(`  ${r.kategoriler}`);
        for (const u of r.uyarilar) bag.yaz(`::warning::token: ${u}`);
      }
    }
    const ozet = ozetMarkdown(sonuclar, { model, mod, cozunurluk, oylama: oylamaSayisi, modelSurumleri: [...modelSurumleri], ...toplam, cagrilar, kotaSatiri, aralik: aralikModu });
    if (bag.ozetDosyasi && sonuclar.length) appendFileSync(bag.ozetDosyasi, `${ozet}\n`);
    return { kod, sonuclar, ozet };
  };
  let secenek: Secenekler;
  try {
    const girdi = argv.includes('--ortamdan') ? [...argv.filter((a) => a !== '--ortamdan'), ...dispatchArgumanlari(bag.env)] : argv;
    secenek = argumanlar(girdi);
    if (!bag.env.YOUTUBE_API_KEY) throw new KullanimHatasi('YOUTUBE_API_KEY tanımlı değil (site/.env ya da GitHub secret).');
    try {
      cozunurluk = cozunurlukCoz(bag.env.GEMINI_COZUNURLUK);
    } catch (hata) {
      throw new KullanimHatasi((hata as Error).message);
    }
  } catch (hata) {
    bag.yaz(`HATA: ${(hata as Error).message}`);
    return { kod: 2, sonuclar, ozet: '' };
  }
  oylamaSayisi = secenek.oylama;
  mod = secenek.otomatik ? 'otomatik' : secenek.dosya ? 'liste' : 'tek gece';
  if (secenek.kuru) mod += ' (kuru: dosya yazılmaz)';
  bag.yaz(`Model: ${model}; video çözünürlüğü: ${cozunurluk}; oylama: ${secenek.oylama}`);
  const youtubeAnahtari = bag.env.YOUTUBE_API_KEY!;
  const simdi = bag.simdi();
  /** Video meta verisi (YouTube Data API); `null` = videos.list video döndürmedi (bulunamadı/silinmiş). */
  const metalar = new Map<string, VideoMeta | null>();
  /** Etkin çözünürlük: API `resolution` alanını reddederse "unspecified"a düşer (bir kez uyarılır). */
  let etkinCozunurluk: Cozunurluk = cozunurluk;

  try {
    const { harita: adHaritasi, kanonikAdlar, tumAdlar } = sozlukOku(bag.icerikKlasoru);
    /** Çevrilen takım kodları için bilgi satırı çalıştırma başına bir kez basılır. */
    const takimBilgileri = new Set<string>();
    // 1) Planı kur: hangi geceler, hangi videolar, hangi karar
    let plan: Plan[];
    const hedefOlustur = async (tarih: string | undefined, url: string): Promise<{ tarih: string; plan: Plan }> => {
      const id = adresDogrula(url);
      const meta = (await videoMeta(yt, youtubeAnahtari, [id])).get(id) ?? null;
      metalar.set(id, meta);
      const cozulen = meta ? baslikCoz(meta.baslik) : undefined;
      const t = tarih ?? cozulen?.tarih;
      if (!t) throw new Error(meta ? `Başlıktan tarih çıkarılamadı ("${meta.baslik}"); --tarih verin.` : `Video bulunamadı (${id}); tarih de verilmediği için gece belirlenemedi.`);
      const video = { id, baslik: meta?.baslik ?? '', yayin: '' };
      return { tarih: t, plan: { tarih: t, karar: karar(mevcutOku(bag.icerikKlasoru, t), true, secenek.uzerineYaz), video: { video, tur: cozulen?.tur ?? 'top10' } } };
    };
    if (secenek.otomatik && secenek.baslangic) {
      // Geçmiş gece doldurma: aralık (en çok 31 gün); oynatma listesi en eski tarihin videosu bulunana ya da başlık tarihi aralığın gerisine düşene kadar sayfalanır.
      const aralik = aralikTarihleri(secenek.baslangic, secenek.bitis, simdi, PENCERE_SAAT_DILIMI, EN_COK_ARALIK_GUN);
      if ('hata' in aralik) throw new KullanimHatasi(aralik.hata);
      const tarihler = aralik.tarihler;
      aralikModu = true;
      mod = `otomatik, geçmiş doldurma ${tarihler[0]} .. ${tarihler.at(-1)} (${tarihler.length} gün)`;
      bag.yaz(`Aralık: ${tarihler[0]} .. ${tarihler.at(-1)} (${tarihler.length} gün)`);
      const tarama = await aralikVideolari({ anahtar: youtubeAnahtari, fetchFn: yt, baslangic: tarihler[0]! });
      taramaNotu = `${tarama.sayfaSayisi} sayfa okundu, durma nedeni: ${tarama.neden}`;
      bag.yaz(`Oynatma listesi: ${tarama.sayfaSayisi} sayfa (sayfa başına en çok 50 video), ${tarama.videolar.length} video; durma nedeni: ${tarama.neden}`);
      plan = planla({ tarihler, videolar: tarama.videolar, mevcutOku: (t) => mevcutOku(bag.icerikKlasoru, t) });
    } else if (secenek.otomatik) {
      const tarihler = pencereTarihleri(simdi, PENCERE_GUN, PENCERE_SAAT_DILIMI);
      // Gece D'nin videosu D'nin UTC gününden sonra yüklenir; bir gün payla en eski gecenin başından itibaren okunur.
      const kadar = new Date(Date.parse(`${tarihler[0]}T00:00:00Z`) - 24 * 60 * 60 * 1000);
      const videolar = await sonVideolar({ anahtar: youtubeAnahtari, fetchFn: yt, kadar });
      plan = planla({ tarihler, videolar, mevcutOku: (t) => mevcutOku(bag.icerikKlasoru, t) });
    } else if (secenek.dosya) {
      const girdiler = listeAyristir((bag.dosyaOku ?? ((y) => readFileSync(y, 'utf8')))(secenek.dosya));
      plan = [];
      for (const g of girdiler) plan.push((await hedefOlustur(g.tarih, g.url)).plan);
    } else if (secenek.url) {
      plan = [(await hedefOlustur(secenek.tarih, secenek.url)).plan];
    } else {
      const tarih = secenek.tarih!;
      const videolar = await sonVideolar({ anahtar: youtubeAnahtari, fetchFn: yt, kadar: new Date(Date.parse(`${tarih}T00:00:00Z`)) });
      plan = planla({ tarihler: [tarih], videolar, mevcutOku: (t) => mevcutOku(bag.icerikKlasoru, t), uzerineYaz: secenek.uzerineYaz });
    }

    // 2) Hazırlık: istem dosyası (her çalıştırmada okunur), anahtar, video meta verisi (zorunlu)
    const uretilecek = plan.filter((p) => p.karar === 'uret' || p.karar === 'uzerine-yaz');
    const geminiAnahtari = bag.env.GEMINI_API_KEY;
    let istem = '';
    if (uretilecek.length > 0) {
      if (!geminiAnahtari) throw new KullanimHatasi('GEMINI_API_KEY tanımlı değil (site/.env ya da GitHub secret).');
      try {
        istem = istemOku(bag.istemDosyasi ?? ISTEM_DOSYASI);
      } catch (hata) {
        throw new KullanimHatasi((hata as Error).message);
      }
      const eksik = [...new Set(uretilecek.map((p) => p.video!.video.id))].filter((id) => !metalar.has(id));
      if (eksik.length) {
        const alinan = await videoMeta(yt, youtubeAnahtari, eksik);
        for (const id of eksik) metalar.set(id, alinan.get(id) ?? null);
      }
    }

    // 3) Uygula
    const ciktiKlasoru = bag.ciktiKlasoru ?? CIKTI_KLASORU;
    const enAz = Math.min(2, secenek.oylama); // oylama için en az geçerli çalıştırma (N = 1 → 1)
    let uretilen = 0;
    sonuclar = [];
    for (const p of plan) {
      const id = p.video?.video.id;
      const meta = id ? metalar.get(id) : undefined;
      const temel = { tarih: p.tarih, karar: p.karar, baslik: meta?.baslik || p.video?.video.baslik, video: id ? videoAdresi(id) : undefined, tur: p.video?.tur as string | undefined };
      if (p.karar !== 'uret' && p.karar !== 'uzerine-yaz') {
        sonuclar.push({ ...temel, durum: p.karar });
        bag.yaz(`${p.tarih}: ${p.karar}${p.karar === 'bekliyor' ? ' (yeniden üretmek için --uzerine-yaz; workflow\'da uzerine_yaz)' : ''}`);
        continue;
      }
      const denemeHatalari: string[] = [];
      const basarisiz = (neden: string) => {
        sonuclar.push({ ...temel, durum: 'basarisiz', hata: neden, denemeHatalari });
        bag.yaz(`::warning::${p.tarih}: üretilemedi: ${neden}`);
      };
      // Video meta verisi zorunlu: yoksa/herkese açık değilse/süresiz ise Gemini çağrılmaz. Başlık kalıbı varsayılmaz.
      if (!meta) { basarisiz(`video bulunamadı (YouTube Data API videos.list boş döndü: ${id}); Gemini çağrılmadı`); continue; }
      if (meta.gizlilik !== 'public') { basarisiz(`video herkese açık değil (durum: ${meta.gizlilik ?? 'bilinmiyor'}); Gemini yalnızca herkese açık videoyu işler; Gemini çağrılmadı`); continue; }
      if (!meta.sureSn || meta.sureSn <= 0) { basarisiz('video süresi alınamadı (YouTube Data API); Gemini çağrılmadı'); continue; }
      const cozulen = baslikCoz(meta.baslik);
      if (!cozulen && !secenek.zorla) { basarisiz(`başlık "Top 10/5 Plays of the Night" kalıbına uymuyor ("${meta.baslik}"); tür varsayılmadı; Gemini çağrılmadı (tek gece modunda --zorla ile aşılabilir)`); continue; }
      if (cozulen && cozulen.tarih !== p.tarih && !secenek.zorla) { basarisiz(`başlıktaki tarih (${cozulen.tarih}) verilen geceyle (${p.tarih}) uyuşmuyor; Gemini çağrılmadı (--zorla ile aşılabilir)`); continue; }
      if (!cozulen) bag.yaz(`UYARI: --zorla: başlık kalıba uymuyor ("${meta.baslik}"); tür modelin type değerinden alınır, oyun sayısı kontrolü yapılmaz.`);
      toplam.sureSn = (toplam.sureSn ?? 0) + meta.sureSn; // video süresi bir kez
      const baglam = { tarih: p.tarih, video: temel.video!, tur: cozulen?.tur, model, sureSn: meta.sureSn, aciklama: meta.aciklama };
      const geceIstemi = istemHazirla(istem, { tarih: p.tarih, sezon: sezonKlasoru(p.tarih) });

      const mevcutGeceler = mevcutGeceleriOku(bag.icerikKlasoru, p.tarih);
      const mevcut = adlariUygula(mevcutGeceler, adHaritasi); // mevcut veri de kanonik adlarla karşılaştırılır (sözlükle eşleşmiş çiftler benzer ad uyarısı vermez)
      // Bilinen adlar (sözlük kanonik + takma adlar ve mevcut top10 verisi): düşük güvenli satırda dışında kalan ad "doğrulanmamış ad" uyarısı alır.
      const bilinen = [...tumAdlar, ...mevcut.flatMap((g) => g.oyunlar.flatMap((o) => [...o.katkilar.map((k) => k.oyuncu), ...(o.rakip ? [o.rakip] : [])]))];
      // Her çalıştırma tek başına doğrulamadan geçmeli (en çok bir yeniden deneme); geçmeyen çalıştırma oylamaya katılmaz.
      const gecerli: Uretilen[] = [];
      const calismaHatalari: string[] = [];
      let cagriBu = 0;
      /** Başarısız her deneme: doğrulama hatası özeti (alan = değer: ileti, en çok 3 hata) terminale ve step summary'ye (kuru olmayan modda da). */
      const denemeBasarisiz = (calisma: number, deneme: number, neden: string) => {
        const metin = `çalıştırma ${calisma}, deneme ${deneme} başarısız: ${neden.length > 500 ? `${neden.slice(0, 500)}…` : neden}`;
        denemeHatalari.push(metin);
        bag.yaz(`  UYARI: ${p.tarih} ${metin}`);
      };
      for (let calisma = 1; calisma <= secenek.oylama; calisma++) {
        if (gecerli.length + (secenek.oylama - calisma + 1) < enAz) break; // kalan çalıştırmalarla en az geçerli sayıya ulaşılamaz: token yakma
        let oncekiHata: string | undefined;
        let sonuc: Uretilen | undefined;
        for (let deneme = 1; deneme <= 2; deneme++) {
          try {
            const sinir = tokenSiniri(meta.sureSn, etkinCozunurluk);
            cagriBu += 1; // istek gitti (başarısız olsa da)
            const { ham, kullanim, modelSurumu, cozunurlukReddedildi } = await geceUret({ anahtar: geminiAnahtari!, model, videoUrl: temel.video!, istem: geceIstemi, fetchFn: bag.fetchFn, oncekiHata, cozunurluk: etkinCozunurluk });
            kullanimEkle(kullanim);
            cagrilar.push({ tarih: p.tarih, calisma, deneme, kullanim, sinir });
            if (modelSurumu && !modelSurumleri.has(modelSurumu)) {
              modelSurumleri.add(modelSurumu);
              bag.yaz(`Model (yanıtta bildirilen): ${modelSurumu}`);
            }
            if (cozunurlukReddedildi && etkinCozunurluk !== 'unspecified') {
              bag.yaz(`UYARI: API video "resolution" alanını reddetti (${etkinCozunurluk}); çözünürlüksüz devam ediliyor (token sınırı düşük oranla hesaplanır)`);
              etkinCozunurluk = 'unspecified';
            }
            // Adlar sözlükle kanonik ada çevrilir (oylamadan ve doğrulamadan önce).
            const d = dogrula(hamAdlariniUygula(ham, adHaritasi), { ...baglam, uretildi: bag.simdi() }, mevcut, bilinen);
            if (!('hata' in d)) {
              sonuc = d;
              break;
            }
            oncekiHata = d.hata;
            denemeBasarisiz(calisma, deneme, d.hata);
            if (d.kesin) break; // yeniden denemenin anlamı yok (ör. boş liste): videoyu bir daha göndermeyiz
          } catch (e) {
            oncekiHata = (e as Error).message;
            denemeBasarisiz(calisma, deneme, oncekiHata);
          }
        }
        if (sonuc) gecerli.push(sonuc);
        else calismaHatalari.push(`çalıştırma ${calisma}: ${oncekiHata}`);
      }
      toplam.cagriSayisi = (toplam.cagriSayisi ?? 0) + cagriBu;
      toplam.islenenSn = (toplam.islenenSn ?? 0) + meta.sureSn * cagriBu; // her çağrı videoyu bir kez işler
      if (gecerli.length < enAz) {
        basarisiz(`geçerli çalıştırma sayısı ${gecerli.length}/${secenek.oylama} (oylama için en az ${enAz} gerekir); ${calismaHatalari.join(' | ')}`);
        continue;
      }
      // Oylama (N ≥ 2) ya da tek çalıştırma (N = 1)
      let ilk: Uretilen;
      if (secenek.oylama === 1) ilk = gecerli[0]!;
      else {
        const o = oylamaSonrasi(gecerli, { ...baglam, uretildi: bag.simdi() }, mevcut, enAz, kanonikAdlar, bilinen);
        if ('hata' in o) {
          basarisiz(o.hata);
          continue;
        }
        ilk = o;
        if (calismaHatalari.length) bag.yaz(`  UYARI: ${calismaHatalari.length} çalıştırma doğrulamadan geçmedi ve oylamaya katılmadı (${gecerli.length}/${secenek.oylama} geçerli): ${calismaHatalari.join(' | ')}`);
      }
      const dosyaAdi = `${sezonKlasoru(p.tarih)}/${p.tarih}.yaml`;
      // Terminal: her oyun satırı güven düzeyi (oylamada oy oranı ve alternatifler) ve gerekçesiyle; uyarılar ayrıca
      for (const o of ilk.gece.oyunlar) {
        const n = ilk.oyunNotlari.find((x) => x.sira === o.sira);
        bag.yaz(`  ${o.sira}. ${o.eylem ?? '-'}: ${o.katkilar.map((k) => `${k.oyuncu} (${k.takim}, %${k.pay ?? '='})`).join(', ')}${o.zaman ? ` @${o.zaman}` : ''} ${n ? guvenMetni(n) : ''}`.trimEnd());
        if (n?.aciklamadaYok.length) bag.yaz(`     UYARI: açıklamada yok: ${n.aciklamadaYok.join(', ')}`);
        if (n?.eylemUyari) bag.yaz(`     UYARI: ${n.eylemUyari}`);
        for (const a of n?.adUyarilari ?? []) bag.yaz(`     UYARI: ad uyarısı: ${a}`);
        for (const a of n?.benzerAdUyarilari ?? []) bag.yaz(`     UYARI: ${a}`);
        if (n?.dogrulanmamisAdlar?.length) bag.yaz(`     UYARI: doğrulanmamış ad: ${n.dogrulanmamisAdlar.join(', ')} (sözlükte ve mevcut veride yok, güven düşük)`);
      }
      for (const u of ilk.uyarilar) bag.yaz(`  UYARI: ${u}`);
      for (const b of ilk.bilgiler) {
        if (!takimBilgileri.has(b)) {
          takimBilgileri.add(b);
          bag.yaz(`  BİLGİ: ${b}`);
        }
      }
      if (secenek.kuru) {
        mkdirSync(ciktiKlasoru, { recursive: true });
        writeFileSync(join(ciktiKlasoru, `${p.tarih}.json`), `${JSON.stringify({ tarih: p.tarih, video: temel.video, tur: cozulen?.tur ?? ilk.gece.tur, model, cozunurluk: etkinCozunurluk, oylama: { istenen: secenek.oylama, gecerli: gecerli.length, hatalar: calismaHatalari }, sureSn: meta.sureSn, yaml: ilk.yaml, gece: ilk.gece, oyunNotlari: ilk.oyunNotlari, adUyarilari: ilk.adUyarilari, mevcutBenzerler: ilk.mevcutBenzerler, uyarilar: ilk.uyarilar, aciklamaKontrol: ilk.aciklamaKontrol, tokenCagrilari: cagrilar.filter((c) => c.tarih === p.tarih) }, null, 2)}\n`, 'utf8');
        bag.yaz(`${p.tarih}: kuru çalışma, dosya yazılmadı; ayrıntı: scripts/top10/cikti/${p.tarih}.json`);
      } else {
        const dosya = yol(bag.icerikKlasoru, p.tarih);
        mkdirSync(dirname(dosya), { recursive: true });
        writeFileSync(dosya, ilk.yaml, { encoding: 'utf8' });
        // Yazılan dosya yeniden okunup şemadan geçirilir; geçmezse silinir ve gece başarısız sayılır.
        const geri = yamlDogrula(readFileSync(dosya, 'utf8'));
        if ('hata' in geri) {
          unlinkSync(dosya);
          basarisiz(`yazılan dosya şemadan geçmedi (silindi): ${geri.hata}`);
          continue;
        }
        bag.yaz(`${p.tarih}: yazıldı: ${dosyaAdi}`);
      }
      uretilen += 1;
      sonuclar.push({ ...temel, tur: ilk.gece.tur, durum: 'uretildi', dosya: dosyaAdi, gece: ilk.gece, oyunNotlari: ilk.oyunNotlari, adUyarilari: ilk.adUyarilari, mevcutBenzerler: ilk.mevcutBenzerler, uyarilar: ilk.uyarilar, bilgiler: ilk.bilgiler, denemeHatalari });
    }
    // Hiç video işlenemediyse ve işlenecek video bulunduysa hata; "henüz video yok" ya da hepsi kilitli ise 0.
    return bitir(uretilecek.length > 0 && uretilen === 0 ? 1 : 0);
  } catch (hata) {
    bag.yaz(`HATA: ${(hata as Error).message}`);
    return bitir(hata instanceof KullanimHatasi ? 2 : 1);
  }
}

// Doğrudan çalıştırma (testte içe aktarılınca çalışmaz).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sonuc = await calistir(process.argv.slice(2), {
    env: process.env,
    fetchFn: fetch,
    simdi: () => new Date(),
    icerikKlasoru: ICERIK_KLASORU,
    yaz: (s) => console.log(s),
    ozetDosyasi: process.env.GITHUB_STEP_SUMMARY,
  });
  process.exit(sonuc.kod);
}
