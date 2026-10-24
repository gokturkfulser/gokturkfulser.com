// OG görseli: Satori (SVG) + resvg (PNG). Renk ve fontlar DESIGN.md token'larıyla aynı.
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
  sinema: { zemin: '#0e5e66', metin: '#ffffff' },
  basketbol: { zemin: '#e2661a', metin: '#16191f' },
  varsayilan: { zemin: '#f4f6f8', metin: '#16191f' },
} as const;

let fontlar: Promise<
  { name: string; data: Buffer; weight: 400 | 800; style: 'normal' }[]
> | null = null;

function fontlariYukle() {
  fontlar ??= (async () => {
    const dosya = (paket: string, ad: string) =>
      readFile(join(process.cwd(), 'node_modules/@fontsource', paket, 'files', ad));
    return [
      { name: 'Big Shoulders Display', data: await dosya('big-shoulders-display', 'big-shoulders-display-latin-800-normal.woff'), weight: 800 as const, style: 'normal' as const },
      { name: 'Big Shoulders Display Ext', data: await dosya('big-shoulders-display', 'big-shoulders-display-latin-ext-800-normal.woff'), weight: 800 as const, style: 'normal' as const },
      { name: 'Literata', data: await dosya('literata', 'literata-latin-400-normal.woff'), weight: 400 as const, style: 'normal' as const },
      { name: 'Literata Ext', data: await dosya('literata', 'literata-latin-ext-400-normal.woff'), weight: 400 as const, style: 'normal' as const },
    ];
  })();
  return fontlar;
}

// Satori JSX yerine düz nesne ağacı kabul eder.
const BASLIK_AILESI = 'Big Shoulders Display, Big Shoulders Display Ext';
const METIN_AILESI = 'Literata, Literata Ext';

const el = (type: string, style: Record<string, unknown>, children?: unknown) => ({
  type,
  props: { style, children },
});

function baslikBoyutu(baslik: string) {
  const n = baslik.length;
  if (n <= 24) return 150;
  if (n <= 40) return 112;
  if (n <= 64) return 92;
  return 76;
}

export async function ogPng({ dunya, baslik, altBilgi, bolumAdi }: Girdi): Promise<Uint8Array<ArrayBuffer>> {
  const { zemin, metin } = RENK[dunya];
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
        el('div', { display: 'flex', fontFamily: BASLIK_AILESI, fontWeight: 800, fontSize: 48 }, 'Göktürk Fulser'),
        el('div', { display: 'flex' }, bolumAdi ?? ''),
      ]),
      el(
        'div',
        {
          display: 'flex',
          fontFamily: BASLIK_AILESI,
          fontWeight: 800,
          fontSize: baslikBoyutu(baslik),
          lineHeight: 1.04,
          letterSpacing: -1,
        },
        baslik,
      ),
      varsayilan
        ? el('div', { display: 'flex', width: '100%', height: 36 }, [
            el('div', { display: 'flex', flex: 1, background: '#0e5e66' }),
            el('div', { display: 'flex', flex: 1, background: '#e2661a' }),
          ])
        : el('div', { display: 'flex', justifyContent: 'space-between', fontSize: 30 }, [
            el('div', { display: 'flex' }, altBilgi ?? ''),
            el('div', { display: 'flex' }, 'gokturkfulser.com'),
          ]),
    ],
  );

  const svg = await satori(agac as never, { width: 1200, height: 630, fonts: await fontlariYukle() });
  return new Uint8Array(new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng());
}
