// OG görseli: Satori (SVG) + resvg (PNG). Renk ve fontlar DESIGN.md token'larıyla aynı (koyu perde + vurgu çizgisi; başlık Cormorant ≥ 24 px, yazı Hanken Grotesk).
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
  sinema: { zemin: '#0b0c0e', metin: '#ece8e1', soluk: '#c9c3b8', vurgu: '#4fd1d9' },
  basketbol: { zemin: '#0b0c0e', metin: '#ece8e1', soluk: '#c9c3b8', vurgu: '#ff8a3d' },
  varsayilan: { zemin: '#0b0c0e', metin: '#ece8e1', soluk: '#c9c3b8', vurgu: '#4fd1d9' },
} as const;

let fontlar: Promise<
  { name: string; data: Buffer; weight: 400 | 500; style: 'normal' }[]
> | null = null;

function fontlariYukle() {
  fontlar ??= (async () => {
    const dosya = (paket: string, ad: string) =>
      readFile(join(process.cwd(), 'node_modules/@fontsource', paket, 'files', ad));
    return [
      { name: 'Cormorant', data: await dosya('cormorant', 'cormorant-latin-500-normal.woff'), weight: 500 as const, style: 'normal' as const },
      { name: 'Cormorant Ext', data: await dosya('cormorant', 'cormorant-latin-ext-500-normal.woff'), weight: 500 as const, style: 'normal' as const },
      { name: 'Hanken Grotesk', data: await dosya('hanken-grotesk', 'hanken-grotesk-latin-400-normal.woff'), weight: 400 as const, style: 'normal' as const },
      { name: 'Hanken Grotesk Ext', data: await dosya('hanken-grotesk', 'hanken-grotesk-latin-ext-400-normal.woff'), weight: 400 as const, style: 'normal' as const },
    ];
  })();
  return fontlar;
}

// Satori JSX yerine düz nesne ağacı kabul eder.
const BASLIK_AILESI = 'Cormorant, Cormorant Ext';
const METIN_AILESI = 'Hanken Grotesk, Hanken Grotesk Ext';

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
        el('div', { display: 'flex', fontFamily: BASLIK_AILESI, fontWeight: 500, fontSize: 52, letterSpacing: -1 }, 'Göktürk Fulser'),
        el('div', { display: 'flex', color: soluk }, bolumAdi ?? ''),
      ]),
      el(
        'div',
        {
          display: 'flex',
          fontFamily: BASLIK_AILESI,
          fontWeight: 500,
          fontSize: baslikBoyutu(baslik) + 14,
          lineHeight: 0.98,
          letterSpacing: -3,
        },
        baslik,
      ),
      varsayilan
        ? el('div', { display: 'flex', width: '100%', height: 12 }, [
            el('div', { display: 'flex', flex: 1, background: '#4fd1d9' }),
            el('div', { display: 'flex', flex: 1, background: '#ff8a3d' }),
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
