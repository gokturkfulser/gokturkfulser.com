import { describe, expect, it } from 'vitest';
import { bugunIstanbul, EN_COK_KARAKTER, gunFarki, nbaDurumu, nbaYapistir } from './nba.ts';
import { CLUTCH_BASLIK, clutchMetni, clutchSatiri, DUNK_BASLIK, dunkMetni, dunkSatiri } from './test-yardim.ts';

describe('bugunIstanbul ve gunFarki', () => {
  it('İstanbul günü UTC+3: UTC 21:30 ertesi gün sayılır, 20:59 aynı gün', () => {
    expect(bugunIstanbul(Date.UTC(2026, 10, 12, 20, 59))).toBe('2026-11-12');
    expect(bugunIstanbul(Date.UTC(2026, 10, 12, 21, 0))).toBe('2026-11-13');
    expect(bugunIstanbul(Date.UTC(2026, 6, 1, 0, 0))).toBe('2026-07-01'); // yaz saati yok
  });

  it('gün farkı: ay ve yıl sınırı, aynı gün 0, gelecek damga 0 (negatif olmaz)', () => {
    expect(gunFarki('2026-11-12', '2026-11-12')).toBe(0);
    expect(gunFarki('2026-11-12', '2026-11-09')).toBe(3);
    expect(gunFarki('2027-01-02', '2026-12-30')).toBe(3);
    expect(gunFarki('2026-11-12', '2026-11-20')).toBe(0);
  });
});

describe('nbaDurumu', () => {
  const BUGUN = '2026-11-12';
  const satir = dunkSatiri('Ada Aksoy', '10/31/2026', '100.0');

  it('dosya boş ya da yok: dolu değil, güncelleme gerekir', () => {
    for (const m of [null, '', '  \n']) {
      const d = nbaDurumu('dunk-score', m, BUGUN);
      expect(d).toMatchObject({ dolu: false, satir: 0, eski: true });
      expect(d.mesaj).toContain('Dosya boş');
    }
  });

  it('okunabilir satır yok (yalnızca başlık): eski sayılır', () => {
    expect(nbaDurumu('dunk-score', dunkMetni(BUGUN), BUGUN)).toMatchObject({ dolu: false, eski: true });
  });

  it('damga yok: tarih bilinmiyor, eski sayılır; satırlar yine sayılır', () => {
    const d = nbaDurumu('dunk-score', dunkMetni(null, satir), BUGUN);
    expect(d).toMatchObject({ dolu: true, satir: 1, eski: true });
    expect(d.guncelleme).toBeUndefined();
    expect(d.mesaj).toContain('bilinmiyor');
  });

  it('dunk-score eşiği 3 gün: 3 gün hâlâ güncel, 4 gün eski', () => {
    expect(nbaDurumu('dunk-score', dunkMetni('2026-11-12', satir), BUGUN)).toMatchObject({ eski: false, yas: 0, mesaj: 'Bugün güncellendi.' });
    expect(nbaDurumu('dunk-score', dunkMetni('2026-11-09', satir), BUGUN)).toMatchObject({ eski: false, yas: 3, mesaj: '3 gün önce güncellendi.' });
    const eski = nbaDurumu('dunk-score', dunkMetni('2026-11-08', satir), BUGUN);
    expect(eski).toMatchObject({ eski: true, yas: 4 });
    expect(eski.mesaj).toBe('4 gündür güncellenmedi (en çok 3 gün olmalı).');
  });

  it('clutch eşiği 7 gün: 7 gün güncel, 8 gün eski', () => {
    const s = clutchSatiri('1', 'Tyrese Maxey', 'PHI');
    expect(nbaDurumu('clutch', clutchMetni('2026-11-05', s), BUGUN)).toMatchObject({ eski: false, yas: 7, esikGun: 7 });
    expect(nbaDurumu('clutch', clutchMetni('2026-11-04', s), BUGUN)).toMatchObject({ eski: true, yas: 8 });
  });

  it('bozuk satırlar durumda hata olarak görünür', () => {
    const d = nbaDurumu('dunk-score', dunkMetni(BUGUN, satir, dunkSatiri('Bora Berk', 'bozuk', '90.0')), BUGUN);
    expect(d.satir).toBe(1);
    expect(d.hatalar).toHaveLength(1);
  });
});

