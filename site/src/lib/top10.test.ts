import { describe, expect, it } from 'vitest';
import {
  benzerAdlar,
  dosyaYoluHatasi,
  katkiHatasi,
  katkiPaylari,
  liderGecmisi,
  puan,
  sezonTablosu,
  siraHatasi,
  sonGece,
  videoAdresiMi,
  yinelenenTarihler,
  type Gece,
  type Katki,
  type Oyun,
} from './top10';

const VIDEO = 'https://www.youtube.com/watch?v=x';
const oyun = (sira: number, oyuncu: string, takim = 'SAS'): Oyun => ({ sira, katkilar: [{ oyuncu, takim, rol: 'bitiren' }] });
/** Paylı oyun: [ad, pay?] çiftleri (pay verilmezse eşit bölüşüm). */
const paylisi = (sira: number, ...katkilar: [string, number?][]): Oyun => ({
  sira,
  katkilar: katkilar.map(([oyuncu, pay], i): Katki => ({ oyuncu, takim: 'SAS', rol: i === 0 ? 'bitiren' : 'pasor', ...(pay === undefined ? {} : { pay }) })),
});
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

  it('aynı gecede iki oyunla gelen oyuncunun puanları toplanır, gece tek sayılır', () => {
    const g = gece('2026-11-01', 'top10', ['Ada Birinci', 'SAS'], ['Bora İkinci']);
    g.oyunlar[4] = oyun(5, 'Ada Birinci', 'SAS'); // 1. sıra (10) + 5. sıra (6)
    const t = sezonTablosu([g]);
    const ada = bul(t, 'Ada Birinci');
    expect(ada.puan).toBe(16);
    expect(ada.gece).toBe(1);
    expect(ada.birinci).toBe(1);
    expect(bul(t, 'Bora İkinci').puan).toBe(9);
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

describe('katkı paylaşımı', () => {
  /** Verilen sıralardaki oyunlar özel, geri kalanı dolgu olan gece. */
  const geceOyun = (tarih: string, tur: 'top10' | 'top5', ozel: Oyun[]): Gece => {
    const g = gece(tarih, tur);
    return { ...g, oyunlar: g.oyunlar.map((d) => ozel.find((o) => o.sira === d.sira) ?? d) };
  };

  it('katkiPaylari: pay yoksa eşit bölüşüm (50/50, 34/33/33: fazlalık ilk katkıya)', () => {
    expect(katkiPaylari([{ oyuncu: 'A' }])).toEqual([100]);
    expect(katkiPaylari([{ oyuncu: 'A' }, { oyuncu: 'B' }])).toEqual([50, 50]);
    expect(katkiPaylari([{ oyuncu: 'A' }, { oyuncu: 'B' }, { oyuncu: 'C' }])).toEqual([34, 33, 33]);
    expect(katkiPaylari([{ oyuncu: 'A', pay: 30 }, { oyuncu: 'B', pay: 70 }])).toEqual([30, 70]);
  });

  it('tek kişilik oyun: puanın tamamı', () => {
    const t = sezonTablosu([geceOyun('2026-11-01', 'top10', [oyun(3, 'Ada A')])]);
    expect(bul(t, 'Ada A').puanBirim).toBe(800);
    expect(bul(t, 'Ada A').puan).toBe(8);
  });

  it('50/50: 2. sıra (9 puan) kişi başı 4,5', () => {
    const t = sezonTablosu([geceOyun('2026-11-01', 'top10', [paylisi(2, ['Ada A', 50], ['Bora B', 50])])]);
    expect([bul(t, 'Ada A').puan, bul(t, 'Bora B').puan]).toEqual([4.5, 4.5]);
  });

  it('70/30: 3. sıra (8 puan) 5,6 ve 2,4; pay yoksa eşit', () => {
    const t = sezonTablosu([geceOyun('2026-11-01', 'top10', [paylisi(3, ['Ada A', 30], ['Bora B', 70])])]);
    expect([bul(t, 'Ada A').puanBirim, bul(t, 'Bora B').puanBirim]).toEqual([240, 560]);
    const e = sezonTablosu([geceOyun('2026-11-01', 'top10', [paylisi(3, ['Ada A'], ['Bora B'])])]);
    expect([bul(e, 'Ada A').puan, bul(e, 'Bora B').puan]).toEqual([4, 4]);
  });

  it('üçlü eşit bölüşüm ve yuvarlama: 4. sıra (7 puan) 2,38 / 2,31 / 2,31, toplam tam 7', () => {
    const t = sezonTablosu([geceOyun('2026-11-01', 'top10', [paylisi(4, ['Ada A'], ['Bora B'], ['Cem C'])])]);
    const [a, b, c] = ['Ada A', 'Bora B', 'Cem C'].map((ad) => bul(t, ad));
    expect([a!.puanBirim, b!.puanBirim, c!.puanBirim]).toEqual([238, 231, 231]);
    expect(a!.puanBirim + b!.puanBirim + c!.puanBirim).toBe(700);
  });

  it('kayan nokta birikmez: 3,3 puanlık paylar 3 gecede tam 9,9', () => {
    // 1. sıra (10 puan) üçlü eşit bölüşüm: 3,4 / 3,3 / 3,3; üç gecede 990 birim.
    const geceler = ['2026-11-01', '2026-11-02', '2026-11-03'].map((g) => geceOyun(g, 'top5', [paylisi(1, ['Ada A'], ['Bora B'], ['Cem C'])]));
    const t = sezonTablosu(geceler);
    expect(bul(t, 'Cem C').puanBirim).toBe(990);
    expect(bul(t, 'Cem C').puan).toBe(9.9);
    expect(bul(t, 'Ada A').puanBirim).toBe(1020);
  });

  it('aynı oyuncunun aynı gecede hem tek başına hem paylı oyunu: puanlar toplanır, gece tek', () => {
    const t = sezonTablosu([geceOyun('2026-11-01', 'top10', [oyun(3, 'Ada A'), paylisi(8, ['Ada A', 50], ['Bora B', 50])])]);
    const ada = bul(t, 'Ada A');
    expect(ada.puanBirim).toBe(800 + 150); // 8 + 3 × 0,5
    expect(ada.gece).toBe(1);
    expect(bul(t, 'Bora B').puanBirim).toBe(150);
  });

  it('top5 gecesinde paylı oyun: 2. sıra (9 puan) 70/30', () => {
    const t = sezonTablosu([geceOyun('2026-11-01', 'top5', [paylisi(2, ['Ada A', 70], ['Bora B', 30])])]);
    expect([bul(t, 'Ada A').puan, bul(t, 'Bora B').puan]).toEqual([6.3, 2.7]);
  });

  it('1 numaralı oyunun her katkı sahibi 1 numara sayılır; gece, herhangi bir katkıdır', () => {
    const t = sezonTablosu([geceOyun('2026-11-01', 'top5', [paylisi(1, ['Ada A'], ['Bora B'])])]);
    expect([bul(t, 'Ada A').birinci, bul(t, 'Bora B').birinci]).toEqual([1, 1]);
    expect([bul(t, 'Ada A').gece, bul(t, 'Bora B').gece]).toEqual([1, 1]);
    expect([bul(t, 'Ada A').puan, bul(t, 'Bora B').puan]).toEqual([5, 5]);
  });

  it('son takım en yeni katkıdaki takımdır', () => {
    const eski = geceOyun('2026-11-01', 'top5', [{ sira: 1, katkilar: [{ oyuncu: 'Ada A', takim: 'SAS', rol: 'bitiren' }] }]);
    const yeni = geceOyun('2026-11-02', 'top5', [
      { sira: 2, katkilar: [{ oyuncu: 'Bora B', takim: 'LAL', rol: 'bitiren' }, { oyuncu: 'Ada A', takim: 'LAL', rol: 'pasor' }] },
    ]);
    expect(bul(sezonTablosu([yeni, eski]), 'Ada A').takim).toBe('LAL');
  });

  it('lider geçmişi ondalıklı puanlarla doğru değişir', () => {
    // Toplayıcı sıra bütünlüğünü denetlemez (doğrulama şemada); yalnızca 1. sıra oyunlu geceler yeter.
    const yalniz = (tarih: string, o: Oyun): Gece => ({ ...gece(tarih, 'top5'), oyunlar: [o] });
    const geceler = [
      yalniz('2026-11-01', paylisi(1, ['Ada A'], ['Bora B'], ['Cem C'])), // A 3,4  B 3,3  C 3,3
      yalniz('2026-11-02', paylisi(1, ['Bora B'], ['Cem C'], ['Dolu D'])), // B 6,7  C 6,6
      yalniz('2026-11-03', paylisi(1, ['Cem C'], ['Ada A'], ['Bora B'])), // C 10  A 6,7  B 10
    ];
    // Gece 3: Cem 6,6 + 3,4 = 10 ve Bora 6,7 + 3,3 = 10 tam eşit (1000 birim); 1 numara ve gece eşit, ad kırar: Bora önde kalır.
    const g = liderGecmisi(geceler);
    expect(g.map((d) => [d.lider.oyuncu, d.lider.puan])).toEqual([
      ['Ada A', 3.4],
      ['Bora B', 6.7],
    ]);
    const t = sezonTablosu(geceler);
    expect([t[0]!.oyuncu, t[0]!.puanBirim, t[1]!.oyuncu, t[1]!.puanBirim]).toEqual(['Bora B', 1000, 'Cem C', 1000]);
  });
});

describe('katkiHatasi (build durdurur)', () => {
  const k = (...paylar: (number | undefined)[]) => paylar.map((pay, i) => ({ oyuncu: `Oyuncu ${String.fromCharCode(65 + i)}`, pay }));
  it('geçerli bölüşümler: eşit, [100], 50/50, 70/30, 30/70, 34/33/33 ve 50/25/25 permütasyonları', () => {
    const gecerli = [[undefined], [undefined, undefined], [undefined, undefined, undefined], [100], [50, 50], [70, 30], [30, 70], [34, 33, 33], [33, 34, 33], [33, 33, 34], [50, 25, 25], [25, 50, 25], [25, 25, 50]];
    for (const paylar of gecerli) expect(katkiHatasi(k(...paylar)), paylar.join('/')).toBeUndefined();
  });
  it('pay bazılarında var bazılarında yok: hata', () => {
    expect(katkiHatasi(k(50, undefined))).toMatch(/bazılarında var/);
    expect(katkiHatasi(k(undefined, 50))).toMatch(/bazılarında var/);
  });
  it('toplam 100 değil: hata', () => {
    expect(katkiHatasi(k(60, 30))).toMatch(/toplamı 100/);
    expect(katkiHatasi(k(50))).toMatch(/toplamı 100/);
    expect(katkiHatasi(k(34, 33, 34))).toMatch(/toplamı 100/);
  });
  it('toplam 100 ama izinsiz bölüşüm: hata', () => {
    expect(katkiHatasi(k(60, 40))).toMatch(/izinsiz/);
    expect(katkiHatasi(k(80, 20))).toMatch(/izinsiz/);
    expect(katkiHatasi(k(40, 30, 30))).toMatch(/izinsiz/);
    expect(katkiHatasi(k(50, 30, 20))).toMatch(/izinsiz/);
    expect(katkiHatasi(k(100, 0))).toMatch(/pozitif/);
  });
  it('aynı oyunda aynı oyuncu iki kez ve katkı sayısı 1-3', () => {
    expect(katkiHatasi([{ oyuncu: 'Ada A' }, { oyuncu: 'ADA A' }])).toMatch(/iki kez/);
    expect(katkiHatasi([])).toMatch(/1–3/);
    expect(katkiHatasi(k(undefined, undefined, undefined, undefined))).toMatch(/1–3/);
  });
  it('katkiPaylari geçersiz katkıda hata fırlatır', () => {
    expect(() => katkiPaylari(k(60, 40))).toThrow(/izinsiz/);
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
  it('katkılardaki ve rakip alanındaki tüm adları kapsar', () => {
    const g = gece('2026-11-01', 'top5', ['Marcus Delaney'], ['Ada Yılmaz'], ['Kemal Torun'], ['Seda Albay'], ['Nils Berg']);
    g.oyunlar[1] = { sira: 2, rakip: 'Marcus Delany', katkilar: [{ oyuncu: 'Ada Yılmaz', takim: 'SAS', rol: 'bitiren' }, { oyuncu: 'Kemal Toruna', takim: 'SAS', rol: 'pasor' }] };
    const b = benzerAdlar([g]).map((x) => [x.a.oyuncu, x.b.oyuncu]);
    expect(b).toContainEqual(['Marcus Delaney', 'Marcus Delany']); // rakip
    expect(b).toContainEqual(['Kemal Torun', 'Kemal Toruna']); // ikinci katkı
  });
  it('aynı slug (büyük/küçük harf, aksan) benzer sayılmaz; uzak adlar sayılmaz', () => {
    expect(benzerAdlar([gece('2026-11-01', 'top5', ['Nikola Jokić'], ['NIKOLA JOKIC'], ['Luka Dončić'], ['Kemal Torun'], ['Seda Albay'])])).toEqual([]);
  });
});

describe('video zamanı', () => {
  it('zamanSaniye: m:ss ve mm:ss', async () => {
    const { zamanSaniye } = await import('./top10');
    expect(zamanSaniye('0:05')).toBe(5);
    expect(zamanSaniye('1:05')).toBe(65);
    expect(zamanSaniye('10:30')).toBe(630);
    expect(zamanSaniye('00:42')).toBe(42);
    for (const kotu of ['1:5', '1:75', '105', '1:05:00', '', 'a:bc']) expect(zamanSaniye(kotu), kotu).toBeUndefined();
  });
  it('videoZamanAdresi: youtube adresine t (saniye) parametresi; YouTube dışı ya da geçersiz zamanda undefined', async () => {
    const { videoZamanAdresi } = await import('./top10');
    expect(videoZamanAdresi('https://www.youtube.com/watch?v=abc', '1:05')).toBe('https://www.youtube.com/watch?v=abc&t=65');
    expect(videoZamanAdresi('https://www.youtube.com/watch?v=abc&t=3', '0:10')).toBe('https://www.youtube.com/watch?v=abc&t=10');
    expect(videoZamanAdresi('https://www.nba.com/watch/video/x', '1:05')).toBeUndefined();
    expect(videoZamanAdresi('https://www.youtube.com/watch?v=abc', '1:75')).toBeUndefined();
  });
});

describe('benzerAdlarMevcutla', () => {
  it('yeni gecedeki ad mevcut adlarla çok benzer ama farklıysa bulunur; aynı kimlik sayılmaz', async () => {
    const { benzerAdlarMevcutla } = await import('./top10');
    const yeni = gece('2026-11-01', 'top5', ['Marcus Delaney'], ['Ada Yılmaz'], ['Kemal Torun'], ['Seda Albay'], ['Nils Berg']);
    const mevcut = gece('2026-10-30', 'top5', ['Marcus Delany'], ['ADA YILMAZ'], ['Qwe Rty'], ['Zxc Vbn'], ['Poi Uyt']);
    expect(benzerAdlarMevcutla(yeni, [mevcut]).map((b) => [b.yeni, b.mevcut])).toEqual([['Marcus Delaney', 'Marcus Delany']]);
    expect(benzerAdlarMevcutla(yeni, [])).toEqual([]);
  });
});

describe('izinliBolusumler ve sezonKlasoru (kontrol düzenleyicisiyle paylaşılan)', () => {
  it('katkı sayısına göre izinli bölüşümler; katkiHatasi ile uyumlu', async () => {
    const { izinliBolusumler, katkiHatasi } = await import('./top10');
    expect(izinliBolusumler(1)).toEqual([[100]]);
    expect(izinliBolusumler(2)).toEqual([[50, 50], [70, 30], [30, 70]]);
    expect(izinliBolusumler(3).map((b) => b.join('-')).sort()).toEqual(['25-25-50', '25-50-25', '33-33-34', '33-34-33', '34-33-33', '50-25-25']);
    expect(izinliBolusumler(4)).toEqual([]);
    for (const n of [1, 2, 3]) {
      for (const b of izinliBolusumler(n)) expect(katkiHatasi(b.map((pay, i) => ({ oyuncu: `Oyuncu ${i}`, pay })))).toBeUndefined();
    }
  });
  it('sezon klasörü: Ağustos ve sonrası o yıl, öncesi önceki yıl', async () => {
    const { sezonKlasoru } = await import('./top10');
    expect(sezonKlasoru('2026-11-01')).toBe('2026-27');
    expect(sezonKlasoru('2027-01-15')).toBe('2026-27');
    expect(sezonKlasoru('2027-08-01')).toBe('2027-28');
  });
});
