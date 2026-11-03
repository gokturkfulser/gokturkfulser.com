// Top 10 yazılarının sitemap `lastmod` değeri: en yeni gecenin tarihi (YYYY-AA-GG). Build yapılandırması (astro.config.mjs → sitemap
// `serialize`) kullanır; yalnızca dosya adlarına ve `taslak: true` satırına bakar (production'da taslak geceler sayılmaz, SHOW_DRAFTS'ta sayılır).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** lastmod'u en yeni gece olan yazı adresi parçaları (her dilin slug'ı). */
export const TOP10_YAZI_SLUGLARI = ['nba-izlemesi-en-keyifli-oyuncu', 'human-highlight-reel'];

/**
 * `dizin` (src/content/top10) altındaki `<sezon>/<YYYY-AA-GG>.yaml` dosyalarından en yeni gecenin tarihi; gece yoksa undefined.
 * `taslakGorunur` false ise `taslak: true` olan geceler yok sayılır.
 */
export function top10SonTarih(dizin, taslakGorunur = false) {
  if (!existsSync(dizin)) return undefined;
  let son;
  for (const sezon of readdirSync(dizin, { withFileTypes: true })) {
    if (!sezon.isDirectory()) continue;
    for (const dosya of readdirSync(join(dizin, sezon.name))) {
      const eslesme = /^(\d{4}-\d{2}-\d{2})\.yaml$/.exec(dosya);
      if (!eslesme) continue;
      if (!taslakGorunur && /^taslak:\s*true\s*$/m.test(readFileSync(join(dizin, sezon.name, dosya), 'utf8'))) continue;
      if (son === undefined || eslesme[1] > son) son = eslesme[1];
    }
  }
  return son;
}

/** `@astrojs/sitemap` `serialize` fonksiyonu: Top 10 yazılarına `lastmod` ekler, diğer girdilere dokunmaz. */
export function top10Serialize(sonTarih) {
  return (item) => {
    if (sonTarih && TOP10_YAZI_SLUGLARI.includes(new URL(item.url).pathname.split('/').filter(Boolean).at(-1) ?? '')) item.lastmod = sonTarih;
    return item;
  };
}
