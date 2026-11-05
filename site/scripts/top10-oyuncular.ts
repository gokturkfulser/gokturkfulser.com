// Podyumdaki oyuncuların fotoğraflarını Wikimedia Commons'tan indirir. Çalıştırma: `pnpm --filter site top10-oyuncular` (`build` bunu otomatik çalıştırır).
// - Kimler: en yeni sezonun sıralamasında ilk 3 ve rakip/yetenek listelerinin her birinde ilk 3 (sayfadaki podyumlarla aynı hesap).
// - Kaynak: İngilizce Vikipedi maddesinin ana görseli. Yanlış kişi gelmesin diye madde açıklaması "basketball" içermelidir; yoksa "<ad> (basketball)" denenir.
//   Görsel Commons'ta olmalı (Vikipedi'ye yerel yüklenmiş "adil kullanım" görselleri atlanır) ve lisansı CC BY, CC BY-SA, CC0 ya da kamu malı olmalıdır (NC/ND reddedilir).
// - Çıktı: src/data/top10/oyuncu/<slug>.jpg (640 px) + <slug>.json (yazar, lisans, Commons sayfası; sayfada atıf olarak gösterilir). Klasör .gitignore'dadır.
// - Hiçbir durumda build'i düşürmez: bulunamayan ya da lisansı uymayan oyuncu atlanır (podyumda baş harf kutusu kalır), nedeni yazılır.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as yamlOku } from 'yaml';
import { slugify } from '../src/lib/slug.ts';
import { kanonikGece, sozlukHaritasi } from '../src/lib/top10-adlar.ts';
import { sayimListeleri, siralamaDegisimi } from '../src/lib/top10-ozet.ts';
import { top10Sema } from '../src/lib/top10-sema.ts';
import type { Gece } from '../src/lib/top10.ts';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const icerik = join(kok, 'src/content/top10');
const klasor = join(kok, 'src/data/top10/oyuncu');
const taslakGorunur = process.env.SHOW_DRAFTS === 'true';
const UA = 'gokturkfulser-site-build/1.0 (https://gokturkfulser.com; kisisel site, build sirasinda en cok 25 istek)';
const WIKI = 'https://en.wikipedia.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const LISANS_UYGUN = /^(cc[ -]by(?:[ -]sa)?[ -]\d|cc0|public domain|pd\b)/i;
const LISANS_RED = /\b(nc|nd)\b/i;

/** Aynı adlı birden çok basketbolcu olan oyuncular için elle doğrulanmış Vikipedi başlığı (kanonik ad → madde). */
const VIKI_BASLIK: Record<string, string> = {
  'Brandon Miller': 'Brandon Miller (basketball, born 2002)', // Charlotte Hornets
};

export interface Atif {
  ad: string;
  yazar: string;
  lisans: string;
  lisansAdresi?: string;
  sayfa: string;
}

function sezonGeceleri(): { geceler: Gece[]; sozluk: Record<string, string[]> } {
  const sozlukDosyasi = join(icerik, 'oyuncu-adlari.yaml');
  const sozluk: Record<string, string[]> = {};
  if (existsSync(sozlukDosyasi)) {
    for (const [k, v] of Object.entries((yamlOku(readFileSync(sozlukDosyasi, 'utf8')) ?? {}) as Record<string, unknown>)) sozluk[k] = Array.isArray(v) ? v.map(String) : [];
  }
  const harita = sozlukHaritasi(sozluk);
  const sezonlar = readdirSync(icerik, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort().reverse();
  const geceler: Gece[] = [];
  const secilen = sezonlar[0];
  if (secilen) {
    for (const dosya of readdirSync(join(icerik, secilen))) {
      if (!dosya.endsWith('.yaml')) continue;
      const s = top10Sema.safeParse(yamlOku(readFileSync(join(icerik, secilen, dosya), 'utf8')));
      if (s.success && (taslakGorunur || !s.data.taslak)) geceler.push(kanonikGece(s.data as unknown as Gece, harita));
    }
  }
  return { geceler: geceler.sort((a, b) => a.tarih.valueOf() - b.tarih.valueOf()), sozluk };
}

/** Sayfadaki podyumlarla aynı küme: sıralamada ilk 3 + her sayım listesinde ilk 3. */
export function podyumOyunculari(geceler: Gece[]): string[] {
  const adlar = new Set<string>();
  for (const x of siralamaDegisimi(geceler, 3)) adlar.add(x.satir.oyuncu);
  const l = sayimListeleri(geceler);
  for (const liste of Object.values(l)) for (const r of (liste as { oyuncu: string }[]).slice(0, 3)) adlar.add(r.oyuncu);
  return [...adlar];
}

async function api<T>(taban: string, parametreler: Record<string, string>): Promise<T> {
  const url = `${taban}?${new URLSearchParams({ format: 'json', formatversion: '2', ...parametreler })}`;
  const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`${new URL(taban).hostname} ${r.status}`);
  return (await r.json()) as T;
}

interface VikiSayfa {
  title: string;
  missing?: boolean;
  description?: string;
  pageimage?: string;
}

