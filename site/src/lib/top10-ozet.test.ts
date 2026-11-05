import { describe, expect, it } from 'vitest';
import {
  degisimMetni,
  eksenOlcegi,
  etiketleriYerlestir,
  cubukDuzeni,
  etiketSatirlari,
  eylemDagilimi,
  grafikDuzeni,
  liderlikSerileri,
  sayimListeleri,
  siralamaDegisimi,
  takimToplami,
  xTikIndeksleri,
} from './top10-ozet';
import { sezonTablosu, type Gece, type Oyun } from './top10';
import type { Etiket, Eylem, Rol } from './top10-sozluk';
import { sozlukHaritasi } from './top10-adlar';

const VIDEO = 'https://www.youtube.com/watch?v=x';
const oyun = (sira: number, oyuncu: string, takim = 'SAS', eylem?: Eylem): Oyun => ({
  sira,
  ...(eylem ? { eylem } : {}),
  katkilar: [{ oyuncu, takim, rol: 'bitiren' }],
});
/** Verilen oyuncularla 1..N sıralı gece; boş sıralar her gece farklı "Dolgu" adlarıyla dolar. */
function gece(tarih: string, ...ilkler: ([string, string?] | [string, string, Eylem])[]): Gece {
  const oyunlar = Array.from({ length: 10 }, (_, i) =>
    ilkler[i] ? oyun(i + 1, ilkler[i]![0], ilkler[i]![1] ?? 'SAS', ilkler[i]![2]) : oyun(i + 1, `Dolgu ${tarih} ${i + 1}`, 'DOL'),
  );
  return { tarih: new Date(`${tarih}T00:00:00Z`), tur: 'top10', video: VIDEO, oyunlar };
}

describe('siralamaDegisimi', () => {
  // 1. gece: A(10) B(9) C(8). 2. gece: C(10) B(9) D(8): toplam C 18, B 18, A 10, D 8 → eşitlikte 1 numara sayısı: C (1) > B (0).
  const g1 = gece('2026-11-01', ['Ada Aksoy'], ['Bora Berk'], ['Can Ceylan']);
  const g2 = gece('2026-11-02', ['Can Ceylan'], ['Bora Berk'], ['Deniz Demir']);

  it('tek gecede herkes yeni', () => {
    const s = siralamaDegisimi([g1]).slice(0, 3);
    expect(s.map((r) => r.degisim.tur)).toEqual(['yeni', 'yeni', 'yeni']);
  });

  it('bir önceki geceye kadarki sıraya göre fark: yukarı, aşağı, aynı, yeni', () => {
    const s = siralamaDegisimi([g1, g2]).slice(0, 4);
    expect(s.map((r) => r.satir.oyuncu)).toEqual(['Can Ceylan', 'Bora Berk', 'Ada Aksoy', 'Deniz Demir']);
    expect(s[0]!.degisim).toEqual({ tur: 'yukari', adim: 2 }); // Can: 3. → 1.
    expect(s[1]!.degisim).toEqual({ tur: 'ayni' }); // Bora: 2. → 2.
    expect(s[2]!.degisim).toEqual({ tur: 'asagi', adim: 2 }); // Ada: 1. → 3.
    expect(s[3]!.degisim).toEqual({ tur: 'yeni' }); // Deniz: ilk kez
  });

  it('geceler karışık sırada verilse de en yeni gece tarihe göre bulunur', () => {
    expect(siralamaDegisimi([g2, g1]).map((r) => r.degisim)).toEqual(siralamaDegisimi([g1, g2]).map((r) => r.degisim));
  });

  it('sıra numarası güncel tablodaki konumdur ve sınır uygulanır', () => {
    const s = siralamaDegisimi([g1, g2], 2);
    expect(s.map((r) => r.sira)).toEqual([1, 2]);
  });

  it('gerçek hesapla uyumlu: değişim, önceki tablonun konumundan türetilir', () => {
    const onceki = sezonTablosu([g1]).map((r) => r.kimlik);
    for (const r of siralamaDegisimi([g1, g2], 50)) {
      const eski = onceki.indexOf(r.satir.kimlik) + 1;
      if (eski === 0) expect(r.degisim.tur).toBe('yeni');
      else if (eski === r.sira) expect(r.degisim.tur).toBe('ayni');
      else expect(r.degisim).toEqual({ tur: eski > r.sira ? 'yukari' : 'asagi', adim: Math.abs(eski - r.sira) });
    }
  });

  it('boş sezon boş liste verir', () => {
    expect(siralamaDegisimi([])).toEqual([]);
  });
});

