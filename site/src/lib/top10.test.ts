import { describe, expect, it } from 'vitest';
import {
  benzerAdlar,
  dosyaYoluHatasi,
  liderGecmisi,
  puan,
  sezonTablosu,
  siraHatasi,
  sonGece,
  videoAdresiMi,
  yinelenenTarihler,
  type Gece,
  type Oyun,
} from './top10';

const VIDEO = 'https://www.youtube.com/watch?v=x';
const oyun = (sira: number, oyuncu: string, takim = 'SAS'): Oyun => ({ sira, oyuncu, takim });
/** Verilen oyuncu adlarıyla 1..N sıralı gece; boşluklar `Dolgu n` ile doldurulur (puan karşılaştırmalarını bozmasın diye ayrı adlı). */
function gece(tarih: string, tur: 'top10' | 'top5', ...ilkler: [string, string?][]): Gece {
  const n = tur === 'top10' ? 10 : 5;
  const oyunlar = Array.from({ length: n }, (_, i) =>
    ilkler[i] ? oyun(i + 1, ilkler[i]![0], ilkler[i]![1] ?? 'SAS') : oyun(i + 1, `Dolgu ${tarih} ${i + 1}`, 'DOL'),
  );
  return { tarih: new Date(`${tarih}T00:00:00Z`), tur, video: VIDEO, oyunlar };
}
const bul = (tablo: ReturnType<typeof sezonTablosu>, ad: string) => tablo.find((s) => s.oyuncu === ad)!;

describe('puan', () => {
  it('11 − sıra: 1. sıra 10, 10. sıra 1', () => {
    expect(puan(1)).toBe(10);
    expect(puan(5)).toBe(6);
    expect(puan(10)).toBe(1);
  });
});

