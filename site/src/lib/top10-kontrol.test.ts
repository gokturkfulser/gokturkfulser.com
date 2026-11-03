import { describe, expect, it } from 'vitest';
import { bakilacakMi, duzenleAdresi, geceDosyaYolu, kontrolOzeti, zamanBaglantisi } from './top10-kontrol';
import type { Gece, Oyun } from './top10';

const oyun = (sira: number, kontrol?: Oyun['kontrol'], zaman?: string): Oyun => ({ sira, zaman, kontrol, katkilar: [{ oyuncu: `Oyuncu ${sira}`, takim: 'SAS', rol: 'bitiren' }] });
const gece = (tarih: string, inceleme: 'bekliyor' | 'onaylandi', oyunlar: Oyun[]): Gece => ({ tarih: new Date(tarih), tur: 'top5', video: 'https://www.youtube.com/watch?v=abcdefghijk', kaynak: 'gemini', inceleme, oyunlar });

describe('bakilacakMi', () => {
  it('güven orta/düşük ya da uyarı varsa; yüksek ve uyarısız ya da kontrolsüz satır değil', () => {
    expect(bakilacakMi({ kontrol: { guven: 'orta' } })).toBe(true);
    expect(bakilacakMi({ kontrol: { guven: 'dusuk' } })).toBe(true);
    expect(bakilacakMi({ kontrol: { guven: 'yuksek', uyarilar: ['açıklamada yok: X'] } })).toBe(true);
    expect(bakilacakMi({ kontrol: { guven: 'yuksek', uyarilar: [] } })).toBe(false);
    expect(bakilacakMi({ kontrol: { guven: 'yuksek', model_guveni: ['yüksek'] } })).toBe(false);
    expect(bakilacakMi({})).toBe(false);
  });
});

describe('kontrolOzeti', () => {
  const girdiler = [
    { id: '2026-27/2026-10-20', gece: gece('2026-10-20', 'bekliyor', [oyun(1, { guven: 'yuksek' }), oyun(2, { guven: 'orta', oy: '2/3' })]) },
    { id: '2026-27/2026-10-22', gece: gece('2026-10-22', 'bekliyor', [oyun(3, { guven: 'dusuk' }), oyun(1, { guven: 'yuksek', uyarilar: ['u'] }), oyun(2)]) },
    { id: '2026-27/2026-10-21', gece: gece('2026-10-21', 'onaylandi', [oyun(1, { guven: 'dusuk' })]) },
  ];
  it('bakılacak satırlar yalnızca bekleyen gecelerden: en yeni gece önce, gece içinde sıra artan; onaylı gecenin satırı girmez', () => {
    const o = kontrolOzeti(girdiler);
    expect(o.bakilacak.map((s) => [s.id.slice(-5), s.oyun.sira])).toEqual([['10-22', 1], ['10-22', 3], ['10-20', 2]]);
  });
  it('bekleyen geceler en yeni önce; satır, bakılacak ve kontrolsüz sayıları', () => {
    const o = kontrolOzeti(girdiler);
    expect(o.bekleyen.map((b) => [b.id.slice(-5), b.satirSayisi, b.bakilacakSayisi, b.kontrolsuzSayisi])).toEqual([['10-22', 3, 2, 1], ['10-20', 2, 1, 0]]);
  });
  it('onaylı geceler ayrı; gece yoksa her şey boş', () => {
    expect(kontrolOzeti(girdiler).onayli.map((g) => g.id)).toEqual(['2026-27/2026-10-21']);
    expect(kontrolOzeti([])).toEqual({ bakilacak: [], bekleyen: [], onayli: [] });
  });
  it('inceleme yazılmamış elle gece onaylı sayılır (kaynağa göre varsayılan)', () => {
    const g: Gece = { ...gece('2026-10-23', 'bekliyor', [oyun(1)]), kaynak: 'elle', inceleme: undefined };
    expect(kontrolOzeti([{ id: 'x/y', gece: g }]).onayli).toHaveLength(1);
  });
});

describe('adresler', () => {
  it('düzenleme bağlantısı: github.com/gokturkfulser/gokturkfulser.com/edit/main/<dosya yolu>', () => {
    expect(geceDosyaYolu('2026-27/2026-10-21')).toBe('site/src/content/top10/2026-27/2026-10-21.yaml');
    expect(duzenleAdresi('2026-27/2026-10-21')).toBe('https://github.com/gokturkfulser/gokturkfulser.com/edit/main/site/src/content/top10/2026-27/2026-10-21.yaml');
  });
  it('zaman bağlantısı: YouTube → o saniye; nba.com → videonun kendisi; zaman yoksa yok', () => {
    const yt = gece('2026-10-20', 'bekliyor', []);
    expect(zamanBaglantisi(yt, { zaman: '02:05' })).toBe('https://www.youtube.com/watch?v=abcdefghijk&t=125');
    expect(zamanBaglantisi({ video: 'https://www.nba.com/watch/video/x' }, { zaman: '02:05' })).toBe('https://www.nba.com/watch/video/x');
    expect(zamanBaglantisi(yt, {})).toBeUndefined();
  });
});
