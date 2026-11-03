import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { top10Serialize, top10SonTarih } from './sitemap-lastmod.mjs';

const gecici: string[] = [];
function dizin(dosyalar: Record<string, string>) {
  const kok = mkdtempSync(join(tmpdir(), 'top10-lastmod-'));
  gecici.push(kok);
  for (const [yol, icerik] of Object.entries(dosyalar)) {
    const tam = join(kok, yol);
    mkdirSync(join(tam, '..'), { recursive: true });
    writeFileSync(tam, icerik);
  }
  return kok;
}
afterEach(() => {
  for (const d of gecici.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('top10SonTarih', () => {
  it('en yeni gecenin dosya adındaki tarih (sezon klasörleri arasında da)', () => {
    const d = dizin({ '2026-27/2026-10-20.yaml': 'tur: top10\n', '2026-27/2026-11-02.yaml': 'tur: top10\n', '2025-26/2026-05-01.yaml': 'tur: top10\n', 'oyuncu-adlari.yaml': 'kayitlar: {}\n' });
    expect(top10SonTarih(d)).toBe('2026-11-02');
  });

  it('taslak geceler production\'da sayılmaz, SHOW_DRAFTS\'ta sayılır', () => {
    const d = dizin({ '2026-27/2026-11-01.yaml': 'tur: top10\n', '2026-27/2026-11-02.yaml': 'taslak: true\ntur: top10\n' });
    expect(top10SonTarih(d, false)).toBe('2026-11-01');
    expect(top10SonTarih(d, true)).toBe('2026-11-02');
  });

  it('gece yoksa ya da klasör yoksa undefined', () => {
    expect(top10SonTarih(dizin({ 'oyuncu-adlari.yaml': '' }))).toBeUndefined();
    expect(top10SonTarih(join(tmpdir(), 'olmayan-top10-dizini'))).toBeUndefined();
  });
});

describe('top10Serialize', () => {
  const serialize = top10Serialize('2026-11-02');
  it('iki dildeki Top 10 yazısına lastmod ekler', () => {
    expect(serialize({ url: 'https://gokturkfulser.com/writing/human-highlight-reel/' }).lastmod).toBe('2026-11-02');
    expect(serialize({ url: 'https://gokturkfulser.com/tr/yazilar/nba-izlemesi-en-keyifli-oyuncu/' }).lastmod).toBe('2026-11-02');
  });
  it('diğer sayfalara dokunmaz; tarih yoksa hiçbirine eklemez', () => {
    expect(serialize({ url: 'https://gokturkfulser.com/writing/is-this-october-really-different/' }).lastmod).toBeUndefined();
    expect(top10Serialize(undefined)({ url: 'https://gokturkfulser.com/writing/human-highlight-reel/' }).lastmod).toBeUndefined();
  });
});