describe('degisimMetni', () => {
  it('"+2", gerçek eksi işaretli "−1", "=" ve yeni metni; ok ya da üçgen yok', () => {
    expect(degisimMetni({ tur: 'yukari', adim: 2 }, 'yeni')).toBe('+2');
    expect(degisimMetni({ tur: 'asagi', adim: 1 }, 'yeni')).toBe('−1');
    expect(degisimMetni({ tur: 'ayni' }, 'yeni')).toBe('=');
    expect(degisimMetni({ tur: 'yeni' }, 'new')).toBe('new');
    for (const d of [{ tur: 'yukari', adim: 3 }, { tur: 'asagi', adim: 3 }] as const) expect(degisimMetni(d, 'yeni')).not.toMatch(/[▲▼△▽↑↓→←›↗]/u);
  });
});

describe('takimToplami', () => {
  it('katkının puanı o gecedeki takıma gider, paylı oyunlar bölünür, çoktan aza sıralanır', () => {
    const g: Gece = {
      tarih: new Date('2026-11-01T00:00:00Z'),
      tur: 'top5',
      video: VIDEO,
      oyunlar: [
        { sira: 1, katkilar: [{ oyuncu: 'Ada', takim: 'LAL', rol: 'bitiren', pay: 70 }, { oyuncu: 'Bora', takim: 'BOS', rol: 'pasor', pay: 30 }] }, // 10 puan: LAL 7, BOS 3
        oyun(2, 'Can', 'BOS'), // 9
        oyun(3, 'Deniz', 'LAL'), // 8
        oyun(4, 'Ece', 'MIA'), // 7
        oyun(5, 'Fikret', 'MIA'), // 6
      ],
    };
    expect(takimToplami([g]).map((t) => [t.takim, t.puan])).toEqual([
      ['LAL', 15], // 7 + 8
      ['MIA', 13], // 7 + 6
      ['BOS', 12], // 3 + 9
    ]);
  });

  it('oyuncu takım değiştirirse her puan o gün yazılı takımda kalır', () => {
    const a = gece('2026-11-01', ['Ada', 'LAL']);
    const b = gece('2026-11-02', ['Ada', 'BOS']);
    const t = takimToplami([a, b]);
    expect(t.find((x) => x.takim === 'LAL')!.puan).toBe(10);
    expect(t.find((x) => x.takim === 'BOS')!.puan).toBe(10);
  });

  it('eşitlikte takım koduna göre ve en çok `sinir` takım döner', () => {
    const g: Gece = {
      tarih: new Date('2026-11-01T00:00:00Z'),
      tur: 'top5',
      video: VIDEO,
      oyunlar: [
        { sira: 1, katkilar: [{ oyuncu: 'A', takim: 'ZZZ', rol: 'bitiren', pay: 50 }, { oyuncu: 'B', takim: 'AAA', rol: 'pasor', pay: 50 }] }, // 5 + 5
        oyun(2, 'C', 'MMM'), // 9
        oyun(3, 'D', 'QQQ'), // 8
        oyun(4, 'E', 'ZZZ'), // 7
        oyun(5, 'F', 'KKK'), // 6
      ],
    };
    // ZZZ 12, MMM 9, QQQ 8, KKK 6, AAA 5; ZZZ ile AAA arasında eşitlik yok: kodla kırılan eşitliği ayrıca kur.
    expect(takimToplami([g]).map((t) => t.takim)).toEqual(['ZZZ', 'MMM', 'QQQ', 'KKK', 'AAA']);
    const e: Gece = { ...g, oyunlar: [{ sira: 1, katkilar: [{ oyuncu: 'A', takim: 'ZZZ', rol: 'bitiren', pay: 50 }, { oyuncu: 'B', takim: 'AAA', rol: 'pasor', pay: 50 }] }, oyun(2, 'C', 'LLL'), oyun(3, 'D', 'LLL'), oyun(4, 'E', 'LLL'), oyun(5, 'F', 'LLL')] };
    expect(takimToplami([{ ...e, oyunlar: e.oyunlar.slice(0, 1) }]).map((t) => t.takim)).toEqual(['AAA', 'ZZZ']); // 5 = 5: takım koduna göre
    expect(takimToplami([g], 1)).toHaveLength(1);
  });

  it('toplam, puanların toplamına eşittir (10 oyun × (10+9+…+1) = 55)', () => {
    const g = gece('2026-11-01', ['A', 'LAL']);
    expect(takimToplami([g], 99).reduce((s, t) => s + t.puanBirim, 0)).toBe(55 * 100);
  });

  it('boş sezon boş liste', () => {
    expect(takimToplami([])).toEqual([]);
  });
});

