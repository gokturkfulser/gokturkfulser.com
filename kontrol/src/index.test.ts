// Uçtan uca: Worker işleyicisi (sahte Access + sahte GitHub). Kimlik, listeler, düzenleme, doğrulama hataları, kaydet/onayla, sha çakışması, sözlük, token sızıntısı.
import { parse } from 'yaml';
import { beforeEach, describe, expect, it } from 'vitest';
import { anahtarOnbelleginiSifirla } from './erisim.ts';
import { oyundanDurum, geceOku, type OyunDurumu } from './form.ts';
import { isle } from './isleyici.ts';
import { AUD, birlesikFetch, clutchMetni, clutchSatiri, DUNK_BASLIK, dunkMetni, dunkSatiri, durumdanForm, GECE_YOLU, GECE_YOLU_2, geceMetni, gecerliYuk, NBA_CLUTCH_YOLU, NBA_DUNK_YOLU, ORIJIN, ortam, sahteAccess, sahteGitHub, SOZLUK_METNI, SOZLUK_YOLU, TAKIM, TOKEN } from './test-yardim.ts';
import { bugunIstanbul } from './nba.ts';
import type { Env } from './ortam.ts';
import { ETIKET_ANAHTARLARI } from '../../site/src/lib/top10-sozluk.ts';

type Kurulum = Awaited<ReturnType<typeof kur>>;

