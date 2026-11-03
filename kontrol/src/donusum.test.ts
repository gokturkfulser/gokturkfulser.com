// Form → gece nesnesi, doğrulama hataları, YAML yeniden yazımı (kontrol/zaman korunur, elle_duzenlendi, inceleme) ve ad sözlüğü.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { derinEsit } from './derin-esit.ts';
import { durumlariDogrula, formdanDurumlar, geceOku, oyundanDurum, type OyunDurumu } from './form.ts';
import { geceyiYenidenYaz } from './gece-yaml.ts';
import { sozlukHaritasiOlustur, sozlukOku, takmaAdEkle } from './sozluk.ts';
import { durumdanForm, geceMetni, SOZLUK_METNI } from './test-yardim.ts';

const oku = (m: string) => {
  const g = geceOku(m);
  if (!g.tamam) throw new Error(g.hata);
  return g;
};
const baslangic = () => {
  const g = oku(geceMetni());
  return { g, durumlar: g.gece.oyunlar.map((o) => oyundanDurum(o as never)) };
};
const harita = sozlukHaritasiOlustur(SOZLUK_METNI);
const dogru = (durumlar: OyunDurumu[], g = oku(geceMetni())) => {
  const s = durumlariDogrula(g.ham, durumlar, harita);
  if (!s.tamam) throw new Error(JSON.stringify(s));
  return s.oyunlar;
};
const hatali = (durumlar: OyunDurumu[]) => {
  const s = durumlariDogrula(oku(geceMetni()).ham, durumlar, harita);
  if (s.tamam) throw new Error('hata bekleniyordu');
  return s;
};
const degistir = (f: (d: OyunDurumu[]) => void) => {
  const { durumlar } = baslangic();
  f(durumlar);
  return durumlar;
};

describe('oyundanDurum ve formdanDurumlar (gidiş-dönüş)', () => {
  it('dosyadan form durumu: pay bölüşümü "70-30", pay yoksa "esit"', () => {
    const { durumlar } = baslangic();
    expect(durumlar[0]).toEqual({
      sira: 1, eylem: 'alley_oop', etiketler: ['poster'], rakip: 'Dario Fenn', aciklama: 'A lobs to B for the slam.', bolusum: '70-30',
      katkilar: [{ oyuncu: 'Mirko Daval', takim: 'SAS', rol: 'pasor' }, { oyuncu: 'Tomas Veltri', takim: 'SAS', rol: 'bitiren' }],
    });
    expect(durumlar[1]!.bolusum).toBe('100');
    expect(oyundanDurum({ sira: 1, katkilar: [{ oyuncu: 'A B', takim: 'SAS', rol: 'bitiren' }] } as never).bolusum).toBe('esit');
  });

  it('formdan okuma: boşluklar temizlenir, takım büyütülür, katkı sayısı sınırlanır; durum → form → durum aynıdır', () => {
    const { durumlar } = baslangic();
    expect(formdanDurumlar(durumdanForm(durumlar), durumlar.map((d) => d.sira))).toEqual(durumlar);
    const f = durumdanForm(durumlar);
    f.set('o1_k0_oyuncu', '  Mirko   Daval ');
    f.set('o1_k0_takim', ' sas ');
    f.set('o1_kn', '99');
    const d = formdanDurumlar(f, [1])[0]!;
    expect(d.katkilar[0]).toMatchObject({ oyuncu: 'Mirko Daval', takim: 'SAS' });
    expect(d.katkilar.length).toBe(4); // en çok 4 okunur ve "katkı sayısı 1–3" hatası verir
  });
});

