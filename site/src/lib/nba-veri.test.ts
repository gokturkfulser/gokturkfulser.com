import { describe, expect, it } from 'vitest';
import { clutchOku, dunkScoreOku, dunkTop10Sirasi, nbaTarihi, sezonSiralari } from './nba-veri';
import { sozlukHaritasi } from './top10-adlar';
import type { Gece, Oyun } from './top10';
import type { Etiket, Eylem, Rol } from './top10-sozluk';

// Gerçek dosyalara dokunulmaz: tablo, NBA sayfasından kopyalanan biçimde (sekme ayrımlı, boş sütunlu) satır içi verilir.
const T = '\t';
const DUNK_BASLIK = ['PLAYER', '', 'TEAM', 'MATCH UP', 'GAME DATE', 'Score', 'JMP', 'PWR', 'STYL', 'DEF', 'VERT', 'HANG', 'DIST', 'HAND', 'HGT', 'SPD', 'RB', 'TIP', 'OOP'].join(T);
const dunk = (oyuncu: string, takim: string, mac: string, tarih: string, skor: string, jmp = '90.0', pwr = '80.0', styl = '70.0', def = '60.0') =>
  [oyuncu, '', takim, mac, tarih, skor, jmp, pwr, styl, def, '30.0', '0.500', '7.0', 'right', '11.0', '20.0', '1.0', 'No', 'No'].join(T);

const DUNK_METIN = [
  ['Game', 'Scores', 'Player', 'Ball', 'Flags'].join(T), // üst başlık: veri değil
  DUNK_BASLIK,
  dunk('Brayden Burries', 'MIL', 'CLE @ MIL', '10/31/2026', '120.1', '92.4', '95.5', '76.1', '82.5'),
  dunk('Bilal Coulibaly', 'WAS', 'WAS @ CHI', '10/24/2026', '118.2'),
  dunk('Brandon Miller', 'CHA', 'DET @ CHA', '11/2/2026', '95.1'),
  dunk('Brandon Miller', 'CHA', 'CHA @ BKN', '10/21/2026', '84.4'),
].join('\r\n');

describe('nbaTarihi', () => {
  it('A/G/Y biçimini UTC gününe çevirir, geçersizi reddeder', () => {
    expect(nbaTarihi('10/31/2026')?.toISOString()).toBe('2026-10-31T00:00:00.000Z');
    expect(nbaTarihi('1/5/2027')?.toISOString()).toBe('2027-01-05T00:00:00.000Z');
    expect(nbaTarihi('13/1/2026')).toBeUndefined();
    expect(nbaTarihi('2/30/2026')).toBeUndefined();
    expect(nbaTarihi('2026-10-31')).toBeUndefined();
  });
});

