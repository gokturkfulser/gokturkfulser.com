import { describe, expect, it } from 'vitest';
import { top10Sema } from './top10-sema';
import { incelemeBekliyor, varsayilanInceleme } from './top10';

const gece = (ekstra: Record<string, unknown> = {}) => ({
  tarih: '2026-11-01',
  video: 'https://www.youtube.com/watch?v=abcdefghijk',
  tur: 'top5',
  oyunlar: [1, 2, 3, 4, 5].map((sira) => ({ sira, katkilar: [{ oyuncu: `Oyuncu ${sira}`, takim: 'SAS', rol: 'bitiren' }] })),
  ...ekstra,
});

describe('elle_duzenlendi', () => {
  it('isteğe bağlı boolean; yazılmazsa undefined, kaynak ve inceleme varsayılanlarını etkilemez', () => {
    expect(top10Sema.parse(gece({ kaynak: 'gemini' })).elle_duzenlendi).toBeUndefined();
    const g = top10Sema.parse(gece({ kaynak: 'gemini', elle_duzenlendi: true }));
    expect([g.elle_duzenlendi, g.inceleme]).toEqual([true, 'bekliyor']);
    expect(top10Sema.safeParse(gece({ elle_duzenlendi: 'evet' })).success).toBe(false);
  });
  it('clutch etiketi şemadan geçer, puanı etkilemez (oyun satırı aynı kalır)', () => {
    const oyunlar = [1, 2, 3, 4, 5].map((sira) => ({ sira, etiketler: sira === 3 ? ['clutch', 'mac_kazandiran'] : undefined, katkilar: [{ oyuncu: `Oyuncu ${sira}`, takim: 'SAS', rol: 'bitiren' }] }));
    expect(top10Sema.parse(gece({ oyunlar })).oyunlar[2]!.etiketler).toEqual(['clutch', 'mac_kazandiran']);
  });
});

describe('inceleme ve kaynak varsayılanları', () => {
  it('kaynak yazılmazsa elle, inceleme onaylandi', () => {
    const g = top10Sema.parse(gece());
    expect([g.kaynak, g.inceleme]).toEqual(['elle', 'onaylandi']);
  });
  it('kaynak: gemini için inceleme varsayılanı bekliyor', () => {
    const g = top10Sema.parse(gece({ kaynak: 'gemini' }));
    expect([g.kaynak, g.inceleme]).toEqual(['gemini', 'bekliyor']);
  });
  it('açık inceleme değeri korunur (onaylı gemini, bekleyen elle)', () => {
    expect(top10Sema.parse(gece({ kaynak: 'gemini', inceleme: 'onaylandi' })).inceleme).toBe('onaylandi');
    expect(top10Sema.parse(gece({ kaynak: 'elle', inceleme: 'bekliyor' })).inceleme).toBe('bekliyor');
  });
  it('geçersiz inceleme/kaynak değeri reddedilir', () => {
    expect(top10Sema.safeParse(gece({ inceleme: 'belki' })).success).toBe(false);
    expect(top10Sema.safeParse(gece({ kaynak: 'claude' })).success).toBe(false);
  });
});

describe('varsayilanInceleme / incelemeBekliyor (sayfadaki notun görünme koşulu)', () => {
  it('varsayılanlar', () => {
    expect(varsayilanInceleme('gemini')).toBe('bekliyor');
    expect(varsayilanInceleme('elle')).toBe('onaylandi');
    expect(varsayilanInceleme(undefined)).toBe('onaylandi');
  });
  it('not yalnızca inceleme bekliyorsa görünür', () => {
    expect(incelemeBekliyor({ kaynak: 'gemini' })).toBe(true);
    expect(incelemeBekliyor({ kaynak: 'gemini', inceleme: 'bekliyor' })).toBe(true);
    expect(incelemeBekliyor({ kaynak: 'gemini', inceleme: 'onaylandi' })).toBe(false);
    expect(incelemeBekliyor({ kaynak: 'elle' })).toBe(false);
    expect(incelemeBekliyor({})).toBe(false);
    expect(incelemeBekliyor({ kaynak: 'elle', inceleme: 'bekliyor' })).toBe(true);
  });
});

describe('şema katılığı', () => {
  it('kaldırılan eski oyun alanları (oyuncu, takim, asist) reddedilir', () => {
    const g = gece();
    (g.oyunlar[0] as Record<string, unknown>).asist = 'X';
    expect(top10Sema.safeParse(g).success).toBe(false);
  });
});

describe('takım kodları ve zaman', () => {
  const oyunla = (degistir: (o: Record<string, any>) => void) => {
    const g = gece();
    degistir(g.oyunlar[0] as Record<string, any>);
    return top10Sema.safeParse(g);
  };
  it("NBA'in 30 kısaltması geçer; dışındaki değer şemadan geçmez", () => {
    for (const kod of ['ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW', 'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK', 'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS']) {
      expect(oyunla((o) => (o.katkilar[0].takim = kod)).success, kod).toBe(true);
    }
    for (const kod of ['GS', 'XYZ', 'sas', 'GSTATE', 'NOH', 'SEA']) {
      const s = oyunla((o) => (o.katkilar[0].takim = kod));
      expect(s.success, kod).toBe(false);
      expect(JSON.stringify(s.error?.issues)).toContain('30 kısaltmasından');
    }
  });
  it('zaman "m:ss" ya da "mm:ss": geçerli değerler geçer, diğerleri reddedilir', () => {
    for (const z of ['0:05', '1:05', '10:30', '00:42', '59:59']) expect(oyunla((o) => (o.zaman = z)).success, z).toBe(true);
    for (const z of ['1:5', '1:75', '105', '1:05:00', 65, '']) expect(oyunla((o) => (o.zaman = z)).success, String(z)).toBe(false);
    expect(oyunla(() => {}).success).toBe(true); // zaman isteğe bağlı
  });
});
