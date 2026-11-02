import { describe, expect, it } from 'vitest';
import { baslikCoz, haricMi, tarihAyristir } from './baslik';

describe('baslikCoz: kalıp', () => {
  it('gerçek NBA başlıkları (Top 5 ve Top 10)', () => {
    expect(baslikCoz("NBA's Top 5 Plays of the Night | November 1, 2026")).toEqual({ tur: 'top5', tarih: '2026-11-01' });
    expect(baslikCoz("NBA's Top 10 Plays of the Night | November 16, 2025")).toEqual({ tur: 'top10', tarih: '2025-11-16' });
  });
  it('NBA\'s öneki, büyük/küçük harf ve ayraç esnek', () => {
    expect(baslikCoz('Top 10 Plays Of The Night | Oct 28, 2026')).toEqual({ tur: 'top10', tarih: '2026-10-28' });
    expect(baslikCoz('NBA’s TOP 10 PLAYS OF THE NIGHT - January 5, 2027')).toEqual({ tur: 'top10', tarih: '2027-01-05' });
    expect(baslikCoz('Top 10 Plays of the Night: Sept. 3rd, 2026')).toEqual({ tur: 'top10', tarih: '2026-09-03' });
  });
  it('kalıba uymayan başlıklar (maç özeti, oyuncu videosu, gece özeti)', () => {
    expect(baslikCoz("NBA's Nightly Recap | November 1, 2026")).toBeUndefined();
    expect(baslikCoz('RAPTORS at LAKERS | FULL GAME HIGHLIGHTS | November 1, 2026')).toBeUndefined();
    expect(baslikCoz('Top 10 Plays of the Night')).toBeUndefined(); // tarih yok
    expect(baslikCoz("NBA's Top 3 Plays of the Night | November 1, 2026")).toBeUndefined(); // 10 ya da 5 değil
  });
});

describe('baslikCoz: dışlamalar', () => {
  it('of the Week / Month / Year, Season, Summer League, All-Star hariç', () => {
    for (const b of [
      'Top 10 Plays of the Week | November 1, 2026',
      "NBA's Top 10 Plays of the Month | October 2026",
      'Top 10 Plays of the Year | December 31, 2026',
      "NBA's Top 10 Plays of the Night | November 1, 2026 | 2026-27 NBA Season",
      'Top 10 Plays of the Night | Summer League | July 12, 2026',
      'Top 10 Plays of the Night | All-Star Game | February 15, 2027',
    ]) {
      expect(haricMi(b), b).toBe(true);
      expect(baslikCoz(b), b).toBeUndefined();
    }
  });
  it('sıradan gece başlığı dışlanmaz', () => {
    expect(haricMi("NBA's Top 10 Plays of the Night | November 1, 2026")).toBe(false);
  });
});

describe('tarihAyristir', () => {
  it('ay adı, kısaltma, sıra eki ve virgülsüz biçim', () => {
    expect(tarihAyristir('November 1, 2026')).toBe('2026-11-01');
    expect(tarihAyristir('Nov. 1, 2026')).toBe('2026-11-01');
    expect(tarihAyristir('March 31st, 2027')).toBe('2027-03-31');
    expect(tarihAyristir('December 9 2026')).toBe('2026-12-09');
    expect(tarihAyristir('February 29, 2028')).toBe('2028-02-29');
  });
  it('geçersiz tarih ve ay adı', () => {
    expect(tarihAyristir('February 30, 2027')).toBeUndefined();
    expect(tarihAyristir('February 29, 2027')).toBeUndefined();
    expect(tarihAyristir('Smarch 3, 2027')).toBeUndefined();
    expect(tarihAyristir('2026-11-01')).toBeUndefined();
    expect(tarihAyristir('')).toBeUndefined();
  });
});