describe('dunkScoreOku', () => {
  it('başlıktan sonraki satırları okur, üst başlığı atlar, skora göre çoktan aza sıralar', () => {
    const r = dunkScoreOku(DUNK_METIN);
    expect(r.hatalar).toEqual([]);
    expect(r.satirlar.map((s) => [s.oyuncu, s.skor])).toEqual([['Brayden Burries', 120.1], ['Bilal Coulibaly', 118.2], ['Brandon Miller', 95.1], ['Brandon Miller', 84.4]]);
    expect(r.satirlar[0]).toMatchObject({ takim: 'MIL', mac: 'CLE @ MIL', atlama: 92.4, guc: 95.5, stil: 76.1, savunma: 82.5 });
    expect(r.satirlar[0]!.tarih.toISOString()).toBe('2026-10-31T00:00:00.000Z');
  });

  it('yapıştırma artıklarını yok sayar: "Glossary", "300 Rows", tekrarlanan başlık; aynı satır iki kez gelirse bir kez sayılır', () => {
    const metin = ['Glossary', '300 Rows', DUNK_BASLIK, dunk('A B', 'MIL', 'A @ B', '10/31/2026', '100.0'), DUNK_BASLIK, dunk('A B', 'MIL', 'A @ B', '10/31/2026', '100.0'), 'Page', '1', 'of 6'].join('\n');
    const r = dunkScoreOku(metin);
    expect(r.hatalar).toEqual([]);
    expect(r.satirlar).toHaveLength(1);
  });

  it('bozuk veri satırı atlanır ve bildirilir; kalanlar okunur', () => {
    const metin = [DUNK_BASLIK, dunk('A B', 'MIL', 'A @ B', 'bozuk', '100.0'), dunk('C D', 'MIL', 'C @ D', '10/31/2026', 'x'), dunk('E F', 'MIL', 'E @ F', '10/31/2026', '90.0'), ['G H', '', 'MIL', 'G @ H', '10/31/2026', '90.0', '1', '1'].join(T)].join('\n');
    const r = dunkScoreOku(metin);
    expect(r.satirlar.map((s) => s.oyuncu)).toEqual(['E F']);
    expect(r.hatalar).toHaveLength(3);
    expect(r.hatalar[0]).toContain('geçersiz tarih');
    expect(r.hatalar[1]).toContain('geçersiz sayı');
    expect(r.hatalar[2]).toContain('sütun sayısı');
  });

  it('boş metin: hata yok; başlıksız metin: tek hata; iki durumda da satır yok', () => {
    expect(dunkScoreOku('')).toEqual({ satirlar: [], hatalar: [] });
    expect(dunkScoreOku('rastgele\nmetin')).toEqual({ satirlar: [], hatalar: ['başlık satırı bulunamadı'] });
  });
});

describe('clutchOku', () => {
  const BASLIK = ['', 'Player', 'Team', 'Age', 'GP', 'W', 'L', 'Min', 'PTS', 'FGM', 'FGA', 'FG%', '3PM', '3PA', '3P%', 'FTM', 'FTA', 'FT%', 'OREB', 'DREB', 'REB', 'AST', 'TOV', 'STL', 'BLK', 'PF', 'TFP', 'HSFP', 'DD2', 'TD3', '+/-'].join(T);
  const satir = (sira: string, oyuncu: string, takim: string, mac: string, sayi: string) =>
    [sira, oyuncu, takim, '26', mac, '8', '0', '2.9', sayi, '0.6', '1.3', '50.0', '0.4', '0.6', '60.0', '1.9', '2.1', '88.2', '0.0', '0.5', '0.5', '0.3', '0.0', '0.1', '0.0', '0.1', '4.9', '4.9', '0', '0', '4.4'].join(T);

  it('sırayı korur, başa gelen sıra sütununu ve sayfa artıklarını yok sayar', () => {
    const metin = ['Glossary', '300 Rows', ' • Page', '1', 'of 6', BASLIK, satir('1', 'Tyrese Maxey', 'PHI', '8', '3.5'), satir('1', 'VJ Edgecombe', 'PHI', '8', '1.5')].join('\n');
    const r = clutchOku(metin);
    expect(r.hatalar).toEqual([]);
    expect(r.satirlar.map((s) => s.oyuncu)).toEqual(['Tyrese Maxey', 'VJ Edgecombe']);
    expect(r.satirlar[0]).toMatchObject({ takim: 'PHI', yas: 26, mac: 8, galibiyet: 8, maglubiyet: 0, dakika: 2.9, sayi: 3.5, isabet: 50, uclukIsabet: 60, ribaund: 0.5, asist: 0.3, calma: 0.1, blok: 0, artiEksi: 4.4 });
  });

  it('aynı oyuncu ve takım iki kez gelirse bir kez sayılır; bozuk sayı atlanır', () => {
    const metin = [BASLIK, satir('1', 'A B', 'PHI', '8', '3.5'), satir('1', 'A B', 'PHI', '8', '3.5'), satir('2', 'C D', 'ATL', '7', 'x')].join('\n');
    const r = clutchOku(metin);
    expect(r.satirlar).toHaveLength(1);
    expect(r.hatalar).toHaveLength(1);
  });
});

