// --onayla: yalnızca inceleme satırını değiştirir; ağ ve anahtar yok (ağ çağrısı olursa test başarısız olur).
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parse } from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { argumanlar, calistir, dispatchArgumanlari, type Bagimliliklar } from './calistir';
import { incelemeyiOnayla, onaylaTarihleri } from './onayla';

const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const gece = (tarih: string, kaynak: 'gemini' | 'elle', inceleme?: string) =>
  [
    '# Gemini ile üretildi: 2026-11-02T07:00:00.000Z, model gemini-3.8-flash',
    '',
    `tarih: ${tarih}`,
    'video: https://www.youtube.com/watch?v=abcdefghijk',
    'tur: top5',
    `kaynak: ${kaynak}`,
    ...(inceleme ? [`inceleme: ${inceleme}`] : []),
    'oyunlar:',
    ...[1, 2, 3, 4, 5].flatMap((n) => [
      '  # güven: orta (oy 2/3)',
      `  - sira: ${n}`,
      '    eylem: smac',
      '    zaman: "01:05"',
      '    katkilar:',
      `      - { oyuncu: Oyuncu Numara${'x'.repeat(n)}, takim: SAS, rol: bitiren, pay: 100 }`,
      '    kontrol:',
      '      guven: orta',
      '      oy: 2/3',
    ]),
  ].join(LF) + LF;

describe('onaylaTarihleri', () => {
  it('virgülle ayrılmış tarihler; boşluklar ve tekrarlar atılır, sıra korunur', () => {
    expect(onaylaTarihleri('2026-10-20, 2026-10-21 ,2026-10-20')).toEqual(['2026-10-20', '2026-10-21']);
    expect(onaylaTarihleri('2026-10-20')).toEqual(['2026-10-20']);
  });
  it('geçersiz biçim, gerçek olmayan gün ve boş liste hata', () => {
    for (const k of ['2026-1-20', '20-10-2026', 'dün', '2026-02-30', '2026-13-01', '2026-10-20; 2026-10-21', '', ' , ']) expect(() => onaylaTarihleri(k), k).toThrow();
  });
});

describe('incelemeyiOnayla', () => {
  it('yalnızca inceleme satırı değişir: tam olarak bir satır farklı, yorumlar ve kontrol alanı aynı', () => {
    const once = gece('2026-11-01', 'gemini', 'bekliyor');
    const s = incelemeyiOnayla(once);
    if (!('metin' in s)) throw new Error(JSON.stringify(s));
    const a = once.split(LF);
    const b = s.metin.split(LF);
    expect(b).toHaveLength(a.length);
    const farkli = a.map((satir, i) => [satir, b[i]!]).filter(([x, y]) => x !== y);
    expect(farkli).toEqual([['inceleme: bekliyor', 'inceleme: onaylandi']]);
    expect(isDeepStrictEqual({ ...(parse(once) as object), inceleme: 0 }, { ...(parse(s.metin) as object), inceleme: 0 })).toBe(true);
  });
  it('CRLF satır sonu ve satır sonu yorumu korunur', () => {
    const once = gece('2026-11-01', 'gemini', 'bekliyor').split(LF).join(CR + LF).replace('inceleme: bekliyor', 'inceleme: bekliyor # kontrol bekliyor');
    const s = incelemeyiOnayla(once);
    if (!('metin' in s)) throw new Error(JSON.stringify(s));
    expect(s.metin).toContain('inceleme: onaylandi # kontrol bekliyor' + CR + LF);
    expect(s.metin.split(CR + LF).join('').includes(LF)).toBe(false);
  });
  it('inceleme yazılmamış gemini dosyası (varsayılan: bekliyor): satır eklenir', () => {
    const s = incelemeyiOnayla(gece('2026-11-01', 'gemini'));
    if (!('metin' in s)) throw new Error(JSON.stringify(s));
    expect((parse(s.metin) as any).inceleme).toBe('onaylandi');
  });
  it('zaten onaylı, kaynak: elle ve bozuk dosya', () => {
    expect(incelemeyiOnayla(gece('2026-11-01', 'gemini', 'onaylandi'))).toEqual({ bilgi: 'zaten onaylı' });
    expect(incelemeyiOnayla(gece('2026-11-01', 'elle', 'bekliyor'))).toMatchObject({ bilgi: expect.stringContaining('kaynak: elle') });
    expect(incelemeyiOnayla(gece('2026-11-01', 'elle'))).toMatchObject({ bilgi: expect.stringContaining('kaynak: elle') });
    expect(incelemeyiOnayla('tarih: [')).toMatchObject({ hata: expect.any(String) });
    expect(incelemeyiOnayla('tarih: 2026-11-01')).toMatchObject({ hata: expect.stringContaining('şemaya uymuyor') });
  });
});

