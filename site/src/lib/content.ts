import { getCollection, type CollectionEntry } from 'astro:content';
import { SHOW_DRAFTS } from 'astro:env/server';
import type { ImageMetadata } from 'astro';
import { digerDil, slugify, type Dil } from '../i18n';
import { yol, type Bolum } from '../i18n/yollar';
import { tmdbKaydi } from './tmdb';
import { benzerAdlar, yinelenenTarihler, type Gece } from './top10';

export type { Bolum };

export type Yazi =
  | { bolum: 'sinema'; entry: CollectionEntry<'sinema'> }
  | { bolum: 'basketbol'; entry: CollectionEntry<'basketbol'> };

/** Production'da taslaklar elenir; SHOW_DRAFTS=true ise (preview) gösterilir. */
const gorunur = ({ data }: { data: { taslak: boolean } }) => SHOW_DRAFTS || !data.taslak;
const yeniden = (a: { data: { tarih: Date } }, b: { data: { tarih: Date } }) =>
  b.data.tarih.valueOf() - a.data.tarih.valueOf();

/** Yazı adres ağaçlarında bu adlar bölüm sayfalarına ve feed'e ayrılmıştır (iki dilde de). */
const AYRILMIS_SLUGLAR = new Set(['sinema', 'basketbol', 'cinema', 'basketball']);

/** Tüm yazılar (iki dil, yeniden eskiye). Slug'lar her dil ağacında tekildir; çakışma build'i durdurur. */
export async function tumYazilar(): Promise<Yazi[]> {
  const [s, b] = await Promise.all([getCollection('sinema', gorunur), getCollection('basketbol', gorunur)]);
  const hepsi: Yazi[] = [
    ...s.map((entry) => ({ bolum: 'sinema' as const, entry })),
    ...b.map((entry) => ({ bolum: 'basketbol' as const, entry })),
  ];
  const gorulen = new Map<string, Bolum>();
  for (const { bolum, entry } of hepsi) {
    if (AYRILMIS_SLUGLAR.has(entry.id)) {
      throw new Error(`"${entry.id}" (${bolum}) ayrılmış bir slug; klasörü yeniden adlandırın.`);
    }
    const anahtar = `${entry.data.dil}:${entry.id}`;
    const onceki = gorulen.get(anahtar);
    if (onceki) {
      throw new Error(`"${entry.id}" (${entry.data.dil}) hem ${onceki} hem ${bolum} koleksiyonunda var; yazı slug'ı dil başına tekil olmalı.`);
    }
    gorulen.set(anahtar, bolum);
  }
  return hepsi.sort((x, y) => yeniden(x.entry, y.entry));
}

/** Bir dilin kendi yazıları (RSS ve o dilin "kendi" saydığı kümeler için). */
export async function dilYazilari(dil: Dil): Promise<Yazi[]> {
  return (await tumYazilar()).filter((y) => y.entry.data.dil === dil);
}

/** Bölüme (ve isteğe bağlı dile) göre süzülmüş yazılar (yeniden eskiye). */
export async function bolumYazilari(bolum: Bolum, dil?: Dil): Promise<Yazi[]> {
  return (await tumYazilar()).filter((y) => y.bolum === bolum && (!dil || y.entry.data.dil === dil));
}

/**
 * Yazının diğer dildeki karşılığı: `ceviri` iki yönlü çözülür (A → B ya da B → A yazılmışsa ikisi de eşleşir).
 * Karşılık taslaksa (production) ya da yoksa undefined.
 */
export async function yaziCevirisi(yazi: Yazi): Promise<Yazi | undefined> {
  const { dil, ceviri } = yazi.entry.data;
  const hedefDil = digerDil(dil);
  const hepsi = await tumYazilar();
  return hepsi.find(
    (y) =>
      y.entry.data.dil === hedefDil &&
      ((ceviri && y.entry.id === ceviri) || (y.entry.data.ceviri === yazi.entry.id && y !== yazi)),
  );
}

/** Ana sayfa için: sayfanın dilindeki yazılardan `oneCikan` işaretliler; hiçbiri yoksa en yeniler (dilde yazı yoksa tüm yazılar). */
export async function oneCikanYazilar(dil: Dil, adet = 3): Promise<Yazi[]> {
  const hepsi = await tumYazilar();
  const kendi = hepsi.filter((y) => y.entry.data.dil === dil);
  const kaynak = kendi.length > 0 ? kendi : hepsi;
  const isaretli = kaynak.filter((y) => y.entry.data.oneCikan);
  const havuz = isaretli.length > 0 ? isaretli : kaynak;
  const secilen: Yazi[] = [];
  // Önce her bölümün en yenisi (varsa), sonra kalan en yeniler.
  for (const bolum of ['sinema', 'basketbol'] as const) {
    const ilk = havuz.find((y) => y.bolum === bolum);
    if (ilk && secilen.length < adet) secilen.push(ilk);
  }
  for (const y of havuz) if (secilen.length < adet && !secilen.includes(y)) secilen.push(y);
  return secilen.sort((x, y) => yeniden(x.entry, y.entry));
}

/** Yazının kapağı: kendi kapağı, yoksa (sinema) TMDB backdrop'u. */
export function yaziKapagi(yazi: Yazi): ImageMetadata | undefined {
  if (yazi.bolum === 'basketbol') return yazi.entry.data.kapak;
  const { data } = yazi.entry;
  return data.kapak ?? tmdbKaydi(data.film.tmdbId, data.dil)?.arkaplanGorsel;
}

