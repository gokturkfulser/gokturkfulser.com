// Çoğunluk oylaması: aynı video N kez bağımsız işlenir; her sıra için ayrı ayrı oylanır. Saf fonksiyonlar (ağ yok).
// Gözlem: doğru satırlar çalıştırmalar arasında aynı kalır, yanlışlar her seferinde farklı yanlış adlarla gelir ve model onlara da "yüksek" güven verir;
// bu yüzden güven modelin kendi beyanından değil OYLAMADAN türetilir (oy birliği → yüksek, çoğunluk → orta, uzlaşma yok → düşük).
import { top10Sema } from '../../src/lib/top10-sema.ts';
import { katkiPaylari, type Gece, type Tur } from '../../src/lib/top10.ts';
import { eylemAdi, type Eylem } from '../../src/lib/top10-sozluk.ts';
import { adNormallestir } from './aciklama.ts';
import { sonIsle, type Baglam, type DogrulamaHatasi, type OyBilgisi, type OyunNotu, type Uretilen } from './gece.ts';

type Seviye = OyBilgisi['seviye'];
const SIRALAMA: Seviye[] = ['yuksek', 'orta', 'dusuk'];
const enKotu = (...s: Seviye[]): Seviye => s.reduce((a, b) => (SIRALAMA.indexOf(b) > SIRALAMA.indexOf(a) ? b : a));
/** Oy birliği → yüksek; kesin çoğunluk (> yarı) → orta; aksi → düşük (uzlaşma yok). */
const seviyeOf = (oy: number, toplam: number): Seviye => (oy === toplam ? 'yuksek' : oy * 2 > toplam ? 'orta' : 'dusuk');
const guvenOf = (s: Seviye) => (s === 'yuksek' ? 'high' : s === 'orta' ? 'medium' : 'low') as OyunNotu['guven'];

/** Anahtarları sayar (ilk görülme sırası korunur); kazanan = en çok oy alan, eşitlikte ilk görülen (= en erken çalıştırma). */
function say(anahtarlar: readonly string[]) {
  const sayim = new Map<string, number>();
  for (const a of anahtarlar) sayim.set(a, (sayim.get(a) ?? 0) + 1);
  let kazanan = anahtarlar[0]!;
  for (const [a, n] of sayim) if (n > sayim.get(kazanan)!) kazanan = a;
  return { kazanan, sayi: sayim.get(kazanan)!, sayim };
}

type Oyun = Gece['oyunlar'][number];
const kumeAnahtari = (o: Oyun) => [...new Set(o.katkilar.map((k) => adNormallestir(k.oyuncu)))].sort().join('|');
const payHaritasi = (o: Oyun) => new Map(o.katkilar.map((k, i) => [adNormallestir(k.oyuncu), katkiPaylari(o.katkilar)[i]!] as const));
const payAnahtari = (o: Oyun) => [...payHaritasi(o)].sort(([a], [b]) => a.localeCompare(b)).map(([a, p]) => `${a}:${p}`).join(',');
const adlar = (o: Oyun) => o.katkilar.map((k) => k.oyuncu).join(' + ');
const payMetni = (o: Oyun) => katkiPaylari(o.katkilar).join('/');
const cogu = (degerler: readonly string[]) => say(degerler).kazanan;

export type OylamaSecenek = {
  /** Sözlükteki kanonik adlar (normalleştirilmiş): birleştirmede yazım önceliği 1. */
  kanonik?: ReadonlySet<string>;
  /** Mevcut top10 verisinde geçen adlar (normalleştirilmiş → yazım): yazım önceliği 2. */
  mevcut?: ReadonlyMap<string, string>;
};

const soyadi = (norm: string) => norm.split(' ').at(-1) ?? '';

/**
 * Aynı sıradaki çalıştırmalar arasında aynı kişiyi farklı yazan adları birleştirir: aynı normalleştirilmiş ad YA DA aynı takım + aynı normalleştirilmiş soyadı.
 * Yalnızca aynı sıra içinde ve aynı takımda; bir çalıştırmanın aynı satırındaki iki katkı sahibi asla birleştirilmez (ayrı kişilerdir).
 * Yazım önceliği: sözlükteki kanonik ad, sonra mevcut top10 verisinde geçen yazım, sonra çoğunluk yazımı (eşitlikte ilk çalıştırma).
 * Girdiyi değiştirmez. Birden çok farklı yazım birleştiğinde "olası takma ad: X → Y, sözlüğe ekle" önerisi üretir (sözlüğü betik yazmaz).
 */
