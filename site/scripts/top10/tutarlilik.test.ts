// Uydurma (halüsinasyon) koruması: Gemini çıktısının videoyla tutarlılık denetimleri ve eylem/pay uyarısı (ağ yok).
import { describe, expect, it } from 'vitest';
import { dogrula, eylemPayUyarisi, type Uretilen } from './gece';
import { gecerliHam } from './test-yardim';
import type { Gece } from '../../src/lib/top10';

const baglam = { tarih: '2026-11-01', video: 'https://www.youtube.com/watch?v=abcdefghijk', tur: 'top10' as const, model: 'gemini-3.6-flash', uretildi: new Date('2026-11-02T07:01:02.000Z') };
const tamam = (s: ReturnType<typeof dogrula>): Uretilen => {
  if ('hata' in s) throw new Error(s.hata);
  return s;
};

describe('videoyla tutarlılık kontrolleri', () => {
  const sure = 725; // 12:05
  const aciklama = 'Plays of the night featuring Tomas Veltri, Kofi Adebayo, Ilse Brandt, Rafael Quintero, Jun Takeda, Dario Fenn, Nils Haugen, Amara Osei, Leo Marchetti and Mirko Daval.';
  const ctx = { ...baglam, sureSn: sure, aciklama };

  it('boş oyun listesi: kesin başarısızlık (yeniden deneme yok), uydurma yazılmaz', () => {
    const s = dogrula({ date: '2026-11-01', type: 'top10', plays: [] }, ctx);
    expect('hata' in s && s.hata).toMatch(/boş oyun listesi/);
    expect('hata' in s && s.kesin).toBe(true);
  });

  it('zaman damgası 0 ile video süresi arasında olmalı', () => {
    const ham = gecerliHam('top10');
    ham.plays[2]!.timestamp = '12:06'; // 726 sn > 725
    const s = dogrula(ham, ctx);
    expect('hata' in s && s.hata).toMatch(/plays\[rank 3\]\.timestamp: 12:06 video süresinin \(12:05\) dışında/);
    const sinirda = gecerliHam('top10');
    sinirda.plays[2]!.timestamp = '12:05';
    expect('hata' in dogrula(sinirda, ctx)).toBe(false);
    const kisaVideo = dogrula(gecerliHam('top10'), { ...ctx, sureSn: 100 });
    expect('hata' in kisaVideo && kisaVideo.hata).toMatch(/video süresinin \(1:40\) dışında/);
  });

  it('oyun sayısı başlıktaki türle aynı olmalı (Top 5 başlıklı videoda 5 oyun)', () => {
    const s = dogrula(gecerliHam('top10'), { ...ctx, tur: 'top5' });
    expect('hata' in s && s.hata).toMatch(/oyun sayısı 10; başlıktaki tür \(Top 5\) 5 oyun gerektirir/);
    const t = dogrula(gecerliHam('top5'), { ...ctx, tur: 'top10' });
    expect('hata' in t && t.hata).toMatch(/oyun sayısı 5; başlıktaki tür \(Top 10\) 10 oyun gerektirir/);
    expect('hata' in dogrula(gecerliHam('top5'), { ...ctx, tur: 'top5', aciklama: undefined })).toBe(false);
  });

  it('başlık kalıba uymayıp --zorla ile geçilirse tür modelin type değerinden alınır, sayı kontrolü yapılmaz', () => {
    const s = tamam(dogrula(gecerliHam('top5'), { ...ctx, tur: undefined, aciklama: undefined }));
    expect(s.gece.tur).toBe('top5');
  });

  it('açıklamadaki liste: katkı sahiplerinin yarısından azı listede yoksa "videoyla tutarsız"', () => {
    const ham = gecerliHam('top10');
    ham.plays.forEach((o, i) => {
      if (i >= 3) o.contributors = [{ player: `Uydurma Oyuncu ${String.fromCharCode(65 + i)}`, team: 'SAS', role: 'finisher', share: 100 }];
    });
    const s = dogrula(ham, ctx);
    expect('hata' in s && s.hata).toMatch(/^videoyla tutarsız: katkı sahiplerinin yalnızca 4\/11 kadarı video açıklamasındaki oyuncu listesinde geçiyor/);
    expect('hata' in s && s.kesin).toBeUndefined(); // yeniden denenebilir
  });

  it('tek tek listede olmayan ad: uyarı (oyun notu ve YAML yorumu), gece başarısız değil', () => {
    const ham = gecerliHam('top10');
    ham.plays[4]!.contributors[0]!.player = 'Baska Biri'; // 10 katkı sahibinden 1'i listede yok
    const s = tamam(dogrula(ham, ctx));
    expect(s.aciklamaKontrol).toMatchObject({ atlandi: false, eslesen: 9, toplam: 10, eksikler: ['Baska Biri'] });
    expect(s.oyunNotlari.find((n) => n.sira === 5)!.aciklamadaYok).toEqual(['Baska Biri']);
    expect(s.yaml).toContain('# açıklamada yok: Baska Biri');
    expect(s.yaml.match(/# açıklamada yok:/g)).toHaveLength(1);
  });

  it('aksan/Jr./kesme işareti farklı yazılan ad listeyle eşleşir (uyarı yok)', () => {
    const ham = gecerliHam('top5');
    ham.plays[0]!.contributors = [{ player: 'Nikola Jokic', team: 'DEN', role: 'finisher', share: 100 }];
    ham.plays[1]!.contributors = [{ player: "De'Aaron Fox", team: 'SAS', role: 'finisher', share: 100 }];
    ham.plays[2]!.contributors = [{ player: 'Jaime Jaquez', team: 'MIA', role: 'finisher', share: 100 }];
    ham.plays[0]!.opponent = null;
    const s = tamam(dogrula(ham, { ...ctx, tur: 'top5', aciklama: 'Top 5 featuring Nikola Jokić, DeAaron Fox, Jaime Jaquez Jr., Rafael Quintero and Jun Takeda.' }));
    expect(s.oyunNotlari.every((n) => n.aciklamadaYok.length === 0)).toBe(true);
    expect(s.aciklamaKontrol.eksikler).toEqual([]);
  });

  it('açıklamada oyuncu listesi yoksa kontrol atlanır ve uyarı yazılır; açıklamadaki liste sonuca veri olarak girmez', () => {
    const s = tamam(dogrula(gecerliHam('top10'), { ...ctx, aciklama: 'Never miss a moment with the latest news, trending stories and highlights' }));
    expect(s.aciklamaKontrol.atlandi).toBe(true);
    expect(s.uyarilar.join(' ')).toMatch(/featuring" oyuncu listesi bulunamadı; açıklama çapraz kontrolü atlandı/);
    // açıklamada geçen ama videodan okunmayan bir ad dosyaya girmez
    const s2 = tamam(dogrula(gecerliHam('top10'), { ...ctx, aciklama: `${aciklama} Also featuring Hic Gecmeyen Adam, Bir Baska, Ucuncu Kisi` }));
    expect(s2.yaml).not.toContain('Hic Gecmeyen Adam');
    expect(JSON.stringify(s2.gece)).not.toContain('Hic Gecmeyen Adam');
  });
});

describe('eylem ile en büyük pay tutarlılığı (yalnızca uyarı)', () => {
  const oyun = (eylem: string, katkilar: [string, string, number][]) =>
    ({
      sira: 3,
      eylem,
      katkilar: katkilar.map(([oyuncu, rol, pay]) => ({ oyuncu, takim: 'SAS', rol, pay })),
    }) as unknown as Gece['oyunlar'][number];

  it('alley_oop için hiç uyarı yok; eşit paylı oyunda uyarı yok', () => {
    expect(eylemPayUyarisi(oyun('alley_oop', [['A Bee', 'pasor', 70], ['C Dee', 'bitiren', 30]]))).toBeUndefined();
    expect(eylemPayUyarisi(oyun('smac', [['A Bee', 'pasor', 50], ['C Dee', 'bitiren', 50]]))).toBeUndefined();
    expect(eylemPayUyarisi(oyun('smac', [['A Bee', 'pasor', 34], ['C Dee', 'bitiren', 33], ['E Eff', 'diger', 33]]))).toMatch(/uyuşmuyor/); // 34 tek en büyük
    expect(eylemPayUyarisi(oyun('smac', [['A Bee', 'pasor', 25], ['C Dee', 'bitiren', 50], ['E Eff', 'diger', 25]]))).toBeUndefined(); // en büyük pay bitirende
    expect(eylemPayUyarisi(oyun('smac', [['A Bee', 'pasor', 50], ['C Dee', 'bitiren', 25], ['E Eff', 'diger', 25]]))).toMatch(/uyuşmuyor/);
  });
  it('en büyük pay pasörde ama eylem smaç: uyarı; pas ile tutarlıysa uyarı yok', () => {
    expect(eylemPayUyarisi(oyun('smac', [['A Bee', 'pasor', 70], ['C Dee', 'bitiren', 30]]))).toBe('eylem ile en büyük pay uyuşmuyor (eylem: Smaç; en büyük pay: A Bee %70, Pasör)');
    expect(eylemPayUyarisi(oyun('pas', [['A Bee', 'pasor', 70], ['C Dee', 'bitiren', 30]]))).toBeUndefined();
  });
  it('rol-eylem eşlemeleri: bloklayan↔blok, top_calan↔top_calma, bitiren↔smac/turnike/ucluk/orta_mesafe', () => {
    expect(eylemPayUyarisi(oyun('blok', [['A Bee', 'bloklayan', 70], ['C Dee', 'bitiren', 30]]))).toBeUndefined();
    expect(eylemPayUyarisi(oyun('smac', [['A Bee', 'bloklayan', 70], ['C Dee', 'bitiren', 30]]))).toMatch(/uyuşmuyor/);
    expect(eylemPayUyarisi(oyun('top_calma', [['A Bee', 'top_calan', 70], ['C Dee', 'bitiren', 30]]))).toBeUndefined();
    expect(eylemPayUyarisi(oyun('blok', [['A Bee', 'top_calan', 70], ['C Dee', 'bitiren', 30]]))).toMatch(/uyuşmuyor/);
    for (const e of ['smac', 'turnike', 'ucluk', 'orta_mesafe']) expect(eylemPayUyarisi(oyun(e, [['A Bee', 'bitiren', 100]])), e).toBeUndefined();
    expect(eylemPayUyarisi(oyun('pas', [['A Bee', 'bitiren', 100]]))).toMatch(/uyuşmuyor/);
    expect(eylemPayUyarisi(oyun('diger', [['A Bee', 'pasor', 100]]))).toBeUndefined();
    expect(eylemPayUyarisi(oyun('smac', [['A Bee', 'diger', 100]]))).toBeUndefined();
  });
  it('dogrula: uyarı sonucu değiştirmez, YAML yorumuna ve oyun notuna yazılır', () => {
    const ham = gecerliHam('top10');
    ham.plays[1]!.action = 'dunk';
    ham.plays[1]!.contributors = [
      { player: 'Kofi Adebayo', team: 'OKC', role: 'passer', share: 70, share_reason: 'The pass was the highlight' },
      { player: 'Piet Kronen', team: 'OKC', role: 'finisher', share: 30 },
    ];
    const s = tamam(dogrula(ham, baglam));
    expect(s.gece.oyunlar[1]!.eylem).toBe('smac'); // sonuç değişmez
    expect(s.oyunNotlari[1]!.eylemUyari).toBe('eylem ile en büyük pay uyuşmuyor (eylem: Smaç; en büyük pay: Kofi Adebayo %70, Pasör)');
    expect(s.yaml).toContain('# eylem ile en büyük pay uyuşmuyor (eylem: Smaç; en büyük pay: Kofi Adebayo %70, Pasör)');
    expect(tamam(dogrula(gecerliHam('top10'), baglam)).oyunNotlari.every((n) => !n.eylemUyari)).toBe(true);
  });
});