describe('--argümanlar ve dispatch', () => {
  it('argumanlar: --onayla tarihleri okur; --onayla=... biçimi de olur', () => {
    expect(argumanlar(['--onayla', '2026-10-20, 2026-10-21']).onayla).toEqual(['2026-10-20', '2026-10-21']);
    expect(argumanlar(['--onayla=2026-10-20']).onayla).toEqual(['2026-10-20']);
  });
  it('geçersiz tarih ve başka bayraklarla birlikte kullanım hatası (özellikle tarih/url/uzerine_yaz)', () => {
    expect(() => argumanlar(['--onayla', 'dün'])).toThrow(/YYYY-AA-GG/);
    expect(() => argumanlar(['--onayla', ''])).toThrow();
    for (const ek of [['--tarih', '2026-11-01'], ['--url', 'https://www.youtube.com/watch?v=abcdefghijk'], ['--uzerine-yaz'], ['--otomatik'], ['--kuru'], ['--zorla'], ['--dosya', 'x.txt']]) {
      expect(() => argumanlar(['--onayla', '2026-10-20', ...ek]), ek.join(' ')).toThrow(/yalnızca onaylama/);
    }
  });
  it('dispatchArgumanlari: GIRDI_ONAYLA → --onayla; çakışan girdiler bayraklara dökülür ve argumanlar reddeder; boşsa --otomatik', () => {
    expect(dispatchArgumanlari({ GIRDI_ONAYLA: '2026-10-20, 2026-10-21' })).toEqual(['--onayla', '2026-10-20, 2026-10-21']);
    expect(dispatchArgumanlari({ GIRDI_ONAYLA: '  ' })).toEqual(['--otomatik']);
    expect(dispatchArgumanlari({ GIRDI_ONAYLA: '2026-10-20', GIRDI_TARIH: '2026-11-01' })).toEqual(['--onayla', '2026-10-20', '--tarih', '2026-11-01']);
    expect(dispatchArgumanlari({ GIRDI_ONAYLA: '2026-10-20', GIRDI_URL: 'https://www.youtube.com/watch?v=abcdefghijk' })).toContain('--url');
    expect(dispatchArgumanlari({ GIRDI_ONAYLA: '2026-10-20', GIRDI_UZERINE_YAZ: 'true' })).toEqual(['--onayla', '2026-10-20', '--uzerine-yaz']);
    for (const env of [{ GIRDI_TARIH: '2026-11-01' }, { GIRDI_URL: 'https://www.youtube.com/watch?v=abcdefghijk' }, { GIRDI_UZERINE_YAZ: 'true' }]) {
      expect(() => argumanlar(dispatchArgumanlari({ GIRDI_ONAYLA: '2026-10-20', ...env }))).toThrow(/yalnızca onaylama/);
    }
  });
});

