// Top 10 verisindeki sabit listelerin (eylem, etiket, rol) anahtarları ve tr/en görünen adları: TEK kaynak.
// Veri şeması (content.config.ts), doğrulama/puanlama (top10.ts), bileşenler ve ileride Gemini betiği aynı dosyayı kullanır;
// i18n/tr.ts ve en.ts'e bu anahtarlar yazılmaz. Anahtar eklemek/çıkarmak = veri dosyalarının geçerli değerlerini değiştirmek.
import type { Dil } from '../i18n';

// `gemini`: scripts/top10/istem.md'deki İngilizce değer (modelin döndürdüğü anahtar); siteye yazılan anahtar nesnenin kendi anahtarıdır.
type Adlar = { tr: string; en: string; gemini?: string };

export const EYLEMLER = {
  smac: { tr: 'Smaç', en: 'Dunk', gemini: 'dunk' },
  alley_oop: { tr: 'Alley-oop', en: 'Alley-oop', gemini: 'alley_oop' },
  blok: { tr: 'Blok', en: 'Block', gemini: 'block' },
  top_calma: { tr: 'Top çalma', en: 'Steal', gemini: 'steal' },
  pas: { tr: 'Pas', en: 'Pass', gemini: 'pass' },
  ucluk: { tr: 'Üçlük', en: 'Three-pointer', gemini: 'three_pointer' },
  turnike: { tr: 'Turnike', en: 'Layup', gemini: 'layup' },
  orta_mesafe: { tr: 'Orta mesafe', en: 'Mid-range', gemini: 'mid_range' },
  calim: { tr: 'Handles', en: 'Handles', gemini: 'dribble_move' },
  diger: { tr: 'Diğer', en: 'Other', gemini: 'other' },
} as const satisfies Record<string, Adlar>;

export const ETIKETLER = {
  poster: { tr: 'Poster', en: 'Poster', gemini: 'poster' },
  chase_down_blok: { tr: 'Arkadan blok', en: 'Chase-down block', gemini: 'chase_down_block' },
  son_saniye: { tr: 'Son saniye', en: 'Last second', gemini: 'buzzer_beater' },
  mac_kazandiran: { tr: 'Maçı kazandıran', en: 'Game-winner', gemini: 'game_winner' },
  esitleyen: { tr: 'Eşitleyen', en: 'Game-tying', gemini: 'game_tying' },
  clutch: { tr: 'Clutch', en: 'Clutch', gemini: 'clutch' },
  and_one: { tr: 'And-one', en: 'And-one', gemini: 'and_one' },
  yari_saha_ve_otesi: { tr: 'Yarı saha ve ötesi', en: 'Half court and beyond', gemini: 'half_court_or_longer' },
  bacak_arasi: { tr: 'Bacak arası', en: 'Between the legs', gemini: 'between_the_legs' },
  sirt_arkasi: { tr: 'Sırt arkası', en: 'Behind the back', gemini: 'behind_the_back' },
  bakmadan: { tr: 'Bakmadan', en: 'No-look', gemini: 'no_look' },
  crossover: { tr: 'Crossover', en: 'Crossover', gemini: 'crossover_ankle_breaker' },
  putback: { tr: 'Putback', en: 'Putback', gemini: 'putback' },
  tip_in: { tr: 'Tip-in', en: 'Tip-in', gemini: 'tip_in' },
  hizli_hucum: { tr: 'Hızlı hücum', en: 'Fast break', gemini: 'fast_break' },
  windmill: { tr: 'Windmill', en: 'Windmill', gemini: 'windmill' },
  ters: { tr: 'Ters', en: 'Reverse', gemini: 'reverse' },
  tek_el: { tr: 'Tek el', en: 'One-handed', gemini: 'one_handed' },
  kendine_alley_oop: { tr: 'Kendine alley-oop', en: 'Self alley-oop', gemini: 'self_alley_oop' },
} as const satisfies Record<string, Adlar>;

export const ROLLER = {
  bitiren: { tr: 'Bitiren', en: 'Finisher', gemini: 'finisher' },
  pasor: { tr: 'Pasör', en: 'Passer', gemini: 'passer' },
  bloklayan: { tr: 'Bloklayan', en: 'Blocker', gemini: 'blocker' },
  top_calan: { tr: 'Top çalan', en: 'Stealer', gemini: 'stealer' },
  calim_atan: { tr: 'Ball handler', en: 'Ball handler', gemini: 'ball_handler' },
  diger: { tr: 'Diğer', en: 'Other', gemini: 'other' },
} as const satisfies Record<string, Adlar>;

export type Eylem = keyof typeof EYLEMLER;
export type Etiket = keyof typeof ETIKETLER;
export type Rol = keyof typeof ROLLER;

