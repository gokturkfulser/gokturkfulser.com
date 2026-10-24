// Oyun mantığı: DOM'a dokunmaz, bu yüzden `node --test` ile test edilir.

export const HARF_SAYISI = 5;
export const HAK = 6;

/** Türk alfabesi (29 harf), büyük harfle. q, w, x yoktur; ı/I ve i/İ ayrı harflerdir. */
export const ALFABE = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ';

/**
 * Ekran klavyesi satırları. Türkçe Q düzeninin harf sırası korunur ama 8'li satırlara bölünür: 360 px genişlikte
 * 10-11'li satırlarda tuş ~27 px olurdu, 8'li satırda ~40 px'tir. Son satırda Gönder ve Sil de vardır.
 */
export const KLAVYE_SATIRLARI: readonly string[] = ['ERTYUIOP', 'ĞÜASDFGH', 'JKLŞİZCV', 'BNMÖÇ'];

export type Durum = 'dogru' | 'var' | 'yok';

/**
 * Türkçe kurallarıyla büyük harf: i → İ, ı → I. Düz `toUpperCase()` "i" harfini "I" yapıp
 * "ı" ile karıştırırdı; bu yüzden her yerde toLocaleUpperCase('tr') kullanılır.
 */
export const buyukHarf = (metin: string): string => metin.toLocaleUpperCase('tr');

/** Türkçe küçük harf: İ → i, I → ı (sözlük dosyası bu biçimdedir). */
export const kucukHarf = (metin: string): string => metin.toLocaleLowerCase('tr');

/**
 * Geçerli tahminler: sözlük dosyası (satır başına bir kelime) ∪ cevap listesi. Cevaplar sözlükte olmasa da
 * her zaman kabul edilir; böylece günün kelimesi hiçbir zaman "sözlükte yok" diye reddedilmez.
 */
export const gecerliKelimeler = (sozlukMetni: string, cevaplar: readonly string[]): Set<string> =>
  new Set([...sozlukMetni.split('\n').filter(Boolean), ...cevaplar.map(kucukHarf)]);

export const tahminGecerli = (tahmin: string, gecerliler: ReadonlySet<string>): boolean =>
  gecerliler.has(kucukHarf(tahmin));

/** Kullanıcının bastığı tuşu (KeyboardEvent.key) oyun harfine çevirir; geçersizse null. */
export function tusuHarfeCevir(tus: string): string | null {
  if (Array.from(tus).length !== 1) return null;
  const harf = buyukHarf(tus);
  return ALFABE.includes(harf) ? harf : null;
}

/**
 * Wordle kuralı: önce doğru yerdekiler, sonra kalan harfler sayıları ölçüsünde "var" olur
 * (tekrarlı harflerde fazladan "var" işaretlenmez).
 */
export function degerlendir(tahmin: string, cevap: string): Durum[] {
  const t = Array.from(buyukHarf(tahmin));
  const c = Array.from(buyukHarf(cevap));
  const sonuc: Durum[] = t.map(() => 'yok');
  const kalan = new Map<string, number>();

  t.forEach((harf, i) => {
    if (harf === c[i]) sonuc[i] = 'dogru';
    else kalan.set(c[i]!, (kalan.get(c[i]!) ?? 0) + 1);
  });
  t.forEach((harf, i) => {
    if (sonuc[i] === 'dogru') return;
    const adet = kalan.get(harf) ?? 0;
    if (adet > 0) {
      sonuc[i] = 'var';
      kalan.set(harf, adet - 1);
    }
  });
  return sonuc;
}

/** Klavye tuşu rengi için bir harfin bilinen en iyi durumu: dogru > var > yok. */
const SIRA: Record<Durum, number> = { yok: 0, var: 1, dogru: 2 };
export const dahaIyi = (a: Durum | undefined, b: Durum): Durum => (a !== undefined && SIRA[a] >= SIRA[b] ? a : b);

/** İstanbul takvim gününün (UTC+3, yaz saati yok) gün numarası; günlük kelime buna göre seçilir. */
export function gunNumarasi(simdi: Date): number {
  const MS_GUN = 86_400_000;
  return Math.floor((simdi.getTime() + 3 * 3_600_000) / MS_GUN);
}

const ebob = (a: number, b: number): number => (b === 0 ? a : ebob(b, a % b));

/** Ardışık günler listede komşu kelimelere denk gelmesin diye, liste uzunluğuyla aralarında asal bir adım. */
export const adim = (n: number): number => {
  let a = 7;
  while (ebob(a, n) !== 1) a += 1;
  return a;
};

export const gunlukKelime = (kelimeler: readonly string[], gun: number): string => {
  const n = kelimeler.length;
  return buyukHarf(kelimeler[(((gun * adim(n)) % n) + n) % n]!);
};

export const rastgeleKelime = (kelimeler: readonly string[], rastgele: () => number = Math.random): string =>
  buyukHarf(kelimeler[Math.floor(rastgele() * kelimeler.length)]!);