describe('durumlariDogrula: form → gece nesnesi', () => {
  it('değişmemiş form geçerlidir ve aynı oyunları verir', () => {
    const { durumlar } = baslangic();
    const o = dogru(durumlar);
    expect(o[0]).toEqual({
      sira: 1, eylem: 'alley_oop', etiketler: ['poster'], aciklama: 'A lobs to B for the slam.', rakip: 'Dario Fenn',
      katkilar: [{ oyuncu: 'Mirko Daval', takim: 'SAS', rol: 'pasor', pay: 70 }, { oyuncu: 'Tomas Veltri', takim: 'SAS', rol: 'bitiren', pay: 30 }],
    });
    expect(o[1]).toEqual({ sira: 2, eylem: 'smac', katkilar: [{ oyuncu: 'Oyuncu Numaraxx', takim: 'NYK', rol: 'bitiren', pay: 100 }] });
  });

  it('düzenlemeler: oyuncu, takım, eylem, rol, pay, etiket, rakip, açıklama', () => {
    const d = degistir((d) => {
      d[0]!.katkilar[0] = { oyuncu: 'Yeni Oyuncu', takim: 'GSW', rol: 'bloklayan' };
      d[0]!.bolusum = '30-70';
      d[0]!.eylem = 'blok';
      d[0]!.etiketler = ['clutch', 'mac_kazandiran'];
      d[0]!.rakip = '';
      d[0]!.aciklama = 'Yeni açıklama';
    });
    expect(dogru(d)[0]).toEqual({
      sira: 1, eylem: 'blok', etiketler: ['clutch', 'mac_kazandiran'], aciklama: 'Yeni açıklama',
      katkilar: [{ oyuncu: 'Yeni Oyuncu', takim: 'GSW', rol: 'bloklayan', pay: 30 }, { oyuncu: 'Tomas Veltri', takim: 'SAS', rol: 'bitiren', pay: 70 }],
    });
  });

  it('etiket sırası: dosyadaki sıra korunur, yeni etiketler sona eklenir', () => {
    const ham = geceMetni().replace('etiketler: [ poster ]', 'etiketler: [ windmill, poster ]');
    const g = oku(ham);
    const d = g.gece.oyunlar.map((o) => oyundanDurum(o as never));
    d[0]!.etiketler = ['poster', 'clutch', 'windmill']; // form sırası farklı
    const s = durumlariDogrula(g.ham, d, harita);
    if (!s.tamam) throw new Error(JSON.stringify(s));
    expect(s.oyunlar[0]!.etiketler).toEqual(['windmill', 'poster', 'clutch']);
  });

  it('katkı ekle/çıkar: 3 katkı için 34-33-33 / 50-25-25 bölüşümleri, "esit" ise pay yazılmaz', () => {
    const d = degistir((d) => {
      d[0]!.katkilar.push({ oyuncu: 'Ucuncu Kisi', takim: 'SAS', rol: 'diger' });
      d[0]!.bolusum = '50-25-25';
    });
    expect(dogru(d)[0]!.katkilar.map((k) => k.pay)).toEqual([50, 25, 25]);
    const e = degistir((d) => {
      d[0]!.katkilar.push({ oyuncu: 'Ucuncu Kisi', takim: 'SAS', rol: 'diger' });
      d[0]!.bolusum = 'esit';
    });
    expect(dogru(e)[0]!.katkilar.every((k) => k.pay === undefined)).toBe(true);
    const tek = degistir((d) => {
      d[0]!.katkilar.pop();
      d[0]!.bolusum = '100';
    });
    expect(dogru(tek)[0]!.katkilar).toEqual([{ oyuncu: 'Mirko Daval', takim: 'SAS', rol: 'pasor', pay: 100 }]);
  });

  it('takma adlar sözlükle kanonik ada çevrilir (katkı ve rakip)', () => {
    const d = degistir((d) => {
      d[0]!.katkilar[0]!.oyuncu = 'Sviatoslav Mykhailiuk';
      d[0]!.rakip = 'braden burries';
    });
    const o = dogru(d)[0]!;
    expect(o.katkilar[0]!.oyuncu).toBe('Svi Mykhailiuk');
    expect(o.rakip).toBe('Brayden Burries');
  });
});

