// Kontrol alanı: nottan üretim, yorumların bu alandan üretilmesi, eski yorumlardan geri kurma, şema ve dogrula entegrasyonu (ağ yok).
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { dogrula, type OyunNotu } from './gece';
import { kontrolYorumlari, notuKontrole, yorumdanKontrol } from './kontrol';
import { oyla } from './oylama';
import { gecerliHam } from './test-yardim';
import { top10Sema } from '../../src/lib/top10-sema';

const baglam = { tarih: '2026-11-01', video: 'https://www.youtube.com/watch?v=abcdefghijk', tur: 'top5' as const, model: 'gemini-3.8-flash', uretildi: new Date('2026-11-02T07:00:00.000Z') };
const temel = (o: Partial<OyunNotu> = {}): OyunNotu => ({ sira: 1, guven: 'high', payli: false, adUyarilari: [], aciklamadaYok: [], ...o });
const calis = (oyuncu: string) => {
  const ham = gecerliHam('top5');
  ham.plays[3]!.contributors = [{ player: oyuncu, team: 'SAS', role: 'finisher', share: 100 }];
  const s = dogrula(ham, baglam);
  if ('hata' in s) throw new Error(s.hata);
  return s;
};

describe('notuKontrole', () => {
  it('oylamasız, yüksek güven: yalnızca guven', () => {
    expect(notuKontrole(temel())).toEqual({ guven: 'yuksek' });
  });
  it('oylamasız, gerekçe model_guveni içinde; paylı oyunda pay gerekçesi uyarıda', () => {
    expect(notuKontrole(temel({ guven: 'medium', guvenNedeni: 'Jersey hidden', payli: true, payNedeni: 'no-look pass' }))).toEqual({
      guven: 'orta',
      model_guveni: ['orta (Jersey hidden)', 'pay: no-look pass'],
    });
  });
  it('oylama: oy, alternatifler, model güvenleri; oy birliği olmayan eylem/pay oyları ve uzlaşma yok uyarıda', () => {
    const k = notuKontrole(
      temel({
        guven: 'low',
        oy: { oran: '1/3', eylemOran: '2/3', payOran: '1/1', seviye: 'dusuk', uzlasmaYok: true, alternatifler: ['diğer: Ada Bee 1/3', 'eylem diğer: Blok 1/3'] },
        modelGuvenleri: [{ guven: 'high' }, { guven: 'low', neden: 'unclear' }, { guven: 'high' }],
        dogrulanmamisAdlar: ['Axl Rose'],
        benzerAdUyarilari: ['benzer ad, aynı kişi mi? A / B; aynıysa sözlüğe ekle, farklıysa yoksay'],
        aciklamadaYok: ['Axl Rose'],
        eylemUyari: 'eylem ile en büyük pay uyuşmuyor (…)',
        zamanUyari: 'zaman damgası yok',
        adUyarilari: ['"X" ile "Y" çok benzer'],
      }),
    );
    expect(k).toEqual({
      guven: 'dusuk',
      oy: '1/3',
      uyarilar: [
        'uzlaşma yok',
        'eylem oyu 2/3',
        'ad uyarısı: "X" ile "Y" çok benzer',
        'benzer ad, aynı kişi mi? A / B; aynıysa sözlüğe ekle, farklıysa yoksay',
        'doğrulanmamış ad: Axl Rose (sözlükte ve mevcut veride yok, güven düşük)',
        'açıklamada yok: Axl Rose',
        'eylem ile en büyük pay uyuşmuyor (…)',
        'zaman damgası yok',
      ],
      alternatifler: ['diğer: Ada Bee 1/3', 'eylem diğer: Blok 1/3'],
      model_guveni: ['yüksek', 'düşük (unclear)', 'yüksek'],
    });
  });
});

describe('kontrolYorumlari (yorumlar kontrol alanından üretilir)', () => {
  it('oylamalı: güven + oy, alternatifler, model güveni, uyarılar', () => {
    expect(kontrolYorumlari({ guven: 'orta', oy: '2/3', alternatifler: ['diğer: Ada Bee 1/3'], model_guveni: ['yüksek', 'orta (gizli forma)', 'pay: gerekçe'], uyarilar: ['ad uyarısı: X'] })).toEqual([
      'güven: orta (oy 2/3)',
      'diğer: Ada Bee 1/3',
      'model güveni: yüksek; orta (gizli forma)',
      'pay: gerekçe',
      'ad uyarısı: X',
    ]);
  });
  it('oylamasız: tek model güveninin gerekçesi güven satırında', () => {
    expect(kontrolYorumlari({ guven: 'orta', model_guveni: ['orta (Jersey hidden)'] })).toEqual(['güven: orta (Jersey hidden)']);
    expect(kontrolYorumlari({ guven: 'yuksek' })).toEqual(['güven: yüksek']);
  });
});