export function adlariBirlestir(calismalar: readonly Uretilen[], secenek: OylamaSecenek = {}): { calismalar: Uretilen[]; oneriler: Map<number, string[]> } {
  const oneriler = new Map<number, string[]>();
  const yeni: Uretilen[] = calismalar.map((c) => ({ ...c, gece: { ...c.gece, oyunlar: c.gece.oyunlar.map((o) => ({ ...o, katkilar: o.katkilar.map((k) => ({ ...k })) })) } }));
  const siralar = [...new Set(yeni.flatMap((c) => c.gece.oyunlar.map((o) => o.sira)))];
  for (const sira of siralar) {
    const girdiler = yeni.flatMap((c, run) => (c.gece.oyunlar.find((o) => o.sira === sira)?.katkilar ?? []).map((k) => ({ run, k, norm: adNormallestir(k.oyuncu) })));
    const ebeveyn = girdiler.map((_, i) => i);
    const calismaKumesi = girdiler.map((g) => new Set([g.run]));
    const kok = (i: number): number => (ebeveyn[i] === i ? i : (ebeveyn[i] = kok(ebeveyn[i]!)));
    for (let i = 0; i < girdiler.length; i++) {
      for (let j = i + 1; j < girdiler.length; j++) {
        const a = girdiler[i]!;
        const b = girdiler[j]!;
        if (a.run === b.run) continue;
        const ayniKisi = a.norm === b.norm || (a.k.takim === b.k.takim && soyadi(a.norm) !== '' && soyadi(a.norm) === soyadi(b.norm));
        if (!ayniKisi) continue;
        const ka = kok(i);
        const kb = kok(j);
        if (ka === kb || [...calismaKumesi[ka]!].some((r) => calismaKumesi[kb]!.has(r))) continue; // aynı çalıştırmadan iki giriş = ayrı kişiler
        ebeveyn[kb] = ka;
        for (const r of calismaKumesi[kb]!) calismaKumesi[ka]!.add(r);
      }
    }
    const kumeler = new Map<number, typeof girdiler>();
    girdiler.forEach((g, i) => kumeler.set(kok(i), [...(kumeler.get(kok(i)) ?? []), g]));
    for (const uyeler of kumeler.values()) {
      const normlar = [...new Set(uyeler.map((u) => u.norm))];
      const sozlukte = uyeler.find((u) => secenek.kanonik?.has(u.norm));
      const mevcutNorm = normlar.find((n) => secenek.mevcut?.has(n));
      const secilen = sozlukte ? sozlukte.k.oyuncu : mevcutNorm ? secenek.mevcut!.get(mevcutNorm)! : say(uyeler.map((u) => u.k.oyuncu)).kazanan;
      const secilenNorm = adNormallestir(secilen);
      const varyantlar = normlar.filter((n) => n !== secilenNorm).map((n) => uyeler.find((u) => u.norm === n)!.k.oyuncu);
      for (const u of uyeler) u.k.oyuncu = secilen;
      if (varyantlar.length) oneriler.set(sira, [...(oneriler.get(sira) ?? []), ...varyantlar.map((v) => `olası takma ad: ${v} → ${secilen}, sözlüğe ekle`)]);
    }
  }
  return { calismalar: yeni, oneriler };
}

export type OylamaSonucu = { tur: Tur; oyunlar: Record<string, unknown>[]; notlar: OyunNotu[]; calismaSayisi: number };

/**
 * Geçerli çalıştırmaları (her biri tek başına doğrulamadan geçmiş) oylar. Oyun sayısı (tür) çalıştırmalar arasında farklıysa çoğunluk, yoksa hata.
 * `enAz`: oylamaya girecek en az geçerli çalıştırma sayısı (N ≥ 2 için 2; N = 1 için 1).
 */