describe('sezonTablosu', () => {
  it('boş sezon boş tablo ve boş lider geçmişi verir', () => {
    expect(sezonTablosu([])).toEqual([]);
    expect(liderGecmisi([])).toEqual([]);
    expect(sonGece([])).toBeUndefined();
  });

  it('top5 gecesinde de 11 − sıra: 1. sıra 10, 5. sıra 6 puan', () => {
    const t = sezonTablosu([gece('2026-11-01', 'top5', ['Ada Birinci'], ['Bora İkinci'], ['Can Üçüncü'], ['Deniz Dördüncü'], ['Ece Beşinci'])]);
    expect(t.map((s) => [s.oyuncu, s.puan])).toEqual([
      ['Ada Birinci', 10],
      ['Bora İkinci', 9],
      ['Can Üçüncü', 8],
      ['Deniz Dördüncü', 7],
      ['Ece Beşinci', 6],
    ]);
    expect(bul(t, 'Ada Birinci').birinci).toBe(1);
    expect(bul(t, 'Ece Beşinci').birinci).toBe(0);
  });

  it('aynı gecede iki oyunla gelen oyuncunun puanları toplanır, gece tek sayılır; asist puan almaz', () => {
    const g = gece('2026-11-01', 'top10', ['Ada Birinci', 'SAS'], ['Bora İkinci']);
    g.oyunlar[0] = { ...g.oyunlar[0]!, asist: 'Bora İkinci' };
    g.oyunlar[4] = oyun(5, 'Ada Birinci', 'SAS'); // 1. sıra (10) + 5. sıra (6)
    const t = sezonTablosu([g]);
    const ada = bul(t, 'Ada Birinci');
    expect(ada.puan).toBe(16);
    expect(ada.gece).toBe(1);
    expect(ada.birinci).toBe(1);
    // Bora yalnızca 2. sıra (9); asist olarak anılması puan getirmez.
    expect(bul(t, 'Bora İkinci').puan).toBe(9);
    expect(bul(t, 'Bora İkinci').gece).toBe(1);
  });

  it('puanlar geceler boyunca birikir; son takım en yeni gecedendir ve yazım slug ile eşleşir', () => {
    const t = sezonTablosu([
      gece('2026-11-03', 'top5', ['Ada Birinci', 'LAL']),
      gece('2026-11-01', 'top10', ['Ada Birinci', 'SAS']),
    ]);
    const ada = bul(t, 'Ada Birinci');
    expect(ada.puan).toBe(20);
    expect(ada.gece).toBe(2);
    expect(ada.birinci).toBe(2);
    expect(ada.takim).toBe('LAL'); // girdi sırası değil tarih belirler
    expect(ada.sonGorunme).toEqual(new Date('2026-11-03T00:00:00Z'));
    // "Ada BİRİNCİ" aynı kimlik (slug) → aynı oyuncu
    const t2 = sezonTablosu([gece('2026-11-01', 'top5', ['Ada Birinci']), gece('2026-11-02', 'top5', ['ADA BİRİNCİ'])]);
    expect(t2.filter((s) => s.kimlik === 'ada-birinci')).toHaveLength(1);
    expect(t2.find((s) => s.kimlik === 'ada-birinci')!.puan).toBe(20);
  });

  describe('eşitlik kırıcıları (sırasıyla)', () => {
    // sira → ad atamasıyla gece; atanmamış sıralar o geceye özgü dolgu adlarıdır (puan karşılaştırmalarına karışmaz).
    const atama = (tarih: string, tur: 'top10' | 'top5', adlar: Record<number, string>): Gece => ({
      ...gece(tarih, tur),
      oyunlar: Array.from({ length: tur === 'top10' ? 10 : 5 }, (_, i) => oyun(i + 1, adlar[i + 1] ?? `Dolgu ${tarih} ${i + 1}`, 'DOL')),
    });
    const sira = (tablo: ReturnType<typeof sezonTablosu>, ...adlar: string[]) => tablo.map((s) => s.oyuncu).filter((a) => adlar.includes(a));

    it('1) eşit puanda daha çok 1 numara olan öne geçer (gece sayısı daha az olsa da)', () => {
      const t = sezonTablosu([
        atama('2026-11-01', 'top10', { 1: 'Ada A' }), // 10, 1 numara
        atama('2026-11-02', 'top10', { 5: 'Bora B' }), // 6
        atama('2026-11-03', 'top10', { 7: 'Bora B' }), // +4
      ]);
      expect([bul(t, 'Ada A').puan, bul(t, 'Bora B').puan]).toEqual([10, 10]);
      expect(sira(t, 'Ada A', 'Bora B')).toEqual(['Ada A', 'Bora B']);
    });

    it('2) 1 numaralar da eşitse daha çok gece', () => {
      const t = sezonTablosu([
        atama('2026-11-01', 'top10', { 2: 'Ada A' }), // 9
        atama('2026-11-02', 'top10', { 10: 'Ada A' }), // +1 = 10, 2 gece
        atama('2026-11-03', 'top10', { 7: 'Bora B' }), // 4
        atama('2026-11-04', 'top10', { 8: 'Bora B' }), // +3
        atama('2026-11-05', 'top10', { 8: 'Bora B' }), // +3 = 10, 3 gece
      ]);
      const [ada, bora] = [bul(t, 'Ada A'), bul(t, 'Bora B')];
      expect([ada.puan, bora.puan, ada.birinci, bora.birinci, ada.gece, bora.gece]).toEqual([10, 10, 0, 0, 2, 3]);
      expect(sira(t, 'Ada A', 'Bora B')).toEqual(['Bora B', 'Ada A']);
    });

    it('3) gece sayısı da eşitse daha yeni son görünme', () => {
      const t = sezonTablosu([atama('2026-11-01', 'top10', { 2: 'Ada A' }), atama('2026-11-02', 'top10', { 2: 'Zeynep Z' })]);
      expect([bul(t, 'Ada A').puan, bul(t, 'Zeynep Z').puan]).toEqual([9, 9]);
      expect(sira(t, 'Ada A', 'Zeynep Z')).toEqual(['Zeynep Z', 'Ada A']);
    });

    it('4) hepsi eşitse ada göre', () => {
      const t = sezonTablosu([
        atama('2026-11-01', 'top10', { 2: 'Zeynep Z', 3: 'Ada A' }), // Z 9, A 8
        atama('2026-11-02', 'top10', { 2: 'Ada A', 3: 'Zeynep Z' }), // A +9, Z +8
      ]);
      expect([bul(t, 'Ada A').puan, bul(t, 'Zeynep Z').puan]).toEqual([17, 17]);
      expect(sira(t, 'Ada A', 'Zeynep Z')).toEqual(['Ada A', 'Zeynep Z']);
    });
  });
});

describe('liderGecmisi', () => {
  it('yalnızca liderin değiştiği geceleri döndürür (ilk gece dahil)', () => {
    const geceler = [
      gece('2026-11-01', 'top5', ['Ada A', 'SAS'], ['Bora B']), // lider Ada (10)
      gece('2026-11-02', 'top5', ['Cem C'], ['Dolu 1']), // Ada 10, Cem 10 → eşit; 1 numara eşit (1-1), gece eşit, daha yeni Cem
      gece('2026-11-03', 'top5', ['Cem C']), // Cem 20
      gece('2026-11-04', 'top5', ['Bora B'], ['Dolu 1']), // Bora 19, Cem 20: lider aynı
    ];
    const g = liderGecmisi(geceler);
    expect(g.map((d) => [d.tarih.toISOString().slice(0, 10), d.lider.oyuncu, d.onceki?.oyuncu])).toEqual([
      ['2026-11-01', 'Ada A', undefined],
      ['2026-11-02', 'Cem C', 'Ada A'],
    ]);
    expect(g[1]!.lider.puan).toBe(10);
  });

  it('girdi sırasından bağımsızdır', () => {
    const a = gece('2026-11-01', 'top5', ['Ada A']);
    const b = gece('2026-11-02', 'top5', ['Bora B'], ['Ada A']); // Ada 19, Bora 10 → Ada kalır
    const c = gece('2026-11-03', 'top5', ['Bora B']); // Bora 20 → Bora lider
    expect(liderGecmisi([c, a, b]).map((d) => d.lider.oyuncu)).toEqual(['Ada A', 'Bora B']);
  });
});