async function kur(dosyalar: Record<string, string> = { [GECE_YOLU]: geceMetni(), [GECE_YOLU_2]: geceMetni('2026-10-31', 'onaylandi'), [SOZLUK_YOLU]: SOZLUK_METNI }, envEk: Partial<Env> = {}) {
  const access = await sahteAccess();
  const github = sahteGitHub(dosyalar);
  const dep = { fetch: birlesikFetch(github, access), simdi: () => access.simdi * 1000 };
  const env = ortam(envEk);
  const jwt = await access.imzala(gecerliYuk(access.simdi));
  const yanitlar: { govde: string; basliklar: string }[] = [];
  const iste = async (yol: string, secenek: { yontem?: string; form?: URLSearchParams; jwt?: string | null; basliklar?: Record<string, string> } = {}) => {
    const form = secenek.form;
    const basliklar: Record<string, string> = { ...(secenek.jwt === null ? {} : { 'Cf-Access-Jwt-Assertion': secenek.jwt ?? jwt }), ...(form ? { Origin: ORIJIN, 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...secenek.basliklar };
    const r = await isle(new Request(`${ORIJIN}${yol}`, { method: secenek.yontem ?? (form ? 'POST' : 'GET'), headers: basliklar, body: form?.toString(), redirect: 'manual' }), env, dep);
    const govde = await r.clone().text();
    yanitlar.push({ govde, basliklar: JSON.stringify([...r.headers]) });
    return { durum: r.status, govde, basliklar: r.headers };
  };
  return { access, github, iste, jwt, yanitlar, env, dep };
}

const durumlar = (): OyunDurumu[] => {
  const g = geceOku(geceMetni());
  if (!g.tamam) throw new Error(g.hata);
  return g.gece.oyunlar.map((o) => oyundanDurum(o as never));
};
const shaAl = (govde: string) => /name="sha" value="([0-9a-f]{40})"/.exec(govde)![1]!;
const sonCommit = (k: Kurulum) => k.github.commitler.at(-1)!;

// Her testin kendi anahtar çifti var (aynı kid): modül düzeyindeki anahtar önbelleği testler arasında sıfırlanır.
beforeEach(() => anahtarOnbelleginiSifirla());

describe('kimlik', () => {

  it('JWT yok → 403; GitHub\'a hiçbir istek gitmez', async () => {
    const k = await kur();
    for (const yol of ['/', '/gece/2026-11-01', '/sozluk', '/stil.css']) expect((await k.iste(yol, { jwt: null })).durum, yol).toBe(403);
    expect(k.github.istekler).toHaveLength(0);
  });

  it('geçersiz JWT (sahte imza, yanlış aud, süresi dolmuş) → 403; POST dahil', async () => {
    const k = await kur();
    const baska = await sahteAccess(k.access.kid);
    expect((await k.iste('/', { jwt: await baska.imzala(gecerliYuk(k.access.simdi)) })).durum).toBe(403);
    expect((await k.iste('/', { jwt: await k.access.imzala(gecerliYuk(k.access.simdi, { aud: ['x'] })) })).durum).toBe(403);
    expect((await k.iste('/', { jwt: await k.access.imzala(gecerliYuk(k.access.simdi, { exp: k.access.simdi - 100 })) })).durum).toBe(403);
    expect((await k.iste('/gece/2026-11-01', { form: new URLSearchParams({ islem: 'onayla', sha: 'x' }), jwt: 'bozuk' })).durum).toBe(403);
    expect(k.github.istekler).toHaveLength(0);
    expect(k.github.commitler).toHaveLength(0);
  });

  it('geçerli JWT → 200; statik varlıklar da Access doğrulamasından sonra sunulur', async () => {
    const k = await kur();
    expect((await k.iste('/')).durum).toBe(200);
    const css = await k.iste('/stil.css');
    expect(css.durum).toBe(200);
    expect(css.govde).toBe('varlik');
  });

  it('yerel geliştirme bayrağı yalnızca localhost\'ta çalışır; production adresinde JWT yoksa 403', async () => {
    const k = await kur(undefined, { KONTROL_GELISTIRME: 'evet' });
    expect((await k.iste('/', { jwt: null })).durum).toBe(403);
  });

  it('güvenlik başlıkları: sıkı CSP, no-store, noindex', async () => {
    const k = await kur();
    const r = await k.iste('/');
    expect(r.basliklar.get('Content-Security-Policy')).toMatch(/^default-src 'self'; script-src 'self'; style-src 'self'/);
    expect(r.basliklar.get('Content-Security-Policy')).not.toMatch(/unsafe-/);
    expect(r.basliklar.get('Cache-Control')).toBe('no-store');
    expect(r.basliklar.get('X-Robots-Tag')).toContain('noindex');
    // 'no-referrer' tarayıcıda same-origin POST'larda Origin: null'a yol açar (gerçek tarayıcı denemesinde yakalandı): same-origin olmalı
    expect(r.basliklar.get('Referrer-Policy')).toBe('same-origin');
    expect((await k.iste('/', { jwt: null })).basliklar.get('Content-Security-Policy')).toBeTruthy(); // 403 yanıtı da
  });
});

describe('sayfalar', () => {
  it('liste: bekleyen geceler önce (bakılacak satır sayısıyla), onaylı geceler altında', async () => {
    const k = await kur();
    const { durum, govde } = await k.iste('/');
    expect(durum).toBe(200);
    expect(govde.indexOf('Bekleyen geceler')).toBeLessThan(govde.indexOf('Onaylı geceler'));
    expect(govde).toContain('href="/gece/2026-11-01"');
    expect(govde).toContain('1 bakılacak satır');
    expect(govde).toContain('5 satır');
    expect(govde).toContain('href="/gece/2026-10-31"');
    expect(govde.indexOf('2026-11-01')).toBeLessThan(govde.indexOf('2026-10-31'));
  });

  it('gece sayfası: video, zaman bağlantısı, kontrol bilgisi (uyarı metinle), alanlar, düğmeler', async () => {
    const k = await kur();
    const { govde } = await k.iste('/gece/2026-11-01');
    expect(govde).toContain('href="https://www.youtube.com/watch?v=abcdefghijk"');
    expect(govde).toContain('href="https://www.youtube.com/watch?v=abcdefghijk&amp;t=125"');
    expect(govde).toContain('Videoda 02:05');
    expect(govde).toContain('Bakılacak satır');
    expect(govde).toMatch(/Güven<\/dt><dd class="guven">Orta/);
    expect(govde).toContain('<span class="uyari-etiketi">Uyarı:</span> pay oyu 2/3');
    expect(govde).toContain('data-ad="Ada Bee"');
    expect(govde).toContain('data-ad="Tomas Veltri"');
    expect(govde).toContain('name="o1_eylem"');
    expect(govde).toMatch(/<option value="alley_oop" selected>/);
    expect(govde).toContain('value="clutch"'); // clutch etiketi seçilebilir
    expect(govde.match(/name="o1_etiket"/g)).toHaveLength(ETIKET_ANAHTARLARI.length); // sözlükteki her etiket formda
    // yeni sözlük girdileri formda: çalım eylemi, çalım atan rolü, eşitleyen etiketi
    expect(govde).toContain('<option value="calim">Handles</option>');
    expect(govde).toContain('<option value="calim_atan">Ball handler</option>');
    expect(govde).toContain('value="esitleyen"');
    expect(govde).toContain('<span>Eşitleyen</span>');
    expect(govde).toContain('name="o1_k1_oyuncu"');
    expect(govde).toMatch(/<option value="70-30" selected>70 \/ 30<\/option>/);
    expect(govde).toContain('list="oyuncu-adlari"');
    expect(govde).toContain('<option value="Svi Mykhailiuk">'); // sözlükten kanonik adlar
    for (const d of ['Kaydet', 'Kaydet ve onayla', 'Onayla (değişiklik yokken)']) expect(govde).toContain(d);
    expect(govde).not.toContain('<script>'); // satır içi betik yok
    expect(govde).not.toMatch(/ style=/);
    // 5 oyun kartı, 1. sıra "bakılacak", diğerleri değil
    expect(govde.match(/<article class="oyun/g)).toHaveLength(5);
    expect(govde.match(/oyun--bakilacak/g)).toHaveLength(1);
  });

  it('onaylı gecede "Onayla" düğmesi yok; olmayan gece 404; geçersiz tarih 400; bilinmeyen adres 404', async () => {
    const k = await kur();
    expect((await k.iste('/gece/2026-10-31')).govde).not.toContain('Onayla (değişiklik yokken)');
    expect((await k.iste('/gece/2026-10-30')).durum).toBe(404);
    expect((await k.iste('/gece/2026-13-45')).durum).toBe(400);
    expect((await k.iste('/yok')).durum).toBe(404);
    expect((await k.iste('/gece/..%2f..%2fpackage.json')).durum).toBe(404);
  });

  it('sözlük sayfası kayıtları ve formu gösterir', async () => {
    const k = await kur();
    const { govde } = await k.iste('/sozluk');
    expect(govde).toContain('Svi Mykhailiuk');
    expect(govde).toContain('Sviatoslav Mykhailiuk');
    expect(govde).toContain('name="takma"');
  });

  it('HTML kaçırma: dosyadaki özel karakterler sayfaya ham girmez', async () => {
    const k = await kur({ [GECE_YOLU]: geceMetni().replace('A lobs to B for the slam.', '<img src=x onerror=alert(1)> "q"'), [SOZLUK_YOLU]: SOZLUK_METNI });
    const { govde } = await k.iste('/gece/2026-11-01');
    expect(govde).not.toContain('<img src=x');
    expect(govde).toContain('&lt;img src=x onerror=alert(1)&gt; &quot;q&quot;');
  });
});

describe('kaydetme', () => {
  it('Kaydet: elle_duzenlendi true, inceleme bekliyor kalır, kontrol/zaman korunur; commit okunan sha ve main ile; mesaj "top10: elle düzenleme <tarih>"', async () => {
    const k = await kur();
    const sha = shaAl((await k.iste('/gece/2026-11-01')).govde);
    const d = durumlar();
    d[0]!.katkilar[0]!.oyuncu = 'Braden Burries'; // takma ad → kanonik ada çevrilir
    d[0]!.katkilar[0]!.takim = 'SAS';
    d[0]!.etiketler = ['poster', 'clutch'];
    d[0]!.aciklama = 'Düzeltilmiş açıklama';
    const r = await k.iste('/gece/2026-11-01', { form: durumdanForm(d, { sha, islem: 'kaydet' }) });
    expect(r.durum).toBe(303);
    expect(r.basliklar.get('Location')).toBe('/gece/2026-11-01?ok=kaydedildi');
    const c = sonCommit(k);
    expect(c).toMatchObject({ mesaj: 'top10: elle düzenleme 2026-11-01', dal: 'main', yol: GECE_YOLU, sha });
    const v = parse(c.metin) as any;
    expect(v).toMatchObject({ elle_duzenlendi: true, inceleme: 'bekliyor', kaynak: 'gemini' });
    expect(v.oyunlar[0].katkilar[0]).toEqual({ oyuncu: 'Brayden Burries', takim: 'SAS', rol: 'pasor', pay: 70 });
    expect(v.oyunlar[0].etiketler).toEqual(['poster', 'clutch']);
    expect(v.oyunlar[0].aciklama).toBe('Düzeltilmiş açıklama');
    expect(v.oyunlar[0].zaman).toBe('02:05');
    expect(v.oyunlar[0].kontrol).toEqual((parse(geceMetni()) as any).oyunlar[0].kontrol);
    // yalnızca bu dosyaya yazıldı
    expect(k.github.istekler.filter((i) => i.yontem === 'PUT').map((i) => i.yol)).toEqual([GECE_YOLU]);
    // sonuç sayfası
    expect((await k.iste('/gece/2026-11-01?ok=kaydedildi')).govde).toContain('Kaydedildi: değişiklik main');
    expect((await k.iste('/gece/2026-11-01')).govde).toContain('Elle düzenlendi (bot dokunmaz)');
  });

  it('clutch tutarlılığı: formda clutch kaldırılsa da kazandıran etiketi varsa eklenir; kayıt sonrası sayfada not görünür', async () => {
    const k = await kur();
    const sha = shaAl((await k.iste('/gece/2026-11-01')).govde);
    const d = durumlar();
    d[0]!.etiketler = ['mac_kazandiran']; // clutch yok
    const r = await k.iste('/gece/2026-11-01', { form: durumdanForm(d, { sha, islem: 'kaydet' }) });
    expect(r.basliklar.get('Location')).toBe('/gece/2026-11-01?ok=kaydedildi&clutch=1');
    expect((parse(sonCommit(k).metin) as any).oyunlar[0].etiketler).toEqual(['mac_kazandiran', 'clutch']);
    const sayfa = (await k.iste(r.basliklar.get('Location')!)).govde;
    expect(sayfa).toContain('Clutch otomatik eklendi (sıra 1)');
    // parametre yalnızca sayı listesi olarak kabul edilir (yansıtma güvenli)
    const kotu = (await k.iste('/gece/2026-11-01?ok=kaydedildi&clutch=<script>x</script>')).govde;
    expect(kotu).not.toContain('Clutch otomatik eklendi');
    expect(kotu).not.toContain('<script>x');
  });

  it('Kaydet ve onayla: inceleme onaylandi, mesaj "top10: onay <tarih>"', async () => {
    const k = await kur();
    const sha = shaAl((await k.iste('/gece/2026-11-01')).govde);
    const r = await k.iste('/gece/2026-11-01', { form: durumdanForm(durumlar(), { sha, islem: 'kaydet-onayla' }) });
    expect(r.basliklar.get('Location')).toBe('/gece/2026-11-01?ok=onaylandi');
    expect(sonCommit(k).mesaj).toBe('top10: onay 2026-11-01');
    expect(parse(sonCommit(k).metin)).toMatchObject({ inceleme: 'onaylandi', elle_duzenlendi: true });
  });

  it('Onayla (değişiklik yokken): yalnızca inceleme (ve elle_duzenlendi) değişir; gönderilen alan değerleri yok sayılır', async () => {
    const k = await kur();
    const sha = shaAl((await k.iste('/gece/2026-11-01')).govde);
    const d = durumlar();
    d[0]!.katkilar[0]!.oyuncu = 'Bu Yok Sayilmali'; // onayla yalnızca onaylar
    const r = await k.iste('/gece/2026-11-01', { form: durumdanForm(d, { sha, islem: 'onayla' }) });
    expect(r.durum).toBe(303);
    const once = parse(geceMetni()) as any;
    const sonra = parse(sonCommit(k).metin) as any;
    expect(sonCommit(k).mesaj).toBe('top10: onay 2026-11-01');
    expect(sonra.inceleme).toBe('onaylandi');
    expect(sonra.elle_duzenlendi).toBe(true);
    expect(sonra.oyunlar).toEqual(once.oyunlar);
  });

  it('değişiklik olmayan "Kaydet" zaten elle_duzenlendi: true olan dosyada commit atmaz', async () => {
    const k = await kur({ [GECE_YOLU]: geceMetni('2026-11-01', 'bekliyor', ['elle_duzenlendi: true']), [SOZLUK_YOLU]: SOZLUK_METNI });
    const sha = shaAl((await k.iste('/gece/2026-11-01')).govde);
    const r = await k.iste('/gece/2026-11-01', { form: durumdanForm(durumlar(), { sha, islem: 'kaydet' }) });
    expect(r.basliklar.get('Location')).toBe('/gece/2026-11-01?ok=degisiklik-yok');
    expect(k.github.commitler).toHaveLength(0);
  });
});

describe('doğrulama hataları', () => {
  it('geçersiz form: 422, satır satır hata, gönderilen değerler korunur, commit yok', async () => {
    const k = await kur();
    const sha = shaAl((await k.iste('/gece/2026-11-01')).govde);
    const d = durumlar();
    d[0]!.katkilar[0]!.takim = 'XYZ';
    d[0]!.katkilar[0]!.oyuncu = 'Yazdığım Yeni Ad';
    d[0]!.aciklama = 'Korunması gereken açıklama';
    d[2]!.bolusum = '50-50'; // 1 katkı için geçersiz
    const r = await k.iste('/gece/2026-11-01', { form: durumdanForm(d, { sha, islem: 'kaydet' }) });
    expect(r.durum).toBe(422);
    expect(k.github.commitler).toHaveLength(0);
    expect(r.govde).toContain('Kaydedilmedi: 2 yerde hata var');
    expect(r.govde).toContain('takım NBA&#39;in 30 kısaltmasından biri olmalı');
    expect(r.govde).toContain('pay bölüşümü katkı sayısına (1) uygun değil');
    expect(r.govde).toContain('value="Yazdığım Yeni Ad"'); // değerler korunur
    expect(r.govde).toContain('Korunması gereken açıklama');
    expect(r.govde.match(/oyun--hata/g)).toHaveLength(2);
    expect(r.govde).toContain('role="alert"');
    expect(shaAl(r.govde)).toBe(sha); // aynı sha ile yeniden gönderilebilir
  });

  it('bilinmeyen işlem ve eksik sha reddedilir', async () => {
    const k = await kur();
    const sha = shaAl((await k.iste('/gece/2026-11-01')).govde);
    expect((await k.iste('/gece/2026-11-01', { form: durumdanForm(durumlar(), { sha, islem: 'sil' }) })).durum).toBe(400);
    expect((await k.iste('/gece/2026-11-01', { form: durumdanForm(durumlar(), { islem: 'kaydet' }) })).durum).toBe(409);
    expect(k.github.commitler).toHaveLength(0);
  });
});

describe('sha çakışması', () => {
  it('dosya okunduktan sonra değişirse (bot/başkası) kaydedilmez: "Dosya değişti, yeniden yükleyin" (409); commit yok', async () => {
    const k = await kur();
    const sha = shaAl((await k.iste('/gece/2026-11-01')).govde);
    k.github.depo.set(GECE_YOLU, geceMetni('2026-11-01', 'onaylandi')); // araya giren commit
    for (const islem of ['kaydet', 'kaydet-onayla', 'onayla']) {
      const r = await k.iste('/gece/2026-11-01', { form: durumdanForm(durumlar(), { sha, islem }) });
      expect(r.durum, islem).toBe(409);
      expect(r.govde).toContain('Dosya değişti, yeniden yükleyin');
    }
    expect(k.github.commitler).toHaveLength(0);
    expect(k.github.istekler.filter((i) => i.yontem === 'PUT')).toHaveLength(0); // sha eski olduğu için PUT bile denenmedi
  });

  it('okuma ile yazma arasında değişirse (GitHub 409) çakışma olarak ele alınır', async () => {
    const k = await kur();
    const sha = shaAl((await k.iste('/gece/2026-11-01')).govde);
    const eskiFetch = k.github.fetch;
    let sayac = 0;
    // GET sonrası, PUT'tan hemen önce dosya değişsin
    k.github.fetch = (async (g: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT' && sayac++ === 0) k.github.depo.set(GECE_YOLU, geceMetni() + '# araya giren\n');
      return eskiFetch(g, init);
    }) as typeof fetch;
    // dep.fetch sahte GitHub'ı doğrudan çağırıyor; yeniden bağla
    const dep2 = { fetch: birlesikFetch(k.github, k.access), simdi: () => k.access.simdi * 1000 };
    const r = await isle(new Request(`${ORIJIN}/gece/2026-11-01`, { method: 'POST', headers: { 'Cf-Access-Jwt-Assertion': k.jwt, Origin: ORIJIN, 'Content-Type': 'application/x-www-form-urlencoded' }, body: durumdanForm(durumlar(), { sha, islem: 'kaydet' }).toString() }), k.env, dep2);
    expect(r.status).toBe(409);
    expect(await r.text()).toContain('Dosya değişti');
    expect(k.github.commitler).toHaveLength(0);
  });
});

describe('ad sözlüğü', () => {
  it('geçerli ekleme: sözlük dosyasına commit ("top10: ad sözlüğü"), yalnızca sözlük yolu', async () => {
    const k = await kur();
    const sha = shaAl((await k.iste('/sozluk')).govde);
    const r = await k.iste('/sozluk', { form: new URLSearchParams({ sha, kanonik: 'Mikel Brown Jr.', takma: 'Michael Brown Jr.' }) });
    expect(r.durum).toBe(303);
    expect(r.basliklar.get('Location')).toBe('/sozluk?ok=eklendi');
    expect(sonCommit(k)).toMatchObject({ mesaj: 'top10: ad sözlüğü', yol: SOZLUK_YOLU, dal: 'main' });
    expect(sonCommit(k).metin).toContain('Mikel Brown Jr.: [Michael Brown Jr.]');
    expect(sonCommit(k).metin).toContain('Svi Mykhailiuk: [Sviatoslav Mykhailiuk]'); // diğer satırlar aynen
  });

  it('kurallara uymayan ekleme reddedilir (422), commit yok, girilen değerler korunur', async () => {
    const k = await kur();
    const sha = shaAl((await k.iste('/sozluk')).govde);
    const r = await k.iste('/sozluk', { form: new URLSearchParams({ sha, kanonik: 'Baska Oyuncu', takma: 'Sviatoslav Mykhailiuk' }) });
    expect(r.durum).toBe(422);
    expect(r.govde).toContain('Eklenmedi:');
    expect(r.govde).toContain('iki kanonik ada');
    expect(r.govde).toContain('value="Baska Oyuncu"');
    expect(k.github.commitler).toHaveLength(0);
  });

  it('sözlük dosyası değişmişse (sha) kaydedilmez', async () => {
    const k = await kur();
    const sha = shaAl((await k.iste('/sozluk')).govde);
    k.github.depo.set(SOZLUK_YOLU, SOZLUK_METNI + 'Ada Bee: [A. Bee]\n');
    const r = await k.iste('/sozluk', { form: new URLSearchParams({ sha, kanonik: 'Cem Dee', takma: 'C. Dee' }) });
    expect(r.durum).toBe(409);
    expect(k.github.commitler).toHaveLength(0);
  });
});

describe('güvenlik', () => {
  it('POST başka kaynaktan (Origin uyuşmuyor) ya da Origin/Sec-Fetch-Site yoksa reddedilir (CSRF)', async () => {
    const k = await kur();
    const sha = shaAl((await k.iste('/gece/2026-11-01')).govde);
    const form = durumdanForm(durumlar(), { sha, islem: 'onayla' });
    expect((await k.iste('/gece/2026-11-01', { form, basliklar: { Origin: 'https://kotu.example' } })).durum).toBe(403);
    expect((await k.iste('/gece/2026-11-01', { form, basliklar: { Origin: 'null' } })).durum).toBe(403);
    const r = await isle(new Request(`${ORIJIN}/gece/2026-11-01`, { method: 'POST', headers: { 'Cf-Access-Jwt-Assertion': k.jwt, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() }), k.env, k.dep);
    expect(r.status).toBe(403);
    expect(k.github.commitler).toHaveLength(0);
  });

  it('desteklenmeyen yöntem 405; beyaz liste dışı yol GitHub\'a gitmez', async () => {
    const k = await kur();
    expect((await k.iste('/', { yontem: 'DELETE' })).durum).toBe(405);
    expect((await k.iste('/', { yontem: 'PUT' })).durum).toBe(405);
    expect(k.github.istekler).toHaveLength(0);
    await k.iste('/gece/2026-11-01');
    for (const i of k.github.istekler) expect([GECE_YOLU, SOZLUK_YOLU]).toContain(i.yol);
  });

  it('GitHub token hiçbir yanıtta (gövde ya da başlık) görünmez: başarı, hata, çakışma, GitHub hatası dahil', async () => {
    const k = await kur();
    const sha = shaAl((await k.iste('/gece/2026-11-01')).govde);
    await k.iste('/');
    await k.iste('/sozluk');
    const d = durumlar();
    d[0]!.katkilar[0]!.takim = 'XYZ';
    await k.iste('/gece/2026-11-01', { form: durumdanForm(d, { sha, islem: 'kaydet' }) }); // 422
    await k.iste('/gece/2026-11-01', { form: durumdanForm(durumlar(), { sha: 'e'.repeat(40), islem: 'kaydet' }) }); // 409
    await k.iste('/gece/2026-11-01', { form: durumdanForm(durumlar(), { sha, islem: 'kaydet-onayla' }) }); // 303
    await k.iste('/yok');
    await k.iste('/', { jwt: null });
    // GitHub token'ı içeren bir hata ile patlarsa
    const patlayan = { fetch: (async (g: RequestInfo | URL) => (String(g).startsWith(TAKIM) ? k.access.certFetch() : Promise.reject(new Error(`bağlantı hatası ${TOKEN}`)))) as typeof fetch, simdi: () => k.access.simdi * 1000 };
    const r = await isle(new Request(`${ORIJIN}/`, { headers: { 'Cf-Access-Jwt-Assertion': k.jwt } }), k.env, patlayan);
    expect(r.status).toBe(500);
    k.yanitlar.push({ govde: await r.text(), basliklar: JSON.stringify([...r.headers]) });
    const gh401 = { fetch: (async (g: RequestInfo | URL) => (String(g).startsWith(TAKIM) ? k.access.certFetch() : new Response(`Bad credentials ${TOKEN}`, { status: 401 }))) as typeof fetch, simdi: () => k.access.simdi * 1000 };
    const r2 = await isle(new Request(`${ORIJIN}/`, { headers: { 'Cf-Access-Jwt-Assertion': k.jwt } }), k.env, gh401);
    k.yanitlar.push({ govde: await r2.text(), basliklar: JSON.stringify([...r2.headers]) });
    for (const y of k.yanitlar) {
      expect(y.govde).not.toContain(TOKEN);
      expect(y.basliklar).not.toContain(TOKEN);
      expect(y.govde).not.toContain('ghp_');
    }
    expect(k.yanitlar.length).toBeGreaterThan(8);
    // token yalnızca GitHub isteklerinin Authorization başlığında kullanıldı
    for (const i of k.github.istekler) expect(i.yetki).toBe(`Bearer ${TOKEN}`);
    // AUD ve takım alanı gibi yapılandırma değerleri de sayfalara yazılmaz
    for (const y of k.yanitlar) expect(y.govde).not.toContain(AUD);
  });

  it('GITHUB_TOKEN_KONTROL tanımsızsa anlaşılır hata (500) ve token adı dışında ayrıntı yok', async () => {
    const k = await kur(undefined, { GITHUB_TOKEN_KONTROL: undefined });
    const r = await k.iste('/');
    expect(r.durum).toBe(500);
    expect(r.govde).toContain('GITHUB_TOKEN_KONTROL');
  });

  it('sahte GitHub adresi (GITHUB_API_TABANI) yalnızca geliştirme bayrağıyla kullanılır: production\'da yok sayılır, token api.github.com\'a gider', async () => {
    const k = await kur(undefined, { GITHUB_API_TABANI: 'https://kotu.example' });
    await k.iste('/');
    expect(k.github.istekler.length).toBeGreaterThan(0); // istekler api.github.com'a gitti (sahte kotu.example'a gitseydi birlesikFetch hata verirdi)
  });
});

describe('NBA verisi (/nba): bayatlık uyarısı ve yapıştırarak güncelleme', () => {
  const bugunDe = (k: Kurulum) => bugunIstanbul(k.dep.simdi());
  const dosyalarla = (dunk: string | null, clutch: string | null): Record<string, string> => ({
    [GECE_YOLU]: geceMetni(),
    [SOZLUK_YOLU]: SOZLUK_METNI,
    ...(dunk !== null ? { [NBA_DUNK_YOLU]: dunk } : {}),
    ...(clutch !== null ? { [NBA_CLUTCH_YOLU]: clutch } : {}),
  });
  const a = dunkSatiri('Ada Aksoy', '10/31/2026', '100.0');
  const b = dunkSatiri('Bora Berk', '11/1/2026', '90.0');
  const sayfa = (...satirlar: string[]) => ['Glossary', '300 Rows', DUNK_BASLIK, ...satirlar].join('\n');
  const yapistir = (k: Kurulum, sha: string, veri: string, mod = 'degistir', kod = 'dunk-score') => k.iste(`/nba/${kod}`, { form: new URLSearchParams({ sha, veri, mod }) });
  const bayat = '2020-01-01';

  it('/nba: iki tablo, durum mesajı, satır sayısı, NBA sayfasına yeni sekme bağlantısı; bayat tabloda uyarı (alert), güncelde durum', async () => {
    const k = await kur(dosyalarla(dunkMetni(bayat, a, b), clutchMetni(bugunIstanbul(Date.now()), clutchSatiri('1', 'Tyrese Maxey', 'PHI'))));
    const { durum, govde } = await k.iste('/nba');
    expect(durum).toBe(200);
    expect(govde).toContain('>Dunk Score</h2>');
    expect(govde).toContain('>Clutch</h2>');
    expect(govde).toContain('gündür güncellenmedi (en çok 3 gün olmalı)');
    expect(govde).toMatch(/class="duyuru duyuru-hata" role="alert">\d+ gündür güncellenmedi/);
    expect(govde).toContain('Bugün güncellendi.');
    expect(govde).toContain('<li>2 satır</li>');
    expect(govde).toContain('<li>Son güncelleme: 2020-01-01</li>');
    expect(govde).toContain('href="https://www.nba.com/stats/players/dunk-scores" target="_blank" rel="noopener noreferrer"');
    expect(govde).toContain('action="/nba/dunk-score"');
    expect(govde).toContain('action="/nba/clutch"');
    expect(govde).toMatch(/name="mod" value="degistir" checked/);
    expect(govde).toContain('href="/nba" aria-current="page"');
  });

  it('liste sayfası: bayat tablo için "NBA verisi güncellenmeli" uyarısı ve /nba bağlantısı; ikisi de güncelse uyarı yok', async () => {
    const k1 = await kur(dosyalarla(dunkMetni(bayat, a), clutchMetni(bayat, clutchSatiri('1', 'Tyrese Maxey', 'PHI'))));
    const l1 = await k1.iste('/');
    expect(l1.govde).toContain('NBA verisi güncellenmeli');
    expect(l1.govde).toContain('href="/nba#dunk-score"');
    expect(l1.govde).toContain('href="/nba#clutch"');
    expect(l1.govde.indexOf('NBA verisi güncellenmeli')).toBeLessThan(l1.govde.indexOf('Bekleyen geceler'));

    const bugun = bugunIstanbul(Date.now());
    const k2 = await kur(dosyalarla(dunkMetni(bugun, a), clutchMetni(bugun, clutchSatiri('1', 'Tyrese Maxey', 'PHI'))));
    expect((await k2.iste('/')).govde).not.toContain('NBA verisi güncellenmeli');
  });

  it('dosya repoda yoksa: liste uyarır, /nba "dosya repoda yok" der ve form göstermez; POST 404 (yeni dosya oluşturulmaz)', async () => {
    const k = await kur(dosyalarla(null, null));
    expect((await k.iste('/')).govde).toContain('NBA verisi güncellenmeli');
    const g = await k.iste('/nba');
    expect(g.govde).toContain('Dosya repoda yok');
    expect(g.govde).not.toContain('action="/nba/dunk-score"');
    const p = await yapistir(k, 'x'.repeat(40), sayfa(DUNK_BASLIK, a));
    expect(p.durum).toBe(404);
    expect(k.github.commitler).toHaveLength(0);
  });

  it('geçerli yapıştırma: main\'e commit (yol, ileti, damga + temizlenmiş içerik), 303 ile /nba, başarı notu; clutch dosyasına dokunulmaz', async () => {
    const eski = dunkMetni(bayat, a);
    const k = await kur(dosyalarla(eski, clutchMetni(bayat, clutchSatiri('1', 'Tyrese Maxey', 'PHI'))));
    const sha = await k.github.sha(NBA_DUNK_YOLU);
    const r = await yapistir(k, sha, sayfa(a, b));
    expect(r.durum).toBe(303);
    expect(r.basliklar.get('Location')).toBe('/nba?ok=nba-kaydedildi&kod=dunk-score&satir=2');
    expect(k.github.commitler).toHaveLength(1);
    const c = sonCommit(k);
    expect(c.yol).toBe(NBA_DUNK_YOLU);
    expect(c.mesaj).toBe('nba: dunk-score verisi');
    expect(c.dal).toBe('main');
    expect(c.metin).toBe(`# guncellendi: ${bugunDe(k)}\n${DUNK_BASLIK}\n${a}\n${b}\n`);
    expect(k.github.depo.get(NBA_CLUTCH_YOLU)).toContain(bayat);
    const son = await k.iste('/nba?ok=nba-kaydedildi&kod=dunk-score&satir=2');
    expect(son.govde).toContain('Dunk Score kaydedildi: 2 satır okundu');
  });

  it('"ekle": mevcut satırlar korunur, aynı satır bir kez; başarı notundaki ad ve sayı adresten güvenli biçimde gelir', async () => {
    const k = await kur(dosyalarla(dunkMetni(bayat, a), clutchMetni(bayat)));
    const r = await yapistir(k, await k.github.sha(NBA_DUNK_YOLU), sayfa(a, b), 'ekle');
    expect(r.durum).toBe(303);
    expect(sonCommit(k).metin).toBe(`# guncellendi: ${bugunDe(k)}\n${DUNK_BASLIK}\n${a}\n${b}\n`);
    // adres parametreleri: bilinmeyen kod ve sayı olmayan değer bildirimi göstermez, sayfaya yansımaz
    const kotu = await k.iste('/nba?ok=nba-kaydedildi&kod=<script>&satir=<b>x</b>');
    expect(kotu.govde).not.toContain('<script>');
    expect(kotu.govde).not.toContain('<b>x</b>');
    expect(kotu.govde).not.toContain('kaydedildi:');
  });

  it('bozuk yapıştırma: 422, satır satır hata, gönderilen metin ve seçim korunur, commit yok', async () => {
    const k = await kur(dosyalarla(dunkMetni(bayat, a), clutchMetni(bayat)));
    const veri = sayfa(a, dunkSatiri('Bora Berk', 'bozuk-tarih', '90.0'));
    const r = await yapistir(k, await k.github.sha(NBA_DUNK_YOLU), veri, 'ekle');
    expect(r.durum).toBe(422);
    expect(r.govde).toContain('Kaydedilmedi:');
    expect(r.govde).toContain('geçersiz tarih (bozuk-tarih)');
    expect(r.govde).toContain('Bora Berk');
    expect(r.govde).toMatch(/name="mod" value="ekle" checked/);
    expect(k.github.commitler).toHaveLength(0);
    // sekmesiz/boş metin
    const bos = await yapistir(k, await k.github.sha(NBA_DUNK_YOLU), 'sadece düz yazı');
    expect(bos.durum).toBe(422);
    expect(bos.govde).toContain('sekmeyle ayrılmış');
    expect(k.github.commitler).toHaveLength(0);
  });

  it('formda ya da dosyada HTML varsa sayfada kaçırılır (XSS yok)', async () => {
    const k = await kur(dosyalarla(dunkMetni(bayat, a), clutchMetni(bayat)));
    const r = await yapistir(k, await k.github.sha(NBA_DUNK_YOLU), sayfa('<img src=x onerror=alert(1)>\t<script>x</script>'));
    expect(r.durum).toBe(422);
    expect(r.govde).not.toContain('<img src=x');
    expect(r.govde).not.toContain('<script>x');
    expect(r.govde).toContain('&lt;img src=x');
  });

  it('sha çakışması: dosya arada değiştiyse 409 ve commit yok; sha eksikse de', async () => {
    const k = await kur(dosyalarla(dunkMetni(bayat, a), clutchMetni(bayat)));
    const eskiSha = await k.github.sha(NBA_DUNK_YOLU);
    k.github.depo.set(NBA_DUNK_YOLU, dunkMetni('2026-11-10', a, b)); // başka biri değiştirdi
    const r = await yapistir(k, eskiSha, sayfa(a));
    expect(r.durum).toBe(409);
    expect(r.govde).toContain('Dosya değişti');
    const eksik = await yapistir(k, '', sayfa(a));
    expect(eksik.durum).toBe(409);
    expect(k.github.commitler).toHaveLength(0);
  });

  it('bilinmeyen tablo kodu 404; GET ile POST rotası çalışmaz; çapraz kaynaklı POST 403; JWT yoksa 403 ve GitHub\'a istek yok', async () => {
    const k = await kur(dosyalarla(dunkMetni(bayat, a), clutchMetni(bayat)));
    expect((await yapistir(k, 'x', sayfa(a), 'degistir', 'baska')).durum).toBe(404);
    expect((await yapistir(k, 'x', sayfa(a), 'degistir', 'toString')).durum).toBe(404);
    expect((await k.iste('/nba/dunk-score')).durum).toBe(404);
    const capraz = await k.iste('/nba/dunk-score', { form: new URLSearchParams({ sha: 'x', veri: sayfa(a) }), basliklar: { Origin: 'https://kotu.example' } });
    expect(capraz.durum).toBe(403);
    const k2 = await kur(dosyalarla(dunkMetni(bayat, a), clutchMetni(bayat)));
    expect((await k2.iste('/nba', { jwt: null })).durum).toBe(403);
    expect((await k2.iste('/nba/dunk-score', { form: new URLSearchParams({ sha: 'x', veri: sayfa(a) }), jwt: null })).durum).toBe(403);
    expect(k2.github.istekler).toHaveLength(0);
    expect(k.github.commitler).toHaveLength(0);
  });

  it('GitHub yalnızca beyaz listeli yollara gider (NBA için tam iki dosya); token hiçbir NBA sayfasına yazılmaz', async () => {
    const k = await kur(dosyalarla(dunkMetni(bayat, a), clutchMetni(bayat)));
    await k.iste('/nba');
    await yapistir(k, await k.github.sha(NBA_DUNK_YOLU), sayfa(a));
    const izinli = new Set([NBA_DUNK_YOLU, NBA_CLUTCH_YOLU]);
    for (const i of k.github.istekler.filter((x) => x.yol.includes('data/nba'))) expect(izinli.has(i.yol), i.yol).toBe(true);
    for (const y of k.yanitlar) {
      expect(y.govde).not.toContain(TOKEN);
      expect(y.govde).not.toContain('ghp_');
    }
  });
});

describe('Worker giriş modülü', () => {
  it('yalnızca varsayılan dışa aktarma (workerd adlandırılmış dışa aktarmaları işleyici sanar)', async () => {
    const m = await import('./index.ts');
    expect(Object.keys(m)).toEqual(['default']);
    expect(typeof m.default.fetch).toBe('function');
  });
});
