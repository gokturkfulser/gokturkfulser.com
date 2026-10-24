// lab liste sayfası, 404 ve CSS. Renk/ölçü değerleri site/DESIGN.md (Teal & Orange) token'larıdır;
// orada değişmeden burada değişmez. Sayfa saf statik HTML + tek CSS dosyasıdır, JS yoktur.

const esc = (m) =>
  String(m).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TUR_ADLARI = { oyun: 'Oyun', arac: 'Araç', uygulama: 'Uygulama', site: 'Site' };

export function labCss(fontDosyalari) {
  const yuz = (aile, agirlik, dosya, aralik) =>
    `@font-face{font-family:'${aile}';font-style:normal;font-display:swap;font-weight:${agirlik};` +
    `src:url('/_lab/yazi/${dosya}') format('woff2');unicode-range:${aralik}}`;
  const LATIN =
    'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
  const LATIN_EXT =
    'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
  const f = (ad) => fontDosyalari.find((d) => d === ad);
  return `${[
    yuz('Big Shoulders Display', 800, f('big-shoulders-display-latin-ext-800-normal.woff2'), LATIN_EXT),
    yuz('Big Shoulders Display', 800, f('big-shoulders-display-latin-800-normal.woff2'), LATIN),
    yuz('Literata', 400, f('literata-latin-ext-400-normal.woff2'), LATIN_EXT),
    yuz('Literata', 400, f('literata-latin-400-normal.woff2'), LATIN),
    yuz('Literata', 700, f('literata-latin-ext-700-normal.woff2'), LATIN_EXT),
    yuz('Literata', 700, f('literata-latin-700-normal.woff2'), LATIN),
  ].join('\n')}

:root {
  color-scheme: light dark;
  --zemin: #f4f6f8;
  --murekkep: #16191f;
  --turkuaz: #0e5e66;
  --turkuaz-metin: #0e5e66;
  --turkuaz-alan-metin: #ffffff;
  --yuzey: #ffffff;
  --soluk: #4a5360;
  --turuncu: #e2661a;
  --font-baslik: 'Big Shoulders Display', 'Arial Narrow', sans-serif;
  --font-metin: 'Literata', Georgia, serif;
  --yazi-xs: 0.875rem;
  --yazi-sm: 0.9375rem;
  --yazi-govde: 1.1875rem;
  --yazi-lede: 1.3125rem;
  --yazi-h2: clamp(2rem, 1.6rem + 1.6vw, 2.75rem);
  --yazi-dev: clamp(3.25rem, 1.4rem + 6.6vw, 8.5rem);
  --aralik-1: 0.25rem;
  --aralik-2: 0.5rem;
  --aralik-3: 1rem;
  --aralik-4: 1.5rem;
  --aralik-5: 2.5rem;
  --aralik-6: clamp(2.5rem, 2rem + 3vw, 5rem);
  --kenar: clamp(1.25rem, 0.5rem + 3vw, 3rem);
  --olcu: 68ch;
  --kap: 78rem;
}

@media (prefers-color-scheme: dark) {
  :root {
    --zemin: #0f1317;
    --murekkep: #e9edf1;
    --yuzey: #171d23;
    --soluk: #a3aeba;
    --turkuaz-metin: #5cc3cc;
  }
}

*, *::before, *::after { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  background: var(--zemin);
  color: var(--murekkep);
  font-family: var(--font-metin);
  font-size: var(--yazi-govde);
  line-height: 1.7;
  hyphens: auto;
}

h1, h2 { font-family: var(--font-baslik); font-weight: 800; line-height: 1.06; hyphens: manual; margin: 0; }
p { margin: 0; }
a { color: var(--turkuaz-metin); text-underline-offset: 0.2em; }
a:hover { text-decoration-thickness: 3px; }

:focus-visible { outline: 3px solid var(--turkuaz-metin); outline-offset: 3px; }

.kap { width: min(100% - 2 * var(--kenar), var(--kap)); margin-inline: auto; }

.atla {
  position: absolute; left: var(--aralik-3); top: -4rem; z-index: 10;
  padding: var(--aralik-2) var(--aralik-3); background: var(--murekkep); color: var(--zemin);
}
.atla:focus { top: var(--aralik-3); }

.ust { display: flex; align-items: baseline; gap: var(--aralik-4); padding-block: var(--aralik-4); }
.marka { font-family: var(--font-baslik); font-weight: 800; font-size: 1.875rem; line-height: 1; color: inherit; text-decoration: none; }
.ust a.ana { margin-inline-start: auto; font-size: 1.0625rem; }

/* Düz renk alanı: DESIGN.md'nin "cesaretin harcandığı tek yer". Gradient ve gölge yok. */
.alan { background: var(--turkuaz); color: var(--turkuaz-alan-metin); padding-block: var(--aralik-6); }
.alan h1 { font-size: var(--yazi-dev); line-height: 1.04; }
.alan p { margin-block-start: var(--aralik-3); max-width: 50ch; font-size: var(--yazi-lede); line-height: 1.5; }

.liste { list-style: none; margin: 0; padding: 0; }
.satir {
  display: grid; gap: var(--aralik-4); padding-block: var(--aralik-5);
  grid-template-columns: minmax(0, 18rem) minmax(0, 1fr); align-items: start;
  border-block-end: 1px solid color-mix(in srgb, var(--soluk) 40%, transparent);
}
.satir:last-child { border-block-end: 0; }
.kapak { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: var(--yuzey); }
.satir h2 { font-size: var(--yazi-h2); }
.satir h2 a { color: inherit; text-decoration: none; }
.satir h2 a:hover { text-decoration: underline; text-decoration-thickness: 4px; text-underline-offset: 0.12em; }
.satir p { margin-block-start: var(--aralik-2); max-width: var(--olcu); }
.tur { margin: var(--aralik-3) 0 0; font-size: var(--yazi-sm); color: var(--soluk); }
.tur dt { display: inline; }
.tur dd { display: inline; margin: 0; }
.tur dt::after { content: ': '; }
.bos { padding-block: var(--aralik-6); color: var(--soluk); }

.alt { padding-block: var(--aralik-5); color: var(--soluk); font-size: var(--yazi-sm); }

@media (max-width: 40rem) {
  .satir { grid-template-columns: minmax(0, 1fr); gap: var(--aralik-3); }
}
`;
}