describe('yorumdanKontrol (geçiş için eski yorumlardan geri kurma)', () => {
  it('eski oylamalı yorumlar', () => {
    expect(
      yorumdanKontrol(['güven: düşük (oy 2/2; eylem 2/2; pay 1/2)', 'pay diğer: 50/50 1/2', 'pay diğer: 30/70 1/2', 'model güveni: yüksek; yüksek', 'pay: Johnson delivers a precise lob pass.']),
    ).toEqual({
      guven: 'dusuk',
      oy: '2/2',
      uyarilar: ['pay oyu 1/2'],
      alternatifler: ['pay diğer: 50/50 1/2', 'pay diğer: 30/70 1/2'],
      model_guveni: ['yüksek', 'yüksek', 'pay: Johnson delivers a precise lob pass.'],
    });
  });
  it('uzlaşma yok, parantezli model gerekçesi (içinde ";") bölünmez', () => {
    const k = yorumdanKontrol(['güven: düşük (oy 1/3, uzlaşma yok; eylem 3/3; pay 1/1)', 'diğer: Cem Dee 1/3', 'model güveni: yüksek (a; b); orta']);
    expect(k).toEqual({ guven: 'dusuk', oy: '1/3', uyarilar: ['uzlaşma yok'], alternatifler: ['diğer: Cem Dee 1/3'], model_guveni: ['yüksek (a; b)', 'orta'] });
  });
  it('oylamasız eski yorum; tanınmayan satır uyarı olarak korunur; güven satırı yoksa null', () => {
    expect(yorumdanKontrol(['güven: orta (Jersey hidden)', 'olası takma ad: A → B, sözlüğe ekle'])).toEqual({
      guven: 'orta',
      uyarilar: ['olası takma ad: A → B, sözlüğe ekle'],
      model_guveni: ['orta (Jersey hidden)'],
    });
    expect(yorumdanKontrol(['başka bir şey'])).toBeNull();
    expect(yorumdanKontrol([])).toBeNull();
  });
  it('üretilen yorumlar tekrar kontrole çevrilince aynı alan çıkar (gidiş-dönüş)', () => {
    const k = notuKontrole(
      temel({ guven: 'medium', payli: true, payNedeni: 'x', oy: { oran: '2/3', eylemOran: '3/3', payOran: '2/2', seviye: 'orta', uzlasmaYok: false, alternatifler: ['diğer: Ada Bee 1/3'] }, modelGuvenleri: [{ guven: 'high' }, { guven: 'medium', neden: 'n' }, { guven: 'high' }] }),
    );
    expect(yorumdanKontrol(kontrolYorumlari(k))).toEqual(k);
  });
});

describe('şema ve betik entegrasyonu', () => {
  it('kontrol alanı şemadan geçer; bilinmeyen anahtar, geçersiz güven ve geçersiz oy reddedilir', () => {
    const gece = (kontrol: unknown) => ({ tarih: '2026-11-01', video: 'https://www.youtube.com/watch?v=abcdefghijk', kaynak: 'gemini', oyunlar: [{ sira: 1, katkilar: [{ oyuncu: 'Ada Bee', takim: 'SAS', rol: 'bitiren' }], kontrol }] });
    // top10 için 10 oyun gerekir; yalnızca kontrol alanı hatalarını ayıklamak için sonuçtaki yolları denetliyoruz.
    const yollar = (k: unknown) => {
      const r = top10Sema.safeParse(gece(k));
      return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
    };
    expect(yollar({ guven: 'yuksek', oy: '2/3', uyarilar: ['a'], alternatifler: ['b'], model_guveni: ['c'] }).filter((y) => y.includes('kontrol'))).toEqual([]);
    expect(yollar({ guven: 'çok' }).some((y) => y.includes('kontrol.guven'))).toBe(true);
    expect(yollar({ guven: 'orta', oy: 'iki' }).some((y) => y.includes('kontrol.oy'))).toBe(true);
    expect(top10Sema.safeParse(gece({ guven: 'orta', fazla: 1 })).success).toBe(false);
  });
  it('dogrula: her oyunun kontrol alanı dolu, YAML kontrol blokları içerir ve yeniden okununca şemadan geçer', () => {
    const s = calis('Ada Bee');
    expect(s.gece.oyunlar.every((o) => o.kontrol)).toBe(true);
    const okunan = top10Sema.parse(parse(s.yaml));
    expect(okunan.oyunlar.every((o) => o.kontrol?.guven)).toBe(true);
    expect(s.gece.oyunlar[0]!.kontrol).toMatchObject({ guven: 'yuksek', model_guveni: ['pay: The no-look pass was the more spectacular part'] });
    // pay gerekçesi uyarı değildir: yüksek güvenli, uyarısız paylı satır "bakılacak" sayılmaz
    expect(s.gece.oyunlar[0]!.kontrol!.uyarilar).toBeUndefined();
    // yorumlar kontrol alanından türemiştir: oyunun üstündeki ilk yorum kontrolün güven satırıdır
    expect(s.yaml).toMatch(/# güven: yüksek[^\n]*\n(?:\s*#[^\n]*\n)*\s*- sira: 1/);
  });
  it('oylama sonucu: oy oranı ve alternatifler kontrol alanında; "doğrulanmamış ad" uyarısı uyarilar içinde', () => {
    const r = oyla([calis('Ada Bee'), calis('Cem Dee'), calis('Ada Bee')], 2);
    if ('hata' in r) throw new Error(r.hata);
    const n = r.notlar.find((x) => x.sira === 4)!;
    const k = notuKontrole(n);
    expect(k).toMatchObject({ guven: 'orta', oy: '2/3', alternatifler: ['diğer: Cem Dee 1/3'] });
  });
  it('düşük güvenli bilinmeyen ad: kontrol.uyarilar "doğrulanmamış ad" satırı içerir', () => {
    const ham = gecerliHam('top5');
    ham.plays[3]!.confidence = 'low';
    ham.plays[3]!.contributors = [{ player: 'Axl Rose', team: 'GSW', role: 'finisher', share: 100 }];
    const s = dogrula(ham, baglam);
    if ('hata' in s) throw new Error(s.hata);
    const k = s.gece.oyunlar.find((o) => o.sira === 4)!.kontrol!;
    expect(k.guven).toBe('dusuk');
    expect(k.uyarilar?.some((u) => u.startsWith('doğrulanmamış ad: Axl Rose'))).toBe(true);
  });
});
