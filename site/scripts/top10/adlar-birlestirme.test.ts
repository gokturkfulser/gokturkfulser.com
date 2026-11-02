// Oyuncu adı sözlüğü ve oylamada aynı kişinin farklı yazımlarının birleştirilmesi (ağ yok).
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { calistir, sozlukOku } from './calistir';
import { dogrula, hamAdlariniUygula, type Uretilen } from './gece';
import type { HamGece } from './gemini';
import { adlariBirlestir, oyla, oylamaSonrasi } from './oylama';
import { geminiYaniti, gecerliHam, GM_ANAHTAR, json, oge, YT_ANAHTAR } from './test-yardim';
import { sozlukHaritasi } from '../../src/lib/top10-adlar';
import type { Gece } from '../../src/lib/top10';

const baglam = { tarih: '2026-11-01', video: 'https://www.youtube.com/watch?v=abcdefghijk', tur: undefined, model: 'gemini-3.8-flash', uretildi: new Date('2026-11-02T07:00:00.000Z') };
/** 4. sıradaki oyuncuyu değiştirilmiş bir çalıştırma. */
const calisma = (oyuncu?: string, takim = 'SAS', degistir: (h: HamGece) => void = () => {}): Uretilen => {
  const ham = gecerliHam('top5');
  if (oyuncu) ham.plays[3]!.contributors = [{ player: oyuncu, team: takim, role: 'finisher', share: 100 }];
  degistir(ham);
  const s = dogrula(ham, baglam);
  if ('hata' in s) throw new Error(s.hata);
  return s;
};
const sonuc = (r: ReturnType<typeof oyla>) => {
  if ('hata' in r) throw new Error(r.hata);
  return r;
};
const ad4 = (r: ReturnType<typeof oyla>) => (sonuc(r).oyunlar.find((o) => o.sira === 4)!.katkilar as { oyuncu: string }[]).map((k) => k.oyuncu);
const not4 = (r: ReturnType<typeof oyla>) => sonuc(r).notlar.find((n) => n.sira === 4)!;

describe('oylamada aynı kişinin farklı yazımları birleşir: oy birliği', () => {
  it('Braden / Brayden Burries (aynı sıra, aynı takım, aynı soyadı) tek kişi: oy 3/3, güven yüksek', () => {
    const r = oyla([calisma('Brayden Burries'), calisma('Braden Burries'), calisma('Brayden Burries')], 2);
    expect(ad4(r)).toEqual(['Brayden Burries']);
    expect(not4(r).oy).toMatchObject({ oran: '3/3', seviye: 'yuksek', alternatifler: [] });
    expect(not4(r).guven).toBe('high');
    expect(not4(r).takmaAdOnerileri).toEqual(['olası takma ad: Braden Burries → Brayden Burries, sözlüğe ekle']);
  });
  it('Svi / Sviatoslav Mykhailiuk tek kişi', () => {
    const r = oyla([calisma('Svi Mykhailiuk', 'GSW'), calisma('Sviatoslav Mykhailiuk', 'GSW'), calisma('Svi Mykhailiuk', 'GSW')], 2);
    expect(ad4(r)).toEqual(['Svi Mykhailiuk']);
    expect(not4(r).oy!.oran).toBe('3/3');
    expect(not4(r).takmaAdOnerileri).toEqual(['olası takma ad: Sviatoslav Mykhailiuk → Svi Mykhailiuk, sözlüğe ekle']);
  });
  it('yazım farkı yoksa öneri yok (aksan/büyük harf farkı aynı ad sayılır)', () => {
    const r = oyla([calisma('Mouhamed Salaün', 'UTA'), calisma('Mouhamed Salaun', 'UTA'), calisma('MOUHAMED SALAUN', 'UTA')], 2);
    expect(not4(r).oy!.oran).toBe('3/3');
    expect(not4(r).takmaAdOnerileri).toBeUndefined();
  });
});