describe('eylemDagilimi', () => {
  it('eylem sayıları çoktan aza, eylemsiz oyunlar ayrı; eşitlikte sözlük sırası', () => {
    const g1 = gece('2026-11-01', ['A', 'SAS', 'smac'], ['B', 'SAS', 'blok'], ['C', 'SAS', 'smac']);
    const g2 = gece('2026-11-02', ['D', 'SAS', 'ucluk'], ['E', 'SAS', 'blok']);
    const d = eylemDagilimi([g1, g2]);
    expect(d.dagilim).toEqual([
      { eylem: 'smac', sayi: 2 },
      { eylem: 'blok', sayi: 2 },
      { eylem: 'ucluk', sayi: 1 },
    ]);
    expect(d.toplam).toBe(20);
    expect(d.belirtilmemis).toBe(20 - 5);
  });

  it('boş sezon: sıfır', () => {
    expect(eylemDagilimi([])).toEqual({ dagilim: [], belirtilmemis: 0, toplam: 0 });
  });
});

describe('liderlikSerileri', () => {
  const g1 = gece('2026-11-01', ['Ada'], ['Bora'], ['Can']);
  const g2 = gece('2026-11-02', ['Bora'], ['Ada'], ['Deniz']);
  const g3 = gece('2026-11-03', ['Bora'], ['Can']);

  it('ilk n oyuncunun gece gece birikimli puanı; son değer sezon toplamıdır', () => {
    const v = liderlikSerileri([g3, g1, g2], 3);
    expect(v.tarihler.map((t) => t.toISOString().slice(0, 10))).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
    const toplam = new Map(sezonTablosu([g1, g2, g3]).map((s) => [s.oyuncu, s.puan]));
    for (const s of v.seriler) expect(s.puanlar.at(-1)).toBe(toplam.get(s.oyuncu));
    const bora = v.seriler.find((s) => s.oyuncu === 'Bora')!;
    expect(bora.puanlar).toEqual([9, 19, 29]);
  });

  it('birikimli puan hiçbir zaman azalmaz; henüz görünmeyen oyuncu 0 ile başlar', () => {
    const v = liderlikSerileri([g1, g2, g3], 10);
    for (const s of v.seriler) for (let i = 1; i < s.puanlar.length; i++) expect(s.puanlar[i]!).toBeGreaterThanOrEqual(s.puanlar[i - 1]!);
    expect(v.seriler.find((s) => s.oyuncu === 'Deniz')!.puanlar[0]).toBe(0);
  });

  it('serilerin sırası güncel sıralamadır ve n ile sınırlanır; boş sezon boş', () => {
    expect(liderlikSerileri([g1, g2, g3], 2).seriler).toHaveLength(2);
    expect(liderlikSerileri([g1, g2, g3], 2).seriler[0]!.oyuncu).toBe('Bora');
    expect(liderlikSerileri([])).toEqual({ tarihler: [], seriler: [] });
  });
});