/** Görselsiz yedek kapağın büyük yazısı: basketbolda sezon (yoksa ilk istatistik, yoksa yıl), sinemada film yılı. */
export function yedekMetin(yazi: Yazi): string {
  if (yazi.bolum === 'sinema') return String(yazi.entry.data.film.yil);
  const { sezon, istatistik, tarih } = yazi.entry.data;
  return sezon ?? (istatistik?.[0] ? String(istatistik[0].deger) : String(tarih.getUTCFullYear()));
}

/** Yıla göre gruplama (yeni yıl önce); girdi zaten yeniden eskiye sıralı olmalı. */
export function yillaraGore(yazilar: Yazi[]) {
  const gruplar = new Map<number, Yazi[]>();
  for (const y of yazilar) {
    const yil = y.entry.data.tarih.getUTCFullYear();
    gruplar.set(yil, [...(gruplar.get(yil) ?? []), y]);
  }
  return [...gruplar].map(([yil, liste]) => ({ yil, yazilar: liste }));
}

/** Yazının kendi dilindeki adresi (her yazı yalnızca kendi dilinin ağacında yaşar). */
export const yaziUrl = (yazi: Yazi) => yol.yazi(yazi.entry.data.dil, yazi.entry.id);

// ——— Projeler ———

export type Proje = {
  /** Slug (iki dilde aynıdır). */
  id: string;
  /** Dilden bağımsız ortak alanlar. */
  data: CollectionEntry<'projeler'>['data'];
  /** Gösterilen dil metni (yoksa diğer dil). */
  metin: CollectionEntry<'projeMetinleri'>;
  /** Gösterilen metnin dili; istenen dilden farklıysa `yedek` doğrudur. */
  metinDili: Dil;
  yedek: boolean;
};

/** Sıra: arşiv en sonda; sonra öne çıkanlar, sonra `sira`, sonra ada göre. Metin istenen dilde, yoksa diğer dilde. */
export async function projeler(dil: Dil): Promise<Proje[]> {
  const [ortak, metinler] = await Promise.all([getCollection('projeler', gorunur), getCollection('projeMetinleri')]);
  const liste: Proje[] = [];
  for (const p of ortak) {
    const istenen = metinler.find((m) => m.id === `${p.id}.${dil}`);
    const diger = metinler.find((m) => m.id === `${p.id}.${digerDil(dil)}`);
    const metin = istenen ?? diger;
    if (!metin) throw new Error(`Proje "${p.id}" için hiçbir dilde metin yok (metin.tr.mdx / metin.en.mdx).`);
    liste.push({ id: p.id, data: p.data, metin, metinDili: istenen ? dil : digerDil(dil), yedek: !istenen });
  }
  const arsiv = (p: Proje) => (p.data.durum === 'arsiv' ? 1 : 0);
  return liste.sort(
    (a, b) =>
      arsiv(a) - arsiv(b) ||
      Number(b.data.oneCikan) - Number(a.data.oneCikan) ||
      a.data.sira - b.data.sira ||
      a.data.ad.localeCompare(b.data.ad, 'tr'),
  );
}

/** Etiket slug'ı → görünen ad ve o etikete sahip yazılar (iki dilin yazıları; slug yazının dilinin kuralıyla üretilir). */
export async function etiketHaritasi() {
  const harita = new Map<string, { ad: string; yazilar: Yazi[] }>();
  for (const yazi of await tumYazilar()) {
    for (const etiket of yazi.entry.data.etiketler) {
      const slug = slugify(etiket, yazi.entry.data.dil);
      const kayit = harita.get(slug) ?? { ad: etiket, yazilar: [] };
      kayit.yazilar.push(yazi);
      harita.set(slug, kayit);
    }
  }
  return harita;
}

// ——— Top 10 (İnsan highlight makarası) ———

const top10Uyarilan = new Set<string>();

/**
 * Bir sezonun (verilmezse en yeni sezonun) görünür geceleri, eskiden yeniye; veri yoksa `geceler` boştur.
 * Production'da `taslak: true` geceler elenir. Aynı güne iki gece yazılmışsa build durur (puanlar iki kez sayılırdı);
 * slug'ları farklı ama çok benzeyen oyuncu adları (yazım hatası şüphesi) build günlüğüne uyarı olarak yazılır.
 */
export async function top10Geceleri(sezon?: string): Promise<{ sezon: string | undefined; geceler: Gece[] }> {
  const girdiler = (await getCollection('top10', gorunur)).map((g) => ({ sezon: g.id.split('/')[0]!, gece: g.data as Gece }));
  const yinelenen = yinelenenTarihler(girdiler.map((g) => g.gece));
  if (yinelenen.length > 0) throw new Error(`top10: aynı güne birden fazla gece yazılmış: ${yinelenen.join(', ')}.`);
  for (const { a, b } of benzerAdlar(girdiler.map((g) => g.gece))) {
    const mesaj = `top10: "${a.oyuncu}" ile "${b.oyuncu}" çok benzer ama slug'ları farklı (${a.kimlik} / ${b.kimlik}); yazım hatası olabilir.`;
    if (!top10Uyarilan.has(mesaj)) {
      top10Uyarilan.add(mesaj);
      console.warn(`[uyarı] ${mesaj}`);
    }
  }
  const sezonlar = [...new Set(girdiler.map((g) => g.sezon))].sort().reverse();
  const secilen = sezon ?? sezonlar[0];
  const geceler = girdiler
    .filter((g) => g.sezon === secilen)
    .map((g) => g.gece)
    .sort((x, y) => x.tarih.valueOf() - y.tarih.valueOf());
  return { sezon: secilen, geceler };
}