describe('yazım önceliği: sözlük kanoniği → mevcut veri → çoğunluk', () => {
  const uc = [() => calisma('Sviatoslav Mykhailiuk', 'GSW'), () => calisma('Svi Mykhailiuk', 'GSW'), () => calisma('Sviatoslav Mykhailiuk', 'GSW')];
  it('1) sözlükteki kanonik ad, çoğunluk başka yazım olsa da kazanır', () => {
    const r = oyla(uc.map((f) => f()), 2, { kanonik: new Set(['svi mykhailiuk']) });
    expect(ad4(r)).toEqual(['Svi Mykhailiuk']);
  });
  it('2) kanonik yoksa mevcut top10 verisinde geçen yazım, çoğunluk başka olsa da kazanır', () => {
    const r = oyla(uc.map((f) => f()), 2, { mevcut: new Map([['svi mykhailiuk', 'Svi Mykhailiuk']]) });
    expect(ad4(r)).toEqual(['Svi Mykhailiuk']);
  });
  it('kanonik ve mevcut ikisi de varsa kanonik önce', () => {
    const r = oyla(uc.map((f) => f()), 2, { kanonik: new Set(['sviatoslav mykhailiuk']), mevcut: new Map([['svi mykhailiuk', 'Svi Mykhailiuk']]) });
    expect(ad4(r)).toEqual(['Sviatoslav Mykhailiuk']);
  });
  it('3) ikisi de yoksa çoğunluk yazımı; eşitlikte ilk çalıştırma', () => {
    expect(ad4(oyla(uc.map((f) => f()), 2))).toEqual(['Sviatoslav Mykhailiuk']); // 2/3
    expect(ad4(oyla([calisma('Svi Mykhailiuk', 'GSW'), calisma('Sviatoslav Mykhailiuk', 'GSW')], 2))).toEqual(['Svi Mykhailiuk']); // 1/1, ilk çalıştırma
  });
  it('oylamaSonrasi: mevcut veri ve sözlük adları seçenek olarak geçer; YAML yorumunda öneri', () => {
    const mevcutGece = { tarih: new Date('2026-10-30T00:00:00Z'), tur: 'top5', video: 'https://www.youtube.com/watch?v=x', kaynak: 'elle', oyunlar: [{ sira: 1, katkilar: [{ oyuncu: 'Svi Mykhailiuk', takim: 'GSW', rol: 'bitiren' }] }] } as unknown as Gece;
    const r = oylamaSonrasi(uc.map((f) => f()), { ...baglam, tur: 'top5' }, [mevcutGece], 2);
    if ('hata' in r) throw new Error(r.hata);
    expect(r.gece.oyunlar.find((o) => o.sira === 4)!.katkilar[0]!.oyuncu).toBe('Svi Mykhailiuk');
    expect(r.yaml).toContain('# olası takma ad: Sviatoslav Mykhailiuk → Svi Mykhailiuk, sözlüğe ekle');
    expect(r.oyunNotlari.find((n) => n.sira === 4)!.takmaAdOnerileri).toHaveLength(1);
  });
});

describe('farklı kişileri birleştirmez', () => {
  it('aynı soyadlı iki farklı takım oyuncusu ayrı kalır (soyadı eşleşmesi aynı takım ister)', () => {
    const r = oyla([calisma('Keldon Johnson', 'SAS'), calisma('Jalen Johnson', 'ATL'), calisma('Keldon Johnson', 'SAS')], 2);
    expect(ad4(r)).toEqual(['Keldon Johnson']);
    expect(not4(r).oy).toMatchObject({ oran: '2/3', seviye: 'orta', alternatifler: ['diğer: Jalen Johnson 1/3'] });
    expect(not4(r).takmaAdOnerileri).toBeUndefined();
  });
  it('aynı takımda farklı soyadlı oyuncular ayrı kalır', () => {
    const r = oyla([calisma('Jaylen Wells', 'MEM'), calisma('Jaylen Walker', 'MEM'), calisma('Jaylen Wells', 'MEM')], 2);
    expect(ad4(r)).toEqual(['Jaylen Wells']);
    expect(not4(r).oy).toMatchObject({ oran: '2/3', alternatifler: ['diğer: Jaylen Walker 1/3'] });
  });
  it('aynı takımda benzer ama farklı soyadı (Burries / Burris) birleşmez', () => {
    const r = oyla([calisma('Brayden Burries'), calisma('Brayden Burris'), calisma('Brayden Burries')], 2);
    expect(not4(r).oy!.oran).toBe('2/3');
  });
  it('soyadı aynı, takım farklıysa birleşmez (aynı oyuncu farklı takım yazılmış olsa bile: takım uyuşmazlığı oyda kalır)', () => {
    const r = oyla([calisma('Brayden Burries', 'SAS'), calisma('Braden Burries', 'DEN'), calisma('Brayden Burries', 'SAS')], 2);
    expect(not4(r).oy!.oran).toBe('2/3');
    expect(not4(r).takmaAdOnerileri).toBeUndefined();
  });
  it('aynı çalıştırmanın aynı satırındaki aynı soyadlı iki katkı sahibi birleştirilmez', () => {
    const ikili = (a: string) => (h: HamGece) => (h.plays[3]!.contributors = [
      { player: a, team: 'SAS', role: 'finisher', share: 50 },
      { player: 'Dallas Burries', team: 'SAS', role: 'passer', share: 50 },
    ]);
    const r = oyla([calisma(undefined, 'SAS', ikili('Brayden Burries')), calisma(undefined, 'SAS', ikili('Braden Burries')), calisma(undefined, 'SAS', ikili('Brayden Burries'))], 2);
    expect(ad4(r).sort()).toEqual(['Brayden Burries', 'Dallas Burries']);
    expect(not4(r).oy).toMatchObject({ oran: '3/3', seviye: 'yuksek' });
  });
  it('birleştirme yalnızca aynı sıra içinde: başka sıradaki aynı soyadı etkilenmez', () => {
    const r = adlariBirlestir([calisma('Brayden Burries'), calisma(undefined, 'SAS', (h) => (h.plays[4]!.contributors = [{ player: 'Braden Burries', team: 'SAS', role: 'finisher', share: 100 }]))]);
    const ad = (c: Uretilen, sira: number) => c.gece.oyunlar.find((o) => o.sira === sira)!.katkilar[0]!.oyuncu;
    expect(ad(r.calismalar[0]!, 4)).toBe('Brayden Burries');
    expect(ad(r.calismalar[1]!, 5)).toBe('Braden Burries'); // sıra 5'te karşılaştıracak başka çalıştırma girişi yok
    expect(r.oneriler.size).toBe(0);
  });
  it('girdiyi değiştirmez', () => {
    const c = [calisma('Brayden Burries'), calisma('Braden Burries'), calisma('Brayden Burries')];
    adlariBirlestir(c);
    expect(c[1]!.gece.oyunlar[3]!.katkilar[0]!.oyuncu).toBe('Braden Burries');
  });
});