describe('durumlariDogrula: hatalar satır satır, form değerleri korunur', () => {
  it('geçersiz takım, rol, eylem, etiket', () => {
    const s = hatali(degistir((d) => {
      d[0]!.katkilar[0]!.takim = 'XYZ';
      d[0]!.katkilar[1]!.rol = 'kaptan';
      d[1]!.eylem = 'dunkk';
      d[1]!.etiketler = ['uydurma'];
    }));
    expect(s.oyun[1]!.join(' ')).toMatch(/takım NBA'in 30 kısaltmasından biri olmalı.*"XYZ"/);
    expect(s.oyun[1]!.join(' ')).toMatch(/rol geçersiz: "kaptan"/);
    expect(s.oyun[2]!.join(' ')).toMatch(/eylem geçersiz: "dunkk"/);
    expect(s.oyun[2]!.join(' ')).toMatch(/etiket geçersiz: "uydurma"/);
    expect(s.oyun[3]).toBeUndefined(); // hatasız satır işaretlenmez
  });

  it('pay kuralları: katkı sayısına uymayan bölüşüm, çift oyuncu, boş ad, katkı sayısı sınırı', () => {
    expect(hatali(degistir((d) => (d[0]!.bolusum = '50-25-25'))).oyun[1]!.join(' ')).toMatch(/katkı sayısına \(2\) uygun değil/);
    expect(hatali(degistir((d) => (d[0]!.bolusum = '60-40'))).oyun[1]!.join(' ')).toMatch(/uygun değil/);
    expect(hatali(degistir((d) => (d[0]!.katkilar[1]!.oyuncu = 'Mirko Daval'))).oyun[1]!.join(' ')).toMatch(/iki kez katkı sahibi olamaz/);
    expect(hatali(degistir((d) => (d[0]!.katkilar[1]!.oyuncu = ''))).oyun[1]!.join(' ')).toMatch(/oyuncu adı boş/);
    expect(hatali(degistir((d) => (d[0]!.katkilar = []))).oyun[1]!.join(' ')).toMatch(/1–3/);
    expect(hatali(degistir((d) => d[0]!.katkilar.push(...Array.from({ length: 2 }, (_, i) => ({ oyuncu: `K${i} Kisi`, takim: 'SAS', rol: 'diger' }))))).oyun[1]!.join(' ')).toMatch(/uygun değil|1–3/);
  });

  it('birden çok satırdaki hatalar birlikte raporlanır; hata varken oyun listesi dönmez', () => {
    const s = hatali(degistir((d) => {
      d[0]!.katkilar[0]!.takim = 'XYZ';
      d[3]!.katkilar[0]!.takim = 'QQQ';
    }));
    expect(Object.keys(s.oyun).map(Number).sort()).toEqual([1, 4]);
  });
});

describe('geceyiYenidenYaz', () => {
  const yaz = (f: (d: OyunDurumu[]) => void, secenek = {}) => {
    const g = oku(geceMetni());
    return geceyiYenidenYaz(geceMetni(), dogru(degistir(f), g), secenek);
  };

  it('kontrol alanı, tırnaklı zaman, yorumlar ve alan sırası korunur; elle_duzenlendi: true, inceleme bekliyor kalır (Kaydet)', () => {
    const cikti = yaz((d) => (d[0]!.aciklama = 'Yeni açıklama'));
    const v = parse(cikti) as any;
    expect(v.elle_duzenlendi).toBe(true);
    expect(v.inceleme).toBe('bekliyor');
    expect(v.oyunlar[0].aciklama).toBe('Yeni açıklama');
    expect(v.oyunlar[0].zaman).toBe('02:05');
    expect(cikti).toContain('zaman: "02:05"');
    expect(v.oyunlar[0].kontrol).toEqual((parse(geceMetni()) as any).oyunlar[0].kontrol);
    expect(cikti).toContain('# güven: orta (oy 2/3)');
    expect(cikti).toContain('  - sira: 1');
    expect(cikti).toMatch(/inceleme: bekliyor\nelle_duzenlendi: true\noyunlar:/);
    expect(cikti).toContain('      - { oyuncu: Mirko Daval, takim: SAS, rol: pasor, pay: 70 }'); // katkılar akış biçiminde
    expect(cikti.startsWith('# Gemini ile üretildi')).toBe(true);
  });

  it('değişmeyen alanlar aynı kalır: yalnızca düzenlenen alan ve elle_duzenlendi farklıdır', () => {
    const once = parse(geceMetni()) as any;
    const sonra = parse(yaz((d) => (d[2]!.katkilar[0]!.oyuncu = 'Baska Oyuncu'))) as any;
    expect(derinEsit({ ...sonra, elle_duzenlendi: undefined, oyunlar: undefined }, { ...once, oyunlar: undefined })).toBe(true);
    expect(sonra.oyunlar[2].katkilar[0].oyuncu).toBe('Baska Oyuncu');
    for (const i of [0, 1, 3, 4]) expect(derinEsit(sonra.oyunlar[i], once.oyunlar[i])).toBe(true);
  });

  it('Kaydet ve onayla / Onayla: inceleme onaylandi; inceleme satırı yoksa eklenir; elle_duzenlendi zaten varsa tekrarlanmaz', () => {
    expect((parse(yaz(() => {}, { inceleme: 'onaylandi' })) as any).inceleme).toBe('onaylandi');
    const g = oku(geceMetni('2026-11-01', null));
    const c = geceyiYenidenYaz(geceMetni('2026-11-01', null), dogru(baslangic().durumlar, g), { inceleme: 'onaylandi' });
    expect(c).toMatch(/kaynak: gemini\ninceleme: onaylandi\nelle_duzenlendi: true/);
    const zaten = geceMetni('2026-11-01', 'bekliyor', ['elle_duzenlendi: true']);
    const c2 = geceyiYenidenYaz(zaten, dogru(baslangic().durumlar, oku(zaten)), {});
    expect(c2.match(/elle_duzenlendi/g)).toHaveLength(1);
  });

  it('eylem/etiket/rakip/açıklama temizlenince dosyadan kalkar; yeniden okununca site şemasından geçer', () => {
    const cikti = yaz((d) => {
      d[0]!.eylem = '';
      d[0]!.etiketler = [];
      d[0]!.rakip = '';
      d[0]!.aciklama = '';
    });
    const o = (parse(cikti) as any).oyunlar[0];
    expect(Object.keys(o)).toEqual(['sira', 'zaman', 'katkilar', 'kontrol']);
    expect(geceOku(cikti).tamam).toBe(true);
  });

  it('CRLF dosyada satır sonu korunur; aciklama özel karakterleri kaçırılır', () => {
    const crlf = geceMetni().split('\n').join('\r\n');
    const c = geceyiYenidenYaz(crlf, dogru(degistir((d) => (d[0]!.aciklama = 'A: "B" # C')), oku(crlf)), {});
    expect(c.includes('\r\n')).toBe(true);
    expect(c.split('\r\n').join('').includes('\n')).toBe(false);
    expect((parse(c) as any).oyunlar[0].aciklama).toBe('A: "B" # C');
  });

  it('eksik sıra ya da oyun sayısı uyuşmazsa hata (kaydedilmez)', () => {
    const g = oku(geceMetni());
    const o = dogru(baslangic().durumlar, g);
    expect(() => geceyiYenidenYaz(geceMetni(), o.slice(1), {})).toThrow(/uyuşmuyor/);
  });

  it('gerçek bir gece dosyası: değişiklik yapılmadan yeniden yazım yalnızca elle_duzenlendi ekler (kontrol, zaman, yorumlar korunur)', () => {
    let metin: string;
    try {
      metin = readFileSync(new URL('../../site/src/content/top10/2026-27/2026-10-21.yaml', import.meta.url), 'utf8');
    } catch {
      return; // örnek veri bu ortamda yoksa atla
    }
    const g = oku(metin);
    const cikti = geceyiYenidenYaz(metin, dogru(g.gece.oyunlar.map((o) => oyundanDurum(o as never)), g), {});
    const once = parse(metin) as any;
    const sonra = parse(cikti) as any;
    expect(derinEsit({ ...sonra, elle_duzenlendi: undefined }, once)).toBe(true);
    expect(sonra.elle_duzenlendi).toBe(true);
    expect(cikti.split('\n').filter((l) => l.trim().startsWith('#')).length).toBe(metin.split('\n').filter((l) => l.trim().startsWith('#')).length);
  });
});

describe('ad sözlüğü', () => {
  it('takma ad ekler: mevcut kanonik adın listesine; yorum ve biçim korunur', () => {
    const s = takmaAdEkle(SOZLUK_METNI, 'Svi Mykhailiuk', 'S. Mykhailiuk');
    if ('hata' in s) throw new Error(s.hata);
    expect(s.metin).toContain('Svi Mykhailiuk: [Sviatoslav Mykhailiuk, S. Mykhailiuk]');
    expect(s.metin).toContain('# Oyuncu adı sözlüğü');
    expect(sozlukOku(s.metin)['Svi Mykhailiuk']).toEqual(['Sviatoslav Mykhailiuk', 'S. Mykhailiuk']);
  });

  it('yeni kanonik ad açar; boş dosyada da çalışır', () => {
    const s = takmaAdEkle(SOZLUK_METNI, 'Mikel Brown Jr.', 'Michael Brown Jr.');
    if ('hata' in s) throw new Error(s.hata);
    expect(sozlukOku(s.metin)['Mikel Brown Jr.']).toEqual(['Michael Brown Jr.']);
    const bos = takmaAdEkle(null, 'Ada Bee', 'A. Bee');
    if ('hata' in bos) throw new Error(bos.hata);
    expect(sozlukOku(bos.metin)).toEqual({ 'Ada Bee': ['A. Bee'] });
  });

  it('sözlük kurallarını bozan ekleme reddedilir: takma ad iki kanonik ada, kanonik başka kaydın takma adı, aynı ad, aynı kimlik', () => {
    const hata = (k: string, t: string) => {
      const s = takmaAdEkle(SOZLUK_METNI, k, t);
      return 'hata' in s ? s.hata : null;
    };
    expect(hata('Baska Oyuncu', 'Sviatoslav Mykhailiuk')).toMatch(/iki kanonik ada/);
    expect(hata('Sviatoslav Mykhailiuk', 'Yeni Takma')).toMatch(/kanonik ad takma ad olamaz/);
    expect(hata('Ada Bee', 'Ada Bee')).toMatch(/kendi kanonik adı/);
    expect(hata('svi mykhailiuk', 'Baska')).toMatch(/aynı oyuncu kimliğine/);
    expect(hata('Ada Bee', 'Sviatoslav Mykhailiuk')).not.toBeNull();
  });

  it('boş, çok uzun, özel karakterli ve zaten kayıtlı ekleme reddedilir', () => {
    const hata = (k: string, t: string) => {
      const s = takmaAdEkle(SOZLUK_METNI, k, t);
      return 'hata' in s ? s.hata : null;
    };
    expect(hata('', 'x')).toMatch(/boş/);
    expect(hata('Ada Bee', '  ')).toMatch(/boş/);
    expect(hata('A'.repeat(81), 'B')).toMatch(/80/);
    expect(hata('Ada: Bee', 'B')).toMatch(/özel/);
    expect(hata('Ada [Bee]', 'B')).toMatch(/özel/);
    expect(hata('Svi Mykhailiuk', 'Sviatoslav Mykhailiuk')).toMatch(/zaten/);
  });
});
