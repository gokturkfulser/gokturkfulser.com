// Çoğunluk oylaması (ağ yok): oy birliği, 2/3 çoğunluk, uzlaşma yok, ad normalleştirme, pay çoğunluğu, tür uyuşmazlığı.
import { describe, expect, it } from 'vitest';
import { dogrula, type Uretilen } from './gece';
import { oyla, oylamaSonrasi } from './oylama';
import { gecerliHam } from './test-yardim';
import type { HamGece } from './gemini';

const baglam = { tarih: '2026-11-01', video: 'https://www.youtube.com/watch?v=abcdefghijk', tur: undefined, model: 'gemini-3.6-flash', uretildi: new Date('2026-11-02T07:00:00.000Z') };
const calisma = (degistir: (h: HamGece) => void = () => {}, tur: 'top10' | 'top5' = 'top5'): Uretilen => {
  const ham = gecerliHam(tur);
  degistir(ham);
  const s = dogrula(ham, baglam);
  if ('hata' in s) throw new Error(s.hata);
  return s;
};
const sonuc = (r: ReturnType<typeof oyla>) => {
  if ('hata' in r) throw new Error(r.hata);
  return r;
};
const not = (r: ReturnType<typeof oyla>, sira: number) => sonuc(r).notlar.find((n) => n.sira === sira)!;
const katkilar = (r: ReturnType<typeof oyla>, sira: number) => (sonuc(r).oyunlar.find((o) => o.sira === sira)!.katkilar as { oyuncu: string; takim: string; rol: string; pay: number }[]);

describe('oy birliği', () => {
  it('üç özdeş çalıştırma: her satır 3/3, güven yüksek, alternatif yok', () => {
    const r = oyla([calisma(), calisma(), calisma()], 2);
    expect(sonuc(r).oyunlar).toHaveLength(5);
    for (const n of sonuc(r).notlar) {
      expect(n.oy).toMatchObject({ oran: '3/3', eylemOran: '3/3', payOran: '3/3', seviye: 'yuksek', uzlasmaYok: false, alternatifler: [] });
      expect(n.guven).toBe('high');
    }
    // satır içeriği (1. sıra: 70/30 alley-oop) aynen korunur
    expect(katkilar(r, 1).map((k) => [k.oyuncu, k.pay, k.rol])).toEqual([['Mirko Daval', 70, 'pasor'], ['Tomas Veltri', 30, 'bitiren']]);
    expect(sonuc(r).oyunlar[0]).toMatchObject({ eylem: 'alley_oop', rakip: 'Dario Fenn', zaman: '2:50' });
  });
  it('modelin kendi güveni ve gerekçesi kaybolmaz (oy notunda çalıştırma başına)', () => {
    const r = oyla([calisma(), calisma(), calisma()], 2);
    expect(not(r, 3).modelGuvenleri).toEqual([
      { guven: 'medium', neden: 'Jersey number partly hidden' },
      { guven: 'medium', neden: 'Jersey number partly hidden' },
      { guven: 'medium', neden: 'Jersey number partly hidden' },
    ]);
    expect(not(r, 3).guven).toBe('high'); // oy birliği → yüksek (model "orta" demiş olsa da)
  });
});

describe('çoğunluk (2/3)', () => {
  const yanlis = (h: HamGece) => (h.plays[3]!.contributors = [{ player: 'Brayden Burries', team: 'SAS', role: 'finisher', share: 100 }]);

  it('azınlıktaki yanlış ad elenir; oy 2/3, güven orta, alternatif "diğer: … 1/3"', () => {
    const r = oyla([calisma(), calisma(yanlis), calisma()], 2);
    expect(katkilar(r, 4).map((k) => k.oyuncu)).toEqual(['Rafael Quintero']);
    expect(not(r, 4).oy).toMatchObject({ oran: '2/3', seviye: 'orta', uzlasmaYok: false, alternatifler: ['diğer: Brayden Burries 1/3'] });
    expect(not(r, 4).guven).toBe('medium');
    // diğer satırlar oy birliği
    expect(not(r, 1).oy!.oran).toBe('3/3');
  });
  it('yanlış ad ilk çalıştırmadaysa yine de çoğunluk kazanır (ad yazımı çoğunluğu veren ilk çalıştırmadan)', () => {
    const r = oyla([calisma(yanlis), calisma(), calisma((h) => (h.plays[3]!.contributors[0]!.player = 'Rafael Quintero'))], 2);
    expect(katkilar(r, 4)[0]!.oyuncu).toBe('Rafael Quintero');
    expect(not(r, 4).oy!.alternatifler).toEqual(['diğer: Brayden Burries 1/3']);
  });
  it('eylem çoğunluğu: 2/3 smaç, azınlıkta pas → eylem oyu orta ve alternatif', () => {
    const r = oyla([calisma(), calisma((h) => (h.plays[1]!.action = 'pass')), calisma()], 2);
    expect(sonuc(r).oyunlar.find((o) => o.sira === 2)!.eylem).toBe('smac');
    expect(not(r, 2).oy).toMatchObject({ eylemOran: '2/3', seviye: 'orta' });
    expect(not(r, 2).oy!.alternatifler).toEqual(['eylem diğer: Pas 1/3']);
  });
  it('etiketler: çalıştırmaların çoğunda geçenler', () => {
    const r = oyla([calisma(), calisma((h) => (h.plays[0]!.tags = ['no_look']), 'top5'), calisma((h) => (h.plays[0]!.tags = ['no_look', 'fast_break', 'poster']))], 2);
    // no_look 3/3, fast_break 2/3 (ilk + 3. çalıştırma), poster 1/3 → poster yok
    expect(sonuc(r).oyunlar[0]!.etiketler).toEqual(['bakmadan', 'hizli_hucum']);
  });
});