describe('sözlük uygulaması (betik)', () => {
  const harita = sozlukHaritasi({ 'Svi Mykhailiuk': ['Sviatoslav Mykhailiuk'], 'Brayden Burries': ['Braden Burries'] });
  it('modelin ham çıktısındaki adlar (katkı ve rakip) kanonik ada çevrilir', () => {
    const ham = gecerliHam('top5');
    ham.plays[3]!.contributors = [{ player: 'Sviatoslav Mykhailiuk', team: 'GSW', role: 'finisher', share: 100 }];
    ham.plays[3]!.opponent = 'braden burries';
    const k = hamAdlariniUygula(ham, harita);
    expect(k.plays[3]!.contributors[0]!.player).toBe('Svi Mykhailiuk');
    expect(k.plays[3]!.opponent).toBe('Brayden Burries');
    expect(ham.plays[3]!.contributors[0]!.player).toBe('Sviatoslav Mykhailiuk'); // girdi değişmez
  });
  it('sözlükle çevrilen adlar oylamada baştan oy birliği olur (öneri üretilmez)', () => {
    const calis = ['Braden Burries', 'Brayden Burries', 'BRADEN BURRIES'].map((ad) => {
      const ham = hamAdlariniUygula((() => { const h = gecerliHam('top5'); h.plays[3]!.contributors = [{ player: ad, team: 'SAS', role: 'finisher', share: 100 }]; return h; })(), harita);
      const s = dogrula(ham, baglam);
      if ('hata' in s) throw new Error(s.hata);
      return s;
    });
    const r = oyla(calis, 2);
    expect(ad4(r)).toEqual(['Brayden Burries']);
    expect(not4(r).oy!.oran).toBe('3/3');
    expect(not4(r).takmaAdOnerileri).toBeUndefined();
  });
});

