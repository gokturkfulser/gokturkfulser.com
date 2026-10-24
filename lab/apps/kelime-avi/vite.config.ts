import { defineConfig } from 'vite';

// Lab kuralı: çıktı statik, base path /<slug>/. SPA yönlendirmesi gerekirse hash routing (#/…) kullanın;
// tek Worker'da path fallback yoktur.
export default defineConfig({
  base: '/kelime-avi/',
  build: {
    outDir: 'dist',
    target: 'es2022',
    // data: URI üretme (sıkı CSP: img-src/font-src 'self').
    assetsInlineLimit: 0,
  },
});