describe('eksenOlcegi', () => {
  it('1-2-5 adımlı, en çok 5 aralık, üst sınır değeri kapsar', () => {
    for (const [en, ust, adim] of [
      [37, 40, 10],
      [10, 10, 2],
      [100, 100, 20],
      [3.4, 4, 1],
      [212, 250, 50],
    ] as const) {
      expect(eksenOlcegi(en)).toEqual({ ust, adim });
    }
    for (let v = 1; v < 600; v += 7) {
      const { ust, adim } = eksenOlcegi(v);
      expect(ust).toBeGreaterThanOrEqual(v);
      expect(ust / adim).toBeLessThanOrEqual(5);
    }
  });
  it('sıfır/negatif değerde varsayılan ölçek', () => {
    expect(eksenOlcegi(0)).toEqual({ ust: 5, adim: 1 });
  });
});

describe('etiketleriYerlestir', () => {
  it('üst üste binmez, sırayı korur, sınırlar içinde kalır ve girdi sırasıyla döner', () => {
    const girdi = [
      { y: 100, yukseklik: 34 },
      { y: 102, yukseklik: 17 },
      { y: 99, yukseklik: 51 },
      { y: 280, yukseklik: 34 },
    ];
    const y = etiketleriYerlestir(girdi, 10, 290);
    const sirali = girdi.map((g, i) => ({ y: y[i]!, h: g.yukseklik, once: g.y })).sort((a, b) => a.once - b.once || a.y - b.y);
    for (let i = 1; i < sirali.length; i++) expect(sirali[i]!.y - sirali[i - 1]!.y).toBeGreaterThanOrEqual((sirali[i]!.h + sirali[i - 1]!.h) / 2 - 1e-9);
    for (const s of sirali) {
      expect(s.y - s.h / 2).toBeGreaterThanOrEqual(10 - 1e-9);
      expect(s.y + s.h / 2).toBeLessThanOrEqual(290 + 1e-9);
    }
  });
  it('aralık yeterliyse yerinden oynatmaz', () => {
    expect(etiketleriYerlestir([{ y: 50, yukseklik: 17 }, { y: 150, yukseklik: 17 }], 0, 300)).toEqual([50, 150]);
  });
  it('boş girdi boş döner', () => {
    expect(etiketleriYerlestir([], 0, 100)).toEqual([]);
  });
});

describe('etiketSatirlari', () => {
  it('boşlukta ve tirede böler, kısa adı tek satırda bırakır', () => {
    expect(etiketSatirlari('Luka Dončić')).toEqual(['Luka Dončić']);
    expect(etiketSatirlari('Shai Gilgeous-Alexander')).toEqual(['Shai', 'Gilgeous-', 'Alexander']);
    expect(etiketSatirlari('Nikola Jokić')).toEqual(['Nikola Jokić']);
    expect(etiketSatirlari('Giannis Antetokounmpo')).toEqual(['Giannis', 'Antetokounmpo']);
    expect(etiketSatirlari('Jaren Jackson Jr.')).toEqual(['Jaren Jackson', 'Jr.']);
  });
});

describe('xTikIndeksleri', () => {
  it('az gecede hepsi, çok gecede ilk ve son dahil eşit aralıklı en çok 4', () => {
    expect(xTikIndeksleri(0)).toEqual([]);
    expect(xTikIndeksleri(1)).toEqual([0]);
    expect(xTikIndeksleri(4)).toEqual([0, 1, 2, 3]);
    expect(xTikIndeksleri(5)).toEqual([0, 1, 3, 4]);
    expect(xTikIndeksleri(14)).toEqual([0, 4, 9, 13]);
    expect(xTikIndeksleri(14, 5)).toEqual([0, 3, 7, 10, 13]);
    expect(xTikIndeksleri(165).at(-1)).toBe(164);
    expect(xTikIndeksleri(165)).toHaveLength(4);
  });
});

