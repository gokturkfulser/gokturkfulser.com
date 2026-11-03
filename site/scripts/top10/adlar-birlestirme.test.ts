// Oyuncu adı sözlüğü ve oylamada ad eşleştirme (ağ yok). Soyadı + takım üzerinden OTOMATİK birleştirme yoktur: yalnızca sözlükle aynı kanonik
// ada bağlı olanlar ve normalleştirilmiş tam adı aynı olanlar aynı kişidir; benzer ama farklı adlar ayrı aday kalır ve uyarılır.
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
const benzer = (a: string, b: string) => `benzer ad, aynı kişi mi? ${a} / ${b}; aynıysa sözlüğe ekle, farklıysa yoksay`;

describe('Jaylin / Jalen Williams: iki ayrı gerçek oyuncu (OKC) sessizce birleştirilmez', () => {
  it('ayrı aday olarak oylanır; çoğunluk yazımı kazanır; satıra "benzer ad, aynı kişi mi?" uyarısı yazılır (yön yok)', () => {
    const r = oyla([calisma('Jalen Williams', 'OKC'), calisma('Jaylin Williams', 'OKC'), calisma('Jalen Williams', 'OKC')], 2);
    expect(ad4(r)).toEqual(['Jalen Williams']);
    expect(not4(r).oy).toMatchObject({ oran: '2/3', seviye: 'orta', alternatifler: ['diğer: Jaylin Williams 1/3'] });
    expect(not4(r).benzerAdUyarilari).toEqual([benzer('Jalen Williams', 'Jaylin Williams')]);
    expect(not4(r).benzerAdUyarilari![0]).not.toMatch(/→/); // öneri yönü belirtilmez
  });
  it('Jaylin çoğunlukta olsa da Jalen\'e yazılmaz', () => {
    const r = oyla([calisma('Jaylin Williams', 'OKC'), calisma('Jaylin Williams', 'OKC'), calisma('Jalen Williams', 'OKC')], 2);
    expect(ad4(r)).toEqual(['Jaylin Williams']);
    expect(not4(r).benzerAdUyarilari).toEqual([benzer('Jaylin Williams', 'Jalen Williams')]);
  });
  it('oylamaSonrasi: uyarı YAML yorumunda', () => {
    const r = oylamaSonrasi([calisma('Jalen Williams', 'OKC'), calisma('Jaylin Williams', 'OKC'), calisma('Jalen Williams', 'OKC')], { ...baglam, tur: 'top5' }, [], 2);
    if ('hata' in r) throw new Error(r.hata);
    expect(r.yaml).toContain(`# ${benzer('Jalen Williams', 'Jaylin Williams')}`);
  });
});

describe('Braden / Brayden Burries: sözlükteyse birleşir, değilse ayrı kalır ve uyarılır', () => {
  it('sözlükte YOKSA ayrı aday: oy 2/3 ve uyarı', () => {
    const r = oyla([calisma('Brayden Burries'), calisma('Braden Burries'), calisma('Brayden Burries')], 2);
    expect(ad4(r)).toEqual(['Brayden Burries']);
    expect(not4(r).oy).toMatchObject({ oran: '2/3', seviye: 'orta', alternatifler: ['diğer: Braden Burries 1/3'] });
    expect(not4(r).benzerAdUyarilari).toEqual([benzer('Brayden Burries', 'Braden Burries')]);
  });
  it('sözlükteyse (hamAdlariniUygula ile kanonik ada çevrilir) oy birliği, uyarı yok', () => {
    const harita = sozlukHaritasi({ 'Brayden Burries': ['Braden Burries'] });
    const calis = ['Braden Burries', 'Brayden Burries', 'BRADEN BURRIES'].map((ad) => {
      const h = gecerliHam('top5');
      h.plays[3]!.contributors = [{ player: ad, team: 'SAS', role: 'finisher', share: 100 }];
      const s = dogrula(hamAdlariniUygula(h, harita), baglam);
      if ('hata' in s) throw new Error(s.hata);
      return s;
    });
    const r = oyla(calis, 2);
    expect(ad4(r)).toEqual(['Brayden Burries']);
    expect(not4(r).oy).toMatchObject({ oran: '3/3', seviye: 'yuksek', alternatifler: [] });
    expect(not4(r).benzerAdUyarilari).toBeUndefined();
  });
  it('Svi / Sviatoslav Mykhailiuk da sözlükte yoksa ayrı kalır ve uyarılır', () => {
    const r = oyla([calisma('Svi Mykhailiuk', 'GSW'), calisma('Sviatoslav Mykhailiuk', 'GSW'), calisma('Svi Mykhailiuk', 'GSW')], 2);
    expect(ad4(r)).toEqual(['Svi Mykhailiuk']);
    expect(not4(r).benzerAdUyarilari).toEqual([benzer('Svi Mykhailiuk', 'Sviatoslav Mykhailiuk')]);
  });
});

