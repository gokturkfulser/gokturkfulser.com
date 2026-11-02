// Oyuncu adı sözlüğü: kanonik ad → takma adlar (src/content/top10/oyuncu-adlari.yaml). Model aynı oyuncuyu farklı yazabiliyor
// ("Brayden Burries" / "Braden Burries"); sözlük bunları tek kişiye bağlar. Saf fonksiyonlar (Astro'ya bağlı değil): site (content.ts) ve
// scripts/top10 aynısını kullanır. Eşleştirme slug üzerindendir (aksan, büyük/küçük harf, noktalama önemsiz).
import { kimlik, type Gece } from './top10.ts';

/** Sözlük: kanonik ad → takma adlar. */
export type AdSozlugu = Record<string, readonly string[]>;
/** slug(ad) → kanonik ad (kanonik adın kendi slug'ı da kendisine bağlıdır). */
export type AdHaritasi = ReadonlyMap<string, string>;

/**
 * Sözlük kuralları (ihlal build'i durdurur): bir takma ad iki kanonik ada bağlanamaz; kanonik ad başka bir kaydın takma adı olamaz;
 * iki kanonik ad aynı kimliğe (slug) sahip olamaz; takma ad kendi kanonik adıyla aynı olamaz; ad boş olamaz. Hata yoksa undefined.
 */
export function sozlukHatasi(sozluk: AdSozlugu): string | undefined {
  const kanonikler = new Map<string, string>(); // slug → kanonik ad
  for (const kanonik of Object.keys(sozluk)) {
    const k = kimlik(kanonik);
    if (!k) return `kanonik ad geçersiz: "${kanonik}"`;
    const onceki = kanonikler.get(k);
    if (onceki) return `"${kanonik}" ile "${onceki}" aynı oyuncu kimliğine sahip; tek kanonik ad olmalı`;
    kanonikler.set(k, kanonik);
  }
  const takmaAdlar = new Map<string, string>(); // slug → bağlı olduğu kanonik ad
  for (const [kanonik, takmalar] of Object.entries(sozluk)) {
    for (const takma of takmalar) {
      const t = kimlik(takma);
      if (!t) return `"${kanonik}" için takma ad geçersiz: "${takma}"`;
      if (t === kimlik(kanonik)) return `"${takma}" kendi kanonik adı "${kanonik}" ile aynı; takma ad olamaz`;
      const digerKanonik = kanonikler.get(t);
      if (digerKanonik) return `"${takma}" ("${kanonik}" takma adı) başka bir kaydın kanonik adı ("${digerKanonik}"); kanonik ad takma ad olamaz`;
      const bagli = takmaAdlar.get(t);
      if (bagli && bagli !== kanonik) return `"${takma}" takma adı iki kanonik ada bağlı: "${bagli}" ve "${kanonik}"`;
      takmaAdlar.set(t, kanonik);
    }
  }
  return undefined;
}

/** Sözlükten arama haritası (geçerli sözlük varsayılır; önce `sozlukHatasi` denetlenir). */
export function sozlukHaritasi(sozluk: AdSozlugu): AdHaritasi {
  const harita = new Map<string, string>();
  for (const [kanonik, takmalar] of Object.entries(sozluk)) {
    harita.set(kimlik(kanonik), kanonik);
    for (const takma of takmalar) harita.set(kimlik(takma), kanonik);
  }
  return harita;
}

/** Ad sözlükte (kanonik ya da takma ad olarak) varsa kanonik adı, yoksa adın kendisini verir. */
export const kanonikAd = (ad: string, harita: AdHaritasi): string => harita.get(kimlik(ad)) ?? ad;

/** Bir gecedeki tüm adları (katkı sahipleri ve rakip) kanonik ada çevirir; girdiyi değiştirmez. */
export function kanonikGece(gece: Gece, harita: AdHaritasi): Gece {
  if (harita.size === 0) return gece;
  return {
    ...gece,
    oyunlar: gece.oyunlar.map((o) => ({
      ...o,
      ...(o.rakip ? { rakip: kanonikAd(o.rakip, harita) } : {}),
      katkilar: o.katkilar.map((k) => ({ ...k, oyuncu: kanonikAd(k.oyuncu, harita) })),
    })),
  };
}

export const adlariUygula = (geceler: readonly Gece[], harita: AdHaritasi): Gece[] => geceler.map((g) => kanonikGece(g, harita));