export function oyla(ilkCalismalar: readonly Uretilen[], enAz: number, secenek: OylamaSecenek = {}): DogrulamaHatasi | OylamaSonucu {
  const calismalar = ilkCalismalar;
  if (calismalar.length < enAz) return { hata: `geçerli çalıştırma sayısı ${calismalar.length}; oylama için en az ${enAz} gerekir` };
  const turler = say(calismalar.map((c) => c.gece.tur));
  if (calismalar.length > 1 && turler.sayi * 2 <= calismalar.length) {
    return { hata: `çalıştırmalar oyun sayısında (tür) uzlaşmadı: ${[...turler.sayim].map(([t, n]) => `${t === 'top10' ? 'Top 10' : 'Top 5'} ${n}/${calismalar.length}`).join(', ')}` };
  }
  const turUyanlar = calismalar.filter((c) => c.gece.tur === turler.kazanan);
  if (turUyanlar.length < enAz) return { hata: `tür çoğunluğuna uyan geçerli çalıştırma sayısı ${turUyanlar.length}; oylama için en az ${enAz} gerekir` };
  // Aynı kişiyi farklı yazan adlar oylamadan önce birleştirilir.
  const { calismalar: calis, oneriler } = adlariBirlestir(turUyanlar, secenek);
  const m = calis.length;
  const siralar = calis[0]!.gece.oyunlar.map((o) => o.sira).sort((a, b) => a - b);
  const oyunlar: Record<string, unknown>[] = [];
  const notlar: OyunNotu[] = [];

  for (const sira of siralar) {
    const satirlar = calis.map((c) => c.gece.oyunlar.find((o) => o.sira === sira)!);
    const satirNotlari = calis.map((c) => c.oyunNotlari.find((n) => n.sira === sira)!);

    // 1) katkı sahipleri kümesi (normalleştirilmiş adlarla)
    const kume = say(satirlar.map(kumeAnahtari));
    const grupIdx = satirlar.map((o, i) => (kumeAnahtari(o) === kume.kazanan ? i : -1)).filter((i) => i >= 0);
    const grup = grupIdx.map((i) => satirlar[i]!);
    const ilk = grup[0]!;
    const kumeSeviye = seviyeOf(kume.sayi, m);
    const uzlasmaYok = m > 1 && kume.sayi * 2 <= m;

    // 2) eylem (tüm çalıştırmalar)
    const eylem = say(satirlar.map((o) => o.eylem ?? '-'));
    const eylemSeviye = seviyeOf(eylem.sayi, m);

    // 3) seçilen küme içinde pay bölüşümü: kesin çoğunluk yoksa eşit bölüşüm
    const pay = say(grup.map(payAnahtari));
    const payCogunluk = pay.sayi * 2 > grup.length;
    const paySeviye = seviyeOf(pay.sayi, grup.length);
    const secilenPay = payCogunluk ? payHaritasi(grup.find((o) => payAnahtari(o) === pay.kazanan)!) : undefined;
    const esit = katkiPaylari(ilk.katkilar.map((k) => ({ oyuncu: k.oyuncu })));

    // 4) katkılar: ad/sıra ilk çalıştırmadan; takım ve rol grupta çoğunluktan
    const katkilar = ilk.katkilar.map((k, i) => {
      const n = adNormallestir(k.oyuncu);
      const ayni = grup.flatMap((o) => o.katkilar.filter((x) => adNormallestir(x.oyuncu) === n));
      return { oyuncu: k.oyuncu, takim: cogu(ayni.map((x) => x.takim)), rol: cogu(ayni.map((x) => x.rol)), pay: secilenPay ? secilenPay.get(n)! : esit[i]! };
    });

    // 5) rakip, açıklama, zaman: çoğunluk kümesini veren ilk çalıştırmadan; etiketler: grubun çoğunda geçenler
    const etiketSayim = new Map<string, number>();
    for (const e of grup.flatMap((o) => o.etiketler ?? [])) etiketSayim.set(e, (etiketSayim.get(e) ?? 0) + 1);
    const etiketler = [...etiketSayim].filter(([, n]) => n * 2 > grup.length).map(([e]) => e);
    const oyun: Record<string, unknown> = { sira, ...(eylem.kazanan !== '-' ? { eylem: eylem.kazanan } : {}) };
    if (etiketler.length) oyun.etiketler = etiketler;
    if (ilk.aciklama) oyun.aciklama = ilk.aciklama;
    if (ilk.rakip) oyun.rakip = ilk.rakip;
    if (ilk.zaman) oyun.zaman = ilk.zaman;
    oyun.katkilar = katkilar;
    oyunlar.push(oyun);

    // 6) oy bilgisi ve azınlıkta kalan alternatifler
    const alternatifler: string[] = [];
    for (const [anahtar, n] of kume.sayim) if (anahtar !== kume.kazanan) alternatifler.push(`diğer: ${adlar(satirlar[satirlar.findIndex((o) => kumeAnahtari(o) === anahtar)]!)} ${n}/${m}`);
    for (const [e, n] of eylem.sayim) if (e !== eylem.kazanan) alternatifler.push(`eylem diğer: ${e === '-' ? 'eylem yok' : eylemAdi(e as Eylem, 'tr')} ${n}/${m}`);
    for (const [anahtar, n] of pay.sayim) if (anahtar !== (payCogunluk ? pay.kazanan : '')) alternatifler.push(`pay diğer: ${payMetni(grup.find((o) => payAnahtari(o) === anahtar)!)} ${n}/${grup.length}`);
    const seviye = enKotu(kumeSeviye, eylemSeviye, paySeviye);
    const oy: OyBilgisi = { oran: `${kume.sayi}/${m}`, eylemOran: `${eylem.sayi}/${m}`, payOran: `${pay.sayi}/${grup.length}`, seviye, uzlasmaYok, alternatifler };
    const ilkNot = satirNotlari[grupIdx[0]!]!;
    notlar.push({
      sira,
      guven: guvenOf(seviye),
      payNedeni: katkilar.length > 1 ? satirNotlari.filter((_, i) => grupIdx.includes(i)).map((n) => n.payNedeni).find(Boolean) : undefined,
      payli: katkilar.length > 1,
      zaman: ilk.zaman,
      zamanUyari: ilkNot.zamanUyari,
      adUyarilari: [],
      aciklamadaYok: [],
      takmaAdOnerileri: oneriler.get(sira),
      oy,
      modelGuvenleri: satirNotlari.map((n) => ({ guven: n.guven, neden: n.guvenNedeni })),
    });
  }
  return { tur: turler.kazanan as Tur, oyunlar, notlar, calismaSayisi: m };
}

