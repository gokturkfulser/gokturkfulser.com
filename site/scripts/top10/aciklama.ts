// Uydurma (halüsinasyon) koruması: NBA video açıklamaları genelde "... featuring A, B, C..." biçiminde oyuncu sayar (sırasız, pas verenler dahil).
// Bu liste YALNIZCA kontrol içindir: Gemini'nin çıkardığı katkı sahipleriyle karşılaştırılır, asla sonuca veri olarak yazılmaz. Saf fonksiyonlar (ağ yok).

const OZEL: Record<string, string> = { ł: 'l', đ: 'd', ø: 'o', ß: 'ss', æ: 'ae', ð: 'd', þ: 'th' };
const SONEKLER = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

/** Karşılaştırma için ad: aksansız, küçük harf, nokta/kesme işareti/tire temiz, Jr./Sr./II/III/IV soneki yok, tek boşluk. */
export function adNormallestir(ad: string): string {
  const temiz = ad
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[łđøßæðþ]/g, (c) => OZEL[c] ?? c)
    .replace(/['’‘`´.]/g, '') // De'Aaron → deaaron; P.J. → pj
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const parcalar = temiz.split(' ').filter(Boolean);
  while (parcalar.length > 1 && SONEKLER.has(parcalar[parcalar.length - 1]!)) parcalar.pop();
  return parcalar.join(' ');
}

/** En az bu kadar ad çıkmazsa liste bulunmuş sayılmaz (kontrol atlanır). */
export const EN_AZ_AD = 3;

/**
 * Açıklamadaki "featuring A, B, C and D" listesi → ad dizisi. Liste yoksa (ya da en az EN_AZ_AD ad çıkmazsa) undefined.
 * "featuring"den sonraki satırın geri kalanı okunur (Jr. gibi noktalar cümle sonu sayılmaz); virgül, "and" ve "&" ile bölünür.
 */
export function aciklamadanOyuncular(aciklama: string): string[] | undefined {
  const m = /\bfeaturing\b[:\s]+([^\r\n]+)/i.exec(aciklama);
  if (!m) return undefined;
  const adlar = m[1]!
    .replace(/\s*(?:\band more\b|\bamong others\b|\.\.\.|…).*$/i, '')
    .replace(/[.\s]+$/, '')
    .split(/\s*,\s*|\s+(?:and|&)\s+/i)
    .map((a) => a.replace(/^(?:and|&)\s+/i, '').trim())
    .filter((a) => /\p{L}{2}/u.test(a) && a.split(/\s+/).length <= 5);
  return adlar.length >= EN_AZ_AD ? adlar : undefined;
}

export type AciklamaKontrolu = {
  /** Açıklamada liste bulunamadı: kontrol yapılmadı (uyarı). */
  atlandi: boolean;
  /** Listede geçen katkı sahibi sayısı / toplam (tekil, normalleştirilmiş). */
  eslesen: number;
  toplam: number;
  /** Listede geçmeyen katkı sahipleri (görünen yazımla). */
  eksikler: string[];
  /** Katkı sahiplerinin yarısından azı listede geçiyorsa: video ile tutarsız. */
  tutarsiz: boolean;
};

export function aciklamaKontrolu(katkiAdlari: readonly string[], liste: readonly string[] | undefined): AciklamaKontrolu {
  const tekil = new Map<string, string>();
  for (const ad of katkiAdlari) tekil.set(adNormallestir(ad), ad);
  if (!liste) return { atlandi: true, eslesen: 0, toplam: tekil.size, eksikler: [], tutarsiz: false };
  const kume = new Set(liste.map(adNormallestir));
  const eksikler = [...tekil].filter(([n]) => !kume.has(n)).map(([, ad]) => ad);
  const eslesen = tekil.size - eksikler.length;
  return { atlandi: false, eslesen, toplam: tekil.size, eksikler, tutarsiz: tekil.size > 0 && eslesen * 2 < tekil.size };
}