describe('siraHatasi', () => {
  const sirali = (...s: number[]) => s.map((sira) => ({ sira }));
  it('geçerli top10 ve top5', () => {
    expect(siraHatasi('top10', sirali(10, 9, 8, 7, 6, 5, 4, 3, 2, 1))).toBeUndefined();
    expect(siraHatasi('top5', sirali(3, 1, 2, 5, 4))).toBeUndefined();
  });
  it('top5 gecesinde 6 geçersiz, top10 gecesinde 11 ve 0 geçersiz', () => {
    expect(siraHatasi('top5', sirali(1, 2, 3, 4, 6))).toMatch(/1\.\.5/);
    expect(siraHatasi('top10', sirali(1, 2, 3, 4, 5, 6, 7, 8, 9, 11))).toMatch(/1\.\.10/);
    expect(siraHatasi('top10', sirali(0, 2, 3, 4, 5, 6, 7, 8, 9, 10))).toMatch(/1\.\.10/);
  });
  it('yinelenen ve eksik sıra', () => {
    expect(siraHatasi('top5', sirali(1, 2, 3, 3, 5))).toMatch(/birden fazla/);
    expect(siraHatasi('top5', sirali(1, 2, 3))).toMatch(/eksik sıra: 4, 5/);
    expect(siraHatasi('top10', sirali(1, 2, 3, 4, 5))).toMatch(/eksik sıra: 6, 7, 8, 9, 10/);
  });
  it('tam sayı olmayan sıra', () => {
    expect(siraHatasi('top5', sirali(1, 2, 3, 4, 4.5))).toMatch(/aralığında/);
  });
});

describe('dosyaYoluHatasi', () => {
  it('dosya adı ile tarih aynı gün olmalı', () => {
    expect(dosyaYoluHatasi('2026-27/2026-11-01.yaml', new Date('2026-11-01T00:00:00Z'))).toBeUndefined();
    expect(dosyaYoluHatasi('2026-27/2026-11-01.yaml', '2026-11-01')).toBeUndefined();
    expect(dosyaYoluHatasi('2026-27/2026-11-01.yaml', new Date('2026-11-02T00:00:00Z'))).toMatch(/aynı gün/);
    expect(dosyaYoluHatasi('2026-27/2026-11-01.yaml', undefined)).toMatch(/aynı gün/);
  });
  it('yol biçimi ve ardışık sezon yılları', () => {
    expect(dosyaYoluHatasi('2026-11-01.yaml', '2026-11-01')).toMatch(/biçiminde/);
    expect(dosyaYoluHatasi('2026-27/gece.yaml', '2026-11-01')).toMatch(/biçiminde/);
    expect(dosyaYoluHatasi('2026-28/2026-11-01.yaml', '2026-11-01')).toMatch(/ardışık/);
    expect(dosyaYoluHatasi('2099-00/2099-11-01.yaml', '2099-11-01')).toBeUndefined();
  });
});

describe('videoAdresiMi', () => {
  it('yalnızca youtube.com ve nba.com (https)', () => {
    expect(videoAdresiMi('https://www.youtube.com/watch?v=abc')).toBe(true);
    expect(videoAdresiMi('https://youtube.com/watch?v=abc')).toBe(true);
    expect(videoAdresiMi('https://www.nba.com/watch/video/x')).toBe(true);
    expect(videoAdresiMi('http://www.youtube.com/watch?v=abc')).toBe(false);
    expect(videoAdresiMi('https://evilyoutube.com/x')).toBe(false);
    expect(videoAdresiMi('https://youtube.com.evil.example/x')).toBe(false);
    expect(videoAdresiMi('https://vimeo.com/1')).toBe(false);
    expect(videoAdresiMi('not a url')).toBe(false);
  });
});

describe('yinelenenTarihler', () => {
  it('aynı güne yazılmış iki geceyi bulur', () => {
    expect(yinelenenTarihler([gece('2026-11-01', 'top5'), gece('2026-11-02', 'top5')])).toEqual([]);
    expect(yinelenenTarihler([gece('2026-11-01', 'top5'), gece('2026-11-01', 'top10')])).toEqual(['2026-11-01']);
  });
});

describe('benzerAdlar (yazım hatası şüphesi)', () => {
  it('slug\'ları farklı ama çok benzeyen adları bulur', () => {
    const b = benzerAdlar([gece('2026-11-01', 'top5', ['Marcus Delaney'], ['Marcus Delany'], ['Ada Yılmaz'], ['Kemal Torun'], ['Seda Albay'])]);
    expect(b.map((x) => [x.a.oyuncu, x.b.oyuncu])).toEqual([['Marcus Delaney', 'Marcus Delany']]);
  });
  it('aynı slug (büyük/küçük harf, aksan) benzer sayılmaz; uzak adlar sayılmaz', () => {
    expect(benzerAdlar([gece('2026-11-01', 'top5', ['Nikola Jokić'], ['NIKOLA JOKIC'], ['Luka Dončić'], ['Kemal Torun'], ['Seda Albay'])])).toEqual([]);
  });
});
