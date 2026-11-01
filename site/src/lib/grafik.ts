import type { Dil } from './format';

/** Grafik etiketleri için sayı: tr "1.579" / "10,8", en "1,579" / "10.8" (en çok 1 ondalık). */
export const sayiYaz = (n: number, dil: Dil) =>
  n.toLocaleString(dil === 'en' ? 'en-US' : 'tr-TR', { maximumFractionDigits: 1 });

/** Değer + birim: "%10,8" / "10.8%" ya da "7,5 maç" / "7.5 games". */
export const birimliYaz = (n: number, birim: string, dil: Dil) =>
  birim === '%' ? (dil === 'en' ? `${sayiYaz(n, dil)}%` : `%${sayiYaz(n, dil)}`) : `${sayiYaz(n, dil)} ${birim}`;