describe('yalnızca normalleştirilmiş tam adı aynı olanlar aynı kişi (aksan, büyük/küçük harf, Jr.)', () => {
  it('Salaün / Salaun / SALAUN Jr. tek aday: oy 3/3, uyarı yok', () => {
    const r = oyla([calisma('Mouhamed Salaün', 'UTA'), calisma('Mouhamed Salaun', 'UTA'), calisma('MOUHAMED SALAUN Jr.', 'UTA')], 2);
    expect(not4(r).oy).toMatchObject({ oran: '3/3', seviye: 'yuksek' });
    expect(not4(r).benzerAdUyarilari).toBeUndefined();
  });
  const uc = [() => calisma('Mouhamed Salaun', 'UTA'), () => calisma('Mouhamed Salaün', 'UTA'), () => calisma('Mouhamed Salaun', 'UTA')];
  it('yazım önceliği 1) sözlükteki kanonik yazım', () => {
    const r = oyla(uc.map((f) => f()), 2, { kanonik: new Map([['mouhamed salaun', 'Mouhamed Salaün']]), mevcut: new Map([['mouhamed salaun', 'Mouhamed SALAUN']]) });
    expect(ad4(r)).toEqual(['Mouhamed Salaün']);
  });
  it('2) kanonik yoksa mevcut top10 verisinde geçen yazım (çoğunluk başka olsa da)', () => {
    const r = oyla(uc.map((f) => f()), 2, { mevcut: new Map([['mouhamed salaun', 'Mouhamed Salaün']]) });
    expect(ad4(r)).toEqual(['Mouhamed Salaün']);
  });
  it('3) ikisi de yoksa çoğunluk yazımı; eşitlikte ilk çalıştırma', () => {
    expect(ad4(oyla(uc.map((f) => f()), 2))).toEqual(['Mouhamed Salaun']); // 2/3
    expect(ad4(oyla([calisma('Mouhamed Salaün', 'UTA'), calisma('Mouhamed Salaun', 'UTA')], 2))).toEqual(['Mouhamed Salaün']);
  });
  it('oylamaSonrasi: kanonik adlar ve mevcut veri yazım önceliğine girer', () => {
    const mevcutGece = { tarih: new Date('2026-10-30T00:00:00Z'), tur: 'top5', video: 'https://www.youtube.com/watch?v=x', kaynak: 'elle', oyunlar: [{ sira: 1, katkilar: [{ oyuncu: 'Mouhamed Salaün', takim: 'UTA', rol: 'bitiren' }] }] } as unknown as Gece;
    const r = oylamaSonrasi(uc.map((f) => f()), { ...baglam, tur: 'top5' }, [mevcutGece], 2);
    if ('hata' in r) throw new Error(r.hata);
    expect(r.gece.oyunlar.find((o) => o.sira === 4)!.katkilar[0]!.oyuncu).toBe('Mouhamed Salaün');
  });
});