describe('eşleştirme', () => {
  const VIDEO = 'https://www.youtube.com/watch?v=x';
  type K = [string, Rol];
  const o = (sira: number, kisiler: K[], ek: { eylem?: Eylem; etiketler?: Etiket[]; rakip?: string } = {}): Oyun => ({
    sira,
    ...ek,
    katkilar: kisiler.map(([oyuncu, rol]) => ({ oyuncu, takim: 'SAS', rol })),
  });
  const g = (tarih: string, ...oyunlar: Oyun[]): Gece => ({ tarih: new Date(`${tarih}T00:00:00Z`), tur: 'top10', video: VIDEO, oyunlar });
  const dunklar = dunkScoreOku(
    [DUNK_BASLIK, dunk('Luka Dončić', 'LAL', 'A @ B', '11/1/2026', '90.0'), dunk('Luka Dončić', 'LAL', 'A @ B', '11/1/2026', '70.0'), dunk('Ada Aksoy', 'LAL', 'A @ B', '11/2/2026', '80.0'), dunk('Bora Berk', 'LAL', 'A @ B', '11/1/2026', '60.0')].join('\n'),
  ).satirlar;

  it('aynı gün ve aynı oyuncu + smaç eylemi/poster etiketi + bitiren rolü: oyunun sırası; en yüksek skorlu smaç eşleşir, diğeri değil', () => {
    const geceler = [
      g(
        '2026-11-01',
        o(3, [['Luka Doncic', 'bitiren']], { eylem: 'smac' }), // aksan farkı: slug aynı
        o(5, [['Bora Berk', 'bitiren']], { eylem: 'turnike' }), // smaç değil
      ),
      g('2026-11-02', o(1, [['Ada Aksoy', 'pasor']], { eylem: 'smac' })), // rol bitiren değil
    ];
    const s = dunkTop10Sirasi(dunklar, geceler);
    expect(dunklar.map((d, i) => [d.oyuncu, d.skor, s[i]])).toEqual([
      ['Luka Dončić', 90, 3],
      ['Ada Aksoy', 80, undefined],
      ['Luka Dončić', 70, undefined], // aynı gece ikinci (düşük skorlu) smaç
      ['Bora Berk', 60, undefined],
    ]);
  });

  it('poster etiketi ve alley-oop eylemi de smaç sayılır; ad sözlüğü farklı yazımı birleştirir; gece yoksa eşleşmez', () => {
    const harita = sozlukHaritasi({ 'Luka Doncic': ['Luka Dončić'] });
    const geceler = [g('2026-11-02', o(2, [['Ada Aksoy', 'bitiren']], { eylem: 'turnike', etiketler: ['poster'] }))];
    const s = dunkTop10Sirasi(dunklar, geceler, harita);
    expect(dunklar.map((d, i) => [d.oyuncu, s[i]])).toEqual([['Luka Dončić', undefined], ['Ada Aksoy', 2], ['Luka Dončić', undefined], ['Bora Berk', undefined]]);
    const alley = dunkTop10Sirasi(dunklar, [g('2026-11-01', o(7, [['Luka Dončić', 'bitiren'], ['Pas P', 'pasor']], { eylem: 'alley_oop' }))], harita);
    expect(alley[0]).toBe(7);
  });

  it('sezonSiralari: sezon tablosundaki sıra (1\'den)', () => {
    const l = sezonSiralari([g('2026-11-01', o(1, [['Ada Aksoy', 'bitiren']]), o(2, [['Bora Berk', 'bitiren']]))]);
    expect(l.get('ada-aksoy')).toBe(1);
    expect(l.get('bora-berk')).toBe(2);
    expect(l.get('yok')).toBeUndefined();
  });
});