describe('grafikDuzeni', () => {
  const kenar = { ust: 16, sag: 104, alt: 34, sol: 30 };
  const secenek = { genislik: 300, yukseklik: 300, kenar, satirYuksekligi: 17, etiketSatirUzunlugu: 11 };
  const g1 = gece('2026-11-01', ['Ada Aksoy'], ['Bora Berk'], ['Can Ceylan']);
  const g2 = gece('2026-11-02', ['Bora Berk'], ['Ada Aksoy'], ['Deniz Demir']);
  const g3 = gece('2026-11-03', ['Bora Berk'], ['Can Ceylan']);
  const veri = liderlikSerileri([g1, g2, g3], 3);
  const d = grafikDuzeni(veri, secenek);

  it('x geceler boyunca eşit aralıklı, ilk nokta alanın solunda, son nokta sağında', () => {
    const bora = d.seriler.find((s) => s.oyuncu === 'Bora Berk')!;
    expect(bora.noktalar.map((p) => p.x)).toEqual([30, 113, 196]);
    expect(d.alan).toEqual({ x0: 30, x1: 196, y0: 16, y1: 266 });
  });

  it('y: 0 puan taban çizgisinde, eksen üst sınırı en büyük değeri kapsar; büyük değer daha yukarıda (küçük y)', () => {
    const bora = d.seriler.find((s) => s.oyuncu === 'Bora Berk')!;
    expect(d.eksen.ust).toBeGreaterThanOrEqual(Math.max(...veri.seriler.flatMap((s) => s.puanlar)));
    const deniz = grafikDuzeni(liderlikSerileri([g1, g2, g3], 10), secenek).seriler.find((s) => s.oyuncu === 'Deniz Demir')!;
    expect(deniz.noktalar[0]!.y).toBe(266);
    expect(bora.noktalar[2]!.y).toBeLessThan(bora.noktalar[0]!.y);
    expect(bora.noktalar[2]!.y).toBeGreaterThanOrEqual(16);
    expect(d.eksen.tikler[0]).toEqual({ deger: 0, y: 266 });
    expect(d.eksen.tikler.at(-1)).toEqual({ deger: d.eksen.ust, y: 16 });
  });

  it('yol "M x y L x y …" biçimindedir ve nokta sayısıyla uyuşur', () => {
    for (const s of d.seriler) {
      expect(s.yol).toMatch(/^M-?\d+(\.\d)? -?\d+(\.\d)?( L-?\d+(\.\d)? -?\d+(\.\d)?)*$/);
      expect(s.yol.split(' L').length).toBe(3);
      expect(s.yol.startsWith(`M${s.noktalar[0]!.x} ${s.noktalar[0]!.y}`)).toBe(true);
    }
  });

  it('etiketler çizgi sonunun sağında, birbirinin üstüne binmeden ve alan içinde durur', () => {
    const etiketler = d.seriler.map((s) => ({ y: s.etiket.y, h: s.etiket.satirlar.length * 17, x: s.etiket.x }));
    for (const e of etiketler) {
      expect(e.x).toBe(206);
      expect(e.y - e.h / 2).toBeGreaterThanOrEqual(16 - 17 / 2 - 1e-9);
      expect(e.y + e.h / 2).toBeLessThanOrEqual(266 + 17 / 2 + 1e-9);
    }
    const sirali = [...etiketler].sort((a, b) => a.y - b.y);
    for (let i = 1; i < sirali.length; i++) expect(sirali[i]!.y - sirali[i - 1]!.y).toBeGreaterThanOrEqual((sirali[i]!.h + sirali[i - 1]!.h) / 2 + 8 - 1e-9); // komşu etiketler arasında en az 8 birim boşluk
  });

  it('tek gecede nokta ortadadır; boş veri hata vermez', () => {
    const tek = grafikDuzeni(liderlikSerileri([g1], 2), secenek);
    expect(tek.seriler[0]!.noktalar).toHaveLength(1);
    expect(tek.seriler[0]!.noktalar[0]!.x).toBe(113);
    const bos = grafikDuzeni(liderlikSerileri([], 5), secenek);
    expect(bos.seriler).toEqual([]);
    expect(bos.xTikleri).toEqual([]);
  });

  it('aynı girdi her seferinde aynı koordinatları üretir', () => {
    expect(grafikDuzeni(veri, secenek)).toEqual(d);
  });
});

