// Build sonrası i18n düzeltmeleri: (1) Türkçe 404 dosyası, (2) sitemap dil alternatifleri.
// Sitemap'e dil alternatiflerini (xhtml:link hreflang) ekler. Kaynak: build edilen her sayfanın <head>'indeki
// <link rel="alternate" hreflang> bağlantıları; böylece sitemap ile sayfalar hiçbir zaman ayrışmaz.
// @astrojs/sitemap'in `i18n` seçeneği yol önekine göre eşler; bu sitede yol parçaları dile göre değiştiği için (writing ↔ yazilar) uygun değildir.
// noindex olan sayfalar (404, SHOW_DRAFTS preview'ı) sitemap'te zaten olmamalı; olursa çıkarılır.
import { existsSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const htmlYolu = (dist, url) => {
  const yol = new URL(url).pathname.replace(/^\//, '');
  const dosya = join(dist, yol, 'index.html');
  return existsSync(dosya) ? dosya : undefined;
};

export function sitemapDilAlternatifleri() {
  return {
    name: 'sitemap-dil-alternatifleri',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const dist = fileURLToPath(dir);
        // Workers static assets "en yakın 404.html"i arar (dizin ağacında yukarı doğru): Türkçe 404, /tr/ altındaki istekler için tr/404.html olmalı.
        // Astro dizin biçiminde iç içe 404'ü tr/404/index.html yazar; dosyaya taşınır.
        const tr404 = join(dist, 'tr', '404', 'index.html');
        if (existsSync(tr404)) {
          renameSync(tr404, join(dist, 'tr', '404.html'));
          rmSync(join(dist, 'tr', '404'), { recursive: true });
          logger.info('tr/404/index.html → tr/404.html');
        }
        const dosyalar = readdirSync(dist).filter((f) => /^sitemap-\d+\.xml$/.test(f));
        let eklenen = 0;
        for (const ad of dosyalar) {
          const yol = join(dist, ad);
          const xml = readFileSync(yol, 'utf8');
          const yeni = xml.replace(/<url>\s*<loc>([^<]+)<\/loc>\s*<\/url>/g, (tam, loc) => {
            const html = htmlYolu(dist, loc);
            if (!html) return tam;
            const kaynak = readFileSync(html, 'utf8');
            const linkler = [...kaynak.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\s*\/?>/g)];
            if (linkler.length === 0) return tam;
            eklenen++;
            const satirlar = linkler.map(([, dil, href]) => `<xhtml:link rel="alternate" hreflang="${dil}" href="${href}"/>`).join('');
            return `<url><loc>${loc}</loc>${satirlar}</url>`;
          });
          writeFileSync(yol, yeni);
        }
        logger.info(`${eklenen} sitemap girdisine dil alternatifi eklendi.`);
      },
    },
  };
}
