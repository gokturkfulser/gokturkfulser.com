import { describe, expect, it } from 'vitest';
import { clutchTamamla, ETIKET_ANAHTARLARI, ETIKETLER, EYLEM_ANAHTARLARI, EYLEMLER, GEMINI_ETIKET, GEMINI_EYLEM, GEMINI_ROL, ROL_ANAHTARLARI, ROLLER, TAKIM_KODLARI, TAKIM_VARYANTLARI, takimKodunuCevir } from './top10-sozluk';

describe('clutch etiketi', () => {
  it('anahtar, Gemini değeri ve görünen adlar', () => {
    expect(ETIKETLER.clutch).toEqual({ tr: 'Clutch', en: 'Clutch', gemini: 'clutch' });
    expect(ETIKET_ANAHTARLARI).toContain('clutch');
    expect(GEMINI_ETIKET.clutch).toBe('clutch');
  });
});

describe('çalım eylemi, çalım atan rolü ve eşitleyen etiketi', () => {
  it('anahtar, Gemini değeri ve görünen adlar', () => {
    expect(EYLEMLER.calim).toEqual({ tr: 'Handles', en: 'Handles', gemini: 'dribble_move' });
    expect(ROLLER.calim_atan).toEqual({ tr: 'Ball handler', en: 'Ball handler', gemini: 'ball_handler' });
    expect(ETIKETLER.esitleyen).toEqual({ tr: 'Eşitleyen', en: 'Game-tying', gemini: 'game_tying' });
    expect(EYLEM_ANAHTARLARI).toContain('calim');
    expect(ROL_ANAHTARLARI).toContain('calim_atan');
    expect(ETIKET_ANAHTARLARI).toContain('esitleyen');
  });
  it('Gemini değerleri site anahtarlarına eşlenir', () => {
    expect(GEMINI_EYLEM.dribble_move).toBe('calim');
    expect(GEMINI_ROL.ball_handler).toBe('calim_atan');
    expect(GEMINI_ETIKET.game_tying).toBe('esitleyen');
  });
});

describe('clutchTamamla (ortak etiket tutarlılığı)', () => {
  it('maçı kazandıran ⇒ clutch eklenir, diğer etiketlere dokunulmaz', () => {
    expect(clutchTamamla(['poster', 'mac_kazandiran'])).toEqual({ etiketler: ['poster', 'mac_kazandiran', 'clutch'], eklendi: true });
  });
  it('eşitleyen ⇒ clutch eklenir', () => {
    expect(clutchTamamla(['esitleyen', 'son_saniye'])).toEqual({ etiketler: ['esitleyen', 'son_saniye', 'clutch'], eklendi: true });
  });
  it('son saniye tek başına clutch eklemez; etiketsiz oyuna da eklenmez', () => {
    expect(clutchTamamla(['son_saniye'])).toEqual({ etiketler: ['son_saniye'], eklendi: false });
    expect(clutchTamamla([])).toEqual({ etiketler: [], eklendi: false });
    expect(clutchTamamla(['poster', 'crossover']).eklendi).toBe(false);
  });
  it('clutch zaten varsa çift eklenmez ve sıra korunur', () => {
    expect(clutchTamamla(['clutch', 'mac_kazandiran'])).toEqual({ etiketler: ['clutch', 'mac_kazandiran'], eklendi: false });
  });
  it('girdiyi değiştirmez', () => {
    const g = ['mac_kazandiran'] as const;
    clutchTamamla(g);
    expect(g).toEqual(['mac_kazandiran']);
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
