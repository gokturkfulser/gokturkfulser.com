const TR_HARITA: Record<string, string> = {
  ı: 'i',
  İ: 'i',
  I: 'i',
  ğ: 'g',
  Ğ: 'g',
  ş: 's',
  Ş: 's',
  ç: 'c',
  Ç: 'c',
  ö: 'o',
  Ö: 'o',
  ü: 'u',
  Ü: 'u',
};

/** Türkçe transliterasyonlu slug: "Çağdaş Işık" → "cagdas-isik". */
export function slugify(metin: string): string {
  return metin
    .replace(/[ıİIğĞşŞçÇöÖüÜ]/g, (c) => TR_HARITA[c] ?? c)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