describe('nbaYapistir', () => {
  const BUGUN = '2026-11-12';
  const a = dunkSatiri('Ada Aksoy', '10/31/2026', '100.0');
  const b = dunkSatiri('Bora Berk', '11/1/2026', '90.0');
  const c = dunkSatiri('Cem Can', '11/2/2026', '80.0');
  const sayfa = (...satirlar: string[]) => ['Glossary', '300 Rows', ' • Page', '1', 'of 6', DUNK_BASLIK, ...satirlar].join('\r\n');

  it('değiştir: yapıştırılan metin damgalı dosya olur; "Glossary" gibi sekmesiz artıklar ve CRLF temizlenir', () => {
    const r = nbaYapistir('dunk-score', dunkMetni('2026-11-01', c), sayfa(a, b), 'degistir', BUGUN);
    expect(r).toMatchObject({ tamam: true, satir: 2 });
    if (!r.tamam) return;
    expect(r.metin).toBe(`# guncellendi: ${BUGUN}\n${DUNK_BASLIK}\n${a}\n${b}\n`);
    expect(r.metin).not.toContain('Glossary');
    expect(r.metin).not.toContain('\r');
    expect(r.metin).not.toContain('Cem Can'); // mevcut veri silindi
  });

  it('ekle: mevcut satırlar kalır, tekrarlanan başlık ve aynı satırlar bir kez; damga yenilenir', () => {
    const r = nbaYapistir('dunk-score', dunkMetni('2026-11-01', a, b), sayfa(b, c), 'ekle', BUGUN);
    expect(r).toMatchObject({ tamam: true, satir: 3 });
    if (!r.tamam) return;
    expect(r.metin).toBe(`# guncellendi: ${BUGUN}\n${DUNK_BASLIK}\n${a}\n${b}\n${c}\n`);
    expect(r.metin.match(/# guncellendi/g)).toHaveLength(1);
  });

  it('clutch: sayfa numarası ve başa gelen sıra sütunuyla birlikte kabul edilir', () => {
    const r = nbaYapistir('clutch', clutchMetni('2026-11-01'), ['Glossary', CLUTCH_BASLIK, clutchSatiri('1', 'Tyrese Maxey', 'PHI'), clutchSatiri('18', 'Trae Young', 'WAS')].join('\n'), 'degistir', BUGUN);
    expect(r).toMatchObject({ tamam: true, satir: 2 });
  });

  it('reddedilir: sekmeli satır yok, başlıksız/okunamayan, bozuk satır (hiçbir şey kaydedilmez), aşırı uzun', () => {
    const sonuc = (metin: string) => nbaYapistir('dunk-score', '', metin, 'degistir', BUGUN);
    const bos = sonuc('merhaba\ndünya');
    expect(bos.tamam).toBe(false);
    if (!bos.tamam) expect(bos.hatalar[0]).toContain('sekmeyle ayrılmış');

    const basliksiz = sonuc([a, b].join('\n'));
    expect(basliksiz.tamam).toBe(false);

    const bozuk = sonuc(sayfa(a, dunkSatiri('Bora Berk', 'bozuk', '90.0')));
    expect(bozuk.tamam).toBe(false);
    if (!bozuk.tamam) expect(bozuk.hatalar[0]).toContain('geçersiz tarih');

    const uzun = sonuc(`${DUNK_BASLIK}\n${'x\t'.repeat(EN_COK_KARAKTER)}`);
    expect(uzun.tamam).toBe(false);
  });

  it('çok sayıda hata: ilk 8 gösterilir, kalan sayısı bildirilir', () => {
    const cok = Array.from({ length: 12 }, (_, i) => dunkSatiri(`Oyuncu ${i}`, 'bozuk', '90.0'));
    const r = nbaYapistir('dunk-score', '', sayfa(a, ...cok), 'degistir', BUGUN);
    expect(r.tamam).toBe(false);
    if (!r.tamam) {
      expect(r.hatalar).toHaveLength(9);
      expect(r.hatalar.at(-1)).toBe('… ve 4 hata daha');
    }
  });
});
