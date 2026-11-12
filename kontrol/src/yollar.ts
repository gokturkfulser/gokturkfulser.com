// Repo yolu beyaz listesi. Düzenleyici yalnızca şu dosya türlerini okur/yazar:
//   gece:   site/src/content/top10/<sezon>/<YYYY-AA-GG>.yaml
//   sozluk: site/src/content/top10/oyuncu-adlari.yaml
//   nba:    site/src/data/nba/dunk-score.tsv ve site/src/data/nba/clutch.tsv (tam bu iki yol; NBA.com/stats tablolarının yapıştırıldığı bilgi tabloları)
// Okuma için ek olarak dizin listeleme (yalnızca top10 klasörü ve sezon klasörleri): geceler listesi için gerekir; yazma yoktur.
// Başka her yol (".." ve kaçış dizileri dahil) 400 ile reddedilir; GitHub'a hiçbir istek gitmez.
import { sezonKlasoru } from '../../site/src/lib/top10.ts';

export const TOP10_DIZINI = 'site/src/content/top10';
const TOP10 = TOP10_DIZINI;
export const SOZLUK_YOLU = `${TOP10}/oyuncu-adlari.yaml`;
const GECE_KALIBI = /^site\/src\/content\/top10\/(\d{4}-\d{2})\/(\d{4}-\d{2}-\d{2})\.yaml$/;
const SEZON_KALIBI = /^\d{4}-\d{2}$/;

/** NBA tablo dosyaları: kod → repo yolu (yalnızca bu iki yol; yeni dosya oluşturulmaz). */
export const NBA_YOLLARI = {
  'dunk-score': 'site/src/data/nba/dunk-score.tsv',
  clutch: 'site/src/data/nba/clutch.tsv',
} as const;
export type NbaKodu = keyof typeof NBA_YOLLARI;
const NBA_YOL_LISTESI: readonly string[] = Object.values(NBA_YOLLARI);

/** Adresten gelen kod bilinen bir NBA tablosu mu? (Object.prototype anahtarları kabul edilmez.) */
export const nbaKodu = (kod: string): NbaKodu | null => (Object.prototype.hasOwnProperty.call(NBA_YOLLARI, kod) ? (kod as NbaKodu) : null);

export type YolTuru = 'gece' | 'sozluk' | 'nba' | 'dizin';

export class YolHatasi extends Error {
  readonly durum = 400;
  constructor(yol: string) {
    super(`izin verilmeyen yol: ${yol.slice(0, 120)}`);
  }
}

const gecerliTarih = (t: string) => {
  const d = new Date(`${t}T00:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === t;
};

/** Gece dosyasının yolu (tarih geçerli bir takvim günü olmalı). */
export function geceYolu(tarih: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih) || !gecerliTarih(tarih)) throw new YolHatasi(tarih);
  return `${TOP10}/${sezonKlasoru(tarih)}/${tarih}.yaml`;
}

/** Yolun türü; beyaz listede değilse null. `yaz` istenirse dizin kabul edilmez. */
export function yolTuru(yol: string, islem: 'oku' | 'yaz'): YolTuru | null {
  if (typeof yol !== 'string' || yol === '' || /[\\%?#\0]|\.\.|\/\/|^\/|\/$/.test(yol)) return null;
  if (yol === SOZLUK_YOLU) return 'sozluk';
  if (NBA_YOL_LISTESI.includes(yol)) return 'nba';
  const g = GECE_KALIBI.exec(yol);
  if (g) return gecerliTarih(g[2]!) && sezonKlasoru(g[2]!) === g[1] ? 'gece' : null;
  if (islem === 'oku') {
    if (yol === TOP10) return 'dizin';
    const s = yol.slice(TOP10.length + 1);
    if (yol.startsWith(`${TOP10}/`) && SEZON_KALIBI.test(s)) return 'dizin';
  }
  return null;
}

/** Beyaz listede değilse YolHatasi (400) fırlatır. */
export function yolDogrula(yol: string, islem: 'oku' | 'yaz'): YolTuru {
  const t = yolTuru(yol, islem);
  if (!t) throw new YolHatasi(String(yol));
  return t;
}