describe('cubukDuzeni', () => {
  const secenek = { genislik: 372, satirYuksekligi: 44, sayiPayi: 44, etiketYuksekligi: 17, cubukYuksekligi: 14 };

  it('çubuk genişliği değerle orantılı, en büyük değer sayı payı dışındaki alanı doldurur', () => {
    const d = cubukDuzeni([30, 15, 3, 0], secenek);
    expect(d.satirlar.map((s) => s.cubukGenislik)).toEqual([328, 164, 32.8, 0]);
    expect(d.yukseklik).toBe(176);
  });

  it('satırlar satır yüksekliği kadar aralıklı; sayı çubuğun sağında, çubukla aynı hizadadır', () => {
    const d = cubukDuzeni([4, 2], secenek);
    expect(d.satirlar.map((s) => s.y)).toEqual([0, 44]);
    for (const s of d.satirlar) {
      expect(s.sayiX).toBe(s.cubukGenislik + 8);
      expect(s.sayiY).toBeGreaterThan(s.cubukY);
      expect(s.sayiY).toBeLessThanOrEqual(s.cubukY + 14);
      expect(s.etiketY).toBeLessThan(s.cubukY);
    }
  });

  it('hiç değer ya da hepsi sıfır: çökmez, çubuk yok', () => {
    expect(cubukDuzeni([], secenek)).toEqual({ yukseklik: 0, satirlar: [] });
    expect(cubukDuzeni([0, 0], secenek).satirlar.every((s) => s.cubukGenislik === 0)).toBe(true);
  });
});

