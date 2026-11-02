// Top 10 verisindeki sabit listelerin (eylem, etiket, rol) anahtarları ve tr/en görünen adları: TEK kaynak.
// Veri şeması (content.config.ts), doğrulama/puanlama (top10.ts), bileşenler ve ileride Gemini betiği aynı dosyayı kullanır;
// i18n/tr.ts ve en.ts'e bu anahtarlar yazılmaz. Anahtar eklemek/çıkarmak = veri dosyalarının geçerli değerlerini değiştirmek.
import type { Dil } from '../i18n';

type Adlar = { tr: string; en: string };

export const EYLEMLER = {
  smac: { tr: 'Smaç', en: 'Dunk' },
  alley_oop: { tr: 'Alley-oop', en: 'Alley-oop' },
  blok: { tr: 'Blok', en: 'Block' },
  top_calma: { tr: 'Top çalma', en: 'Steal' },
  pas: { tr: 'Pas', en: 'Pass' },
  ucluk: { tr: 'Üçlük', en: 'Three-pointer' },
  turnike: { tr: 'Turnike', en: 'Layup' },
  orta_mesafe: { tr: 'Orta mesafe', en: 'Mid-range' },
  diger: { tr: 'Diğer', en: 'Other' },
} as const satisfies Record<string, Adlar>;

export const ETIKETLER = {
  poster: { tr: 'Poster', en: 'Poster' },
  chase_down_blok: { tr: 'Arkadan blok', en: 'Chase-down block' },
  son_saniye: { tr: 'Son saniye', en: 'Last second' },
  mac_kazandiran: { tr: 'Maçı kazandıran', en: 'Game-winner' },
  and_one: { tr: 'And-one', en: 'And-one' },
  yari_saha_ve_otesi: { tr: 'Yarı saha ve ötesi', en: 'Half court and beyond' },
  bacak_arasi: { tr: 'Bacak arası', en: 'Between the legs' },
  sirt_arkasi: { tr: 'Sırt arkası', en: 'Behind the back' },
  bakmadan: { tr: 'Bakmadan', en: 'No-look' },
  crossover: { tr: 'Crossover', en: 'Crossover' },
  putback: { tr: 'Putback', en: 'Putback' },
  tip_in: { tr: 'Tip-in', en: 'Tip-in' },
  hizli_hucum: { tr: 'Hızlı hücum', en: 'Fast break' },
  windmill: { tr: 'Windmill', en: 'Windmill' },
  ters: { tr: 'Ters', en: 'Reverse' },
  tek_el: { tr: 'Tek el', en: 'One-handed' },
  kendine_alley_oop: { tr: 'Kendine alley-oop', en: 'Self alley-oop' },
} as const satisfies Record<string, Adlar>;

export const ROLLER = {
  bitiren: { tr: 'Bitiren', en: 'Finisher' },
  pasor: { tr: 'Pasör', en: 'Passer' },
  bloklayan: { tr: 'Bloklayan', en: 'Blocker' },
  top_calan: { tr: 'Top çalan', en: 'Stealer' },
  diger: { tr: 'Diğer', en: 'Other' },
} as const satisfies Record<string, Adlar>;

export type Eylem = keyof typeof EYLEMLER;
export type Etiket = keyof typeof ETIKETLER;
export type Rol = keyof typeof ROLLER;

/** `z.enum()` için anahtar demetleri. */
export const EYLEM_ANAHTARLARI = Object.keys(EYLEMLER) as [Eylem, ...Eylem[]];
export const ETIKET_ANAHTARLARI = Object.keys(ETIKETLER) as [Etiket, ...Etiket[]];
export const ROL_ANAHTARLARI = Object.keys(ROLLER) as [Rol, ...Rol[]];

export const eylemAdi = (anahtar: Eylem, dil: Dil) => EYLEMLER[anahtar][dil];
export const etiketAdi = (anahtar: Etiket, dil: Dil) => ETIKETLER[anahtar][dil];
export const rolAdi = (anahtar: Rol, dil: Dil) => ROLLER[anahtar][dil];
