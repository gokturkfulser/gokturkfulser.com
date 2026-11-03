import { describe, expect, it } from 'vitest';
import { ETIKET_ANAHTARLARI, ETIKETLER, GEMINI_ETIKET, TAKIM_KODLARI, TAKIM_VARYANTLARI, takimKodunuCevir } from './top10-sozluk';

describe('clutch etiketi', () => {
  it('anahtar, Gemini değeri ve görünen adlar', () => {
    expect(ETIKETLER.clutch).toEqual({ tr: 'Clutch', en: 'Clutch', gemini: 'clutch' });
    expect(ETIKET_ANAHTARLARI).toContain('clutch');
    expect(GEMINI_ETIKET.clutch).toBe('clutch');
  });
});

describe('takım kodu varyantları', () => {
  it('her varyant resmi 30 koddan birine çevrilir; varyant resmi kod değildir', () => {
    for (const [v, r] of Object.entries(TAKIM_VARYANTLARI)) {
      expect(TAKIM_KODLARI).toContain(r);
      expect(TAKIM_KODLARI).not.toContain(v);
    }
  });
  it('istenen çeviriler', () => {
    const beklenen: Record<string, string> = { PHO: 'PHX', GS: 'GSW', GOS: 'GSW', NO: 'NOP', NOR: 'NOP', NOH: 'NOP', SA: 'SAS', SAN: 'SAS', NY: 'NYK', NYC: 'NYK', BRK: 'BKN', BKLYN: 'BKN', CHO: 'CHA', CHH: 'CHA', UTAH: 'UTA', UTH: 'UTA', WSH: 'WAS' };
    for (const [v, r] of Object.entries(beklenen)) expect(takimKodunuCevir(v)).toEqual({ kod: r, cevrildi: true });
  });
  it('küçük harf işlenir; resmi kod aynen kalır; NJ ve bilinmeyenler çevrilmez', () => {
    expect(takimKodunuCevir(' pho ')).toEqual({ kod: 'PHX', cevrildi: true });
    expect(takimKodunuCevir('wsh')).toEqual({ kod: 'WAS', cevrildi: true });
    expect(takimKodunuCevir('GSW')).toEqual({ kod: 'GSW', cevrildi: false });
    expect(takimKodunuCevir('NJ')).toEqual({ kod: 'NJ', cevrildi: false });
    expect(takimKodunuCevir('XYZ').cevrildi).toBe(false);
  });
});
