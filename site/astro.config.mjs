// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { sitemapDilAlternatifleri } from './scripts/sitemap-hreflang.mjs';
import { top10Serialize, top10SonTarih } from './scripts/sitemap-lastmod.mjs';

import { existsSync, readFileSync } from 'node:fs';

/**
 * Geliştirici kontrol sayfası (/kontrol/top10/): yalnızca SHOW_DRAFTS=true ortamında (preview build'leri, `top10-kontrol` dalı, yerel geliştirme) rotaya eklenir.
 * Production'da sayfa dosyası (src/kontrol-sayfalari/) modül grafiğine hiç girmez; sayfa, bağlantı, veri ve CSS'i dist'e çıkmaz.
 * SHOW_DRAFTS okuması taslak-loader.ts ile aynıdır: süreç ortamı, yoksa site/.env dosyası (yapılandırma dosyası .env'yi kendisi yüklemez).
 */
const envDosyasindaTaslak = existsSync('.env') && /^SHOW_DRAFTS\s*=\s*["']?true["']?\s*$/m.test(readFileSync('.env', 'utf8'));
const taslakGorunur = process.env.SHOW_DRAFTS === 'true' || (process.env.SHOW_DRAFTS === undefined && envDosyasindaTaslak);
/** @type {import('astro').AstroIntegration} */
const kontrolSayfasi = {
  name: 'kontrol-sayfasi',
  hooks: {
    'astro:config:setup': ({ injectRoute }) => {
      if (taslakGorunur) injectRoute({ pattern: '/kontrol/top10', entrypoint: './src/kontrol-sayfalari/top10.astro' });
    },
  },
};

// Saf statik çıktı: adapter yok, output varsayılan ('static').
export default defineConfig({
  site: 'https://gokturkfulser.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  // i18n: İngilizce (varsayılan) kökte, Türkçe /tr/ altında. Sayfa dosyaları src/pages (en) ve src/pages/tr (tr); yol parçaları dile göre
  // yerelleşir (writing ↔ yazilar…), bu yüzden adresleri i18n/yollar.ts üretir. Tarayıcı diline göre otomatik yönlendirme yoktur.
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'tr'],
    routing: { prefixDefaultLocale: false },
  },
  // Sitemap'in kendi i18n eşlemesi yol önekine bakar; yollar dile göre değiştiği için dil alternatifleri sayfalardaki
  // hreflang bağlantılarından okunup sitemap'e yazılır (scripts/sitemap-hreflang.mjs). Sıra önemli: sitemap'ten sonra.
  // Sitemap `lastmod`: yalnızca Top 10 yazılarında, en yeni gecenin tarihi (taslak geceler production'da sayılmaz); diğer girdilerde lastmod yok.
  integrations: [
    mdx(),
    kontrolSayfasi,
    sitemap({
      filter: (sayfa) => !/\/404\/?$/.test(sayfa) && !/\/kontrol\//.test(sayfa),
      serialize: top10Serialize(top10SonTarih('src/content/top10', taslakGorunur)),
    }),
    sitemapDilAlternatifleri(),
  ],
  devToolbar: { enabled: false },
  // CSP (hash tabanlı, 'unsafe-inline' yok). Astro her sayfaya <meta http-equiv="content-security-policy">
  // koyar: script-src/style-src hash'leri otomatik, aşağıdaki directives tüm sayfalara eklenir.
  // <meta> frame-ancestors/report-uri/sandbox'ı desteklemez; frame-ancestors public/_headers'tan gider.
  // Header ve meta birlikte uygulanır (kesişim); _headers'taki CSP yalnızca meta'da bulunmayan
  // direktifi taşır, böylece iki politika çakışmaz.
  security: {
    csp: {
      scriptDirective: {
        // Resources verilince 'self' otomatik gelmez; açıkça yazılır.
        resources: ["'self'", 'https://static.cloudflareinsights.com'],
      },
      directives: [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "form-action 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        // Cloudflare Web Analytics beacon'ı (manuel gömme) verisini cloudflareinsights.com'a yollar.
        "connect-src 'self' https://cloudflareinsights.com",
        // lab (oyun/uygulama gömme) ve DemoVideo'nun desteklediği YouTube/Vimeo gömmeleri.
        "frame-src https://lab.gokturkfulser.com https://www.youtube-nocookie.com https://player.vimeo.com",
        "media-src 'self'",
        'upgrade-insecure-requests',
      ],
    },
  },
  // Fontlar build sırasında indirilip kendi domain'imizden servis edilir.
  // Türkçe (ğ ş İ) için latin-ext zorunlu. Cormorant yalnızca koyu bantta ve ≥ 24 px (başlık);
  // Hanken Grotesk her yerde (kâğıt yüzeyler ve ≤ 24 px dahil). İki serif aile yoktur (DESIGN.md "Fontlar").
  fonts: [
    {
      name: 'Cormorant',
      cssVariable: '--font-baslik',
      provider: fontProviders.fontsource(),
      weights: ['500', '600'],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['Georgia', 'serif'],
    },
    {
      name: 'Hanken Grotesk',
      cssVariable: '--font-metin',
      provider: fontProviders.fontsource(),
      weights: ['400 700'],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['Arial', 'sans-serif'],
    },
  ],
  env: {
    schema: {
      // true ise taslak içerikler de derlenir (yalnızca preview build'leri için).
      SHOW_DRAFTS: envField.boolean({ context: 'server', access: 'public', default: false }),
      // Tanımlıysa ana sayfada "son izlediklerim" şeridi build sırasında çekilir.
      LETTERBOXD_RSS: envField.string({ context: 'server', access: 'public', optional: true }),
      // Tanımlıysa Cloudflare Web Analytics script'i eklenir.
      CF_ANALYTICS_TOKEN: envField.string({ context: 'server', access: 'public', optional: true }),
    },
  },
});
