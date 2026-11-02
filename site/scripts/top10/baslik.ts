// Video başlığından gece bilgisi: kalıp ve dışlama listesi TEK yerde (burası). Saf fonksiyonlar, ağ yok.
// Gerçek başlık örneği: "NBA's Top 5 Plays of the Night | November 1, 2026".

export type Tur = 'top10' | 'top5';

/** Kalıp: "[NBA's ]Top 10|5 Plays of the Night" + ayraç + tarih metni. Büyük/küçük harf önemsiz. */
export const BASLIK_KALIBI = /^(?:NBA['’]s\s+)?Top\s+(10|5)\s+Plays\s+of\s+the\s+Night\s*[|:–—-]\s*(.+)$/i;

/** Kalıba benzese de gece listesi olmayanlar ("of the Week", "of the Month", sezon özetleri…). */
export const DISLAMA_KALIPLARI: readonly RegExp[] = [
  /\bof\s+the\s+(?:week|month|year|decade)\b/i,
  /\bseason\b/i,
  /\bsummer\s+league\b/i,
  /\ball-?star\b/i,
];

const AYLAR: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

/** "November 1, 2026" / "Nov. 1, 2026" → "2026-11-01"; geçersiz takvim günü (30 Şubat) → undefined. */
export function tarihAyristir(metin: string): string | undefined {
  const m = /^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/.exec(metin.trim());
  if (!m) return undefined;
  const ay = AYLAR[m[1]!.toLowerCase()];
  const gun = Number(m[2]);
  const yil = Number(m[3]);
  if (!ay) return undefined;
  const d = new Date(Date.UTC(yil, ay - 1, gun));
  if (d.getUTCFullYear() !== yil || d.getUTCMonth() !== ay - 1 || d.getUTCDate() !== gun) return undefined;
  return d.toISOString().slice(0, 10);
}

export const haricMi = (baslik: string) => DISLAMA_KALIPLARI.some((k) => k.test(baslik));

/** Başlık "Top 10/5 Plays of the Night" gecesi mi ve tarihi? Değilse (ya da tarih ayrıştırılamıyorsa, ya da dışlananlardansa) undefined. */
export function baslikCoz(baslik: string): { tur: Tur; tarih: string } | undefined {
  const temiz = baslik.trim();
  if (haricMi(temiz)) return undefined;
  const m = BASLIK_KALIBI.exec(temiz);
  if (!m) return undefined;
  const tarih = tarihAyristir(m[2]!);
  if (!tarih) return undefined;
  return { tur: m[1] === '10' ? 'top10' : 'top5', tarih };
}
