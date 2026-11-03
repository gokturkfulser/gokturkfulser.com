// Access JWT doğrulaması: yok / geçersiz / geçerli, iss/aud/exp/nbf/alg, anahtar önbelleği, geliştirme bayrağı (yalnızca localhost'ta).
import { beforeEach, describe, expect, it } from 'vitest';
import { anahtarOnbelleginiSifirla, erisimDogrula, takimAdresi } from './erisim.ts';
import { AUD, gecerliYuk, ORIJIN, ortam, sahteAccess, TAKIM } from './test-yardim.ts';

const istek = (jwt?: string, adres = `${ORIJIN}/`) => new Request(adres, { headers: jwt ? { 'Cf-Access-Jwt-Assertion': jwt } : {} });

describe('erisimDogrula', () => {
  beforeEach(() => anahtarOnbelleginiSifirla());

  async function kur() {
    const a = await sahteAccess();
    const dep = { fetch: ((g: RequestInfo | URL) => (String(g) === `${TAKIM}/cdn-cgi/access/certs` ? a.certFetch() : Promise.reject(new Error('beklenmeyen istek')))) as typeof fetch, simdi: () => a.simdi * 1000 };
    return { a, dep };
  }

  it('geçerli JWT kabul edilir (e-posta döner); aud dizi ya da metin olabilir', async () => {
    const { a, dep } = await kur();
    const s = await erisimDogrula(istek(await a.imzala(gecerliYuk(a.simdi))), ortam(), dep);
    expect(s).toMatchObject({ tamam: true, eposta: 'goktrk@example.com' });
    const s2 = await erisimDogrula(istek(await a.imzala(gecerliYuk(a.simdi, { aud: AUD }))), ortam(), dep);
    expect(s2.tamam).toBe(true);
  });

  it('başlık yok → reddedilir', async () => {
    const { dep } = await kur();
    expect(await erisimDogrula(istek(), ortam(), dep)).toMatchObject({ tamam: false, neden: expect.stringContaining('başlığı yok') });
  });

  it('bozuk biçim, boş parça ve rastgele metin → reddedilir', async () => {
    const { dep } = await kur();
    for (const j of ['abc', 'a.b', 'a.b.c.d', '..', 'a.b.c!', 'eyJhbGciOiJub25lIn0.e30.']) expect((await erisimDogrula(istek(j), ortam(), dep)).tamam, j).toBe(false);
  });

  it('başka anahtarla imzalanmış JWT (sahte imza) → reddedilir', async () => {
    const { a, dep } = await kur();
    const baska = await sahteAccess(a.kid); // aynı kid, farklı anahtar çifti
    const s = await erisimDogrula(istek(await baska.imzala(gecerliYuk(a.simdi))), ortam(), dep);
    expect(s).toMatchObject({ tamam: false, neden: expect.stringContaining('imza') });
  });

  it('yük değiştirilmişse (imza yükü kapsıyor) → reddedilir', async () => {
    const { a, dep } = await kur();
    const [b, , i] = (await a.imzala(gecerliYuk(a.simdi))).split('.');
    const kotu = btoa(JSON.stringify(gecerliYuk(a.simdi, { email: 'saldirgan@example.com' }))).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    expect((await erisimDogrula(istek(`${b}.${kotu}.${i}`), ortam(), dep)).tamam).toBe(false);
  });

  it('yanlış aud, yanlış iss, süresi dolmuş, henüz geçerli değil → reddedilir', async () => {
    const { a, dep } = await kur();
    const dene = async (ek: Record<string, unknown>) => erisimDogrula(istek(await a.imzala(gecerliYuk(a.simdi, ek))), ortam(), dep);
    expect(await dene({ aud: ['baska-uygulama'] })).toMatchObject({ tamam: false, neden: expect.stringContaining('aud') });
    expect(await dene({ iss: 'https://baska.cloudflareaccess.com' })).toMatchObject({ tamam: false, neden: expect.stringContaining('iss') });
    expect(await dene({ exp: a.simdi - 3600 })).toMatchObject({ tamam: false, neden: expect.stringContaining('süresi') });
    expect(await dene({ nbf: a.simdi + 3600 })).toMatchObject({ tamam: false, neden: expect.stringContaining('henüz') });
    expect(await dene({ exp: undefined })).toMatchObject({ tamam: false });
  });

  it('alg: none / HS256 ya da kid yok → reddedilir', async () => {
    const { a, dep } = await kur();
    expect((await erisimDogrula(istek(await a.imzala(gecerliYuk(a.simdi), { alg: 'none' })), ortam(), dep)).tamam).toBe(false);
    expect((await erisimDogrula(istek(await a.imzala(gecerliYuk(a.simdi), { alg: 'HS256' })), ortam(), dep)).tamam).toBe(false);
    expect((await erisimDogrula(istek(await a.imzala(gecerliYuk(a.simdi), { kid: undefined })), ortam(), dep)).tamam).toBe(false);
  });

  it('bilinmeyen kid: anahtarlar bir kez yeniden çekilir (en çok dakikada bir), yine yoksa reddedilir', async () => {
    const { a, dep } = await kur();
    expect((await erisimDogrula(istek(await a.imzala(gecerliYuk(a.simdi), { kid: 'yok' })), ortam(), dep)).tamam).toBe(false);
    expect(a.certIstegiSayisi()).toBe(1); // ilk çekim; yenileme aralığı dolmadığı için ikinci çekim yok
  });

  it('anahtarlar önbelleğe alınır: art arda geçerli isteklerde tek sertifika isteği', async () => {
    const { a, dep } = await kur();
    for (let i = 0; i < 3; i++) await erisimDogrula(istek(await a.imzala(gecerliYuk(a.simdi))), ortam(), dep);
    expect(a.certIstegiSayisi()).toBe(1);
  });

  it('takım alanı ya da AUD tanımsızsa her istek reddedilir (kapalı varsayılan)', async () => {
    const { a, dep } = await kur();
    const jwt = await a.imzala(gecerliYuk(a.simdi));
    expect((await erisimDogrula(istek(jwt), ortam({ ACCESS_AUD: undefined }), dep)).tamam).toBe(false);
    expect((await erisimDogrula(istek(jwt), ortam({ ACCESS_TEAM_DOMAIN: undefined }), dep)).tamam).toBe(false);
    expect((await erisimDogrula(istek(jwt), ortam({ ACCESS_TEAM_DOMAIN: 'http://takim.cloudflareaccess.com' }), dep)).tamam).toBe(false); // https zorunlu
  });

  it('takım alanı şemasız yazılabilir; ACCESS_IZINLI_EPOSTA ek emniyet olarak uygulanır', async () => {
    const { a, dep } = await kur();
    const jwt = await a.imzala(gecerliYuk(a.simdi));
    expect((await erisimDogrula(istek(jwt), ortam({ ACCESS_TEAM_DOMAIN: 'takim.cloudflareaccess.com/' }), dep)).tamam).toBe(true);
    expect((await erisimDogrula(istek(jwt), ortam({ ACCESS_IZINLI_EPOSTA: 'GOKTRK@example.com' }), dep)).tamam).toBe(true);
    expect((await erisimDogrula(istek(jwt), ortam({ ACCESS_IZINLI_EPOSTA: 'baska@example.com' }), dep)).tamam).toBe(false);
    expect(takimAdresi('https://takim.cloudflareaccess.com/yol')).toBe(TAKIM);
  });

  describe('yerel geliştirme bayrağı', () => {
    it('KONTROL_GELISTIRME=evet ve localhost → JWT olmadan geçer', async () => {
      const { dep } = await kur();
      const s = await erisimDogrula(istek(undefined, 'http://localhost:8787/'), ortam({ KONTROL_GELISTIRME: 'evet', ACCESS_AUD: undefined }), dep);
      expect(s).toMatchObject({ tamam: true, gelistirme: true });
    });
    it('production adresinde bayrak yok sayılır (JWT yoksa 403); localhost olsa bile bayrak "evet" değilse yok sayılır', async () => {
      const { dep } = await kur();
      expect((await erisimDogrula(istek(undefined, `${ORIJIN}/`), ortam({ KONTROL_GELISTIRME: 'evet' }), dep)).tamam).toBe(false);
      expect((await erisimDogrula(istek(undefined, 'https://nba-daily-top10-control.hesap.workers.dev/'), ortam({ KONTROL_GELISTIRME: 'evet' }), dep)).tamam).toBe(false);
      expect((await erisimDogrula(istek(undefined, 'http://localhost:8787/'), ortam({ KONTROL_GELISTIRME: 'true' }), dep)).tamam).toBe(false);
      expect((await erisimDogrula(istek(undefined, 'http://localhost.gokturkfulser.com/'), ortam({ KONTROL_GELISTIRME: 'evet' }), dep)).tamam).toBe(false);
    });
  });
});