const kabuk = (baslik, aciklama, govde) => `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(baslik)}</title>
    <meta name="description" content="${esc(aciklama)}" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="preload" href="/_lab/yazi/big-shoulders-display-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="stylesheet" href="/_lab/lab.css" />
  </head>
  <body>
    <a class="atla" href="#icerik">İçeriğe geç</a>
    <header class="kap ust">
      <a class="marka" href="/">Lab</a>
      <a class="ana" href="https://gokturkfulser.com/">gokturkfulser.com</a>
    </header>
    <main id="icerik">
${govde}
    </main>
    <footer class="kap alt">
      <p>© ${new Date().getFullYear()} Göktürk Fulser. Küçük oyunlar ve araçlar; hepsi tarayıcıda çalışır.</p>
    </footer>
  </body>
</html>
`;

export function indexSayfasi(uygulamalar) {
  const satirlar = uygulamalar
    .map(({ slug, meta }) => {
      const tur = TUR_ADLARI[meta.tur] ?? meta.tur;
      return `        <li class="satir">
          <a href="/${slug}/" tabindex="-1" aria-hidden="true"><img class="kapak" src="/${slug}/${esc(meta.kapak)}" alt="" width="640" height="480" loading="lazy" /></a>
          <div>
            <h2><a href="/${slug}/">${esc(meta.ad)}</a></h2>
            <p>${esc(meta.ozet)}</p>
            <dl class="tur"><dt>Tür</dt> <dd>${esc(tur)}</dd></dl>
          </div>
        </li>`;
    })
    .join('\n');
  const govde = `      <section class="alan">
        <div class="kap">
          <h1>Lab</h1>
          <p>Küçük oyunlar ve araçlar. Her biri kendi sayfasında, tarayıcıda çalışır.</p>
        </div>
      </section>
      <div class="kap">
        <ul class="liste">
${satirlar}
        </ul>
      </div>`;
  return kabuk('Lab · Göktürk Fulser', 'Göktürk Fulser’in küçük oyunları ve araçları.', govde);
}

export function lab404() {
  const govde = `      <section class="alan">
        <div class="kap">
          <h1>Sayfa bulunamadı</h1>
          <p>Aradığınız adres lab’da yok.</p>
        </div>
      </section>
      <div class="kap bos"><p><a href="/">Lab’ın ana sayfasına dön</a></p></div>`;
  return kabuk('Sayfa bulunamadı · Lab', 'Aradığınız adres lab’da yok.', govde);
}
