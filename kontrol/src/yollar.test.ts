import { describe, expect, it } from 'vitest';
import { geceYolu, SOZLUK_YOLU, TOP10_DIZINI, yolDogrula, yolTuru, YolHatasi } from './yollar.ts';

describe('yol beyaz listesi', () => {
  it('izinli yollar: gece dosyası, ad sözlüğü (okuma ve yazma); dizin yalnızca okuma', () => {
    expect(yolTuru('site/src/content/top10/2026-27/2026-11-01.yaml', 'yaz')).toBe('gece');
    expect(yolTuru('site/src/content/top10/2027-28/2027-10-20.yaml', 'oku')).toBe('gece');
    expect(yolTuru(SOZLUK_YOLU, 'yaz')).toBe('sozluk');
    expect(yolTuru(TOP10_DIZINI, 'oku')).toBe('dizin');
    expect(yolTuru('site/src/content/top10/2026-27', 'oku')).toBe('dizin');
    expect(yolTuru(TOP10_DIZINI, 'yaz')).toBeNull();
    expect(yolTuru('site/src/content/top10/2026-27', 'yaz')).toBeNull();
  });

  it('başka her yol reddedilir: başka klasör, uzantı, sezon uyuşmazlığı, geçersiz tarih, dizin geçişi, kaçış dizileri', () => {
    const kotu = [
      '',
      'site/package.json',
      '.github/workflows/site-top10.yml',
      'site/src/content/top10/2026-27/2026-11-01.yml',
      'site/src/content/top10/2026-27/2026-11-01.yaml.bak',
      'site/src/content/top10/2026-27/notlar.yaml',
      'site/src/content/top10/2025-26/2026-11-01.yaml', // sezon tarihle uyuşmuyor
      'site/src/content/top10/2026-27/2026-02-30.yaml', // gerçek olmayan gün
      'site/src/content/top10/2026-27/../../../../package.json',
      'site/src/content/top10/../top10/oyuncu-adlari.yaml',
      'site/src/content/top10/2026-27/2026-11-01.yaml/..',
      '/site/src/content/top10/oyuncu-adlari.yaml',
      'site/src/content/top10/oyuncu-adlari.yaml/',
      'site//src/content/top10/oyuncu-adlari.yaml',
      'site/src/content/top10/2026-27/2026-11-01%2eyaml',
      'site\\src\\content\\top10\\oyuncu-adlari.yaml',
      'site/src/content/top10/oyuncu-adlari.yaml?ref=baska',
      'site/src/content/top10/oyuncu-adlari.yaml#x',
      'site/src/content/top10/2026-27/2026-11-01.yaml\0.txt',
      'site/src/content/top10/yedek/2026-11-01.yaml',
      'site/src/content/sinema/yazi/index.mdx',
      'site/src/content/top10',
    ];
    for (const y of kotu.filter((k) => k !== 'site/src/content/top10')) {
      expect(yolTuru(y, 'oku'), y).toBeNull();
      expect(yolTuru(y, 'yaz'), y).toBeNull();
      expect(() => yolDogrula(y, 'oku'), y).toThrow(YolHatasi);
    }
  });

  it('geceYolu: tarihten sezon klasörlü yol; geçersiz tarih YolHatasi (400)', () => {
    expect(geceYolu('2026-11-01')).toBe('site/src/content/top10/2026-27/2026-11-01.yaml');
    expect(geceYolu('2027-01-15')).toBe('site/src/content/top10/2026-27/2027-01-15.yaml');
    for (const t of ['2026-13-01', '2026-02-30', '../x', '2026-1-1', '']) expect(() => geceYolu(t), t).toThrow(YolHatasi);
    expect(new YolHatasi('x').durum).toBe(400);
  });
});