/** Oylama + şema + son işlemler (açıklama kontrolü, eylem/pay uyarısı, ad benzerliği, YAML). */
export function oylamaSonrasi(
  calismalar: readonly Uretilen[],
  baglam: Baglam,
  mevcutGeceler: readonly Gece[],
  enAz: number,
  /** Sözlükteki kanonik adlar (birleştirmede yazım önceliği 1). */
  kanonikAdlar: readonly string[] = [],
): DogrulamaHatasi | (Uretilen & { calismaSayisi: number }) {
  const mevcut = new Map<string, string>();
  for (const g of mevcutGeceler) for (const o of g.oyunlar) for (const k of o.katkilar) mevcut.set(adNormallestir(k.oyuncu), k.oyuncu);
  const sonuc = oyla(calismalar, enAz, { kanonik: new Set(kanonikAdlar.map(adNormallestir)), mevcut });
  if ('hata' in sonuc) return sonuc;
  const aday = { tarih: baglam.tarih, video: baglam.video, tur: sonuc.tur, kaynak: 'gemini', inceleme: 'bekliyor', oyunlar: sonuc.oyunlar };
  const ayrik = top10Sema.safeParse(aday);
  if (!ayrik.success) {
    const s = ayrik.error.issues[0]!;
    return { hata: `oylama sonucu şemadan geçmedi: ${s.path.join('.') || '(kök)'}: ${s.message}` };
  }
  const uyarilar = [...new Set(calismalar.flatMap((c) => c.uyarilar))].filter((u) => !/açıklama çapraz kontrolü atlandı/.test(u));
  const son = sonIsle(ayrik.data as unknown as Gece, sonuc.notlar, { ...baglam, tur: sonuc.tur }, mevcutGeceler, uyarilar);
  if ('hata' in son) return son;
  return { ...son, calismaSayisi: sonuc.calismaSayisi };
}