describe('uzlaşma yok', () => {
  it('her çalıştırma farklı ad: en çok oyu alan (eşitlikte ilk) seçilir, satır "uzlaşma yok" ve düşük güven', () => {
    const adli = (ad: string) => (h: HamGece) => (h.plays[4]!.contributors = [{ player: ad, team: 'SAS', role: 'finisher', share: 100 }]);
    const r = oyla([calisma(adli('Ada Bee')), calisma(adli('Cem Dee')), calisma(adli('Eda Eff'))], 2);
    expect(katkilar(r, 5)[0]!.oyuncu).toBe('Ada Bee'); // eşitlikte ilk çalıştırma
    expect(not(r, 5).oy).toMatchObject({ oran: '1/3', seviye: 'dusuk', uzlasmaYok: true, alternatifler: ['diğer: Cem Dee 1/3', 'diğer: Eda Eff 1/3'] });
    expect(not(r, 5).guven).toBe('low');
  });
  it('2 çalıştırma, farklı sonuç: 1/2 çoğunluk değildir → uzlaşma yok', () => {
    const r = oyla([calisma(), calisma((h) => (h.plays[4]!.contributors = [{ player: 'Ada Bee', team: 'SAS', role: 'finisher', share: 100 }]))], 2);
    expect(not(r, 5).oy).toMatchObject({ oran: '1/2', uzlasmaYok: true, seviye: 'dusuk' });
  });
});

describe('ad normalleştirme', () => {
  it('aksan / Jr. / kesme işareti farklı yazılan aynı oyuncu aynı küme sayılır; görünen yazım ilk çalıştırmadan', () => {
    const adli = (ad: string) => (h: HamGece) => (h.plays[3]!.contributors = [{ player: ad, team: 'UTA', role: 'finisher', share: 100 }]);
    const r = oyla([calisma(adli('Mouhamed Salaün')), calisma(adli('Mouhamed Salaun')), calisma(adli('MOUHAMED SALAUN Jr.'))], 2);
    expect(not(r, 4).oy).toMatchObject({ oran: '3/3', seviye: 'yuksek' });
    expect(katkilar(r, 4)[0]!.oyuncu).toBe('Mouhamed Salaün');
  });
});

