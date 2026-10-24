import { getCollection, type CollectionEntry } from 'astro:content';
import { SHOW_DRAFTS } from 'astro:env/server';
import { slugify } from './slug';

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

export async function tumYazilar(): Promise<Yazi[]> {
  const [s, b] = await Promise.all([sinemaYazilari(), basketbolYazilari()]);
  const hepsi: Yazi[] = [
    ...s.map((entry) => ({ bolum: 'sinema' as const, entry })),
    ...b.map((entry) => ({ bolum: 'basketbol' as const, entry })),
  ];
  return hepsi.sort((x, y) => yeniden(x.entry, y.entry));
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

export const yaziUrl = (bolum: Bolum, id: string) => `/${bolum}/${id}/`;

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
