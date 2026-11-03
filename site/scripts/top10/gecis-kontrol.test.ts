// Tek seferlik geçiş betiği (gecis-kontrol.ts): yorumlardan kontrol alanı, kontrol dışındaki içeriğin değişmediği kanıtı (ağ yok, geçici klasör).
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parse } from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { kontrolDisiMetin, kontrolEkle, klasoruDonustur } from './gecis-kontrol';
import { top10Sema } from '../../src/lib/top10-sema';

const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);

/** Gerçek dosyalardaki biçimde 5 oyunluk bir top5 gecesi (ilk oyunun yorumu, ayrıştırıcıda oyunlar listesine bağlanan türden). */
const ornek = (inceleme = 'bekliyor') =>
  [
    '# Gemini ile üretildi: 2026-11-02T22:13:46.680Z, model gemini-3.8-flash',
    '',
    'tarih: 2026-11-01',
    'video: https://www.youtube.com/watch?v=abcdefghijk',
    'tur: top5',
    'kaynak: gemini',
    `inceleme: ${inceleme}`,
    'oyunlar:',
    '  # güven: yüksek (oy 3/3; eylem 3/3; pay 3/3)',
    '  # model güveni: yüksek; yüksek; yüksek',
    '  - sira: 1',
    '    eylem: alley_oop',
    '    etiketler: [ poster ]',
    '    aciklama: A lobs, B finishes.',
    '    zaman: "02:05"',
    '    katkilar:',
    '      - { oyuncu: Ada Bee, takim: SAS, rol: pasor, pay: 70 }',
    '      - { oyuncu: Cem Dee, takim: SAS, rol: bitiren, pay: 30 }',
    '  # güven: düşük (oy 1/3, uzlaşma yok; eylem 2/3; pay 1/1)',
    '  # diğer: Eda Eff 1/3',
    '  # eylem diğer: Blok 1/3',
    '  # model güveni: yüksek (kısmen gizli; belirsiz); düşük; yüksek',
    '  # doğrulanmamış ad: Axl Rose (sözlükte ve mevcut veride yok, güven düşük)',
    '  - sira: 2',
    '    eylem: smac',
    '    zaman: "01:51"',
    '    katkilar:',
    '      - { oyuncu: Axl Rose, takim: GSW, rol: bitiren, pay: 100 }',
    ...[3, 4, 5].flatMap((n) => [
      '  # güven: yüksek (oy 2/2; eylem 2/2; pay 2/2)',
      '  # model güveni: yüksek; yüksek',
      `  - sira: ${n}`,
      '    eylem: smac',
      '    katkilar:',
      `      - { oyuncu: Oyuncu Numara${'x'.repeat(n)}, takim: NYK, rol: bitiren, pay: 100 }`,
    ]),
  ].join(LF) + LF;

const sonuc = (metin: string) => {
  const s = kontrolEkle(metin);
  if (s.durum !== 'degisti') throw new Error(JSON.stringify(s));
  return s;
};
/** kontrol alanları çıkarılmış nesne */
const kontrolsuz = (metin: string) => {
  const v: any = parse(metin);
  return { ...v, oyunlar: v.oyunlar.map(({ kontrol: _k, ...o }: any) => o) };
};