describe('pay', () => {
  it('pay çoğunluğu: 2/3 aynı bölüşüm seçilir, alternatif gösterilir, güven orta', () => {
    const r = oyla([calisma(), calisma(), calisma((h) => h.plays[0]!.contributors.forEach((k) => (k.share = 50)))], 2);
    expect(katkilar(r, 1).map((k) => k.pay)).toEqual([70, 30]);
    expect(not(r, 1).oy).toMatchObject({ payOran: '2/3', oran: '3/3', seviye: 'orta' });
    expect(not(r, 1).oy!.alternatifler).toEqual(['pay diğer: 50/50 1/3']);
  });
  it('pay çoğunluğu yoksa eşit bölüşüm (2 kişi 50/50)', () => {
    const r = oyla([
      calisma(),
      calisma((h) => { h.plays[0]!.contributors[0]!.share = 30; h.plays[0]!.contributors[1]!.share = 70; }),
      calisma((h) => h.plays[0]!.contributors.forEach((k) => (k.share = 50))),
    ], 2);
    expect(katkilar(r, 1).map((k) => k.pay)).toEqual([50, 50]);
    expect(not(r, 1).oy).toMatchObject({ payOran: '1/3', oran: '3/3', seviye: 'dusuk' });
    expect(not(r, 1).oy!.alternatifler).toHaveLength(3);
  });
  it('üç kişilik sette eşit bölüşüm 34/33/33 (fazlalık ilk katkıya)', () => {
    const uc = (pay: [number, number, number]) => (h: HamGece) => {
      h.plays[1]!.contributors = ['Ada Bee', 'Cem Dee', 'Eda Eff'].map((player, i) => ({ player, team: 'SAS', role: i === 0 ? 'finisher' : 'passer', share: pay[i]! }));
    };
    const r = oyla([calisma(uc([34, 33, 33])), calisma(uc([50, 25, 25])), calisma(uc([25, 50, 25]))], 2);
    expect(katkilar(r, 2).map((k) => k.pay)).toEqual([34, 33, 33]);
  });
  it('pay yalnızca seçilen kümeyi veren çalıştırmalar arasında oylanır', () => {
    const adli = (h: HamGece) => (h.plays[0]!.contributors = [{ player: 'Ada Bee', team: 'SAS', role: 'finisher', share: 100 }]);
    const r = oyla([calisma(), calisma(adli), calisma()], 2);
    expect(katkilar(r, 1).map((k) => k.pay)).toEqual([70, 30]);
    expect(not(r, 1).oy).toMatchObject({ oran: '2/3', payOran: '2/2' });
  });
});

describe('geçerli çalıştırma sayısı ve tür', () => {
  it('oylamaya en az 2 geçerli çalıştırma gerekir (N = 1 için 1)', () => {
    const r = oyla([calisma()], 2);
    expect('hata' in r && r.hata).toMatch(/geçerli çalıştırma sayısı 1; oylama için en az 2/);
    expect('hata' in oyla([calisma()], 1)).toBe(false);
    expect('hata' in oyla([], 1)).toBe(true);
  });
  it('oyun sayısı (tür) farklıysa çoğunluk; çoğunlukta olmayan çalıştırma oylamadan çıkar', () => {
    const top10 = calisma(undefined, 'top10');
    const r = oyla([calisma(), calisma(), top10], 2);
    expect(sonuc(r).tur).toBe('top5');
    expect(sonuc(r).oyunlar).toHaveLength(5);
    expect(sonuc(r).calismaSayisi).toBe(2);
    expect(not(r, 1).oy!.oran).toBe('2/2');
  });
  it('tür çoğunluğu yoksa gece başarısız', () => {
    const r = oyla([calisma(), calisma(undefined, 'top10')], 2);
    expect('hata' in r && r.hata).toMatch(/oyun sayısında \(tür\) uzlaşmadı: Top 5 1\/2, Top 10 1\/2/);
  });
});

describe('oylamaSonrasi: şema, YAML yorumları', () => {
  it('oy oranı, azınlık alternatifi ve model güveni YAML yorumuna yazılır; dosya şemadan geçer', () => {
    const yanlis = (h: HamGece) => (h.plays[3]!.contributors = [{ player: 'Brayden Burries', team: 'SAS', role: 'finisher', share: 100 }]);
    const r = oylamaSonrasi([calisma(), calisma(yanlis), calisma()], { ...baglam, tur: 'top5' }, [], 2);
    if ('hata' in r) throw new Error(r.hata);
    expect(r.gece.kaynak).toBe('gemini');
    expect(r.yaml).toContain('# güven: orta (oy 2/3)');
    expect(r.yaml).toContain('# diğer: Brayden Burries 1/3');
    expect(r.yaml).toContain('# güven: yüksek (oy 3/3)');
    expect(r.yaml).toContain('# model güveni: orta (Jersey number partly hidden); orta (Jersey number partly hidden); orta (Jersey number partly hidden)');
    expect(r.yaml).toMatch(/zaman: "2:50"/);
    expect(r.calismaSayisi).toBe(3);
    expect(r.oyunNotlari.find((n) => n.sira === 4)!.oy!.seviye).toBe('orta');
  });
  it('uzlaşma yok satırı YAML yorumunda işaretlenir', () => {
    const adli = (ad: string) => (h: HamGece) => (h.plays[4]!.contributors = [{ player: ad, team: 'SAS', role: 'finisher', share: 100 }]);
    const r = oylamaSonrasi([calisma(adli('Ada Bee')), calisma(adli('Cem Dee')), calisma(adli('Eda Eff'))], { ...baglam, tur: 'top5' }, [], 2);
    if ('hata' in r) throw new Error(r.hata);
    expect(r.yaml).toContain('# güven: düşük (oy 1/3)');
    expect(r.yaml).toContain('# diğer: Cem Dee 1/3');
  });
});
