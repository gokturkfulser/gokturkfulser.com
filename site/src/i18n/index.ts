// Dil katmanı: tek locale parametresi (`Dil`) ile sözlük, <html lang>, tarih/sayı biçimi, hyphens kuralı ve slug
// transliterasyonu buradan yönetilir. Sayfalar dili `dilAl(Astro)` ile (Astro'nun `currentLocale`'inden) okur; sabit yazmaz.
import { en } from './en';
import { tr, type Sozluk } from './tr';

export const DILLER = ['en', 'tr'] as const;
export type Dil = (typeof DILLER)[number];
/** Varsayılan dil kökte yaşar (prefixDefaultLocale: false); diğerleri `/<dil>/` altında. */
export const VARSAYILAN_DIL: Dil = 'en';
export const digerDil = (dil: Dil): Dil => (dil === 'en' ? 'tr' : 'en');

const TR_HARITA: Record<string, string> = { ı: 'i', İ: 'i', I: 'i', ğ: 'g', Ğ: 'g', ş: 's', Ş: 's', ç: 'c', Ç: 'c', ö: 'o', Ö: 'o', ü: 'u', Ü: 'u' };

export const AYAR: Record<
  Dil,
  {
    /** <html lang> ve hreflang. */
    lang: string;
    /** Intl tarih/sayı biçimi. */
    intl: string;
    og: string;
    /** RSS <language>. */
    rss: string;
    /** CSS `hyphens` kuralı (html[data-tire]). */
    tire: 'auto' | 'manual';
    /** Slug transliterasyon haritası (NFD ayrıştırmasının çözemediği harfler). */
    harita: Record<string, string>;
    /** Okuma süresi: dakikada kelime. */
    kelimeHizi: number;
  }
> = {
  en: { lang: 'en', intl: 'en-GB', og: 'en_US', rss: 'en', tire: 'auto', harita: {}, kelimeHizi: 230 },
  tr: { lang: 'tr', intl: 'tr-TR', og: 'tr_TR', rss: 'tr-TR', tire: 'auto', harita: TR_HARITA, kelimeHizi: 180 },
};

const sozlukler: Record<Dil, Sozluk> = { en, tr };

// Eksik ya da fazla anahtar build'i durdurur (tür denetimine ek, çalışma zamanı güvencesi).
const anahtarlar = (nesne: unknown, onek = ''): string[] =>
  Object.entries(nesne as Record<string, unknown>).flatMap(([k, v]) =>
    v !== null && typeof v === 'object' ? anahtarlar(v, `${onek}${k}.`) : [`${onek}${k}`],
  );
{
  const kaynak = new Set(anahtarlar(tr));
  const hedef = new Set(anahtarlar(en));
  const eksik = [...kaynak].filter((k) => !hedef.has(k));
  const fazla = [...hedef].filter((k) => !kaynak.has(k));
  if (eksik.length || fazla.length) {
    throw new Error(`i18n: en.ts ile tr.ts anahtarları aynı değil. en'de eksik: [${eksik}] en'de fazla: [${fazla}]`);
  }
}

export const sozluk = (dil: Dil): Sozluk => sozlukler[dil];

/** Sayfanın dili: Astro'nun `currentLocale`'i (yol öneki), yoksa varsayılan dil. */
export const dilAl = (astro: { currentLocale?: string }): Dil =>
  (DILLER as readonly string[]).includes(astro.currentLocale ?? '') ? (astro.currentLocale as Dil) : VARSAYILAN_DIL;

export type Yerel = { en: string; tr: string };
/** İki dilli alan: istenen dil, boşsa diğeri. */
export const yerel = (v: Yerel, dil: Dil) => v[dil] || v[digerDil(dil)];

export const tarihBicimi = (dil: Dil) =>
  new Intl.DateTimeFormat(AYAR[dil].intl, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });
export const tarihYaz = (tarih: Date, dil: Dil) => tarihBicimi(dil).format(tarih);
export const sayiYaz = (n: number, dil: Dil, secenek?: Intl.NumberFormatOptions) =>
  n.toLocaleString(AYAR[dil].intl, secenek);
/** Yarım puanlı değer: tr "3,5", en "3.5". */
export const puanYaz = (puan: number, dil: Dil) => sayiYaz(puan, dil);
export const listeYaz = (liste: string[], dil: Dil) =>
  new Intl.ListFormat(AYAR[dil].intl, { style: 'long', type: 'conjunction' }).format(liste);

/** Dile göre transliterasyonlu slug: tr "Çağdaş Işık" → "cagdas-isik". */
export function slugify(metin: string, dil: Dil = 'tr'): string {
  const harita = AYAR[dil].harita;
  return metin
    .replace(/[ıİIğĞşŞçÇöÖüÜ]/g, (c) => harita[c] ?? c)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