describe('calistir --onayla (uçtan uca, ağ yok)', () => {
  let klasor: string;
  let cikti: string[];
  let ozet: string;
  let fetchCagrisi: number;
  beforeEach(() => {
    klasor = mkdtempSync(join(tmpdir(), 'top10-onay-'));
    mkdirSync(join(klasor, 'icerik', '2026-27'), { recursive: true });
    cikti = [];
    ozet = join(klasor, 'ozet.md');
    fetchCagrisi = 0;
  });
  afterEach(() => rmSync(klasor, { recursive: true, force: true }));
  const dosya = (t: string) => join(klasor, 'icerik', '2026-27', `${t}.yaml`);
  const yaz = (t: string, kaynak: 'gemini' | 'elle', inceleme?: string) => writeFileSync(dosya(t), gece(t, kaynak, inceleme));
  // Anahtar YOK ve fetch çağrılırsa sayaç artar: onaylama modu hiçbirini istemez.
  const bag = (env: Record<string, string | undefined> = {}): Bagimliliklar => ({
    env,
    fetchFn: (async () => {
      fetchCagrisi++;
      throw new Error('ağ çağrısı yapılmamalı');
    }) as unknown as Bagimliliklar['fetchFn'],
    simdi: () => new Date('2026-11-02T07:00:00Z'),
    icerikKlasoru: join(klasor, 'icerik'),
    yaz: (s) => cikti.push(s),
    ozetDosyasi: ozet,
  });

  it('bekleyen geceler onaylanır, yalnızca inceleme satırı değişir; ağ/anahtar yok; çıkış 0', async () => {
    yaz('2026-10-20', 'gemini', 'bekliyor');
    yaz('2026-10-21', 'gemini', 'bekliyor');
    yaz('2026-10-22', 'gemini', 'bekliyor'); // listede yok: dokunulmaz
    const once = readFileSync(dosya('2026-10-22'), 'utf8');
    const o20 = readFileSync(dosya('2026-10-20'), 'utf8');
    const s = await calistir(['--onayla', '2026-10-20, 2026-10-21'], bag());
    expect(s.kod).toBe(0);
    expect(fetchCagrisi).toBe(0);
    expect((parse(readFileSync(dosya('2026-10-20'), 'utf8')) as any).inceleme).toBe('onaylandi');
    expect((parse(readFileSync(dosya('2026-10-21'), 'utf8')) as any).inceleme).toBe('onaylandi');
    expect(readFileSync(dosya('2026-10-20'), 'utf8').replace('onaylandi', 'bekliyor')).toBe(o20);
    expect(readFileSync(dosya('2026-10-22'), 'utf8')).toBe(once);
    expect(cikti.join(LF)).toContain('2026-10-20: onaylandı');
    expect(readFileSync(ozet, 'utf8')).toContain('## top10 onaylama');
    expect(readFileSync(ozet, 'utf8')).toContain('Onaylanan: 2');
  });

  it('dosyası olmayan, zaten onaylı ve elle yazılmış tarih: bilgi, dokunulmaz, çıkış 0 (kırmızı bitmez)', async () => {
    yaz('2026-10-21', 'gemini', 'onaylandi');
    yaz('2026-10-22', 'elle', 'onaylandi');
    yaz('2026-10-23', 'gemini', 'bekliyor');
    const a = readFileSync(dosya('2026-10-21'), 'utf8');
    const b = readFileSync(dosya('2026-10-22'), 'utf8');
    const s = await calistir(['--onayla', '2026-10-20,2026-10-21,2026-10-22,2026-10-23'], bag());
    expect(s.kod).toBe(0);
    expect(readFileSync(dosya('2026-10-21'), 'utf8')).toBe(a);
    expect(readFileSync(dosya('2026-10-22'), 'utf8')).toBe(b);
    expect((parse(readFileSync(dosya('2026-10-23'), 'utf8')) as any).inceleme).toBe('onaylandi');
    const log = cikti.join(LF);
    expect(log).toContain('2026-10-20: BİLGİ: gece dosyası yok');
    expect(log).toContain('2026-10-21: BİLGİ: zaten onaylı');
    expect(log).toContain('2026-10-22: BİLGİ: kaynak: elle');
    const md = readFileSync(ozet, 'utf8');
    expect(md).toContain('Onaylanan: 1; bilgi: 3; hata: 0');
  });

  it('elle yazılmış (bekliyor işaretli) dosyaya dokunulmaz', async () => {
    yaz('2026-10-20', 'elle', 'bekliyor');
    const once = readFileSync(dosya('2026-10-20'), 'utf8');
    const s = await calistir(['--onayla', '2026-10-20'], bag());
    expect(s.kod).toBe(0);
    expect(readFileSync(dosya('2026-10-20'), 'utf8')).toBe(once);
    expect(cikti.join(LF)).toContain('kaynak: elle');
  });

  it('bozuk dosya hata sayılır (çıkış 1) ama diğer geceler yine onaylanır', async () => {
    writeFileSync(dosya('2026-10-20'), 'tarih: [');
    yaz('2026-10-21', 'gemini', 'bekliyor');
    const s = await calistir(['--onayla', '2026-10-20, 2026-10-21'], bag());
    expect(s.kod).toBe(1);
    expect((parse(readFileSync(dosya('2026-10-21'), 'utf8')) as any).inceleme).toBe('onaylandi');
  });

  it('geçersiz tarih ve çakışan girdiler: kullanım hatası (çıkış 2), hiçbir dosyaya dokunulmaz, ağ yok', async () => {
    yaz('2026-10-20', 'gemini', 'bekliyor');
    const once = readFileSync(dosya('2026-10-20'), 'utf8');
    expect((await calistir(['--onayla', 'dün'], bag())).kod).toBe(2);
    expect((await calistir(['--onayla', '2026-10-20', '--tarih', '2026-10-20'], bag())).kod).toBe(2);
    expect((await calistir(['--ortamdan'], bag({ GIRDI_ONAYLA: '2026-10-20', GIRDI_URL: 'https://www.youtube.com/watch?v=abcdefghijk' }))).kod).toBe(2);
    expect((await calistir(['--ortamdan'], bag({ GIRDI_ONAYLA: '2026-10-20', GIRDI_UZERINE_YAZ: 'true' }))).kod).toBe(2);
    expect((await calistir(['--ortamdan'], bag({ GIRDI_ONAYLA: '2026-10-20', GIRDI_TARIH: '2026-10-20' }))).kod).toBe(2);
    expect(readFileSync(dosya('2026-10-20'), 'utf8')).toBe(once);
    expect(fetchCagrisi).toBe(0);
  });

  it('--ortamdan + GIRDI_ONAYLA: workflow yolu; YouTube/Gemini anahtarı olmadan çalışır', async () => {
    yaz('2026-10-20', 'gemini', 'bekliyor');
    const s = await calistir(['--ortamdan'], bag({ GIRDI_ONAYLA: '2026-10-20' }));
    expect(s.kod).toBe(0);
    expect((parse(readFileSync(dosya('2026-10-20'), 'utf8')) as any).inceleme).toBe('onaylandi');
    expect(fetchCagrisi).toBe(0);
  });
});
