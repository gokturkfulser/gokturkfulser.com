// NBA.com/stats bilgi tabloları (Dunk Score, clutch): durum/bayatlık hesabı ve yapıştırılan tablonun doğrulanıp dosya metnine çevrilmesi.
// Ayrıştırma sitenin kendi saf okuyucularıdır (site/src/lib/nba-veri.ts; ikinci kopya yok). Ağdan hiçbir şey çekilmez: veri kullanıcının yapıştırdığı metindir.
// Dosyanın ilk satırı "# guncellendi: YYYY-AA-GG" damgasıdır (İstanbul günü); sitedeki "Son güncelleme" notu ve buradaki bayatlık uyarısı ondan gelir.
import { clutchOku, dunkScoreOku, guncellemeTarihi, type Okuma } from '../../site/src/lib/nba-veri.ts';
import type { NbaKodu } from './yollar.ts';

export type NbaTablosu = {
  ad: string;
  /** Verinin en çok kaç gün eski kalabileceği; aşılırsa uyarı. */
  esikGun: number;
  /** Tablonun NBA sayfası. */
  adres: string;
  /** Güncelleme sıklığının nedeni (sayfada gösterilir). */
  gerekce: string;
  okuyucu: (metin: string) => Okuma<unknown>;
};

export const NBA_TABLOLARI: Record<NbaKodu, NbaTablosu> = {
  'dunk-score': {
    ad: 'Dunk Score',
    esikGun: 3,
    adres: 'https://www.nba.com/stats/players/dunk-scores',
    gerekce: 'Her gece yeni smaçlar listeye girebilir ve "Top 10" sütunu yeni geceleri eşleştirir; en geç 3 günde bir yenileyin.',
    okuyucu: dunkScoreOku,
  },
  clutch: {
    ad: 'Clutch',
    esikGun: 7,
    adres: 'https://www.nba.com/stats/players/clutch-traditional',
    gerekce: 'Clutch ortalamaları yavaş değişir; haftada bir yenilemek yeter.',
    okuyucu: clutchOku,
  },
};

export type NbaDurumu = {
  kod: NbaKodu;
  ad: string;
  adres: string;
  gerekce: string;
  esikGun: number;
  /** Dosya var ve en az bir satır okunabiliyor mu. */
  dolu: boolean;
  satir: number;
  hatalar: string[];
  /** YYYY-AA-GG (İstanbul günü), damga yoksa undefined. */
  guncelleme?: string;
  /** Damgadan bugüne gün; damga yoksa undefined. */
  yas?: number;
  /** Güncelleme gerekiyor: dosya boş/yok, damga yok ya da eşik aşıldı. */
  eski: boolean;
  mesaj: string;
};

/** İstanbul'daki bugünün tarihi (YYYY-AA-GG). İstanbul yıl boyu UTC+3'tür. */
export const bugunIstanbul = (simdiMs: number): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(simdiMs));

/** İki YYYY-AA-GG arasındaki tam gün farkı (negatif olamaz: gelecek damga 0 sayılır). */
export const gunFarki = (bugun: string, once: string): number => Math.max(0, Math.round((Date.UTC(+bugun.slice(0, 4), +bugun.slice(5, 7) - 1, +bugun.slice(8, 10)) - Date.UTC(+once.slice(0, 4), +once.slice(5, 7) - 1, +once.slice(8, 10))) / 86_400_000));

/** Dosyanın (ya da yoksa null) durumu: satır sayısı, damga, bayatlık ve kısa Türkçe mesaj. */
export function nbaDurumu(kod: NbaKodu, metin: string | null, bugun: string): NbaDurumu {
  const t = NBA_TABLOLARI[kod];
  const temel = { kod, ad: t.ad, adres: t.adres, gerekce: t.gerekce, esikGun: t.esikGun };
  if (metin === null || metin.trim() === '') return { ...temel, dolu: false, satir: 0, hatalar: [], eski: true, mesaj: 'Dosya boş; tabloyu yapıştırın.' };
  const r = t.okuyucu(metin);
  const guncelleme = guncellemeTarihi(metin);
  const dolu = r.satirlar.length > 0;
  const ortak = { ...temel, dolu, satir: r.satirlar.length, hatalar: r.hatalar, ...(guncelleme ? { guncelleme } : {}) };
  if (!dolu) return { ...ortak, eski: true, mesaj: 'Dosyada okunabilir satır yok; tabloyu yeniden yapıştırın.' };
  if (!guncelleme) return { ...ortak, eski: true, mesaj: 'Son güncelleme günü bilinmiyor; bir kez yapıştırıp kaydedince yazılır.' };
  const yas = gunFarki(bugun, guncelleme);
  const eski = yas > t.esikGun;
  const mesaj = eski ? `${yas} gündür güncellenmedi (en çok ${t.esikGun} gün olmalı).` : yas === 0 ? 'Bugün güncellendi.' : `${yas} gün önce güncellendi.`;
  return { ...ortak, yas, eski, mesaj };
}

