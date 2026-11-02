// Geçmiş geceleri toplu doldurma: aralık hesabı ve oynatma listesi sayfalama durma koşulları (ağ yok).
import { describe, expect, it } from 'vitest';
import { EN_COK_SAYFA_ARALIK } from './ayarlar';
import { aralikTarihleri } from './otomatik';
import { json, oge, YT_ANAHTAR } from './test-yardim';
import { aralikVideolari } from './youtube';

// 2 Kasım 2026 07:00 UTC → ABD (Doğu) 2 Kasım 02:00: bugün 2026-11-02, dün 2026-11-01
const SIMDI = new Date('2026-11-02T07:00:00Z');
const ET = 'America/New_York';
const tarihler = (r: ReturnType<typeof aralikTarihleri>) => {
  if ('hata' in r) throw new Error(r.hata);
  return r.tarihler;
};

describe('aralikTarihleri', () => {
  it('bitiş verilmezse dün (ABD saatine göre); uçlar dahil, eskiden yeniye', () => {
    expect(tarihler(aralikTarihleri('2026-10-29', undefined, SIMDI, ET))).toEqual(['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  });
  it('açık bitiş; tek günlük aralık; bitiş bugün olabilir', () => {
    expect(tarihler(aralikTarihleri('2026-10-20', '2026-10-22', SIMDI, ET))).toEqual(['2026-10-20', '2026-10-21', '2026-10-22']);
    expect(tarihler(aralikTarihleri('2026-10-31', '2026-10-31', SIMDI, ET))).toEqual(['2026-10-31']);
    expect(tarihler(aralikTarihleri('2026-11-02', '2026-11-02', SIMDI, ET))).toEqual(['2026-11-02']);
  });
  it('ay ve yıl sınırı, saat dilimi: UTC gün dönse de ABD günü esas', () => {
    expect(tarihler(aralikTarihleri('2026-12-30', '2027-01-02', new Date('2027-01-03T09:00:00Z'), ET))).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
    // 2 Kasım 01:30 UTC: ABD'de hâlâ 1 Kasım; dün = 31 Ekim
    expect(tarihler(aralikTarihleri('2026-10-30', undefined, new Date('2026-11-02T01:30:00Z'), ET))).toEqual(['2026-10-30', '2026-10-31']);
  });
  it('31 gün sınırı: 31 gün geçer, 32 gün kullanım hatası', () => {
    expect(tarihler(aralikTarihleri('2026-10-02', '2026-11-01', SIMDI, ET))).toHaveLength(31);
    const r = aralikTarihleri('2026-10-01', '2026-11-01', SIMDI, ET);
    expect('hata' in r && r.hata).toMatch(/en çok 31 gün.*32 gün/);
    expect('hata' in aralikTarihleri('2026-01-01', undefined, SIMDI, ET)).toBe(true);
  });
  it('geçersiz aralıklar: başlangıç > bitiş, bitiş bugünden sonra, geçersiz tarih', () => {
    expect((aralikTarihleri('2026-10-31', '2026-10-30', SIMDI, ET) as { hata: string }).hata).toMatch(/bitişten.*sonra olamaz/);
    expect((aralikTarihleri('2026-10-31', '2026-11-03', SIMDI, ET) as { hata: string }).hata).toMatch(/bugünden.*sonra olamaz/);
    expect((aralikTarihleri('2026-11-02', undefined, SIMDI, ET) as { hata: string }).hata).toMatch(/bitişten/); // varsayılan bitiş dün: başlangıç bugün olamaz
    for (const kotu of ['2026-02-30', '2026-13-01', 'dün', '2026-1-5', '']) expect('hata' in aralikTarihleri(kotu, undefined, SIMDI, ET), kotu).toBe(true);
    expect((aralikTarihleri('2026-10-31', '2026-99-99', SIMDI, ET) as { hata: string }).hata).toMatch(/--bitis geçerli/);
  });
});

const AYLAR = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "2026-10-30" → NBA başlığı. */
const baslik = (t: string) => `NBA's Top 10 Plays of the Night | ${AYLAR[Number(t.slice(5, 7)) - 1]} ${Number(t.slice(8, 10))}, ${t.slice(0, 4)}`;
const gun = (t: string, ek = 0) => new Date(Date.parse(`${t}T00:00:00Z`) + (1 + ek) * 86400000).toISOString().slice(0, 10);
/** Bir gecenin videosu + aynı gün yüklenen başlıksız gürültü videoları. */
const gecelik = (t: string, gurultu = 3) => [
  ...Array.from({ length: gurultu }, (_, i) => oge(`g${t.slice(5).replace('-', '')}${i}xxxxxx`.slice(0, 11), `RAPTORS at LAKERS | FULL GAME HIGHLIGHTS ${i}`, `${gun(t)}T0${5 + i}:30:00Z`)),
  oge(`v${t.slice(5).replace('-', '')}xxxxxxx`.slice(0, 11), baslik(t), `${gun(t)}T05:00:00Z`),
];

function sahteListe(sayfalar: ReturnType<typeof oge>[][]) {
  const istekler: string[] = [];
  const fetchFn = (async (girdi: URL | string) => {
    const url = new URL(String(girdi));
    const no = Number(url.searchParams.get('pageToken')?.slice(1) ?? 0);
    istekler.push(`${url.pathname.split('/').pop()}:${no}`);
    return json({ items: sayfalar[no] ?? [], ...(no + 1 < sayfalar.length ? { nextPageToken: `P${no + 1}` } : {}) });
  }) as unknown as typeof fetch;
  return { fetchFn, istekler };
}

describe('aralikVideolari: sayfalama durma koşulu', () => {
  it('en eski istenen tarihin videosu bulununca durur (sonraki sayfa okunmaz); sayfa sayısı raporlanır', async () => {
    const { fetchFn, istekler } = sahteListe([
      [...gecelik('2026-11-01'), ...gecelik('2026-10-31')],
      [...gecelik('2026-10-30'), ...gecelik('2026-10-29')], // en eski istenen: 29 Ekim
      [...gecelik('2026-10-28')], // okunmamalı
    ]);
    const r = await aralikVideolari({ anahtar: YT_ANAHTAR, fetchFn, baslangic: '2026-10-29' });
    expect(r.sayfaSayisi).toBe(2);
    expect(r.neden).toBe('en eski istenen tarihin videosu bulundu');
    expect(istekler).toEqual(['playlistItems:0', 'playlistItems:1']);
    expect(r.videolar.some((v) => /October 29, 2026/.test(v.baslik))).toBe(true);
    expect(r.videolar.some((v) => /October 28, 2026/.test(v.baslik))).toBe(false);
  });
  it('en eski tarih için video yoksa ama başlık tarihi aralığın gerisine düşerse durur', async () => {
    const { fetchFn, istekler } = sahteListe([[...gecelik('2026-11-01')], [...gecelik('2026-10-27')], [...gecelik('2026-10-26')]]);
    const r = await aralikVideolari({ anahtar: YT_ANAHTAR, fetchFn, baslangic: '2026-10-29' });
    expect(r.sayfaSayisi).toBe(2);
    expect(r.neden).toBe('başlıktaki tarih aralığın gerisine düştü');
    expect(istekler).toHaveLength(2);
  });
  it('başlıksız sayfalar: yükleme tarihi aralığın 3 gün gerisine inince durur (tüm kanalı taramaz)', async () => {
    const gurultu = (t: string) => Array.from({ length: 5 }, (_, i) => oge(`x${t.slice(5).replace('-', '')}${i}xxxxxx`.slice(0, 11), `Highlights ${i}`, `${t}T1${i}:00:00Z`));
    const { fetchFn, istekler } = sahteListe([gurultu('2026-11-01'), gurultu('2026-10-30'), gurultu('2026-10-24'), gurultu('2026-10-20')]);
    const r = await aralikVideolari({ anahtar: YT_ANAHTAR, fetchFn, baslangic: '2026-10-29' });
    expect(r.neden).toBe('yükleme tarihi aralığın çok gerisinde');
    expect(r.sayfaSayisi).toBe(3);
    expect(istekler).toHaveLength(3);
  });
  it('liste biterse durur', async () => {
    const { fetchFn } = sahteListe([[...gecelik('2026-11-01')], [...gecelik('2026-10-31')]]);
    const r = await aralikVideolari({ anahtar: YT_ANAHTAR, fetchFn, baslangic: '2026-10-20' });
    expect(r.sayfaSayisi).toBe(2);
    expect(r.neden).toBe('oynatma listesi bitti');
  });
  it(`sayfa üst sınırı (${EN_COK_SAYFA_ARALIK}) aşılmaz`, async () => {
    const sayfalar = Array.from({ length: 60 }, () => [oge('abcdefghijk', 'Highlights', '2026-11-01T10:00:00Z')]);
    const { fetchFn, istekler } = sahteListe(sayfalar);
    const r = await aralikVideolari({ anahtar: YT_ANAHTAR, fetchFn, baslangic: '2026-10-20' });
    expect(r.sayfaSayisi).toBe(EN_COK_SAYFA_ARALIK);
    expect(r.neden).toBe('sayfa üst sınırı');
    expect(istekler).toHaveLength(EN_COK_SAYFA_ARALIK);
  });
  it('aynı sayfadaki tüm videolar işlenir (durma kararı sayfa sonunda)', async () => {
    const { fetchFn } = sahteListe([[...gecelik('2026-10-29'), ...gecelik('2026-10-28'), ...gecelik('2026-10-31')]]);
    const r = await aralikVideolari({ anahtar: YT_ANAHTAR, fetchFn, baslangic: '2026-10-29' });
    expect(r.videolar).toHaveLength(12);
  });
  it('sayfa başına en çok 50 video istenir', async () => {
    const urller: URL[] = [];
    const fetchFn = (async (g: URL | string) => {
      urller.push(new URL(String(g)));
      return json({ items: [] });
    }) as unknown as typeof fetch;
    await aralikVideolari({ anahtar: YT_ANAHTAR, fetchFn, baslangic: '2026-10-29' });
    expect(urller[0]!.searchParams.get('maxResults')).toBe('50');
    expect(urller[0]!.pathname).toMatch(/playlistItems$/);
  });
});
