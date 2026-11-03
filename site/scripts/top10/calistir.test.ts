// Uçtan uca (ağ yok): sahte YouTube + Gemini yanıtları, geçici klasör. Gerçek API'lere ve gerçek içerik klasörüne dokunmaz.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { argumanlar, calistir, dispatchArgumanlari, listeAyristir, mevcutOku, type Bagimliliklar } from './calistir';
import { ACIKLAMA_ORNEK, geminiYaniti, gecerliHam, GM_ANAHTAR, json, oge, YT_ANAHTAR } from './test-yardim';

// 2 Kasım 2026 07:00 UTC → ABD'de 2 Kasım 02:00: pencere 31 Ekim, 1 Kasım, 2 Kasım
const SIMDI = new Date('2026-11-02T07:00:00Z');
const T5 = "NBA's Top 5 Plays of the Night | November 1, 2026";
const T10 = "NBA's Top 10 Plays of the Night | October 31, 2026";
const V5 = 'vid5aaaaaaa'; // başlığı Top 5
const V10 = 'vid10bbbbbb'; // başlığı Top 10

let klasor: string;
let cikti: string[];
let geminiGovdeleri: { istem: string; uri: string; cozunurluk?: string }[];
/** Gerçek YouTube isteklerinin (yol + sayfa belirteci) kaydı. */
let youtubeIstekleri: string[];
beforeEach(() => {
  klasor = mkdtempSync(join(tmpdir(), 'top10-test-'));
  cikti = [];
  geminiGovdeleri = [];
  youtubeIstekleri = [];
});
afterEach(() => rmSync(klasor, { recursive: true, force: true }));

type Ayar = {
  videolar?: ReturnType<typeof oge>[];
  /** Gemini yanıtını değiştir: (ham, çağrı sırası, video türü). */
  gemini?: (tur: 'top10' | 'top5', n: number) => unknown;
  usage?: object | null;
  /** Yanıt gövdesine `model` alanı ekler (API'nin bildirdiği model sürümü). */
  modelSurumu?: string;
  /** Sayfalı oynatma listesi: her öğe bir sayfa (nextPageToken otomatik). `videolar` yerine kullanılır. */
  sayfalar?: ReturnType<typeof oge>[][];
  /** Gövdede video parçasında `resolution` varsa 400 döner (API alanı reddediyor). */
  cozunurlukReddet?: boolean;
  youtubeDurum?: number;
  /** videos.list yanıtını video kimliği başına değiştir; null = video bulunamadı (items'ta yok). */
  meta?: Record<string, { baslik?: string; aciklama?: string; sure?: string | null; gizlilik?: string } | null>;
};
const icerik = () => join(klasor, 'icerik');
const ciktiKlasoru = () => join(klasor, 'cikti');
const dosya = (t: string) => join(icerik(), '2026-27', `${t}.yaml`);

function bag(ayar: Ayar = {}, env: Record<string, string | undefined> = { YOUTUBE_API_KEY: YT_ANAHTAR, GEMINI_API_KEY: GM_ANAHTAR }): Bagimliliklar & { ozetDosyasi: string } {
  let geminiCagri = 0;
  const fetchFn = (async (girdi: URL | string, init?: RequestInit) => {
    const url = new URL(String(girdi));
    if (url.hostname === 'www.googleapis.com') {
      if (ayar.youtubeDurum) return json({ error: { message: 'x' } }, ayar.youtubeDurum);
      if (url.pathname.endsWith('/videos')) {
        const idler = (url.searchParams.get('id') ?? '').split(',');
        return json({
          items: idler
            .filter((id) => ayar.meta?.[id] !== null)
            .map((id) => {
              const m = ayar.meta?.[id] ?? {};
              return {
                id,
                snippet: { title: m.baslik ?? (id === V5 ? T5 : T10), description: m.aciklama ?? ACIKLAMA_ORNEK },
                contentDetails: m.sure === null ? {} : { duration: m.sure ?? (id === V5 ? 'PT10M30S' : 'PT12M5S') },
                status: { privacyStatus: m.gizlilik ?? 'public' },
              };
            }),
        });
      }
      if (ayar.sayfalar) {
        const no = Number(url.searchParams.get('pageToken')?.slice(1) ?? 0);
        youtubeIstekleri.push(`playlistItems:${no}`);
        return json({ items: ayar.sayfalar[no] ?? [], ...(no + 1 < ayar.sayfalar.length ? { nextPageToken: `P${no + 1}` } : {}) });
      }
      return json({ items: ayar.videolar ?? [] });
    }
    geminiCagri += 1;
    const govde = JSON.parse(String(init!.body));
    const videoParca = govde.input.find((p: { type: string }) => p.type === 'video') as { uri: string; resolution?: string };
    const uri = videoParca.uri;
    geminiGovdeleri.push({ istem: govde.input[0].text, uri, cozunurluk: videoParca.resolution });
    if (ayar.cozunurlukReddet && videoParca.resolution) return json({ error: { message: 'Unknown name resolution at input[1]: Cannot find field.' } }, 400);
    const tur = uri.includes(V5) ? 'top5' : 'top10';
    const ham = ayar.gemini ? ayar.gemini(tur, geminiCagri) : gecerliHam(tur, tur === 'top5' ? '2026-11-01' : '2026-10-31');
    return ham instanceof Response ? ham : json({ ...geminiYaniti(ham, ayar.usage === undefined ? undefined : ayar.usage), ...(ayar.modelSurumu ? { model: ayar.modelSurumu } : {}) });
  }) as unknown as typeof fetch;
  return { env, fetchFn, simdi: () => SIMDI, icerikKlasoru: icerik(), yaz: (s) => cikti.push(s), ozetDosyasi: join(klasor, 'ozet.md'), ciktiKlasoru: ciktiKlasoru() };
}
/** Eski (oylamasız) testler: tek çalıştırma. Oylama testleri doğrudan calistir() çağırır (varsayılan oylama 3). */
const tek = (argv: readonly string[], b: Bagimliliklar) => calistir([...argv, '--oylama', '1'], b);
const iki = [oge(V5, T5, '2026-11-02T05:26:50Z'), oge(V10, T10, '2026-11-01T05:00:00Z'), oge('digerccccc', "NBA's Nightly Recap | November 1, 2026", '2026-11-02T07:00:00Z')];

