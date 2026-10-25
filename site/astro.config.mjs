// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// Saf statik çıktı: adapter yok, output varsayılan ('static').
export default defineConfig({
  site: 'https://gokturkfulser.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [mdx(), sitemap()],
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
  // Türkçe (ğ ş İ) için latin-ext zorunlu. Yön 1: Bricolage Grotesque (başlık/UI) + Newsreader (gövde).
  fonts: [
    {
      name: 'Bricolage Grotesque',
      cssVariable: '--font-baslik',
      provider: fontProviders.fontsource(),
      weights: ['500 800'],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['Arial', 'sans-serif'],
    },
    {
      name: 'Newsreader',
      cssVariable: '--font-metin',
      provider: fontProviders.fontsource(),
      weights: ['400 700'],
      styles: ['normal', 'italic'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['Georgia', 'serif'],
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
