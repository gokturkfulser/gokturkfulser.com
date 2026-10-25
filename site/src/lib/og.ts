// OG görseli: Satori (SVG) + resvg (PNG). Renk ve fontlar DESIGN.md Yön 1 token'larıyla aynı (koyu perde + vurgu çizgisi).
// Satori woff2 okuyamaz; @fontsource'un statik woff dosyaları kullanılır. Türkçe (ğ ş İ) için
// her fontun latin + latin-ext dosyası ayrı aile adıyla verilir ('… Ext'); fontFamily listesi
// ("Ana, Ana Ext") eksik glifi latin-ext dosyasından alır. Aynı ad iki kez verilirse yedek çalışmaz.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

export type OgDunya = 'sinema' | 'basketbol' | 'varsayilan';

type Girdi = {
  dunya: OgDunya;
  baslik: string;
  /** Başlığın altındaki satır, ör. tarih. */
  altBilgi?: string;
  /** Başlığın üstündeki bölüm adı. */
  bolumAdi?: string;
};

const RENK = {
  sinema: { zemin: '#0a0d12', metin: '#eef1f4', soluk: '#9aa5b1', vurgu: '#3fc8cf' },
  basketbol: { zemin: '#0a0d12', metin: '#eef1f4', soluk: '#9aa5b1', vurgu: '#ff7a2f' },
  varsayilan: { zemin: '#0a0d12', metin: '#eef1f4', soluk: '#9aa5b1', vurgu: '#3fc8cf' },
} as const;

let fontlar: Promise<
  { name: string; data: Buffer; weight: 400 | 800; style: 'normal' }[]
> | null = null;

function fontlariYukle() {
  fontlar ??= (async () => {
    const dosya = (paket: string, ad: string) =>
      readFile(join(process.cwd(), 'node_modules/@fontsource', paket, 'files', ad));
    return [
      { name: 'Bricolage Grotesque', data: await dosya('bricolage-grotesque', 'bricolage-grotesque-latin-800-normal.woff'), weight: 800 as const, style: 'normal' as const },
      { name: 'Bricolage Grotesque Ext', data: await dosya('bricolage-grotesque', 'bricolage-grotesque-latin-ext-800-normal.woff'), weight: 800 as const, style: 'normal' as const },
      { name: 'Newsreader', data: await dosya('newsreader', 'newsreader-latin-400-normal.woff'), weight: 400 as const, style: 'normal' as const },
      { name: 'Newsreader Ext', data: await dosya('newsreader', 'newsreader-latin-ext-400-normal.woff'), weight: 400 as const, style: 'normal' as const },
    ];
  })();
  return fontlar;
}

// Satori JSX yerine düz nesne ağacı kabul eder.
const BASLIK_AILESI = 'Bricolage Grotesque, Bricolage Grotesque Ext';
const METIN_AILESI = 'Newsreader, Newsreader Ext';

const el = (type: string, style: Record<string, unknown>, children?: unknown) => ({
  type,
  props: { style, children },
});

function baslikBoyutu(baslik: string) {
  const n = baslik.length;
  if (n <= 24) return 138;
  if (n <= 40) return 104;
  if (n <= 64) return 84;
  return 70;
}

export async function ogPng({ dunya, baslik, altBilgi, bolumAdi }: Girdi): Promise<Uint8Array<ArrayBuffer>> {
  const { zemin, metin, soluk, vurgu } = RENK[dunya];
  const varsayilan = dunya === 'varsayilan';

  const agac = el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      boxSizing: 'border-box',
      width: 1200,
      height: 630,
      padding: '64px 72px',
      background: zemin,
      color: metin,
      fontFamily: METIN_AILESI,
    },
    [
      el('div', { display: 'flex', justifyContent: 'space-between', fontSize: 34 }, [
        el('div', { display: 'flex', fontFamily: BASLIK_AILESI, fontWeight: 800, fontSize: 48, letterSpacing: -2 }, 'Göktürk Fulser'),
        el('div', { display: 'flex', color: soluk }, bolumAdi ?? ''),
      ]),
      el(
        'div',
        {
          display: 'flex',
          fontFamily: BASLIK_AILESI,
          fontWeight: 800,
          fontSize: baslikBoyutu(baslik),
          lineHeight: 1,
          letterSpacing: -5,
        },
        baslik,
      ),
      varsayilan
        ? el('div', { display: 'flex', width: '100%', height: 12 }, [
            el('div', { display: 'flex', flex: 1, background: '#3fc8cf' }),
            el('div', { display: 'flex', flex: 1, background: '#ff7a2f' }),
          ])
        : el('div', { display: 'flex', flexDirection: 'column', gap: 24 }, [
            el('div', { display: 'flex', width: '100%', height: 8, background: vurgu }),
            el('div', { display: 'flex', justifyContent: 'space-between', fontSize: 30, color: soluk }, [
              el('div', { display: 'flex' }, altBilgi ?? ''),
              el('div', { display: 'flex' }, 'gokturkfulser.com'),
            ]),
          ]),
    ],
  );

  const svg = await satori(agac as never, { width: 1200, height: 630, fonts: await fontlariYukle() });
  return new Uint8Array(new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng());
}