describe('farklı kişileri birleştirmez, gereksiz uyarı vermez', () => {
  it('aynı soyadlı iki farklı takım oyuncusu: ayrı kalır, uyarı yok (soyadı uyarısı aynı takım ister)', () => {
    const r = oyla([calisma('Keldon Johnson', 'SAS'), calisma('Jalen Johnson', 'ATL'), calisma('Keldon Johnson', 'SAS')], 2);
    expect(ad4(r)).toEqual(['Keldon Johnson']);
    expect(not4(r).oy).toMatchObject({ oran: '2/3', seviye: 'orta', alternatifler: ['diğer: Jalen Johnson 1/3'] });
    expect(not4(r).benzerAdUyarilari).toBeUndefined();
  });
  it('aynı takımda farklı soyadlı oyuncular: ayrı kalır, uyarı yok', () => {
    const r = oyla([calisma('Jaylen Wells', 'MEM'), calisma('Jaylen Walker', 'MEM'), calisma('Jaylen Wells', 'MEM')], 2);
    expect(ad4(r)).toEqual(['Jaylen Wells']);
    expect(not4(r).benzerAdUyarilari).toBeUndefined();
  });
  it('aynı takımda benzer ama farklı soyadı (Burries / Burris): uyarı yok', () => {
    const r = oyla([calisma('Brayden Burries'), calisma('Brayden Burris'), calisma('Brayden Burries')], 2);
    expect(not4(r).oy!.oran).toBe('2/3');
    expect(not4(r).benzerAdUyarilari).toBeUndefined();
  });
  it('soyadı aynı, takım farklı: uyarı yok', () => {
    const r = oyla([calisma('Brayden Burries', 'SAS'), calisma('Braden Burries', 'DEN'), calisma('Brayden Burries', 'SAS')], 2);
    expect(not4(r).oy!.oran).toBe('2/3');
    expect(not4(r).benzerAdUyarilari).toBeUndefined();
  });
  it('aynı çalıştırmanın aynı satırında birlikte geçen aynı soyadlı iki oyuncu ayrı kişidir: uyarı yok', () => {
    const ikili = (a: string) => (h: HamGece) => (h.plays[3]!.contributors = [
      { player: a, team: 'SAS', role: 'finisher', share: 50 },
      { player: 'Dallas Burries', team: 'SAS', role: 'passer', share: 50 },
    ]);
    const r = oyla([calisma(undefined, 'SAS', ikili('Brayden Burries')), calisma(undefined, 'SAS', ikili('Brayden Burries')), calisma(undefined, 'SAS', ikili('Brayden Burries'))], 2);
    expect(ad4(r).sort()).toEqual(['Brayden Burries', 'Dallas Burries']);
    expect(not4(r).oy).toMatchObject({ oran: '3/3', seviye: 'yuksek' });
    expect(not4(r).benzerAdUyarilari).toBeUndefined();
  });
  it('benzer ad uyarısı yalnızca aynı sıra içinde: başka sıradaki aynı soyadı uyarı doğurmaz; girdi değişmez', () => {
    const c = [calisma('Brayden Burries'), calisma(undefined, 'SAS', (h) => (h.plays[4]!.contributors = [{ player: 'Braden Burries', team: 'SAS', role: 'finisher', share: 100 }]))];
    const r = adlariBirlestir(c);
    expect(r.uyarilar.size).toBe(0);
    expect(c[1]!.gece.oyunlar[4]!.katkilar[0]!.oyuncu).toBe('Braden Burries');
  });
  it('soyadı eşleşmesi hiçbir koşulda ad değiştirmez', () => {
    const c = [calisma('Jalen Williams', 'OKC'), calisma('Jaylin Williams', 'OKC'), calisma('Jalen Williams', 'OKC')];
    const r = adlariBirlestir(c);
    expect(r.calismalar.map((x) => x.gece.oyunlar[3]!.katkilar[0]!.oyuncu)).toEqual(['Jalen Williams', 'Jaylin Williams', 'Jalen Williams']);
    expect(r.uyarilar.get(4)).toEqual([benzer('Jalen Williams', 'Jaylin Williams')]);
  });
});

