import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { dogrula, katkiDokumu, sezonKlasoru, yamlDogrula, type Uretilen } from './gece';
import { gecerliHam } from './test-yardim';
import { top10Sema } from '../../src/lib/top10-sema';
import type { Gece } from '../../src/lib/top10';

const URETILDI = new Date('2026-11-02T07:01:02.000Z');
const baglam = { tarih: '2026-11-01', video: 'https://www.youtube.com/watch?v=abcdefghijk', tur: 'top10' as const, model: 'gemini-3.6-flash', uretildi: URETILDI };
const tamam = (s: ReturnType<typeof dogrula>): Uretilen => {
  if ('hata' in s) throw new Error(s.hata);
  return s;
};

describe('sezonKlasoru', () => {
  it('Ağustos ve sonrası o yıl başlayan sezon, öncesi önceki yıl başlayan', () => {
    expect(sezonKlasoru('2026-11-01')).toBe('2026-27');
    expect(sezonKlasoru('2027-01-15')).toBe('2026-27');
    expect(sezonKlasoru('2027-10-20')).toBe('2027-28');
    expect(sezonKlasoru('2099-10-20')).toBe('2099-00');
  });
});

describe('dogrula: clutch tutarlılığı (ortak kural)', () => {
  const etiketli = (etiketler: string[]) => {
    const ham = gecerliHam('top10');
    ham.plays[2]!.tags = etiketler;
    return tamam(dogrula(ham, baglam));
  };
  it('game_winner ve game_tying ⇒ clutch eklenir; bilgi satırı yalnızca YAML yorumunda, kontrol.uyarilar içinde değil', () => {
    for (const t of ['game_winner', 'game_tying']) {
      const s = etiketli([t, 'buzzer_beater']);
      expect(s.gece.oyunlar[2]!.etiketler, t).toEqual([t === 'game_winner' ? 'mac_kazandiran' : 'esitleyen', 'son_saniye', 'clutch']);
      expect(s.yaml.match(/clutch otomatik eklendi/g), t).toHaveLength(1);
      expect(JSON.stringify(s.gece.oyunlar[2]!.kontrol?.uyarilar ?? [])).not.toContain('clutch');
      expect(yamlDogrula(s.yaml)).toHaveProperty('gece');
    }
  });
  it('buzzer_beater tek başına clutch eklemez ve yorum yazılmaz; modelin verdiği clutch çift eklenmez', () => {
    const s = etiketli(['buzzer_beater']);
    expect(s.gece.oyunlar[2]!.etiketler).toEqual(['son_saniye']);
    expect(s.yaml).not.toContain('clutch otomatik eklendi');
    const c = etiketli(['game_winner', 'clutch']);
    expect(c.gece.oyunlar[2]!.etiketler).toEqual(['mac_kazandiran', 'clutch']);
    expect(c.yaml).not.toContain('clutch otomatik eklendi');
  });
});

