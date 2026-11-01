const tarihBicimi = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Istanbul',
});

export const tarihYaz = (tarih: Date) => tarihBicimi.format(tarih);

/** <time datetime="..."> için ISO tarih (YYYY-AA-GG). */
export const tarihIso = (tarih: Date) => tarih.toISOString().slice(0, 10);

/** Yarım puanlı değeri virgüllü gösterir: 3.5 → "3,5". */
export const puanYaz = (puan: number) => puan.toLocaleString('tr-TR');

export type Dil = 'tr' | 'en';
export type Yerel = { en: string; tr: string };

/** İki dilli alan: istenen dil, boşsa `tr`. i18n gelene kadar sayfalar varsayılan `tr`'yi kullanır. */
export const yerel = (v: Yerel, dil: Dil = 'tr') => v[dil] || v.tr;

const ayYilBicimleri: Record<Dil, Intl.DateTimeFormat> = {
  tr: new Intl.DateTimeFormat('tr-TR', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
  en: new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
};
const SURUYOR: Record<Dil, string> = { tr: 'devam ediyor', en: 'present' };

/** Özgeçmiş dönemi: "YYYY" ya da "YYYY-AA" → "2016 – 2024" / "Tem 2023 – devam ediyor" (bitiş yok/null = devam ediyor). */
export const donemYaz = (baslangic: string, bitis?: string | null, dil: Dil = 'tr') => {
  const bicim = (d: string) => (d.length === 4 ? d : ayYilBicimleri[dil].format(new Date(`${d}-01T00:00:00Z`)));
  return `${bicim(baslangic)} – ${bitis ? bicim(bitis) : SURUYOR[dil]}`;
};

/** Zaman çizelgesi için yıl aralığı: "2016 – 2024" / "2023 –" (bitiş yok/null = süren). Aynı yıl tek yıl yazılır. */
export const yilAraligi = (baslangic: string, bitis?: string | null) => {
  const b = baslangic.slice(0, 4);
  if (!bitis) return `${b} –`;
  const s = bitis.slice(0, 4);
  return b === s ? b : `${b} – ${s}`;
};