/** Vikipedi'de basketbolcu maddesinin ana görsel dosya adı; kişi doğrulanamazsa ya da görsel yoksa neden döner. */
async function anaGorsel(ad: string): Promise<{ dosya: string } | { neden: string }> {
  const sayfa = async (baslik: string): Promise<VikiSayfa | undefined> => {
    const v = await api<{ query: { pages: VikiSayfa[] } }>(WIKI, { action: 'query', redirects: '1', prop: 'pageimages|description', piprop: 'name', titles: baslik });
    const s = v.query.pages[0];
    return s && !s.missing && /basketball/i.test(s.description ?? '') ? s : undefined; // açıklama basketbolcu değilse aynı adlı başka kişidir
  };
  const sonuc = (s: VikiSayfa) => (s.pageimage ? { dosya: s.pageimage } : { neden: 'maddede ana görsel yok' });
  for (const baslik of [VIKI_BASLIK[ad], ad, `${ad} (basketball)`]) {
    if (!baslik) continue;
    const s = await sayfa(baslik);
    if (s) return sonuc(s);
  }
  // Aynı adlı birden çok madde varken ("Brandon Miller (basketball, born 2002)"): yalnızca tek bir basketbolcu adayı varsa kabul edilir, aksi hâlde kişi belirsizdir.
  const ara = await api<{ query: { search: { title: string }[] } }>(WIKI, { action: 'query', list: 'search', srsearch: `${ad} basketball player`, srlimit: '5' });
  const adaylar: VikiSayfa[] = [];
  for (const t of ara.query.search.map((x) => x.title).filter((t) => t.toLowerCase().startsWith(`${ad.toLowerCase()} (`))) {
    const s = await sayfa(t);
    if (s) adaylar.push(s);
  }
  if (adaylar.length === 1) return sonuc(adaylar[0]!);
  return { neden: adaylar.length > 1 ? 'aynı adlı birden çok basketbolcu maddesi var, kişi belirsiz' : 'Vikipedi basketbolcu maddesi bulunamadı' };
}

const temizle = (html: string | undefined) =>
  (html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

interface CommonsSayfa {
  title: string;
  missing?: boolean;
  imageinfo?: { thumburl?: string; descriptionurl?: string; mime?: string; extmetadata?: Record<string, { value?: string }> }[];
}

async function commonsBilgi(dosya: string): Promise<{ adres: string; atif: Omit<Atif, 'ad'> } | { neden: string }> {
  const v = await api<{ query: { pages: CommonsSayfa[] } }>(COMMONS, {
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata',
    iiurlwidth: '640',
    titles: `File:${dosya}`,
  });
  const s = v.query.pages[0];
  const bilgi = s?.imageinfo?.[0];
  if (!s || s.missing || !bilgi) return { neden: 'görsel Commons\'ta yok (Vikipedi\'ye yerel, serbest değil)' };
  if (bilgi.mime !== 'image/jpeg') return { neden: `JPEG değil (${bilgi.mime})` };
  const m = bilgi.extmetadata ?? {};
  const lisans = temizle(m.LicenseShortName?.value);
  if (!LISANS_UYGUN.test(lisans) || LISANS_RED.test(lisans)) return { neden: `lisans uygun değil (${lisans || 'bilinmiyor'})` };
  const yazar = temizle(m.Artist?.value) || temizle(m.Credit?.value);
  if (!yazar || !bilgi.thumburl || !bilgi.descriptionurl) return { neden: 'yazar ya da adres eksik' };
  return { adres: bilgi.thumburl, atif: { yazar, lisans, ...(m.LicenseUrl?.value ? { lisansAdresi: m.LicenseUrl.value } : {}), sayfa: bilgi.descriptionurl } };
}

async function calis() {
  await mkdir(klasor, { recursive: true });
  const { geceler } = sezonGeceleri();
  const adlar = podyumOyunculari(geceler);
  const gerekli = new Set(adlar.map((a) => slugify(a)));
  for (const dosya of await readdir(klasor)) {
    const t = dosya.replace(/\.(jpg|json)$/, '');
    if (/\.(jpg|json)$/.test(dosya) && !gerekli.has(t)) await rm(join(klasor, dosya), { force: true });
  }
  let tamam = 0;
  const atlanan: string[] = [];
  for (const ad of adlar) {
    const slug = slugify(ad);
    if (existsSync(join(klasor, `${slug}.jpg`)) && existsSync(join(klasor, `${slug}.json`))) {
      tamam++;
      continue;
    }
    try {
      const g = await anaGorsel(ad);
      if ('neden' in g) throw new Error(g.neden);
      const c = await commonsBilgi(g.dosya);
      if ('neden' in c) throw new Error(c.neden);
      const r = await fetch(c.adres, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30_000) });
      if (!r.ok) throw new Error(`indirme ${r.status}`);
      const b = Buffer.from(await r.arrayBuffer());
      if (b.length < 2_000 || b[0] !== 0xff || b[1] !== 0xd8) throw new Error('JPEG değil');
      await writeFile(join(klasor, `${slug}.jpg`), b);
      await writeFile(join(klasor, `${slug}.json`), JSON.stringify({ ad, ...c.atif } satisfies Atif, null, 2) + '\n');
      tamam++;
    } catch (e) {
      atlanan.push(`${ad} (${(e as Error).message})`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(`top10-oyuncular: ${tamam}/${adlar.length} oyuncu fotoğrafı hazır.`);
  for (const a of atlanan) console.warn(`top10-oyuncular: atlandı: ${a}`);
}

try {
  await calis();
} catch (e) {
  console.warn(`top10-oyuncular: ${(e as Error).message}; podyum baş harf kutusuyla çizilecek.`);
}
process.exit(0);
