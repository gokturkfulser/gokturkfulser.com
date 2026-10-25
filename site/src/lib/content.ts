import { getCollection, type CollectionEntry } from 'astro:content';
import { SHOW_DRAFTS } from 'astro:env/server';
import type { ImageMetadata } from 'astro';
import { slugify } from './slug';
import { tmdbKaydi } from './tmdb';

export type Bolum = 'sinema' | 'basketbol';

export type Yazi =
  | { bolum: 'sinema'; entry: CollectionEntry<'sinema'> }
  | { bolum: 'basketbol'; entry: CollectionEntry<'basketbol'> };

export const BOLUM_ADLARI: Record<Bolum, string> = {
  sinema: 'Sinema',
  basketbol: 'Basketbol',
};

/** Production'da taslaklar elenir; SHOW_DRAFTS=true ise (preview) gösterilir. */
const gorunur = ({ data }: { data: { taslak: boolean } }) => SHOW_DRAFTS || !data.taslak;
const yeniden = (a: { data: { tarih: Date } }, b: { data: { tarih: Date } }) =>
  b.data.tarih.valueOf() - a.data.tarih.valueOf();

export async function sinemaYazilari() {
  return (await getCollection('sinema', gorunur)).sort(yeniden);
}

export async function basketbolYazilari() {
  return (await getCollection('basketbol', gorunur)).sort(yeniden);
}

/** /yazilar/<slug>/ tek bir alan adı uzayıdır; bu adlar bölüm sayfalarına ve feed'e ayrılmıştır. */
const AYRILMIS_SLUGLAR = new Set(['sinema', 'basketbol']);

export async function tumYazilar(): Promise<Yazi[]> {
  const [s, b] = await Promise.all([sinemaYazilari(), basketbolYazilari()]);
  const hepsi: Yazi[] = [
    ...s.map((entry) => ({ bolum: 'sinema' as const, entry })),
    ...b.map((entry) => ({ bolum: 'basketbol' as const, entry })),
  ];
  const gorulen = new Map<string, Bolum>();
  for (const { bolum, entry } of hepsi) {
    if (AYRILMIS_SLUGLAR.has(entry.id)) {
      throw new Error(`"${entry.id}" (${bolum}) ayrılmış bir slug; klasörü yeniden adlandırın.`);
    }
    const onceki = gorulen.get(entry.id);
    if (onceki) {
      throw new Error(`"${entry.id}" hem ${onceki} hem ${bolum} koleksiyonunda var; /yazilar/<slug>/ tekil olmalı.`);
    }
    gorulen.set(entry.id, bolum);
  }
  return hepsi.sort((x, y) => yeniden(x.entry, y.entry));
}

/** Bölüme göre süzülmüş yazılar (yeniden eskiye). */
export async function bolumYazilari(bolum: Bolum): Promise<Yazi[]> {
  return (await tumYazilar()).filter((y) => y.bolum === bolum);
}

/** Ana sayfa için: `oneCikan` işaretliler; hiçbiri yoksa en yeniler. Sinema ve basketboldan dengeli karışır. */
export async function oneCikanYazilar(adet = 3): Promise<Yazi[]> {
  const hepsi = await tumYazilar();
  const isaretli = hepsi.filter((y) => y.entry.data.oneCikan);
  const havuz = isaretli.length > 0 ? isaretli : hepsi;
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
  return data.kapak ?? tmdbKaydi(data.film.tmdbId)?.arkaplanGorsel;
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

/** Sıra: arşiv en sonda; sonra öne çıkanlar, sonra `sira`, sonra ada göre. */
export async function projeler() {
  const arsiv = (p: CollectionEntry<'projeler'>) => (p.data.durum === 'arsiv' ? 1 : 0);
  return (await getCollection('projeler', gorunur)).sort(
    (a, b) =>
      arsiv(a) - arsiv(b) ||
      Number(b.data.oneCikan) - Number(a.data.oneCikan) ||
      a.data.sira - b.data.sira ||
      a.data.ad.localeCompare(b.data.ad, 'tr'),
  );
}

/** Tüm yazılar tek adres uzayındadır; bölüm URL'de yer almaz (eski /sinema/<slug>/ → 301, public/_redirects). */
export const yaziUrl = (_bolum: Bolum, id: string) => `/yazilar/${id}/`;
export const BOLUM_URL: Record<Bolum, string> = { sinema: '/yazilar/sinema/', basketbol: '/yazilar/basketbol/' };

/** Etiket slug'ı → görünen ad ve o etikete sahip yazılar. */
export async function etiketHaritasi() {
  const harita = new Map<string, { ad: string; yazilar: Yazi[] }>();
  for (const yazi of await tumYazilar()) {
    for (const etiket of yazi.entry.data.etiketler) {
      const slug = slugify(etiket);
      const kayit = harita.get(slug) ?? { ad: etiket, yazilar: [] };
      kayit.yazilar.push(yazi);
      harita.set(slug, kayit);
    }
  }
  return harita;
}
