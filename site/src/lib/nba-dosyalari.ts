// src/data/nba/*.tsv dosyalarını build'de okur ve ayrıştırır (ayrıştırma saf fonksiyonlarda: nba-veri.ts). Dosya yoksa ya da boşsa tablo boş döner, bölüm çizilmez.
// Ayrıştırma hataları (bozuk satırlar) build günlüğüne bir kez uyarı olarak yazılır; build durmaz.
import { clutchOku, dunkScoreOku, type ClutchSatiri, type DunkSatiri, type Okuma } from './nba-veri.ts';

const dosyalar = import.meta.glob('../data/nba/*.tsv', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const uyarilan = new Set<string>();

function oku<T>(ad: string, okuyucu: (metin: string) => Okuma<T>): T[] {
  const r = okuyucu(dosyalar[`../data/nba/${ad}.tsv`] ?? '');
  for (const h of r.hatalar) {
    const mesaj = `nba: ${ad}.tsv ${h}`;
    if (!uyarilan.has(mesaj)) {
      uyarilan.add(mesaj);
      console.warn(`[uyarı] ${mesaj}`);
    }
  }
  return r.satirlar;
}

export const nbaDunkScore = (): DunkSatiri[] => oku('dunk-score', dunkScoreOku);
export const nbaClutch = (): ClutchSatiri[] => oku('clutch', clutchOku);