describe('sayimListeleri', () => {
  type K = [string, Rol];
  const o = (sira: number, kisiler: K[], ek: { eylem?: Eylem; etiketler?: Etiket[]; rakip?: string } = {}): Oyun => ({
    sira,
    ...ek,
    katkilar: kisiler.map(([oyuncu, rol]) => ({ oyuncu, takim: 'SAS', rol })),
  });
  /** Verilen oyunlar 1..N sıralarında; kalan sıralar etiketsiz dolgu oyunlarıyla dolar (listeleri etkilemez). */
  const g = (tarih: string, ...oyunlar: Oyun[]): Gece => {
    const kalan = Array.from({ length: 10 }, (_, i) => i + 1).filter((n) => !oyunlar.some((x) => x.sira === n));
    return { tarih: new Date(`${tarih}T00:00:00Z`), tur: 'top10', video: VIDEO, oyunlar: [...oyunlar, ...kalan.map((n) => o(n, [[`Dolgu ${tarih} ${n}`, 'bitiren']]))] };
  };
  const ad = (l: { oyuncu: string; sayi: number }[]) => l.map((x) => [x.oyuncu, x.sayi]);

  it('posterlenen: poster etiketli oyunların rakibi; rakipsiz oyun atlanır', () => {
    const l = sayimListeleri([
      g('2026-11-01', o(1, [['Ada Aksoy', 'bitiren']], { etiketler: ['poster'], rakip: 'Ravi Rakip' }), o(2, [['Bora Berk', 'bitiren']], { etiketler: ['poster'] })),
      g('2026-11-02', o(3, [['Can Ceylan', 'bitiren']], { etiketler: ['poster'], rakip: 'Ravi Rakip' }), o(4, [['Deniz Demir', 'bitiren']], { etiketler: ['poster'], rakip: 'Sena Savunma' })),
    ]);
    expect(ad(l.posterlenen)).toEqual([['Ravi Rakip', 2], ['Sena Savunma', 1]]);
  });

  it('bloklanan: eylemi blok olan oyunların rakibi; poster etiketli ama blok olmayan oyun girmez', () => {
    const l = sayimListeleri([g('2026-11-01', o(1, [['Ada Aksoy', 'bloklayan']], { eylem: 'blok', rakip: 'Ravi Rakip' }), o(2, [['Bora Berk', 'bitiren']], { eylem: 'smac', etiketler: ['poster'], rakip: 'Sena Savunma' }))]);
    expect(ad(l.bloklanan)).toEqual([['Ravi Rakip', 1]]);
  });

  it('rakipToplam: poster, blok ve çalım oyunlarında rakip; aynı oyunda birden çok türde olsa da oyun başına bir kez; rakipsiz ya da türsüz oyun atlanır', () => {
    const l = sayimListeleri([
      g(
        '2026-11-01',
        o(1, [['Ada Aksoy', 'bitiren']], { eylem: 'smac', etiketler: ['poster', 'crossover'], rakip: 'Ravi Rakip' }), // üç tür birden: tek sayı
        o(2, [['Bora Berk', 'bloklayan']], { eylem: 'blok', rakip: 'Ravi Rakip' }),
        o(3, [['Can Ceylan', 'calim_atan']], { eylem: 'calim', rakip: 'Sena Savunma' }),
        o(4, [['Deniz Demir', 'bitiren']], { eylem: 'smac', etiketler: ['poster'] }), // rakipsiz
        o(5, [['Ece Er', 'bitiren']], { eylem: 'turnike', rakip: 'Tolga Top' }), // tür yok: sayılmaz
      ),
    ]);
    expect(ad(l.rakipToplam)).toEqual([['Ravi Rakip', 2], ['Sena Savunma', 1]]);
    // Dağılım: Ravi oyun 1'de posterlendi ve crossover yedi, oyun 2'de bloklandı; toplam oyun sayısı (2) türlerin toplamından (3) küçük olabilir
    expect(l.rakipToplam[0]!.dagilim).toEqual({ posterlenen: 1, bloklanan: 1, calimlanan: 1 });
    expect(l.rakipToplam[1]!.dagilim).toEqual({ posterlenen: 0, bloklanan: 0, calimlanan: 1 });
    expect(l.posterlenen[0]!.dagilim).toBeUndefined();
  });

  it('calimlanan: calim eylemi ya da crossover etiketi; aynı oyunda ikisi de varsa bir kez sayılır', () => {
    const l = sayimListeleri([
      g(
        '2026-11-01',
        o(1, [['Ada Aksoy', 'calim_atan']], { eylem: 'calim', etiketler: ['crossover'], rakip: 'Ravi Rakip' }), // ikisi birden: tek sayı
        o(2, [['Bora Berk', 'bitiren']], { eylem: 'turnike', etiketler: ['crossover'], rakip: 'Ravi Rakip' }), // yalnızca etiket
        o(3, [['Can Ceylan', 'calim_atan']], { eylem: 'calim', rakip: 'Sena Savunma' }), // yalnızca eylem
        o(4, [['Deniz Demir', 'calim_atan']], { eylem: 'calim', etiketler: ['crossover'] }), // rakipsiz
      ),
    ]);
    expect(ad(l.calimlanan)).toEqual([['Ravi Rakip', 2], ['Sena Savunma', 1]]);
  });

  it('posterBasan: poster etiketli oyunlarda yalnızca bitiren rolü', () => {
    const l = sayimListeleri([g('2026-11-01', o(1, [['Pasör Pınar', 'pasor'], ['Ada Aksoy', 'bitiren']], { eylem: 'alley_oop', etiketler: ['poster'] }), o(2, [['Ada Aksoy', 'bitiren']], { eylem: 'smac' }), o(3, [['Bora Berk', 'bitiren']], { etiketler: ['poster'] }))]);
    expect(ad(l.posterBasan)).toEqual([['Ada Aksoy', 1], ['Bora Berk', 1]].sort((a, b) => (a[0] as string).localeCompare(b[0] as string, 'tr')));
    expect(l.posterBasan.some((x) => x.oyuncu === 'Pasör Pınar')).toBe(false);
  });

  it('blokYapan: bloklayan rolü; rol yoksa tek katkı varsa o kişi, çok katkıda kimse', () => {
    const l = sayimListeleri([
      g(
        '2026-11-01',
        o(1, [['Ada Aksoy', 'bloklayan'], ['Bora Berk', 'bitiren']], { eylem: 'blok' }),
        o(2, [['Can Ceylan', 'diger']], { eylem: 'blok' }), // tek katkı, bloklayan rolü yok → o kişi
        o(3, [['Deniz Demir', 'diger'], ['Ece Eren', 'bitiren']], { eylem: 'blok' }), // çok katkı, bloklayan yok → kimse
        o(4, [['Fikret Fidan', 'bloklayan']], { eylem: 'smac' }), // eylem blok değil ama rol bloklayan: sayılır
      ),
    ]);
    expect(ad(l.blokYapan)).toEqual([['Ada Aksoy', 1], ['Can Ceylan', 1], ['Fikret Fidan', 1]]);
  });

  it('blokYapan eyleme bakmaz: eylemi smaç olan oyunda bloklayan rolü sayılır; bloklananlar listesi o oyunu saymaz', () => {
    const l = sayimListeleri([
      g('2026-11-01', o(1, [['Ada Aksoy', 'bloklayan'], ['Bora Berk', 'bitiren']], { eylem: 'smac', etiketler: ['chase_down_blok'], rakip: 'Ravi Rakip' })),
    ]);
    expect(ad(l.blokYapan)).toEqual([['Ada Aksoy', 1]]);
    expect(l.bloklanan).toEqual([]); // eylem blok değil: rakip bloklananlara girmez
    expect(l.posterlenen).toEqual([]);
  });

  it('blokYapan: tek katkılı blok oyunu o kişiyi sayar; eylemi blok olmayan tek katkılı bloklayansız oyun sayılmaz; aynı oyunda aynı kişi bir kez', () => {
    const l = sayimListeleri([
      g(
        '2026-11-01',
        o(1, [['Can Ceylan', 'diger']], { eylem: 'blok', rakip: 'Ravi Rakip' }),
        o(2, [['Deniz Demir', 'diger']], { eylem: 'smac' }),
        o(3, [['Ada Aksoy', 'bloklayan'], ['Ada Aksoy', 'bloklayan']], { eylem: 'smac' }), // aynı kişi iki katkıda: tek sayı
      ),
    ]);
    expect(ad(l.blokYapan)).toEqual([['Ada Aksoy', 1], ['Can Ceylan', 1]]);
    expect(ad(l.bloklanan)).toEqual([['Ravi Rakip', 1]]);
  });

  it('takma adlar sözlükle tek kişide birleşir', () => {
    const harita = sozlukHaritasi({ 'Victor Wembanyama': ['Victor Wembenyama'] });
    const l = sayimListeleri(
      [
        g('2026-11-01', o(1, [['Ada Aksoy', 'bitiren']], { etiketler: ['poster'], rakip: 'Victor Wembanyama' })),
        g('2026-11-02', o(1, [['Bora Berk', 'bitiren']], { etiketler: ['poster'], rakip: 'Victor Wembenyama' })),
      ],
      5,
      harita,
    );
    expect(ad(l.posterlenen)).toEqual([['Victor Wembanyama', 2]]);
    expect(sayimListeleri([g('2026-11-01', o(1, [['Ada Aksoy', 'bitiren']], { etiketler: ['poster'], rakip: 'Victor Wembanyama' })), g('2026-11-02', o(1, [['Bora Berk', 'bitiren']], { etiketler: ['poster'], rakip: 'Victor Wembenyama' }))]).posterlenen).toHaveLength(2);
  });

  it('eşitlikte daha yeni son görünme, sonra ad; ilk `sinir` döner', () => {
    const p = (sira: number, rakip: string) => o(sira, [['Ada Aksoy', 'bitiren']], { etiketler: ['poster'], rakip });
    const l = sayimListeleri([g('2026-11-01', p(1, 'Zeynep Z'), p(2, 'Ayşe A')), g('2026-11-02', p(1, 'Burak B')), g('2026-11-03', p(1, 'Cem C'))]);
    // hepsi 1: en yeni görünme önce (Cem, Burak), sonra 11-01'dekiler ada göre (Ayşe, Zeynep)
    expect(ad(l.posterlenen)).toEqual([['Cem C', 1], ['Burak B', 1], ['Ayşe A', 1], ['Zeynep Z', 1]]);
    expect(sayimListeleri([g('2026-11-01', p(1, 'Zeynep Z'), p(2, 'Ayşe A'))], 1).posterlenen).toHaveLength(1);
    const cok = sayimListeleri([g('2026-11-01', ...[1, 2, 3, 4, 5, 6, 7].map((n) => p(n, `Rakip ${String.fromCharCode(64 + n)}`)))]);
    expect(cok.posterlenen).toHaveLength(5);
  });

  it('boş sezon ve kayıtsız listeler boş döner', () => {
    expect(sayimListeleri([])).toEqual({ rakipToplam: [], posterlenen: [], bloklanan: [], calimlanan: [], posterBasan: [], blokYapan: [] });
    expect(sayimListeleri([g('2026-11-01')]).calimlanan).toEqual([]);
  });
});