describe('dogrula: istem.md değerlerinden site anahtarlarına', () => {
  it('geçerli çıktı: eylem/etiket/rol/pay/zaman/rakip dönüştürülür; kaynak gemini, inceleme bekliyor', () => {
    const s = tamam(dogrula(gecerliHam('top10'), baglam));
    expect(s.gece.kaynak).toBe('gemini');
    expect(s.gece.inceleme).toBe('bekliyor');
    const bir = s.gece.oyunlar[0]!;
    expect(bir).toMatchObject({ sira: 1, eylem: 'alley_oop', etiketler: ['bakmadan', 'hizli_hucum'], rakip: 'Dario Fenn', zaman: '6:10' });
    expect(bir.katkilar).toEqual([
      { oyuncu: 'Mirko Daval', takim: 'SAS', rol: 'pasor', pay: 70 },
      { oyuncu: 'Tomas Veltri', takim: 'SAS', rol: 'bitiren', pay: 30 },
    ]);
    expect(s.gece.oyunlar[1]).toMatchObject({ eylem: 'smac', aciklama: 'Play number 2' });
  });

  it('katkı dökümü: kişi başı pay ve puan (1. sıra 70/30 → 7 ve 3)', () => {
    const s = tamam(dogrula(gecerliHam('top10'), baglam));
    expect(katkiDokumu(s.gece.oyunlar[0]!).map((k) => [k.oyuncu, k.pay, k.puan])).toEqual([['Mirko Daval', 70, 7], ['Tomas Veltri', 30, 3]]);
  });

  it('bilinmeyen takım kodu şemadan geçmez (yeniden deneme yoluna giden hata)', () => {
    for (const kod of ['NJ', 'XYZ', 'GSTATE', 'SEA']) {
      const ham = gecerliHam('top10');
      ham.plays[2]!.contributors[0]!.team = kod;
      const s = dogrula(ham, baglam);
      expect('hata' in s && s.hata, kod).toMatch(/takım NBA'in 30 kısaltmasından biri olmalı/);
    }
  });
  it('takım küçük harfle gelirse büyütülür; 30 takımdan biri geçer', () => {
    const ham = gecerliHam('top10');
    ham.plays[2]!.contributors[0]!.team = ' gsw ';
    expect(tamam(dogrula(ham, baglam)).gece.oyunlar[2]!.katkilar[0]!.takim).toBe('GSW');
  });

  it('takım kodu varyantları resmi koda çevrilir ve bilgi satırı verir (tekrar eden kod tek satır)', () => {
    const ham = gecerliHam('top10');
    ham.plays[2]!.contributors[0]!.team = 'GS';
    ham.plays[3]!.contributors[0]!.team = 'pho';
    ham.plays[4]!.contributors[0]!.team = 'GS';
    const s = tamam(dogrula(ham, baglam));
    expect(s.gece.oyunlar[2]!.katkilar[0]!.takim).toBe('GSW');
    expect(s.gece.oyunlar[3]!.katkilar[0]!.takim).toBe('PHX');
    expect(s.bilgiler.sort()).toEqual(['takım kodu çevrildi: GS → GSW', 'takım kodu çevrildi: PHO → PHX']);
  });
  it('doğrulanmamış ad: düşük güven + sözlükte/mevcut veride yok → işaretlenir; bilinen ad ya da yüksek güven → işaretlenmez', () => {
    const dusuk = gecerliHam('top5');
    dusuk.plays[3]!.confidence = 'low';
    dusuk.plays[3]!.contributors = [{ player: 'Axl Rose', team: 'GSW', role: 'finisher', share: 100 }];
    const s = tamam(dogrula(dusuk, { ...baglam, tur: 'top5' }));
    expect(s.oyunNotlari[3]!.dogrulanmamisAdlar).toEqual(['Axl Rose']);
    const b = tamam(dogrula(dusuk, { ...baglam, tur: 'top5' }, [], ['axl rose']));
    expect(b.oyunNotlari[3]!.dogrulanmamisAdlar).toBeUndefined();
    const yuksek = gecerliHam('top5');
    yuksek.plays[3]!.confidence = 'high';
    yuksek.plays[3]!.contributors = [{ player: 'Axl Rose', team: 'GSW', role: 'finisher', share: 100 }];
    expect(tamam(dogrula(yuksek, { ...baglam, tur: 'top5' })).oyunNotlari[3]!.dogrulanmamisAdlar).toBeUndefined();
  });
  it('semaHatasi: en çok 3 hata, alan = değer', () => {
    const ham = gecerliHam('top10');
    for (const i of [0, 1, 2, 3]) ham.plays[i]!.contributors[0]!.team = 'NJ';
    const s = dogrula(ham, baglam);
    const h = 'hata' in s ? s.hata : '';
    expect(h).toContain('= "NJ"');
    expect(h).toContain('(+1 hata daha)');
    expect(h.split('; ').length).toBe(3);
  });

  it('geçersiz pay bölüşümü ve bilinmeyen enum değerleri hata verir', () => {
    const hatali = (degistir: (h: ReturnType<typeof gecerliHam>) => void, beklenen: RegExp) => {
      const ham = gecerliHam('top5');
      degistir(ham);
      const s = dogrula(ham, { ...baglam, tur: 'top5' });
      expect('hata' in s && s.hata).toMatch(beklenen);
    };
    hatali((h) => (h.plays[0]!.contributors[0]!.share = 60), /izinsiz bölüşüm|toplamı/);
    hatali((h) => (h.plays[0]!.contributors[0]!.share = 50), /toplamı 100/);
    hatali((h) => (h.plays[1]!.action = 'dunkk'), /action/);
    hatali((h) => (h.plays[1]!.tags = ['uydurma']), /tags/);
    hatali((h) => (h.plays[1]!.contributors[0]!.role = 'captain'), /role/);
    hatali((h) => h.plays.pop(), /oyun sayısı 4/);
    hatali((h) => (h.plays[1]!.contributors = [h.plays[1]!.contributors[0]!, { ...h.plays[1]!.contributors[0]!, player: 'ADA' }, { ...h.plays[1]!.contributors[0]!, player: 'ada' }]), /iki kez|toplamı/);
  });

  it('modelin type değeri başlıktakiyle uyuşmazsa hata; tarih farklıysa yalnızca uyarı', () => {
    const ham = gecerliHam('top10');
    ham.type = 'top5';
    const s1 = dogrula(ham, baglam); // başlık top10 diyor, model top5
    expect('hata' in s1 && s1.hata).toMatch(/type/);
    const ham2 = gecerliHam('top10', '2026-10-31');
    const s2 = tamam(dogrula(ham2, baglam));
    expect(s2.uyarilar.join(' ')).toMatch(/tarihi \(2026-10-31\)/);
  });

  it('zaman damgası: geçerliyse yazılır; geçersizse yazılmaz ve uyarı notu düşer', () => {
    const ham = gecerliHam('top10');
    ham.plays[3]!.timestamp = '1:75';
    ham.plays[4]!.timestamp = null;
    ham.plays[5]!.timestamp = '00:42';
    const s = tamam(dogrula(ham, baglam));
    const g = (sira: number) => s.gece.oyunlar.find((o) => o.sira === sira)!;
    expect(g(4).zaman).toBeUndefined();
    expect(g(5).zaman).toBeUndefined();
    expect(g(6).zaman).toBe('00:42');
    expect(s.oyunNotlari.find((n) => n.sira === 4)!.zamanUyari).toMatch(/geçersiz/);
    expect(s.oyunNotlari.find((n) => n.sira === 5)!.zamanUyari).toMatch(/yok/);
  });
});

describe('YAML (Document API): yorumlar ve yeniden okuma', () => {
  it('dosya başında tek satır üretim zamanı + model; her oyunun üstünde güven ve pay yorumu', () => {
    const s = tamam(dogrula(gecerliHam('top5'), { ...baglam, tur: 'top5' }));
    const satirlar = s.yaml.split('\n');
    expect(satirlar[0]).toBe('# Gemini ile üretildi: 2026-11-02T07:01:02.000Z, model gemini-3.6-flash');
    expect(satirlar.filter((l) => l.startsWith('# ') && l.includes('Gemini ile'))).toHaveLength(1);
    // 1. oyun: yüksek güven, paylı → pay gerekçesi
    const i1 = satirlar.findIndex((l) => l.includes('- sira: 1'));
    expect(satirlar.slice(i1 - 2, i1).join('\n')).toContain('# güven: yüksek');
    expect(satirlar.slice(i1 - 2, i1).join('\n')).toContain('# pay: The no-look pass was the more spectacular part');
    // 3. oyun: orta güven + gerekçe
    expect(s.yaml).toContain('# güven: orta (Jersey number partly hidden)');
    // paylı olmayan oyunda pay yorumu yok
    expect(s.yaml.match(/# pay:/g)).toHaveLength(1);
  });

  it('yazılan metin yeniden okunur ve şemadan geçer; zaman tırnaklı metin kalır, dosya katkılarda pay içerir', () => {
    const s = tamam(dogrula(gecerliHam('top10'), baglam));
    expect(s.yaml).toMatch(/zaman: "6:10"/);
    const geri = yamlDogrula(s.yaml);
    expect('hata' in geri).toBe(false);
    const okunan = top10Sema.parse(parse(s.yaml));
    expect(okunan.oyunlar).toHaveLength(10);
    expect(okunan.oyunlar[0]!.katkilar.map((k) => k.pay)).toEqual([70, 30]);
    expect(okunan.inceleme).toBe('bekliyor');
    expect(okunan.oyunlar[0]!.zaman).toBe('6:10');
    expect(s.yaml).not.toMatch(/confidence/); // modelin ham alan adı yazılmaz; güven yalnızca kontrol alanında ve ondan üretilen yorumda
  });

  it('yamlDogrula bozuk YAML ve şemaya uymayan veriyi reddeder', () => {
    expect('hata' in yamlDogrula('tarih: [')).toBe(true);
    expect('hata' in yamlDogrula('tarih: 2026-11-01\nvideo: https://x.example/a\noyunlar: []')).toBe(true);
  });

  it('özel karakterli adlar bozulmadan geri okunur', () => {
    const adlar = ["De'Aaron Fox", 'Nikola Jokić', 'Şengün A.', 'Foo: Bar', '#Hash Name'];
    const ham = gecerliHam('top5');
    adlar.forEach((ad, i) => (ham.plays[i]!.contributors = [{ player: ad, team: 'SAS', role: 'finisher', share: 100 }]));
    ham.plays[0]!.opponent = null;
    const s = tamam(dogrula(ham, { ...baglam, tur: 'top5' }));
    expect(top10Sema.parse(parse(s.yaml)).oyunlar.map((o) => o.katkilar[0]!.oyuncu)).toEqual(adlar);
  });
});

describe('ad benzerliği', () => {
  const mevcutGece = (oyuncu: string): Gece => ({ tarih: new Date('2026-10-30T00:00:00Z'), tur: 'top5', video: 'https://www.youtube.com/watch?v=x', kaynak: 'elle', oyunlar: [{ sira: 1, katkilar: [{ oyuncu, takim: 'BOS', rol: 'bitiren' }] }] });

  it('mevcut veriyle çok benzer ama farklı yazılan ad değiştirilmez; uyarı ve yorum ("mevcut yazım: X?")', () => {
    const ham = gecerliHam('top10');
    ham.plays[7]!.contributors[0]!.player = 'Amara Oseii';
    const s = tamam(dogrula(ham, baglam, [mevcutGece('Amara Osei')]));
    expect(s.gece.oyunlar[7]!.katkilar[0]!.oyuncu).toBe('Amara Oseii'); // ad değişmedi
    expect(s.mevcutBenzerler).toEqual([{ yeni: 'Amara Oseii', mevcut: 'Amara Osei', yeniKimlik: 'amara-oseii', mevcutKimlik: 'amara-osei' }]);
    expect(s.yaml).toContain('# ad uyarısı: "Amara Oseii", mevcut yazım: Amara Osei?');
    expect(s.oyunNotlari[7]!.adUyarilari).toHaveLength(1);
  });
  it('aynı ad (aksan/büyük harf farkı) benzer sayılmaz; mevcut veri yoksa uyarı yok', () => {
    const ham = gecerliHam('top10');
    ham.plays[7]!.contributors[0]!.player = 'AMARA OSEI';
    expect(tamam(dogrula(ham, baglam, [mevcutGece('Amara Osei')])).mevcutBenzerler).toEqual([]);
    expect(tamam(dogrula(gecerliHam('top10'), baglam)).mevcutBenzerler).toEqual([]);
  });
  it('rakip alanındaki ad da taranır; gece içi benzerler ayrıca raporlanır', () => {
    const ham = gecerliHam('top10');
    ham.plays[1]!.opponent = 'Tomas Veltry';
    const s = tamam(dogrula(ham, baglam, [mevcutGece('Tomas Veltri')]));
    expect(s.mevcutBenzerler.map((b) => b.yeni)).toContain('Tomas Veltry');
    expect(s.adUyarilari.join(' ')).toMatch(/Tomas Veltri.*Tomas Veltry|Tomas Veltry.*Tomas Veltri/);
  });
});