/** En çok kabul edilen yapıştırma/dosya boyutu (GitHub contents API ve Worker istek sınırlarına karşı rahat pay). */
export const EN_COK_KARAKTER = 400_000;
const EN_COK_HATA = 8;

/** Tablo satırı olabilecek satırlar: boş olmayan, sekme içeren; sondaki boşluklar atılır; birebir aynı satırlar bir kez kalır. */
function tabloSatirlari(metin: string): string[] {
  const goruldu = new Set<string>();
  const cikti: string[] = [];
  for (const ham of metin.replace(/\r\n?/g, '\n').split('\n')) {
    const satir = ham.replace(/\s+$/, '');
    if (!satir.includes('\t') || satir.replace(/\t/g, '').trim() === '' || goruldu.has(satir)) continue;
    goruldu.add(satir);
    cikti.push(satir);
  }
  return cikti;
}

export type YapistirmaSonucu = { tamam: true; metin: string; satir: number } | { tamam: false; hatalar: string[] };

/**
 * Yapıştırılan tabloyu dosya metnine çevirir. `degistir`: dosya yalnızca yapıştırılanla yazılır; `ekle`: mevcut satırların sonuna eklenir (tekrarlanan başlık ve
 * aynı satırlar bir kez kalır; çok sayfalı tabloyu sayfa sayfa yapıştırmak için). Sekmesiz satırlar ("Glossary", "300 Rows", sayfa numarası) atılır.
 * Sonuç sitenin okuyucusundan geçer: okunabilir satır yoksa ya da bozuk satır (geçersiz sayı/tarih, eksik sütun) varsa kaydedilmez.
 */
export function nbaYapistir(kod: NbaKodu, mevcutMetin: string, yapistirilan: string, mod: 'degistir' | 'ekle', bugun: string): YapistirmaSonucu {
  if (yapistirilan.length > EN_COK_KARAKTER) return { tamam: false, hatalar: [`Yapıştırılan metin çok uzun (en çok ${EN_COK_KARAKTER.toLocaleString('tr-TR')} karakter).`] };
  const yeni = tabloSatirlari(yapistirilan);
  if (yeni.length === 0) return { tamam: false, hatalar: ['Yapıştırılan metinde sekmeyle ayrılmış tablo satırı bulunamadı. Tabloyu NBA sayfasından başlık satırıyla birlikte seçip kopyalayın.'] };
  const govde = tabloSatirlari(mod === 'ekle' ? `${mevcutMetin}\n${yeni.join('\n')}` : yeni.join('\n'));
  const metin = `# guncellendi: ${bugun}\n${govde.join('\n')}\n`;
  if (metin.length > EN_COK_KARAKTER) return { tamam: false, hatalar: ['Birleşen veri çok uzun; "Değiştir" ile yalnızca gerekli sayfaları yapıştırın.'] };
  const r = NBA_TABLOLARI[kod].okuyucu(metin);
  if (r.satirlar.length === 0) return { tamam: false, hatalar: r.hatalar.length ? r.hatalar.slice(0, EN_COK_HATA) : ['Okunabilir veri satırı bulunamadı; başlık satırıyla birlikte yapıştırın.'] };
  if (r.hatalar.length > 0) {
    const ek = r.hatalar.length > EN_COK_HATA ? [`… ve ${r.hatalar.length - EN_COK_HATA} hata daha`] : [];
    return { tamam: false, hatalar: [...r.hatalar.slice(0, EN_COK_HATA), ...ek] };
  }
  return { tamam: true, metin, satir: r.satirlar.length };
}