describe('--otomatik', () => {
  it('son 3 gecede videosu olan geceler için dosya üretir; videosu olmayan gece "henüz yok"tur (çıkış 0)', async () => {
    const s = await tek(['--otomatik'], bag({ videolar: iki }));
    expect(s.kod).toBe(0);
    expect(s.sonuclar.map((r) => [r.tarih, r.durum])).toEqual([['2026-10-31', 'uretildi'], ['2026-11-01', 'uretildi'], ['2026-11-02', 'video-yok']]);
    expect(readFileSync(dosya('2026-11-01'), 'utf8')).toContain('tur: top5');
    expect(geminiGovdeleri).toHaveLength(2);
    expect(mevcutOku(icerik(), '2026-11-01')).toEqual({ dosyaVar: true, kaynak: 'gemini', inceleme: 'bekliyor' });
  });

  it('hiç video yoksa çıkış 0, Gemini çağrılmaz', async () => {
    const s = await tek(['--otomatik'], bag({ videolar: [] }));
    expect(s.kod).toBe(0);
    expect(geminiGovdeleri).toHaveLength(0);
  });

  it('kilitler: bekleyen gemini dosyasına dokunulmaz; elle ve onaylı dosyaya asla', async () => {
    mkdirSync(join(icerik(), '2026-27'), { recursive: true });
    writeFileSync(dosya('2026-10-31'), 'tarih: 2026-10-31\nkaynak: elle\n# elle yazıldı\n');
    writeFileSync(dosya('2026-11-01'), 'tarih: 2026-11-01\nkaynak: gemini\ninceleme: bekliyor\n# bekliyor\n');
    const s = await tek(['--otomatik'], bag({ videolar: iki }));
    expect(s.kod).toBe(0);
    expect(s.sonuclar.map((r) => [r.tarih, r.durum])).toEqual([['2026-10-31', 'kilitli'], ['2026-11-01', 'bekliyor'], ['2026-11-02', 'video-yok']]);
    expect(geminiGovdeleri).toHaveLength(0);
    expect(readFileSync(dosya('2026-10-31'), 'utf8')).toContain('# elle yazıldı');
    expect(cikti.join('\n')).toContain('--uzerine-yaz'); // yeniden üretme ipucu
    writeFileSync(dosya('2026-11-01'), 'tarih: 2026-11-01\nkaynak: gemini\ninceleme: onaylandi\n# onaylı\n');
    await tek(['--otomatik'], bag({ videolar: iki }));
    expect(readFileSync(dosya('2026-11-01'), 'utf8')).toContain('# onaylı');
  });

  it('bulunan video işlenemezse çıkış ≠ 0 ve dosya yazılmaz; ikinci denemede önceki hata modele iletilir', async () => {
    const b = bag({ videolar: [oge(V5, T5, '2026-11-02T05:26:50Z')], gemini: (tur) => { const h = gecerliHam(tur); h.plays.pop(); return h; } });
    const s = await tek(['--otomatik'], b);
    expect(s.kod).toBe(1);
    expect(geminiGovdeleri).toHaveLength(2);
    expect(geminiGovdeleri[1]!.istem).toContain('Your previous answer was rejected by validation');
    expect(existsSync(dosya('2026-11-01'))).toBe(false);
    expect(cikti.join('\n')).toContain('::warning::');
  });

  it('bilinmeyen takım kodu mevcut yeniden deneme yolunu kullanır: ikinci denemede düzelirse dosya yazılır', async () => {
    const b = bag({
      videolar: [oge(V5, T5, '2026-11-02T05:26:50Z')],
      gemini: (tur, n) => {
        const h = gecerliHam(tur);
        if (n === 1) h.plays[1]!.contributors[0]!.team = 'NJ';
        return h;
      },
    });
    const s = await tek(['--otomatik'], b);
    expect(s.kod).toBe(0);
    expect(geminiGovdeleri).toHaveLength(2);
    expect(geminiGovdeleri[1]!.istem).toMatch(/takım NBA'in 30 kısaltmasından biri olmalı/);
    expect(existsSync(dosya('2026-11-01'))).toBe(true);
  });

  it('başarısız her deneme için neden (alan = değer, en çok 3 hata) terminale ve step summary\'ye yazılır (kuru olmayan modda da)', async () => {
    const b = bag({
      videolar: [oge(V5, T5, '2026-11-01T05:26:50Z'.replace('11-01', '11-02'))],
      gemini: (tur, n) => {
        const h = gecerliHam(tur);
        if (n === 1) for (const i of [0, 1, 2, 3]) h.plays[i]!.contributors[0]!.team = 'NJ';
        return h;
      },
    });
    const s = await tek(['--otomatik'], b);
    expect(s.kod).toBe(0);
    const log = cikti.join('\n');
    expect(log).toMatch(/UYARI: 2026-11-01 çalıştırma 1, deneme 1 başarısız: .*= "NJ"/);
    expect(log).toContain('(+1 hata daha)');
    const ozet = readFileSync(b.ozetDosyasi!, 'utf8');
    expect(ozet).toContain('Başarısız denemeler');
    expect(ozet).toMatch(/2026-11-01 çalıştırma 1, deneme 1 başarısız: .*= "NJ"/);
  });

  it('takım kodu varyantı (PHO) çevrilir; dosyada PHX yazar; bilgi satırı bir kez basılır ve yeniden deneme olmaz', async () => {
    const b = bag({
      videolar: [oge(V5, T5, '2026-11-02T05:26:50Z')],
      gemini: (tur) => {
        const h = gecerliHam(tur);
        h.plays[1]!.contributors[0]!.team = 'PHO';
        h.plays[2]!.contributors[0]!.team = 'PHO';
        return h;
      },
    });
    const s = await tek(['--otomatik'], b);
    expect(s.kod).toBe(0);
    expect(geminiGovdeleri).toHaveLength(1);
    expect(cikti.filter((l) => l.includes('BİLGİ: takım kodu çevrildi: PHO → PHX'))).toHaveLength(1);
    const y = readFileSync(dosya('2026-11-01'), 'utf8');
    expect(y).toContain('takim: PHX');
    expect(y).not.toContain('PHO');
    expect(readFileSync(b.ozetDosyasi!, 'utf8')).toContain('bilgi: takım kodu çevrildi: PHO → PHX');
  });

  it('bir gece başarısız, biri başarılıysa çıkış 0', async () => {
    const b = bag({ videolar: iki, gemini: (tur) => { const h = gecerliHam(tur, tur === 'top5' ? '2026-11-01' : '2026-10-31'); if (tur === 'top5') h.plays.pop(); return h; } });
    const s = await tek(['--otomatik'], b);
    expect(s.kod).toBe(0);
    expect(s.sonuclar.map((r) => r.durum)).toEqual(['uretildi', 'basarisiz', 'video-yok']);
  });

  it('API hatası → çıkış 1; anahtarlar yoksa → 2 (Gemini anahtarı yalnızca üretim gerektiğinde istenir)', async () => {
    expect((await tek(['--otomatik'], bag({ youtubeDurum: 403 }))).kod).toBe(1);
    expect((await tek(['--otomatik'], bag({}, { GEMINI_API_KEY: GM_ANAHTAR }))).kod).toBe(2);
    expect((await tek(['--otomatik'], bag({ videolar: [] }, { YOUTUBE_API_KEY: YT_ANAHTAR }))).kod).toBe(0);
    expect((await tek(['--otomatik'], bag({ videolar: iki }, { YOUTUBE_API_KEY: YT_ANAHTAR }))).kod).toBe(2);
  });

  it('anahtarlar ne log çıktısına ne özet dosyasına ne üretilen dosyaya girer', async () => {
    const b = bag({ videolar: [oge(V5, T5, '2026-11-02T05:26:50Z')] });
    await tek(['--otomatik'], b);
    await tek(['--otomatik'], bag({ youtubeDurum: 403 }));
    const hepsi = [cikti.join('\n'), readFileSync(b.ozetDosyasi, 'utf8'), readFileSync(dosya('2026-11-01'), 'utf8')].join('\n');
    expect(hepsi).not.toContain(YT_ANAHTAR);
    expect(hepsi).not.toContain(GM_ANAHTAR);
  });
});

describe('istem.md', () => {
  it('betik her çalıştırmada istem dosyasını okur: düzenleme bir sonraki çalıştırmada modele gider', async () => {
    const istem = join(klasor, 'istem.md');
    writeFileSync(istem, 'BIRINCI ISTEM');
    const b = { ...bag({ videolar: [oge(V5, T5, '2026-11-02T05:26:50Z')] }), istemDosyasi: istem };
    await tek(['--tarih', '2026-11-01', '--kuru'], b);
    writeFileSync(istem, 'IKINCI ISTEM (duzenlendi)');
    await tek(['--tarih', '2026-11-01', '--kuru'], b);
    expect(geminiGovdeleri.map((g) => g.istem)).toEqual(['BIRINCI ISTEM', 'IKINCI ISTEM (duzenlendi)']);
  });
  it('istem dosyası yoksa açık hata, çıkış 2, Gemini çağrılmaz', async () => {
    const b = { ...bag({ videolar: [oge(V5, T5, '2026-11-02T05:26:50Z')] }), istemDosyasi: join(klasor, 'yok.md') };
    const s = await tek(['--tarih', '2026-11-01'], b);
    expect(s.kod).toBe(2);
    expect(cikti.join('\n')).toMatch(/İstem dosyası okunamadı/);
    expect(geminiGovdeleri).toHaveLength(0);
  });
});

describe('step summary ve toplamlar', () => {
  it('her oyunda katkı payları, kişi başı puan ve zaman damgası (videoya o saniyeden bağlantı); kontrol listesinde pay gerekçesi', async () => {
    const b = bag({ videolar: [oge(V5, T5, '2026-11-02T05:26:50Z')] });
    await tek(['--otomatik'], b);
    const ozet = readFileSync(b.ozetDosyasi, 'utf8');
    expect(ozet).toContain('## top10: otomatik gece üretimi');
    expect(ozet).toContain('[NBA\'s Top 5 Plays of the Night \\| November 1, 2026](https://www.youtube.com/watch?v=vid5aaaaaaa)');
    // 1. sıra: Top 5 gecesi, zaman 2:50 (170 sn), 70/30 → 7 ve 3 puan
    expect(ozet).toContain('1. [2:50](https://www.youtube.com/watch?v=vid5aaaaaaa&t=170) Alley-oop: Mirko Daval (SAS, Pasör, %70, 7 puan), Tomas Veltri (SAS, Bitiren, %30, 3 puan); rakip: Dario Fenn');
    expect(ozet).toContain('**Kontrol edilecek satırlar**');
    expect(ozet).toContain('sıra 1: pay gerekçesi: The no-look pass was the more spectacular part');
    expect(ozet).toContain('sıra 3: güven orta; Jersey number partly hidden');
  });

  it('toplam video süresi ve token kullanımı terminale ve özete yazılır', async () => {
    const b = bag({ videolar: iki });
    await tek(['--otomatik'], b);
    // 12:05 (Top 10) + 10:30 (Top 5) = 22:35 = 1355 sn; her gece için 2000/500/100/2600 token
    const satir = "Toplam video süresi: 22:35; Gemini'de işlenen toplam süre: 22:35 (2 çağrı); token: girdi 4.000, çıktı 1.000, düşünme 200, toplam 5.200";
    expect(cikti).toContain(satir);
    expect(readFileSync(b.ozetDosyasi, 'utf8')).toContain(satir);
  });
  it('yanıtta usage yoksa token bilgisi yok denir', async () => {
    const b = bag({ videolar: [oge(V5, T5, '2026-11-02T05:26:50Z')], usage: null });
    await tek(['--otomatik'], b);
    expect(cikti.join('\n')).toContain("Toplam video süresi: 10:30; Gemini'de işlenen toplam süre: 10:30 (1 çağrı); token: yanıtta token bilgisi yok");
  });
  it('mevcut veriyle benzer ad: ad değişmez, uyarı özette ve yorumda', async () => {
    mkdirSync(join(icerik(), '2026-27'), { recursive: true });
    writeFileSync(dosya('2026-10-30'), ['tarih: 2026-10-30', 'video: https://www.youtube.com/watch?v=x', 'tur: top5', 'kaynak: elle', 'oyunlar:', ...[1, 2, 3, 4, 5].map((n) => `  - { sira: ${n}, katkilar: [{ oyuncu: ${n === 1 ? 'Tomas Veltry' : `Baska Oyuncu${'x'.repeat(n)}`}, takim: SAS, rol: bitiren }] }`)].join('\n'));
    const b = bag({ videolar: [oge(V5, T5, '2026-11-02T05:26:50Z')] });
    await tek(['--otomatik'], b);
    expect(readFileSync(dosya('2026-11-01'), 'utf8')).toContain('Tomas Veltri'); // değiştirilmedi
    expect(readFileSync(dosya('2026-11-01'), 'utf8')).toContain('# ad uyarısı: "Tomas Veltri", mevcut yazım: Tomas Veltry?');
    expect(readFileSync(b.ozetDosyasi, 'utf8')).toContain('ad uyarısı: "Tomas Veltri", mevcut yazım: Tomas Veltry?');
  });
});

describe('--kuru', () => {
  it('--kuru içerik klasörüne hiçbir şey yazmaz; JSON cikti klasörüne gider', async () => {
    const s = await tek(['--tarih', '2026-11-01', '--kuru'], bag({ videolar: [oge(V5, T5, '2026-11-02T05:26:50Z')] }));
    expect(s.kod).toBe(0);
    expect(existsSync(icerik())).toBe(false);
    const json = JSON.parse(readFileSync(join(ciktiKlasoru(), '2026-11-01.json'), 'utf8'));
    expect(json.tarih).toBe('2026-11-01');
    expect(json.yaml).toContain('kaynak: gemini');
    expect(json.gece.oyunlar).toHaveLength(5);
    expect(json.oylama).toMatchObject({ istenen: 1, gecerli: 1 });
  });
  it('--tekrar kaldırıldı: kullanım hatası (çıkış 2) ve --oylama yönlendirmesi', async () => {
    const s = await calistir(['--tarih', '2026-11-01', '--kuru', '--tekrar', '2'], bag());
    expect(s.kod).toBe(2);
    expect(cikti.join(String.fromCharCode(10))).toContain('--tekrar kaldırıldı');
    expect(() => argumanlar(['--tarih', '2026-11-01', '--tekrar', '2'])).toThrow(/--oylama/);
  });
});

describe('tek gece ve liste modu', () => {
  it('konumsal argümanlar: <YYYY-AA-GG> <url> (pnpm site:top10 biçimi)', async () => {
    expect(argumanlar(['2026-11-01', 'https://www.youtube.com/watch?v=vid5aaaaaaa'])).toMatchObject({ tarih: '2026-11-01', url: 'https://www.youtube.com/watch?v=vid5aaaaaaa', otomatik: false });
    const s = await tek(['2026-11-01', 'https://www.youtube.com/watch?v=vid5aaaaaaa'], bag());
    expect(s.kod).toBe(0);
    expect(existsSync(dosya('2026-11-01'))).toBe(true);
    expect(readFileSync(dosya('2026-11-01'), 'utf8')).toContain('tur: top5'); // tür başlıktan
  });
  it('--tarih ile playlist\'ten videoyu bulur ve üretir', async () => {
    expect((await tek(['--tarih', '2026-11-01'], bag({ videolar: [oge(V5, T5, '2026-11-02T05:26:50Z')] }))).kod).toBe(0);
    expect(existsSync(dosya('2026-11-01'))).toBe(true);
  });
  it('--uzerine-yaz bekleyen gemini dosyasını yeniden üretir; elle/onaylı dosyaya yine dokunmaz', async () => {
    mkdirSync(join(icerik(), '2026-27'), { recursive: true });
    writeFileSync(dosya('2026-11-01'), 'tarih: 2026-11-01\nkaynak: gemini\ninceleme: bekliyor\n# eski\n');
    const videolar = [oge(V5, T5, '2026-11-02T05:26:50Z')];
    const s = await tek(['--tarih=2026-11-01', '--uzerine-yaz'], bag({ videolar }));
    expect(s.sonuclar[0]!.karar).toBe('uzerine-yaz');
    expect(readFileSync(dosya('2026-11-01'), 'utf8')).not.toContain('# eski');
    writeFileSync(dosya('2026-11-01'), 'tarih: 2026-11-01\nkaynak: gemini\ninceleme: onaylandi\n# onayli\n');
    const s2 = await tek(['--tarih=2026-11-01', '--uzerine-yaz'], bag({ videolar }));
    expect(s2.sonuclar[0]!.durum).toBe('kilitli');
    expect(readFileSync(dosya('2026-11-01'), 'utf8')).toContain('# onayli');
  });
  it('elle_duzenlendi: true dosyaya --uzerine-yaz dahil hiçbir koşulda dokunulmaz (inceleme bekliyor olsa bile); false/yok olan bekleyen dosya yeniden üretilir', async () => {
    mkdirSync(join(icerik(), '2026-27'), { recursive: true });
    const videolar = [oge(V5, T5, '2026-11-01T05:26:50Z'.replace('11-01', '11-02'))];
    for (const bayrak of [['--tarih=2026-11-01', '--uzerine-yaz'], ['--tarih=2026-11-01'], ['--otomatik']]) {
      writeFileSync(dosya('2026-11-01'), 'tarih: 2026-11-01\nkaynak: gemini\ninceleme: bekliyor\nelle_duzenlendi: true\n# elle\n');
      const s = await tek(bayrak, bag({ videolar }));
      const durum = s.sonuclar.find((r) => r.tarih === '2026-11-01')!.durum;
      expect(durum, bayrak.join(' ')).toBe('kilitli');
      expect(readFileSync(dosya('2026-11-01'), 'utf8')).toContain('# elle');
    }
    writeFileSync(dosya('2026-11-01'), 'tarih: 2026-11-01\nkaynak: gemini\ninceleme: bekliyor\nelle_duzenlendi: false\n# eski\n');
    const s = await tek(['--tarih=2026-11-01', '--uzerine-yaz'], bag({ videolar }));
    expect(s.sonuclar[0]!.karar).toBe('uzerine-yaz');
    expect(readFileSync(dosya('2026-11-01'), 'utf8')).not.toContain('# eski');
  });
  it('liste dosyası ayrıştırma: boş satır, # yorumu ve satır sonu yorumu', () => {
    const l = listeAyristir(['# başlık', '', '2026-11-01 https://www.youtube.com/watch?v=vid5aaaaaaa', '2026-10-31   https://youtu.be/vid10bbbbbb  # elle seçildi', '   # son'].join('\n'));
    expect(l).toEqual([{ tarih: '2026-11-01', url: 'https://www.youtube.com/watch?v=vid5aaaaaaa' }, { tarih: '2026-10-31', url: 'https://youtu.be/vid10bbbbbb' }]);
  });
  it('liste dosyası geçersiz satırda satır numarasıyla hata verir', () => {
    expect(() => listeAyristir('2026-11-01\n')).toThrow(/1\. satır geçersiz/);
    expect(() => listeAyristir('# yalnız yorum\n')).toThrow(/hiç gece yok/);
    expect(() => listeAyristir('2026-11-01 https://vimeo.com/1\n')).toThrow(/geçersiz/);
    expect(() => listeAyristir('2026-11-01 https://www.youtube.com/watch?v=abcdefghijk fazla\n')).toThrow(/geçersiz/);
  });
  it('--dosya: listedeki her gece sırayla işlenir', async () => {
    const b = { ...bag(), dosyaOku: () => '# liste\n2026-11-01 https://www.youtube.com/watch?v=vid5aaaaaaa\n2026-10-31 https://www.youtube.com/watch?v=vid10bbbbbb\n' };
    const s = await tek(['--dosya', 'liste.txt'], b);
    expect(s.kod).toBe(0);
    expect(s.sonuclar.map((r) => [r.tarih, r.durum])).toEqual([['2026-11-01', 'uretildi'], ['2026-10-31', 'uretildi']]);
    expect(readdirSync(join(icerik(), '2026-27')).sort()).toEqual(['2026-10-31.yaml', '2026-11-01.yaml']);
  });
  it('--dosya ile --tarih/--url ya da --otomatik birlikte kullanılmaz', () => {
    expect(() => argumanlar(['--dosya', 'x.txt', '--tarih', '2026-11-01'])).toThrow(/birlikte/);
    expect(() => argumanlar(['--otomatik', '--dosya', 'x.txt'])).toThrow(/birlikte/);
  });
  it('kullanım hataları çıkış 2: argümansız, --otomatik + --uzerine-yaz, bilinmeyen argüman, kötü tarih', async () => {
    for (const a of [[], ['--otomatik', '--uzerine-yaz'], ['--otomatik', '--tarih', '2026-11-01'], ['--yok'], ['--tarih', '1 Kasim']]) {
      expect((await tek(a, bag())).kod, a.join(' ')).toBe(2);
    }
  });
});

describe('workflow_dispatch girdileri → bayraklar', () => {
  it('girdi yoksa --otomatik (zamanlanmış çalıştırma da böyle)', () => {
    expect(dispatchArgumanlari({})).toEqual(['--otomatik']);
    expect(dispatchArgumanlari({ GIRDI_TARIH: '', GIRDI_URL: '  ', GIRDI_UZERINE_YAZ: 'false' })).toEqual(['--otomatik']);
  });
  it('tarih + url → tek gece; uzerine_yaz işaretliyse --uzerine-yaz', () => {
    expect(dispatchArgumanlari({ GIRDI_TARIH: '2026-11-01', GIRDI_URL: 'https://www.youtube.com/watch?v=abcdefghijk', GIRDI_UZERINE_YAZ: 'false' })).toEqual(['--tarih', '2026-11-01', '--url', 'https://www.youtube.com/watch?v=abcdefghijk']);
    expect(dispatchArgumanlari({ GIRDI_TARIH: '2026-11-01', GIRDI_URL: 'https://www.youtube.com/watch?v=abcdefghijk', GIRDI_UZERINE_YAZ: 'true' })).toEqual(['--tarih', '2026-11-01', '--url', 'https://www.youtube.com/watch?v=abcdefghijk', '--uzerine-yaz']);
    expect(dispatchArgumanlari({ GIRDI_TARIH: '2026-11-01' })).toEqual(['--tarih', '2026-11-01']);
  });
  it('--ortamdan: tarih + url + uzerine_yaz ile bekleyen geceyi yeniden üretir; onaylı geceye dokunmaz', async () => {
    mkdirSync(join(icerik(), '2026-27'), { recursive: true });
    writeFileSync(dosya('2026-11-01'), 'tarih: 2026-11-01\nkaynak: gemini\ninceleme: bekliyor\n# eski\n');
    const env = { YOUTUBE_API_KEY: YT_ANAHTAR, GEMINI_API_KEY: GM_ANAHTAR, GIRDI_TARIH: '2026-11-01', GIRDI_URL: `https://www.youtube.com/watch?v=${V5}`, GIRDI_UZERINE_YAZ: 'true' };
    const s = await tek(['--ortamdan'], bag({}, env));
    expect(s.sonuclar[0]!.karar).toBe('uzerine-yaz');
    expect(readFileSync(dosya('2026-11-01'), 'utf8')).not.toContain('# eski');
    // onaylandı: aynı girdilerle bile dokunulmaz
    writeFileSync(dosya('2026-11-01'), 'tarih: 2026-11-01\nkaynak: gemini\ninceleme: onaylandi\n# onayli\n');
    const s2 = await tek(['--ortamdan'], bag({}, env));
    expect(s2.sonuclar[0]!.durum).toBe('kilitli');
    expect(readFileSync(dosya('2026-11-01'), 'utf8')).toContain('# onayli');
    // uzerine_yaz işaretli değilse bekleyen dosya yeniden üretilmez
    writeFileSync(dosya('2026-11-01'), 'tarih: 2026-11-01\nkaynak: gemini\ninceleme: bekliyor\n# bekleyen\n');
    const s3 = await tek(['--ortamdan'], bag({}, { ...env, GIRDI_UZERINE_YAZ: 'false' }));
    expect(s3.sonuclar[0]!.durum).toBe('bekliyor');
    expect(readFileSync(dosya('2026-11-01'), 'utf8')).toContain('# bekleyen');
  });
});

describe('uydurma koruması: adres ve video meta verisi', () => {
  const PLACEHOLDER = 'https://www.youtube.com/watch?v=...';

  it('geçersiz adres (yer tutucu "...") hiçbir API çağrısı yapılmadan çıkış 2', async () => {
    let cagri = 0;
    const b = bag();
    const orijinal = b.fetchFn;
    b.fetchFn = (async (g: URL | string, i?: RequestInit) => {
      cagri += 1;
      return orijinal(g, i);
    }) as unknown as typeof fetch;
    for (const argv of [['2026-11-01', PLACEHOLDER], ['--tarih', '2026-11-01', '--url', PLACEHOLDER], ['--tarih', '2026-11-01', '--url', 'https://www.youtube.com/watch?v=kisa'], ['2026-11-01', 'https://vimeo.com/123456789']]) {
      const s = await tek(argv, b);
      expect(s.kod, argv.join(' ')).toBe(2);
    }
    expect(cikti.join('\n')).toContain('Geçersiz YouTube adresi');
    expect(cagri).toBe(0);
    expect(geminiGovdeleri).toHaveLength(0);
  });
  it('liste dosyasında geçersiz adres çıkış 2 (Gemini çağrılmaz)', async () => {
    const b = { ...bag(), dosyaOku: () => `2026-11-01 ${PLACEHOLDER}` };
    expect((await tek(['--dosya', 'x.txt'], b)).kod).toBe(2);
    expect(geminiGovdeleri).toHaveLength(0);
  });
  it('--ortamdan ile gelen geçersiz adres de çıkış 2', async () => {
    const env = { YOUTUBE_API_KEY: YT_ANAHTAR, GEMINI_API_KEY: GM_ANAHTAR, GIRDI_TARIH: '2026-11-01', GIRDI_URL: PLACEHOLDER };
    expect((await tek(['--ortamdan'], bag({}, env))).kod).toBe(2);
    expect(geminiGovdeleri).toHaveLength(0);
  });

  it('video bulunamadı: Gemini çağrılmaz, gece başarısız (çıkış 1), dosya yok', async () => {
    const b = bag({ meta: { [V5]: null } });
    const s = await tek(['2026-11-01', `https://www.youtube.com/watch?v=${V5}`], b);
    expect(s.kod).toBe(1);
    expect(s.sonuclar[0]).toMatchObject({ tarih: '2026-11-01', durum: 'basarisiz' });
    expect(s.sonuclar[0]!.hata).toMatch(/video bulunamadı/);
    expect(geminiGovdeleri).toHaveLength(0);
    expect(existsSync(dosya('2026-11-01'))).toBe(false);
  });
  it('--tarih ile playlistte bulunan ama videos.list döndürmeyen video de başarısızdır', async () => {
    const s = await tek(['--tarih', '2026-11-01'], bag({ videolar: [oge(V5, T5, '2026-11-02T05:26:50Z')], meta: { [V5]: null } }));
    expect(s.kod).toBe(1);
    expect(geminiGovdeleri).toHaveLength(0);
  });
  it('herkese açık olmayan video (özel/liste dışı): Gemini çağrılmaz, gece başarısız', async () => {
    for (const gizlilik of ['private', 'unlisted']) {
      const s = await tek(['--tarih', '2026-11-01'], bag({ videolar: [oge(V5, T5, '2026-11-02T05:26:50Z')], meta: { [V5]: { gizlilik } } }));
      expect(s.kod).toBe(1);
      expect(s.sonuclar[0]!.hata, gizlilik).toMatch(/herkese açık değil/);
    }
    expect(geminiGovdeleri).toHaveLength(0);
  });
  it('süre alınamazsa ya da 0 ise Gemini çağrılmaz', async () => {
    for (const sure of [null, 'PT0S']) {
      const s = await tek(['--tarih', '2026-11-01'], bag({ videolar: [oge(V5, T5, '2026-11-02T05:26:50Z')], meta: { [V5]: { sure } } }));
      expect(s.kod).toBe(1);
      expect(s.sonuclar[0]!.hata).toMatch(/süresi alınamadı/);
    }
    expect(geminiGovdeleri).toHaveLength(0);
  });

  it('başlık kalıba uymuyorsa varsayım yapılmaz: hata, Gemini çağrılmaz; --zorla ile aşılır', async () => {
    const url = `https://www.youtube.com/watch?v=${V5}`;
    const meta = { [V5]: { baslik: 'Wembanyama GOES OFF vs Lakers' } };
    const s = await tek(['2026-11-01', url], bag({ meta }));
    expect(s.kod).toBe(1);
    expect(s.sonuclar[0]!.hata).toMatch(/kalıbına uymuyor.*tür varsayılmadı.*--zorla/);
    expect(geminiGovdeleri).toHaveLength(0);
    const z = await tek(['2026-11-01', url, '--zorla'], bag({ meta, gemini: (tur) => gecerliHam(tur) }));
    expect(z.kod).toBe(0);
    expect(cikti.join('\n')).toContain('--zorla: başlık kalıba uymuyor');
    expect(existsSync(dosya('2026-11-01'))).toBe(true);
  });
  it('--zorla otomatik modda yok (kullanım hatası, çıkış 2)', async () => {
    expect((await tek(['--otomatik', '--zorla'], bag())).kod).toBe(2);
    expect(() => argumanlar(['--otomatik', '--zorla'])).toThrow(/otomatik modda/);
  });
  it('başlıktaki tarih verilen geceyle uyuşmuyorsa hata (--zorla ile aşılır)', async () => {
    const s = await tek(['2026-10-31', `https://www.youtube.com/watch?v=${V5}`], bag());
    expect(s.kod).toBe(1);
    expect(s.sonuclar[0]!.hata).toMatch(/başlıktaki tarih \(2026-11-01\) verilen geceyle \(2026-10-31\)/);
    expect(geminiGovdeleri).toHaveLength(0);
  });
  it('toplam video süresi YouTube meta verisinden gelir (başarısız geceler eklenmez)', async () => {
    await tek(['--otomatik'], bag({ videolar: iki, meta: { [V10]: { gizlilik: 'private' } } }));
    expect(cikti.join('\n')).toContain('Toplam video süresi: 10:30');
  });
});

describe('uydurma koruması: Gemini çıktısı videoyla tutarsızsa', () => {
  const v5 = [oge(V5, T5, '2026-11-02T05:26:50Z')];

  it('boş liste: tek çağrı (yeniden deneme yok), gece başarısız, dosya yok', async () => {
    const b = bag({ videolar: v5, gemini: () => ({ date: '2026-11-01', type: 'top5', plays: [] }) });
    const s = await tek(['--tarih', '2026-11-01'], b);
    expect(s.kod).toBe(1);
    expect(geminiGovdeleri).toHaveLength(1);
    expect(s.sonuclar[0]!.hata).toMatch(/boş oyun listesi/);
    expect(existsSync(dosya('2026-11-01'))).toBe(false);
  });
  it('süre dışı zaman damgası: bir kez yeniden denenir; yine geçmezse başarısız, dosya yok', async () => {
    const b = bag({ videolar: v5, gemini: (tur) => { const h = gecerliHam(tur); h.plays[0]!.timestamp = '59:59'; return h; } });
    const s = await tek(['--tarih', '2026-11-01'], b);
    expect(s.kod).toBe(1);
    expect(geminiGovdeleri).toHaveLength(2);
    expect(geminiGovdeleri[1]!.istem).toContain('video süresinin (10:30) dışında');
    expect(existsSync(dosya('2026-11-01'))).toBe(false);
  });
  it('tür/oyun sayısı uyuşmazlığı (Top 5 başlıklı videoda 10 oyun): iki denemede de geçmezse başarısız', async () => {
    const b = bag({ videolar: v5, gemini: () => gecerliHam('top10') });
    const s = await tek(['--tarih', '2026-11-01'], b);
    expect(s.kod).toBe(1);
    expect(s.sonuclar[0]!.hata).toMatch(/oyun sayısı 10; başlıktaki tür \(Top 5\) 5 oyun gerektirir/);
    expect(existsSync(dosya('2026-11-01'))).toBe(false);
  });
  it('açıklamadaki listeyle çelişen (uydurma) oyuncular: yarıdan azı eşleşirse başarısız; ikinci denemede düzelirse yazılır', async () => {
    const uydurma = (tur: 'top10' | 'top5') => {
      const h = gecerliHam(tur);
      h.plays.forEach((o, i) => (o.contributors = [{ player: `Uydurma Kisi ${i}`, team: 'SAS', role: 'finisher', share: 100 }]));
      return h;
    };
    const b1 = bag({ videolar: v5, gemini: (tur) => uydurma(tur) });
    const s1 = await tek(['--tarih', '2026-11-01'], b1);
    expect(s1.kod).toBe(1);
    expect(s1.sonuclar[0]!.hata).toMatch(/videoyla tutarsız/);
    expect(existsSync(dosya('2026-11-01'))).toBe(false);
    geminiGovdeleri = [];
    const b2 = bag({ videolar: v5, gemini: (tur, n) => (n === 1 ? uydurma(tur) : gecerliHam(tur)) });
    const s2 = await tek(['--tarih', '2026-11-01'], b2);
    expect(s2.kod).toBe(0);
    expect(geminiGovdeleri).toHaveLength(2);
    expect(existsSync(dosya('2026-11-01'))).toBe(true);
  });
  it('açıklamada liste yoksa kontrol atlanır; uyarı terminalde, özette ve sonuçta', async () => {
    const b = bag({ videolar: v5, meta: { [V5]: { aciklama: 'Never miss a moment with the latest news, trending stories and highlights' } }, gemini: (tur) => { const h = gecerliHam(tur); h.plays[1]!.contributors[0]!.player = 'Herhangi Biri'; return h; } });
    const s = await tek(['--tarih', '2026-11-01'], b);
    expect(s.kod).toBe(0);
    expect(cikti.join('\n')).toMatch(/UYARI: video açıklamasında "featuring" oyuncu listesi bulunamadı; açıklama çapraz kontrolü atlandı/);
    expect(readFileSync(b.ozetDosyasi, 'utf8')).toContain('açıklama çapraz kontrolü atlandı');
    expect(readFileSync(dosya('2026-11-01'), 'utf8')).not.toContain('açıklamada yok');
  });
  it('tek tek listede olmayan ad: YAML yorumu, terminal uyarısı ve step summary "açıklamada yok"', async () => {
    const b = bag({ videolar: v5, gemini: (tur) => { const h = gecerliHam(tur); h.plays[4]!.contributors[0]!.player = 'Baska Biri'; return h; } });
    await tek(['--tarih', '2026-11-01'], b);
    expect(readFileSync(dosya('2026-11-01'), 'utf8')).toContain('# açıklamada yok: Baska Biri');
    expect(cikti.join('\n')).toContain('UYARI: açıklamada yok: Baska Biri');
    expect(readFileSync(b.ozetDosyasi, 'utf8')).toContain('sıra 5: açıklamada yok: Baska Biri');
  });
  it('eylem ile en büyük pay uyuşmuyor uyarısı: terminalde, YAML yorumunda ve özette', async () => {
    const b = bag({ videolar: v5, gemini: (tur) => { const h = gecerliHam(tur); h.plays[1]!.contributors = [{ player: 'Kofi Adebayo', team: 'OKC', role: 'passer', share: 70 }, { player: 'Piet Kronen', team: 'OKC', role: 'finisher', share: 30 }]; return h; } });
    await tek(['--tarih', '2026-11-01'], b);
    const uyari = 'eylem ile en büyük pay uyuşmuyor (eylem: Smaç; en büyük pay: Kofi Adebayo %70, Pasör)';
    expect(readFileSync(dosya('2026-11-01'), 'utf8')).toContain(`# ${uyari}`);
    expect(cikti.join('\n')).toContain(`UYARI: ${uyari}`);
    expect(readFileSync(b.ozetDosyasi, 'utf8')).toContain(`sıra 2: ${uyari}`);
  });
});

describe('terminalde güven düzeyi ve token raporu', () => {
  const v5 = [oge(V5, T5, '2026-11-02T05:26:50Z')];

  it('her oyun satırında güven düzeyi ve gerekçesi (yazan modda da)', async () => {
    await tek(['--tarih', '2026-11-01'], bag({ videolar: v5 }));
    const log = cikti.join('\n');
    expect(log).toContain('  1. alley_oop: Mirko Daval (SAS, %70), Tomas Veltri (SAS, %30) @2:50 [güven: yüksek]');
    expect(log).toContain('@1:30 [güven: orta: Jersey number partly hidden]');
    expect(log.match(/\[güven: /g)).toHaveLength(5);
  });
  it('--kuru modunda da aynı satırlar basılır', async () => {
    await tek(['--tarih', '2026-11-01', '--kuru'], bag({ videolar: v5 }));
    expect(cikti.join('\n')).toContain('[güven: orta: Jersey number partly hidden]');
  });

  it('token raporu çağrı başına: çalıştırma ve yeniden denemeler ayrı gösterilir', async () => {
    const b = bag({ videolar: v5, gemini: (tur, n) => { const h = gecerliHam(tur); if (n === 1) h.plays[0]!.timestamp = '59:59'; return h; } });
    await tek(['--tarih', '2026-11-01'], b);
    const log = cikti.join('\n');
    expect(log).toContain('Token kullanımı (çağrı başına):');
    expect(log).toContain('2026-11-01 çalıştırma 1, deneme 1: girdi 2.000, çıktı 500, düşünme 100, toplam 2.600 (girdi sınırı 242.500)');
    expect(log).toContain('2026-11-01 çalıştırma 1, deneme 2: girdi 2.000, çıktı 500, düşünme 100, toplam 2.600');
    expect(log).toContain("girdi token'ı: ilk denemeler 2.000; yeniden denemeler 2.000; ek oylama çalıştırmaları 0; toplam 4.000");
    expect(readFileSync(b.ozetDosyasi, 'utf8')).toContain('### Token kullanımı (çağrı başına)');
  });
  it('oylama çalıştırmaları ayrı kategoride (ek oylama çalıştırmaları)', async () => {
    await calistir(['--tarih', '2026-11-01', '--kuru', '--oylama', '2'], bag({ videolar: v5 }));
    const log = cikti.join(String.fromCharCode(10));
    expect(log).toContain('çalıştırma 2, deneme 1');
    expect(log).toContain('ilk denemeler 2.000; yeniden denemeler 0; ek oylama çalıştırmaları 2.000; toplam 4.000');
  });

  it('video başına girdi token üst sınırı aşılırsa uyarı (terminal + step summary); iş durmaz', async () => {
    // 10:30 video: sınır = (630 × 300 + 5.000) × 1,25 = 242.500; 1.330.160 girdi token'ı bunu aşar
    const b = bag({ videolar: v5, usage: { total_input_tokens: 1330160, total_output_tokens: 500, total_tokens: 1330660 } });
    const s = await tek(['--tarih', '2026-11-01'], b);
    expect(s.kod).toBe(0);
    expect(cikti.join('\n')).toContain("::warning::token: 2026-11-01 çalıştırma 1, deneme 1: girdi token'ı 1.330.160 video başına üst sınırı (242.500) aştı");
    expect(readFileSync(b.ozetDosyasi, 'utf8')).toContain('**Token üst sınırı uyarıları**');
    expect(readFileSync(b.ozetDosyasi, 'utf8')).toContain('SINIR AŞILDI');
  });
  it('sınır altındaysa uyarı yok', async () => {
    const b = bag({ videolar: v5 });
    await tek(['--tarih', '2026-11-01'], b);
    expect(cikti.join('\n')).not.toContain('SINIR AŞILDI');
    expect(readFileSync(b.ozetDosyasi, 'utf8')).not.toContain('Token üst sınırı uyarıları');
  });
});

describe('çoğunluk oylaması (varsayılan 3) uçtan uca', () => {
  const v5 = [oge(V5, T5, '2026-11-02T05:26:50Z')];
  const yanlisAd = (h: ReturnType<typeof gecerliHam>) => (h.plays[3]!.contributors = [{ player: 'Brayden Burries', team: 'SAS', role: 'finisher', share: 100 }]);
  const log = () => cikti.join(String.fromCharCode(10));

  it('varsayılan 3 çalıştırma; oy birliği → güven yüksek; model, çözünürlük ve oylama başta, video süresi bir kez + işlenen süre ayrı', async () => {
    const b = bag({ videolar: v5, modelSurumu: 'gemini-3.6-flash-001' });
    const s = await calistir(['--tarih', '2026-11-01'], b);
    expect(s.kod).toBe(0);
    expect(geminiGovdeleri).toHaveLength(3);
    expect(cikti[0]).toBe('Model: gemini-3.8-flash; video çözünürlüğü: high; oylama: 3');
    expect(log()).toContain('Model (yanıtta bildirilen): gemini-3.6-flash-001');
    expect(log()).toContain("Toplam video süresi: 10:30; Gemini'de işlenen toplam süre: 31:30 (3 çağrı)"); // 3 × 10:30
    expect(log()).toContain('1. alley_oop: Mirko Daval (SAS, %70), Tomas Veltri (SAS, %30) @2:50 [güven: yüksek (oy 3/3)]');
    const yaml = readFileSync(dosya('2026-11-01'), 'utf8');
    expect(yaml).toContain('# güven: yüksek (oy 3/3)');
    const ozet = readFileSync(b.ozetDosyasi, 'utf8');
    expect(ozet).toContain('Model: `gemini-3.8-flash`; yanıtta bildirilen model: `gemini-3.6-flash-001`.');
    expect(ozet).toContain('oylama: 3; video çözünürlüğü: high');
    expect(ozet).toContain('(oy 3/3)');
    expect(ozet).toContain('ek oylama çalıştırmaları 4.000; toplam 6.000');
  });
  it('yanıtta model sürümü yoksa özet bunu söyler', async () => {
    const b = bag({ videolar: v5 });
    await calistir(['--tarih', '2026-11-01'], b);
    expect(readFileSync(b.ozetDosyasi, 'utf8')).toContain('yanıtta model sürümü yok');
  });

  it('2/3 çoğunluk: azınlıktaki yanlış ad elenir; terminal, YAML ve özet oy oranı + alternatifi gösterir; oy birliği olmayan satır kontrol listesinde', async () => {
    const b = bag({ videolar: v5, gemini: (tur, n) => { const h = gecerliHam(tur); if (n === 2) yanlisAd(h); return h; } });
    const s = await calistir(['--tarih', '2026-11-01'], b);
    expect(s.kod).toBe(0);
    expect(log()).toContain('4. smac: Rafael Quintero (MIA, %100) @0:50 [güven: orta (oy 2/3; eylem 3/3; pay 2/2; diğer: Brayden Burries 1/3)]');
    expect(readFileSync(dosya('2026-11-01'), 'utf8')).toContain('# diğer: Brayden Burries 1/3');
    expect(readFileSync(dosya('2026-11-01'), 'utf8')).not.toContain('Brayden Burries, takim');
    const ozet = readFileSync(b.ozetDosyasi, 'utf8');
    expect(ozet).toContain('sıra 4: oy 2/3; eylem');
    expect(ozet).toContain('diğer: Brayden Burries 1/3');
    expect(ozet).not.toContain('sıra 5: oy'); // oy birliği olan satır listede yok
  });
  it('uzlaşma yok: satır düşük güvenle işaretlenir, yine de yazılır', async () => {
    const adlar = ['Ada Bee', 'Cem Dee', 'Eda Eff'];
    const b = bag({ videolar: v5, gemini: (tur, n) => { const h = gecerliHam(tur); h.plays[4]!.contributors = [{ player: adlar[n - 1]!, team: 'SAS', role: 'finisher', share: 100 }]; return h; } });
    const s = await calistir(['--tarih', '2026-11-01'], b);
    expect(s.kod).toBe(0);
    expect(log()).toContain('[güven: düşük (oy 1/3, uzlaşma yok;');
    expect(readFileSync(dosya('2026-11-01'), 'utf8')).toContain('# güven: düşük (oy 1/3)');
    expect(readFileSync(b.ozetDosyasi, 'utf8')).toContain('sıra 5: oy 1/3, uzlaşma yok');
  });

  it('geçersiz çalıştırma oylamaya katılmaz (kendi yeniden denemesi sonrası); kalan 2 geçerli ile devam, uyarılır', async () => {
    // çalıştırma 1: her iki deneme geçersiz (zaman damgası süre dışı) → 2 çağrı; çalıştırma 2 ve 3 geçerli → 2 çağrı
    let cagri = 0;
    const b = bag({ videolar: v5, gemini: (tur) => { cagri += 1; const h = gecerliHam(tur); if (cagri <= 2) h.plays[0]!.timestamp = '59:59'; return h; } });
    const s = await calistir(['--tarih', '2026-11-01'], b);
    expect(s.kod).toBe(0);
    expect(geminiGovdeleri).toHaveLength(4);
    expect(log()).toContain('1 çalıştırma doğrulamadan geçmedi ve oylamaya katılmadı (2/3 geçerli)');
    expect(readFileSync(dosya('2026-11-01'), 'utf8')).toContain('# güven: yüksek (oy 2/2)');
  });
  it('geçerli çalıştırma sayısı 2nin altına düşerse gece başarısız; gereksiz çağrı yapılmaz', async () => {
    const b = bag({ videolar: v5, gemini: (tur) => { const h = gecerliHam(tur); h.plays[0]!.timestamp = '59:59'; return h; } });
    const s = await calistir(['--tarih', '2026-11-01'], b);
    expect(s.kod).toBe(1);
    expect(s.sonuclar[0]!.hata).toMatch(/geçerli çalıştırma sayısı 0\/3 \(oylama için en az 2 gerekir\)/);
    expect(geminiGovdeleri).toHaveLength(4); // 2 çalıştırma × (deneme + yeniden deneme); 3. çalıştırma 2 geçerliye yetmeyeceği için yapılmaz
    expect(existsSync(dosya('2026-11-01'))).toBe(false);
  });
  it('tek geçerli çalıştırma 2nin altında: başarısız; --oylama 1 ise tek çalıştırma yeterli', async () => {
    let cagri = 0;
    const b = bag({ videolar: v5, gemini: (tur) => { cagri += 1; const h = gecerliHam(tur); if (cagri !== 3) h.plays[0]!.timestamp = '59:59'; return h; } });
    // çalıştırma 1: çağrı 1-2 geçersiz; çalıştırma 2: çağrı 3 geçerli; çalıştırma 3 yapılır (1 + 1 kalan ≥ 2): çağrı 4-5 geçersiz → 1 geçerli < 2
    const s = await calistir(['--tarih', '2026-11-01'], b);
    expect(s.kod).toBe(1);
    expect(s.sonuclar[0]!.hata).toMatch(/geçerli çalıştırma sayısı 1\/3/);
    const t = await calistir(['--tarih', '2026-11-01', '--oylama', '1'], bag({ videolar: v5 }));
    expect(t.kod).toBe(0);
  });
  it('oyun sayısı (tür) çalıştırmalar arasında farklıysa çoğunluk (--zorla: tür başlıktan bilinmiyor)', async () => {
    const meta = { [V5]: { baslik: 'Wembanyama GOES OFF vs Lakers', aciklama: '' } };
    const b = bag({ videolar: v5, meta, gemini: (_tur, n) => gecerliHam(n === 3 ? 'top10' : 'top5') });
    const s = await calistir(['--tarih', '2026-11-01', '--zorla'], b);
    expect(s.kod).toBe(0);
    expect(s.sonuclar[0]!.tur).toBe('top5');
    expect(readFileSync(dosya('2026-11-01'), 'utf8')).toContain('tur: top5');
    rmSync(dosya('2026-11-01')); // ilk çalıştırmanın dosyası bekleyen gemini dosyası olarak kalır
    const c = bag({ videolar: v5, meta, gemini: (_tur, n) => gecerliHam(n === 1 ? 'top10' : 'top5') });
    expect((await calistir(['--tarih', '2026-11-01', '--zorla', '--oylama', '2'], c)).kod).toBe(1);
  });
  it('token raporu çalıştırma başına; üst sınır uyarısı çalıştırma başına', async () => {
    const b = bag({ videolar: v5, usage: { total_input_tokens: 500000, total_output_tokens: 500, total_tokens: 500500 } });
    await calistir(['--tarih', '2026-11-01'], b);
    for (const k of [1, 2, 3]) expect(log()).toContain(`::warning::token: 2026-11-01 çalıştırma ${k}, deneme 1: girdi token'ı 500.000`);
  });
});

describe('--oylama bayrağı', () => {
  it('geçerli aralık 1..7; varsayılan 3; tam sayı olmalı', () => {
    expect(argumanlar(['--otomatik']).oylama).toBe(3);
    expect(argumanlar(['--otomatik', '--oylama', '5']).oylama).toBe(5);
    expect(argumanlar(['--otomatik', '--oylama=1']).oylama).toBe(1);
    for (const kotu of ['0', '8', '2.5', 'x', '-1']) expect(() => argumanlar(['--otomatik', '--oylama', kotu]), kotu).toThrow(/--oylama 1 ile 7/);
  });
  it('--tekrar ile birlikte (ya da tek başına) kullanım hatası: --tekrar kaldırıldı', async () => {
    expect(() => argumanlar(['--otomatik', '--oylama', '3', '--tekrar', '2'])).toThrow(/--tekrar kaldırıldı/);
    expect((await calistir(['--otomatik', '--oylama', '3', '--tekrar', '2'], bag())).kod).toBe(2);
    expect((await calistir(['--otomatik', '--oylama', '9'], bag())).kod).toBe(2);
  });
});

describe('video çözünürlüğü ve istem yer tutucuları (uçtan uca)', () => {
  const v5 = [oge(V5, T5, '2026-11-02T05:26:50Z')];
  const env = (ek: Record<string, string> = {}) => ({ YOUTUBE_API_KEY: YT_ANAHTAR, GEMINI_API_KEY: GM_ANAHTAR, ...ek });

  it('varsayılan yüksek: her istekte video parçasında resolution=high; GEMINI_COZUNURLUK değiştirir', async () => {
    await tek(['--tarih', '2026-11-01', '--kuru'], bag({ videolar: v5 }));
    expect(geminiGovdeleri.map((g) => g.cozunurluk)).toEqual(['high']);
    geminiGovdeleri = [];
    await tek(['--tarih', '2026-11-01', '--kuru'], bag({ videolar: v5 }, env({ GEMINI_COZUNURLUK: 'low' })));
    expect(geminiGovdeleri.map((g) => g.cozunurluk)).toEqual(['low']);
    geminiGovdeleri = [];
    await tek(['--tarih', '2026-11-01', '--kuru'], bag({ videolar: v5 }, env({ GEMINI_COZUNURLUK: 'unspecified' })));
    expect(geminiGovdeleri.map((g) => g.cozunurluk)).toEqual([undefined]);
  });
  it('geçersiz GEMINI_COZUNURLUK çıkış 2 (Gemini çağrılmaz)', async () => {
    const s = await tek(['--tarih', '2026-11-01'], bag({ videolar: v5 }, env({ GEMINI_COZUNURLUK: 'ultra' })));
    expect(s.kod).toBe(2);
    expect(geminiGovdeleri).toHaveLength(0);
  });
  it('API alanı reddederse çözünürlüksüz devam eder, bir kez uyarır; sonraki çağrılar alansız gider', async () => {
    const b = bag({ videolar: v5, cozunurlukReddet: true });
    const s = await calistir(['--tarih', '2026-11-01'], b);
    expect(s.kod).toBe(0);
    const uyarilar = cikti.filter((x) => x.includes('video "resolution" alanını reddetti'));
    expect(uyarilar).toHaveLength(1);
    // ilk çağrı resolution ile reddedildi (+ alansız yeniden gönderim), sonraki iki çalıştırma baştan alansız
    expect(geminiGovdeleri[0]!.cozunurluk).toBe('high');
    expect(geminiGovdeleri.slice(2).every((g) => g.cozunurluk === undefined)).toBe(true);
  });
  it('istem yer tutucuları gece tarihi ve sezonla doldurulur', async () => {
    const istem = join(klasor, 'istem.md');
    writeFileSync(istem, 'Games played on {tarih} (season {sezon}).');
    await tek(['--tarih', '2026-11-01', '--kuru'], { ...bag({ videolar: v5 }), istemDosyasi: istem });
    expect(geminiGovdeleri[0]!.istem).toBe('Games played on 2026-11-01 (season 2026-27).');
    geminiGovdeleri = [];
    await tek(['2026-11-01', `https://www.youtube.com/watch?v=${V5}`, '--kuru'], { ...bag(), istemDosyasi: istem });
    expect(geminiGovdeleri[0]!.istem).not.toMatch(/[{}]/);
  });
  it('depodaki istem.md ile gerçek istem: başta tarih/sezon cümlesi, yer tutucu kalmaz', async () => {
    await tek(['--tarih', '2026-11-01', '--kuru'], bag({ videolar: v5 }));
    expect(geminiGovdeleri[0]!.istem.startsWith('This video covers NBA games played on 2026-11-01 (season 2026-27). Rosters and rookies are those of that season;')).toBe(true);
    expect(geminiGovdeleri[0]!.istem).not.toMatch(/[{][a-z]+[}]/);
  });
});

describe('geçmiş geceleri toplu doldurma (--otomatik --baslangic)', () => {
  const AY = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const bas = (t: string) => `NBA's Top 10 Plays of the Night | ${AY[Number(t.slice(5, 7)) - 1]} ${Number(t.slice(8, 10))}, ${t.slice(0, 4)}`;
  const idOf = (t: string) => `vid${t.slice(5).replace('-', '')}xxxx`; // 11 karakter
  const yayin = (t: string) => new Date(Date.parse(`${t}T05:00:00Z`) + 86400000).toISOString();
  const gece = (t: string) => oge(idOf(t), bas(t), yayin(t));
  const gurultu = (t: string) => Array.from({ length: 4 }, (_, i) => oge(`g${t.slice(5).replace('-', '')}${i}xxxxx`.slice(0, 11), `RAPTORS at LAKERS | FULL GAME HIGHLIGHTS ${i}`, `${yayin(t).slice(0, 10)}T0${6 + i}:00:00Z`));
  const meta = (tarihler: string[]) => Object.fromEntries(tarihler.map((t) => [idOf(t), { baslik: bas(t) }]));
  const log = () => cikti.join(String.fromCharCode(10));
  const GUNLER = ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];

  it('bitiş varsayılan dün: 4 gece işlenir; oynatma listesi 2 sayfa okunur, ikinci sayfada en eski tarih bulununca durur; sayfa ve kota sonda raporlanır', async () => {
    const b = bag({ sayfalar: [[...gurultu('2026-11-01'), gece('2026-11-01'), gece('2026-10-31')], [...gurultu('2026-10-30'), gece('2026-10-30'), gece('2026-10-29')], [gece('2026-10-28')]], meta: meta(GUNLER) });
    const s = await tek(['--otomatik', '--baslangic', '2026-10-29'], b);
    expect(s.kod).toBe(0);
    expect(s.sonuclar.map((r) => [r.tarih, r.durum])).toEqual(GUNLER.map((t) => [t, 'uretildi']));
    expect(youtubeIstekleri).toEqual(['playlistItems:0', 'playlistItems:1']); // 3. sayfa okunmadı
    expect(log()).toContain('Aralık: 2026-10-29 .. 2026-11-01 (4 gün)');
    expect(log()).toContain('Oynatma listesi: 2 sayfa (sayfa başına en çok 50 video), 12 video; durma nedeni: en eski istenen tarihin videosu bulundu');
    // 2 sayfa + videos.list (4 gece, tek çağrı) = 3 istek
    expect(log()).toContain('YouTube API: 3 istek ≈ 3 kota birimi (list çağrısı başına 1); oynatma listesi sayfası: 2; 2 sayfa okundu, durma nedeni: en eski istenen tarihin videosu bulundu');
    for (const t of GUNLER) expect(existsSync(dosya(t))).toBe(true);
    expect(readFileSync(b.ozetDosyasi, 'utf8')).toContain('### Aralık sonucu');
  });

  it('bir gece başarısız olursa betik durmaz, sonrakine geçer; sonda başarılı/başarısız/video yok listesi verilir', async () => {
    const b = bag({
      sayfalar: [[gece('2026-11-01'), gece('2026-10-31'), gece('2026-10-29')]], // 30 Ekim için video yok
      meta: meta(GUNLER),
      gemini: (tur) => { const h = gecerliHam(tur); if (geminiGovdeleri.at(-1)!.uri.includes(idOf('2026-10-31'))) h.plays.pop(); return h; },
    });
    const s = await tek(['--otomatik', '--baslangic', '2026-10-29'], b);
    expect(s.kod).toBe(0); // en az bir gece işlendi
    expect(s.sonuclar.map((r) => [r.tarih, r.durum])).toEqual([['2026-10-29', 'uretildi'], ['2026-10-30', 'video-yok'], ['2026-10-31', 'basarisiz'], ['2026-11-01', 'uretildi']]);
    expect(log()).toContain('Aralık sonucu: başarılı 2, başarısız 1, video yok 1, dokunulmadı (dosyası var) 0');
    expect(log()).toContain('  başarılı: 2026-10-29, 2026-11-01');
    expect(log()).toMatch(/başarısız \(yeniden çalıştırınca[^)]*\): 2026-10-31 \(/);
    expect(log()).toContain('  video yok: 2026-10-30');
    expect(existsSync(dosya('2026-10-31'))).toBe(false);
    expect(existsSync(dosya('2026-11-01'))).toBe(true); // başarısız geceden SONRAKİ gece de işlendi
  });

  it('tekrar çalıştırınca yalnızca dosyası olmayan geceler işlenir (başarısızlar yeniden denenir)', async () => {
    const sayfalar = [[gece('2026-11-01'), gece('2026-10-31'), gece('2026-10-30'), gece('2026-10-29')]];
    const bozuk = (tur: 'top10' | 'top5') => { const h = gecerliHam(tur); h.plays.pop(); return h; };
    const b1 = bag({ sayfalar, meta: meta(GUNLER), gemini: (tur) => (geminiGovdeleri.at(-1)!.uri.includes(idOf('2026-10-30')) ? bozuk(tur) : gecerliHam(tur)) });
    const s1 = await tek(['--otomatik', '--baslangic', '2026-10-29'], b1);
    expect(s1.sonuclar.map((r) => r.durum)).toEqual(['uretildi', 'basarisiz', 'uretildi', 'uretildi']);
    geminiGovdeleri = [];
    const s2 = await tek(['--otomatik', '--baslangic', '2026-10-29'], bag({ sayfalar, meta: meta(GUNLER) }));
    expect(s2.kod).toBe(0);
    expect(s2.sonuclar.map((r) => [r.tarih, r.durum])).toEqual([['2026-10-29', 'bekliyor'], ['2026-10-30', 'uretildi'], ['2026-10-31', 'bekliyor'], ['2026-11-01', 'bekliyor']]);
    expect(geminiGovdeleri).toHaveLength(1); // yalnızca eksik gece için Gemini çağrıldı
    expect(geminiGovdeleri[0]!.uri).toContain(idOf('2026-10-30'));
    expect(log()).toContain('dokunulmadı (dosyası var) 3');
    // kilit kuralları aynen: elle yazılmış dosyaya dokunulmaz
    writeFileSync(dosya('2026-10-31'), 'tarih: 2026-10-31' + String.fromCharCode(10) + 'kaynak: elle' + String.fromCharCode(10) + '# elle' + String.fromCharCode(10));
    geminiGovdeleri = [];
    const s3 = await tek(['--otomatik', '--baslangic', '2026-10-29'], bag({ sayfalar, meta: meta(GUNLER) }));
    expect(s3.sonuclar.find((r) => r.tarih === '2026-10-31')!.durum).toBe('kilitli');
    expect(geminiGovdeleri).toHaveLength(0);
  });

  it('aralık en çok 31 gün: 32 gün kullanım hatası (çıkış 2), hiçbir API çağrılmaz; 31 gün çalışır', async () => {
    const b = bag({ sayfalar: [[]] });
    const s = await tek(['--otomatik', '--baslangic', '2026-10-01'], b); // 2026-10-01 .. 2026-11-01 = 32 gün
    expect(s.kod).toBe(2);
    expect(log()).toMatch(/aralık en çok 31 gün olabilir/);
    expect(youtubeIstekleri).toHaveLength(0);
    expect(geminiGovdeleri).toHaveLength(0);
    cikti = [];
    const t = await tek(['--otomatik', '--baslangic', '2026-10-02'], bag({ sayfalar: [[]] })); // tam 31 gün
    expect(t.kod).toBe(0);
    expect(t.sonuclar).toHaveLength(31);
    expect(t.sonuclar.every((r) => r.durum === 'video-yok')).toBe(true);
  });

  it('--bitis: aralığın üst sınırı; bitişten sonraki geceler işlenmez', async () => {
    const b = bag({ sayfalar: [[gece('2026-11-01'), gece('2026-10-31'), gece('2026-10-30'), gece('2026-10-29')]], meta: meta(GUNLER) });
    const s = await tek(['--otomatik', '--baslangic', '2026-10-29', '--bitis', '2026-10-30'], b);
    expect(s.sonuclar.map((r) => r.tarih)).toEqual(['2026-10-29', '2026-10-30']);
    expect(existsSync(dosya('2026-10-31'))).toBe(false);
  });

  it('başlık tarihi aralığın gerisine düşünce sayfalama durur; o geceler "video yok"', async () => {
    const b = bag({ sayfalar: [[gece('2026-11-01'), gece('2026-10-31')], [gece('2026-10-27')], [gece('2026-10-26')]], meta: meta(['2026-11-01', '2026-10-31']) });
    const s = await tek(['--otomatik', '--baslangic', '2026-10-29'], b);
    expect(s.sonuclar.map((r) => [r.tarih, r.durum])).toEqual([['2026-10-29', 'video-yok'], ['2026-10-30', 'video-yok'], ['2026-10-31', 'uretildi'], ['2026-11-01', 'uretildi']]);
    expect(youtubeIstekleri).toEqual(['playlistItems:0', 'playlistItems:1']);
    expect(log()).toContain('durma nedeni: başlıktaki tarih aralığın gerisine düştü');
  });

  it('bayrak hataları çıkış 2: --otomatik olmadan, --bitis tek başına, geçersiz tarih, başlangıç > bitiş', async () => {
    for (const argv of [['--baslangic', '2026-10-29'], ['--tarih', '2026-11-01', '--baslangic', '2026-10-29'], ['--otomatik', '--bitis', '2026-10-30'], ['--otomatik', '--baslangic', '2026-02-30'], ['--otomatik', '--baslangic', 'dün'], ['--otomatik', '--baslangic', '2026-10-31', '--bitis', '2026-10-29']]) {
      expect((await tek(argv, bag({ sayfalar: [[]] }))).kod, argv.join(' ')).toBe(2);
    }
    expect(youtubeIstekleri).toHaveLength(0);
  });

  it('bayrak verilmezse bugünkü 3 günlük pencere aynen çalışır (tek sayfa, aralık satırları yok)', async () => {
    const b = bag({ videolar: iki });
    const s = await tek(['--otomatik'], b);
    expect(s.sonuclar.map((r) => r.tarih)).toEqual(['2026-10-31', '2026-11-01', '2026-11-02']);
    expect(log()).not.toContain('Aralık sonucu');
    expect(log()).not.toContain('Aralık:');
  });
});