describe('uçtan uca (sahte API, geçici klasör)', () => {
  const SIMDI = new Date('2026-11-02T07:00:00Z');
  const V5 = 'vid5aaaaaaa';
  const T5 = "NBA's Top 5 Plays of the Night | November 1, 2026";
  let klasor: string;
  let cikti: string[];
  beforeEach(() => {
    klasor = mkdtempSync(join(tmpdir(), 'top10-adlar-'));
    cikti = [];
  });
  afterEach(() => rmSync(klasor, { recursive: true, force: true }));
  const icerik = () => join(klasor, 'icerik');

  function bag(adlar: string[]) {
    let n = 0;
    const fetchFn = (async (girdi: URL | string) => {
      const url = new URL(String(girdi));
      if (url.hostname === 'www.googleapis.com') {
        if (url.pathname.endsWith('/videos')) return json({ items: [{ id: V5, snippet: { title: T5, description: '' }, contentDetails: { duration: 'PT10M30S' }, status: { privacyStatus: 'public' } }] });
        return json({ items: [oge(V5, T5, '2026-11-02T05:26:50Z')] });
      }
      const h = gecerliHam('top5');
      h.plays[3]!.contributors = [{ player: adlar[n++ % adlar.length]!, team: 'GSW', role: 'finisher', share: 100 }];
      return json(geminiYaniti(h));
    }) as unknown as typeof fetch;
    return { env: { YOUTUBE_API_KEY: YT_ANAHTAR, GEMINI_API_KEY: GM_ANAHTAR }, fetchFn, simdi: () => SIMDI, icerikKlasoru: icerik(), yaz: (s: string) => cikti.push(s), ozetDosyasi: join(klasor, 'ozet.md'), ciktiKlasoru: join(klasor, 'cikti') };
  }
  const sozlukYaz = (icerikMetni: string) => {
    mkdirSync(icerik(), { recursive: true });
    writeFileSync(join(icerik(), 'oyuncu-adlari.yaml'), icerikMetni);
  };
  const dosya = () => readFileSync(join(icerik(), '2026-27', '2026-11-01.yaml'), 'utf8');

  it('sözlükteki takma adlar çevrilir: oy birliği, kanonik ad yazılır, öneri yok', async () => {
    sozlukYaz('Brayden Burries: [Braden Burries]\n');
    const s = await calistir(['--tarih', '2026-11-01'], bag(['Braden Burries', 'Brayden Burries', 'Braden Burries']));
    expect(s.kod).toBe(0);
    expect(dosya()).toContain('oyuncu: Brayden Burries');
    expect(dosya()).not.toContain('Braden');
    expect(dosya()).toContain('# güven: yüksek (oy 3/3;');
    expect(cikti.join(String.fromCharCode(10))).not.toContain('olası takma ad');
  });
  it('sözlükte olmayan yazım farkı birleştirilir ve "olası takma ad … sözlüğe ekle" önerisi YAML yorumu, terminal ve özette görünür; sözlük değişmez', async () => {
    const baslangic = 'Svi Mykhailiuk: [Sviatoslav Mykhailiuk]\n';
    sozlukYaz(baslangic);
    const b = bag(['Braden Burries', 'Brayden Burries', 'Brayden Burries']);
    const s = await calistir(['--tarih', '2026-11-01'], b);
    expect(s.kod).toBe(0);
    const oneri = 'olası takma ad: Braden Burries → Brayden Burries, sözlüğe ekle';
    expect(dosya()).toContain(`# ${oneri}`);
    expect(dosya()).toContain('oyuncu: Brayden Burries');
    expect(cikti.join(String.fromCharCode(10))).toContain(`UYARI: ${oneri}`);
    expect(readFileSync(b.ozetDosyasi, 'utf8')).toContain(`sıra 4: ${oneri}`);
    expect(readFileSync(join(icerik(), 'oyuncu-adlari.yaml'), 'utf8')).toBe(baslangic); // betik sözlüğü yazmaz
  });
  it('mevcut gece dosyasındaki takma ad yazımı sözlükle eşleşir: "mevcut yazım" uyarısı yok', async () => {
    sozlukYaz('Brayden Burries: [Braden Burries]\n');
    mkdirSync(join(icerik(), '2026-27'), { recursive: true });
    writeFileSync(join(icerik(), '2026-27', '2026-10-30.yaml'), ['tarih: 2026-10-30', 'video: https://www.youtube.com/watch?v=x', 'tur: top5', 'kaynak: elle', 'oyunlar:', ...[1, 2, 3, 4, 5].map((n) => `  - { sira: ${n}, katkilar: [{ oyuncu: ${n === 1 ? 'Braden Burries' : `Baska Oyuncu${'x'.repeat(n)}`}, takim: SAS, rol: bitiren }] }`)].join(String.fromCharCode(10)));
    await calistir(['--tarih', '2026-11-01', '--oylama', '1'], bag(['Brayden Burries']));
    expect(dosya()).not.toContain('mevcut yazım');
    // sözlük olmadan aynı durum uyarı verir
    rmSync(join(icerik(), 'oyuncu-adlari.yaml'));
    rmSync(join(icerik(), '2026-27', '2026-11-01.yaml'));
    await calistir(['--tarih', '2026-11-01', '--oylama', '1'], bag(['Brayden Burries']));
    expect(dosya()).toContain('mevcut yazım: Braden Burries?');
  });
  it('geçersiz sözlük (çakışma) çıkış 2, Gemini çağrılmaz', async () => {
    sozlukYaz('Ada Bee: [Cem Dee]\nEda Eff: [Cem Dee]\n');
    const s = await calistir(['--tarih', '2026-11-01'], bag(['Brayden Burries']));
    expect(s.kod).toBe(2);
    expect(cikti.join(String.fromCharCode(10))).toMatch(/oyuncu-adlari.yaml geçersiz: .*iki kanonik ada bağlı/);
  });
  it('sozlukOku: dosya yoksa boş; takma adlar ve null değerler okunur', () => {
    expect(sozlukOku(join(klasor, 'yok')).kanonikAdlar).toEqual([]);
    sozlukYaz('Ada Bee: [Cem Dee]\nEda Eff:\n');
    const o = sozlukOku(icerik());
    expect(o.kanonikAdlar).toEqual(['Ada Bee', 'Eda Eff']);
    expect(o.harita.get('cem-dee')).toBe('Ada Bee');
  });
});