describe('kontrolEkle', () => {
  it('her oyuna kontrol alanı eklenir (ilk oyun dahil); yorumlar bu alandan yeniden üretilir', () => {
    const s = sonuc(ornek());
    expect(s.eklenen).toBe(5);
    const v: any = parse(s.metin);
    expect(v.oyunlar[0].kontrol).toEqual({ guven: 'yuksek', oy: '3/3', model_guveni: ['yüksek', 'yüksek', 'yüksek'] });
    expect(v.oyunlar[1].kontrol).toEqual({
      guven: 'dusuk',
      oy: '1/3',
      uyarilar: ['uzlaşma yok', 'eylem oyu 2/3', 'doğrulanmamış ad: Axl Rose (sözlükte ve mevcut veride yok, güven düşük)'],
      alternatifler: ['diğer: Eda Eff 1/3', 'eylem diğer: Blok 1/3'],
      model_guveni: ['yüksek (kısmen gizli; belirsiz)', 'düşük', 'yüksek'],
    });
    expect(s.metin).toContain('  # güven: düşük (oy 1/3)' + LF + '  # diğer: Eda Eff 1/3');
    expect(top10Sema.safeParse(v).success).toBe(true);
  });

  it('kontrol dışındaki içerik aynı: nesne eşitliği (inceleme dahil) ve metin eşitliği', () => {
    for (const inceleme of ['bekliyor', 'onaylandi']) {
      const once = ornek(inceleme);
      const s = sonuc(once);
      expect(isDeepStrictEqual(kontrolsuz(once), kontrolsuz(s.metin))).toBe(true);
      expect((parse(s.metin) as any).inceleme).toBe(inceleme);
      expect(kontrolDisiMetin(once)).toBe(kontrolDisiMetin(s.metin));
    }
  });

  it('idempotent: ikinci çalıştırma hiçbir şeyi değiştirmez; kısmen eklenmişlerde yalnızca eksikler tamamlanır', () => {
    const bir = sonuc(ornek());
    expect(kontrolEkle(bir.metin)).toEqual({ durum: 'degismedi', neden: 'tüm oyunlarda kontrol alanı zaten var' });
  });

  it('CRLF dosyada satır sonu korunur', () => {
    const crlf = ornek().split(LF).join(CR + LF);
    const s = sonuc(crlf);
    expect(s.metin.includes(CR + LF)).toBe(true);
    expect(s.metin.split(CR + LF).join('').includes(LF)).toBe(false);
    expect(isDeepStrictEqual(kontrolsuz(crlf.split(CR + LF).join(LF)), kontrolsuz(s.metin.split(CR + LF).join(LF)))).toBe(true);
  });

  it('yorumu olmayan ya da tanınmayan oyun: hata, dosya değişmez', () => {
    const yorumsuz = ornek().split(LF).filter((l) => !/^\s+# /.test(l)).join(LF);
    expect(kontrolEkle(yorumsuz)).toMatchObject({ durum: 'hata' });
    expect(kontrolEkle('tarih: [')).toMatchObject({ durum: 'hata' });
  });
});

describe('klasoruDonustur', () => {
  let klasor: string;
  beforeEach(() => {
    klasor = mkdtempSync(join(tmpdir(), 'top10-gecis-'));
    mkdirSync(join(klasor, '2026-27'));
    writeFileSync(join(klasor, '2026-27', '2026-11-01.yaml'), ornek());
    writeFileSync(join(klasor, 'oyuncu-adlari.yaml'), 'Ada Bee: [A. Bee]' + LF); // sözlüğe dokunulmaz
  });
  afterEach(() => rmSync(klasor, { recursive: true, force: true }));

  it('kuru modda yazmaz; normal modda yazar, sözlüğe ve diğer dosyalara dokunmaz, ikinci çalıştırma dokunmaz', () => {
    const yol = join(klasor, '2026-27', '2026-11-01.yaml');
    const once = readFileSync(yol, 'utf8');
    const kuru = klasoruDonustur(klasor, true, () => {});
    expect(kuru[0]!.sonuc.durum).toBe('degisti');
    expect(readFileSync(yol, 'utf8')).toBe(once);
    klasoruDonustur(klasor, false, () => {});
    const sonra = readFileSync(yol, 'utf8');
    expect(sonra).not.toBe(once);
    expect(isDeepStrictEqual(kontrolsuz(once), kontrolsuz(sonra))).toBe(true);
    expect(readFileSync(join(klasor, 'oyuncu-adlari.yaml'), 'utf8')).toBe('Ada Bee: [A. Bee]' + LF);
    expect(klasoruDonustur(klasor, false, () => {})[0]!.sonuc.durum).toBe('degismedi');
    expect(readFileSync(yol, 'utf8')).toBe(sonra);
  });
});