describe('sözlük uygulaması (betik)', () => {
  const harita = sozlukHaritasi({ 'Svi Mykhailiuk': ['Sviatoslav Mykhailiuk'], 'Brayden Burries': ['Braden Burries'] });
  it('modelin ham çıktısındaki adlar (katkı ve rakip) kanonik ada çevrilir; girdi değişmez', () => {
    const ham = gecerliHam('top5');
    ham.plays[3]!.contributors = [{ player: 'Sviatoslav Mykhailiuk', team: 'GSW', role: 'finisher', share: 100 }];
    ham.plays[3]!.opponent = 'braden burries';
    const k = hamAdlariniUygula(ham, harita);
    expect(k.plays[3]!.contributors[0]!.player).toBe('Svi Mykhailiuk');
    expect(k.plays[3]!.opponent).toBe('Brayden Burries');
    expect(ham.plays[3]!.contributors[0]!.player).toBe('Sviatoslav Mykhailiuk');
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
  const log = () => cikti.join(String.fromCharCode(10));

  function bag(adlar: string[], takim = 'GSW') {
    let n = 0;
    const fetchFn = (async (girdi: URL | string) => {
      const url = new URL(String(girdi));
      if (url.hostname === 'www.googleapis.com') {
        if (url.pathname.endsWith('/videos')) return json({ items: [{ id: V5, snippet: { title: T5, description: '' }, contentDetails: { duration: 'PT10M30S' }, status: { privacyStatus: 'public' } }] });
        return json({ items: [oge(V5, T5, '2026-11-02T05:26:50Z')] });
      }
      const h = gecerliHam('top5');
      h.plays[3]!.contributors = [{ player: adlar[n++ % adlar.length]!, team: takim, role: 'finisher', share: 100 }];
      return json(geminiYaniti(h));
    }) as unknown as typeof fetch;
    return { env: { YOUTUBE_API_KEY: YT_ANAHTAR, GEMINI_API_KEY: GM_ANAHTAR }, fetchFn, simdi: () => SIMDI, icerikKlasoru: icerik(), yaz: (s: string) => cikti.push(s), ozetDosyasi: join(klasor, 'ozet.md'), ciktiKlasoru: join(klasor, 'cikti') };
  }
  const sozlukYaz = (icerikMetni: string) => {
    mkdirSync(icerik(), { recursive: true });
    writeFileSync(join(icerik(), 'oyuncu-adlari.yaml'), icerikMetni);
  };
  const dosya = () => readFileSync(join(icerik(), '2026-27', '2026-11-01.yaml'), 'utf8');

  it('sözlükteki takma adlar çevrilir: oy birliği, kanonik ad yazılır, benzer ad uyarısı yok', async () => {
    sozlukYaz('Brayden Burries: [Braden Burries]\n');
    const s = await calistir(['--tarih', '2026-11-01'], bag(['Braden Burries', 'Brayden Burries', 'Braden Burries'], 'SAS'));
    expect(s.kod).toBe(0);
    expect(dosya()).toContain('oyuncu: Brayden Burries');
    expect(dosya()).not.toContain('Braden');
    expect(dosya()).toContain('# güven: yüksek (oy 3/3;');
    expect(log()).not.toContain('benzer ad');
  });
  it('sözlükte olmayan benzer yazım ayrı aday kalır: "benzer ad, aynı kişi mi?" uyarısı YAML yorumu, terminal ve özette; sözlük değişmez', async () => {
    const baslangic = 'Svi Mykhailiuk: [Sviatoslav Mykhailiuk]\n';
    sozlukYaz(baslangic);
    const b = bag(['Braden Burries', 'Brayden Burries', 'Brayden Burries'], 'SAS');
    const s = await calistir(['--tarih', '2026-11-01'], b);
    expect(s.kod).toBe(0);
    const uyari = benzer('Braden Burries', 'Brayden Burries');
    expect(dosya()).toContain(`# ${uyari}`);
    expect(dosya()).toContain('oyuncu: Brayden Burries'); // çoğunluk yazımı; Braden'a dönüştürülmedi
    expect(log()).toContain(`UYARI: ${uyari}`);
    expect(readFileSync(b.ozetDosyasi, 'utf8')).toContain(`sıra 4: ${uyari}`);
    expect(readFileSync(join(icerik(), 'oyuncu-adlari.yaml'), 'utf8')).toBe(baslangic); // betik sözlüğü yazmaz
  });
  it('mevcut gece dosyasındaki takma ad yazımı sözlükle eşleşir: "mevcut yazım" uyarısı yok', async () => {
    sozlukYaz('Brayden Burries: [Braden Burries]\n');
    mkdirSync(join(icerik(), '2026-27'), { recursive: true });
    writeFileSync(join(icerik(), '2026-27', '2026-10-30.yaml'), ['tarih: 2026-10-30', 'video: https://www.youtube.com/watch?v=x', 'tur: top5', 'kaynak: elle', 'oyunlar:', ...[1, 2, 3, 4, 5].map((n) => `  - { sira: ${n}, katkilar: [{ oyuncu: ${n === 1 ? 'Braden Burries' : `Baska Oyuncu${'x'.repeat(n)}`}, takim: SAS, rol: bitiren }] }`)].join(String.fromCharCode(10)));
    await calistir(['--tarih', '2026-11-01', '--oylama', '1'], bag(['Brayden Burries'], 'SAS'));
    expect(dosya()).not.toContain('mevcut yazım');
    rmSync(join(icerik(), 'oyuncu-adlari.yaml'));
    rmSync(join(icerik(), '2026-27', '2026-11-01.yaml'));
    await calistir(['--tarih', '2026-11-01', '--oylama', '1'], bag(['Brayden Burries'], 'SAS'));
    expect(dosya()).toContain('mevcut yazım: Braden Burries?');
  });
  it('geçersiz sözlük (çakışma) çıkış 2, Gemini çağrılmaz', async () => {
    sozlukYaz('Ada Bee: [Cem Dee]\nEda Eff: [Cem Dee]\n');
    const s = await calistir(['--tarih', '2026-11-01'], bag(['Brayden Burries']));
    expect(s.kod).toBe(2);
    expect(log()).toMatch(/oyuncu-adlari.yaml geçersiz: .*iki kanonik ada bağlı/);
  });
  it('sozlukOku: dosya yoksa boş; takma adlar ve null değerler okunur; tüm adlar listelenir', () => {
    expect(sozlukOku(join(klasor, 'yok')).kanonikAdlar).toEqual([]);
    sozlukYaz('Ada Bee: [Cem Dee]\nEda Eff:\n');
    const o = sozlukOku(icerik());
    expect(o.kanonikAdlar).toEqual(['Ada Bee', 'Eda Eff']);
    expect(o.tumAdlar).toEqual(['Ada Bee', 'Cem Dee', 'Eda Eff']);
    expect(o.harita.get('cem-dee')).toBe('Ada Bee');
  });
});
