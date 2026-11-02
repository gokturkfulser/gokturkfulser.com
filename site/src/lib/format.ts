// Biçim yardımcıları. Dile bağlı olanlar `i18n/index.ts`'tedir (tarih, sayı, puan, liste); burada özgeçmiş dönemleri ve Letterboxd tarihi.
import { AYAR, sozluk, type Dil } from '../i18n';

export { tarihYaz, puanYaz, sayiYaz, listeYaz, yerel, type Dil, type Yerel } from '../i18n';

/** <time datetime="..."> için ISO tarih (YYYY-AA-GG). */
export const tarihIso = (tarih: Date) => tarih.toISOString().slice(0, 10);

const ayYilBicimleri = (dil: Dil) => new Intl.DateTimeFormat(AYAR[dil].intl, { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Özgeçmiş dönemi: "YYYY" ya da "YYYY-AA" → "2016 – 2024" / "Tem 2023 – devam ediyor" (bitiş yok/null = devam ediyor). */
export const donemYaz = (baslangic: string, bitis: string | null | undefined, dil: Dil) => {
  const bicim = (d: string) => (d.length === 4 ? d : ayYilBicimleri(dil).format(new Date(`${d}-01T00:00:00Z`)));
  return `${bicim(baslangic)} – ${bitis ? bicim(bitis) : sozluk(dil).hakkimda.suruyor}`;
};

/** Zaman çizelgesi için yıl aralığı: "2016 – 2024" / "2023 –" (bitiş yok/null = süren). Aynı yıl tek yıl yazılır. */
export const yilAraligi = (baslangic: string, bitis?: string | null) => {
  const b = baslangic.slice(0, 4);
  if (!bitis) return `${b} –`;
  const s = bitis.slice(0, 4);
  return b === s ? b : `${b} – ${s}`;
};