/** `z.enum()` için anahtar demetleri. */
export const EYLEM_ANAHTARLARI = Object.keys(EYLEMLER) as [Eylem, ...Eylem[]];
export const ETIKET_ANAHTARLARI = Object.keys(ETIKETLER) as [Etiket, ...Etiket[]];
export const ROL_ANAHTARLARI = Object.keys(ROLLER) as [Rol, ...Rol[]];

/** Bu etiketlerden biri varsa oyun clutch'tır (maçı kazandıran ve eşitleyen atış her zaman clutch). `son_saniye` tek başına clutch eklemez. */
export const CLUTCH_GEREKTIREN = ['mac_kazandiran', 'esitleyen'] as const satisfies readonly Etiket[];

/**
 * Ortak etiket tutarlılığı kuralı (bot, kontrol düzenleyicisi ve testler aynısını kullanır): etiketlerde `mac_kazandiran` ya da `esitleyen`
 * varsa ve `clutch` yoksa `clutch` sona eklenir. Başka hiçbir etiketi değiştirmez ya da silmez; girdiyi değiştirmez.
 * `eklendi`: kural bir etiket ekledi mi.
 */
export function clutchTamamla<T extends string>(etiketler: readonly T[]): { etiketler: (T | 'clutch')[]; eklendi: boolean } {
  const gerekli = etiketler.some((e) => (CLUTCH_GEREKTIREN as readonly string[]).includes(e));
  if (!gerekli || etiketler.includes('clutch' as T)) return { etiketler: [...etiketler], eklendi: false };
  return { etiketler: [...etiketler, 'clutch'], eklendi: true };
}

export const eylemAdi = (anahtar: Eylem, dil: Dil) => EYLEMLER[anahtar][dil];
export const etiketAdi = (anahtar: Etiket, dil: Dil) => ETIKETLER[anahtar][dil];
export const rolAdi = (anahtar: Rol, dil: Dil) => ROLLER[anahtar][dil];

/** NBA'in 30 takım kısaltması: `katkilar[].takim` bunlardan biri olmalıdır (şema reddeder; betikte yeniden deneme yolu). */
export const TAKIM_KODLARI = [
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS',
] as const;
export type TakimKodu = (typeof TAKIM_KODLARI)[number];

/**
 * Yaygın takım kodu varyantları → resmi 30 kod. Doğrulamadan önce betik bunları çevirir (çevrilen her kod için bir kez bilgi satırı).
 * Tablo dışındaki değer çevrilmez ve doğrulama hatası olarak kalır (ör. NJ: eski New Jersey Nets, geçerli bir takım değil).
 * Resmi kodların kendisi tabloda yoktur (olduğu gibi geçerlidir); WSH → WAS gibi varyantlar vardır.
 */
export const TAKIM_VARYANTLARI: Readonly<Record<string, TakimKodu>> = {
  PHO: 'PHX',
  GS: 'GSW', GOS: 'GSW',
  NO: 'NOP', NOR: 'NOP', NOH: 'NOP',
  SA: 'SAS', SAN: 'SAS',
  NY: 'NYK', NYC: 'NYK',
  BRK: 'BKN', BKLYN: 'BKN',
  CHO: 'CHA', CHH: 'CHA',
  UTAH: 'UTA', UTH: 'UTA',
  WSH: 'WAS',
};

/** Takım kodunu (büyük harfe çevirip) resmi koda çevirir. `cevrildi`: varyanttı ve çevrildi; resmi kod ya da bilinmeyen değer aynen döner. */
export function takimKodunuCevir(kod: string): { kod: string; cevrildi: boolean } {
  const k = kod.trim().toUpperCase();
  const resmi = TAKIM_VARYANTLARI[k];
  return resmi ? { kod: resmi, cevrildi: true } : { kod: k, cevrildi: false };
}

// Gemini'nin (istem.md) İngilizce değerleri ↔ sitenin anahtarları. Sözlükteki `gemini` alanlarından türetilir.
type Anahtarli = Record<string, Adlar>;
const gemini = <T extends string>(tablo: Anahtarli) => {
  const harita = Object.fromEntries(Object.entries(tablo).map(([k, v]) => [v.gemini, k])) as Record<string, T>;
  return { harita, degerler: Object.keys(harita) as [string, ...string[]] };
};
const GE = gemini<Eylem>(EYLEMLER);
const GT = gemini<Etiket>(ETIKETLER);
const GR = gemini<Rol>(ROLLER);
export const GEMINI_EYLEM = GE.harita;
export const GEMINI_ETIKET = GT.harita;
export const GEMINI_ROL = GR.harita;
export const GEMINI_EYLEM_DEGERLERI = GE.degerler;
export const GEMINI_ETIKET_DEGERLERI = GT.degerler;
export const GEMINI_ROL_DEGERLERI = GR.degerler;
