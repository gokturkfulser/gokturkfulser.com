// Top 10 yazı sayfasının ek hesapları: sıralama değişimi, takım toplamı, eylem dağılımı, liderlik serileri ve grafik koordinatları.
// Saf fonksiyonlar: Astro'ya ve içerik koleksiyonuna dokunmaz; puan ve sıralama kuralları top10.ts'ten gelir (burada ikinci kopya yok).
// Birim testleri `top10-ozet.test.ts`'tedir.
import { katkiBirimi, katkiPaylari, kimlik, PUAN_BIRIMI, sezonTablosu, type Gece, type Satir } from './top10.ts';
import { adlariUygula, type AdHaritasi } from './top10-adlar.ts';
import { EYLEM_ANAHTARLARI, type Eylem } from './top10-sozluk.ts';

const artan = (a: Gece, b: Gece) => a.tarih.valueOf() - b.tarih.valueOf();

// ——— Sıralama değişimi ———

/** Bir önceki geceye kadarki sıraya göre fark: yeni (o zaman tabloda yoktu), aynı, yukarı/aşağı `adim` basamak. */
export type Degisim = { tur: 'yeni' } | { tur: 'ayni' } | { tur: 'yukari' | 'asagi'; adim: number };
export type SiralamaSatiri = { satir: Satir; sira: number; degisim: Degisim };

/**
 * Güncel sezon tablosunun ilk `sinir` satırı; her satırda en yeni geceden önceki tabloya göre sıra farkı.
 * Önceki tablo, en yeni gece çıkarılıp aynı kurallarla (top10.ts → sezonTablosu) yeniden hesaplanır; tek gece varsa herkes "yeni"dir.
 */
export function siralamaDegisimi(geceler: readonly Gece[], sinir = 20): SiralamaSatiri[] {
  const sirali = [...geceler].sort(artan);
  const guncel = sezonTablosu(sirali);
  const onceki = new Map(sezonTablosu(sirali.slice(0, -1)).map((s, i) => [s.kimlik, i + 1]));
  return guncel.slice(0, sinir).map((satir, i) => {
    const sira = i + 1;
    const eski = onceki.get(satir.kimlik);
    const degisim: Degisim = eski === undefined ? { tur: 'yeni' } : eski === sira ? { tur: 'ayni' } : { tur: eski > sira ? 'yukari' : 'asagi', adim: Math.abs(eski - sira) };
    return { satir, sira, degisim };
  });
}

/** "+2", "−1" (gerçek eksi işareti), "=" ya da `yeniMetni`; ok ya da üçgen yok. */
export function degisimMetni(d: Degisim, yeniMetni: string): string {
  switch (d.tur) {
    case 'yeni':
      return yeniMetni;
    case 'ayni':
      return '=';
    case 'yukari':
      return `+${d.adim}`;
    case 'asagi':
      return `−${d.adim}`;
  }
}

// ——— Takım toplamı ———

export type TakimSatiri = { takim: string; puanBirim: number; puan: number };

/**
 * Takımın oyuncularının toplam puanı: her katkının puanı, o gecedeki katkıda yazılı takıma gider (oyuncu takım değiştirse de
 * puan o gün oynadığı takımda kalır). Çoktan aza; eşitlikte takım kodu sırasıyla. En çok `sinir` takım.
 */
export function takimToplami(geceler: readonly Gece[], sinir = 10): TakimSatiri[] {
  const toplam = new Map<string, number>();
  for (const gece of geceler) {
    for (const oyun of gece.oyunlar) {
      const paylar = katkiPaylari(oyun.katkilar);
      oyun.katkilar.forEach((k, i) => toplam.set(k.takim, (toplam.get(k.takim) ?? 0) + katkiBirimi(oyun.sira, paylar[i]!)));
    }
  }
  return [...toplam]
    .map(([takim, puanBirim]) => ({ takim, puanBirim, puan: puanBirim / PUAN_BIRIMI }))
    .sort((a, b) => b.puanBirim - a.puanBirim || a.takim.localeCompare(b.takim, 'en'))
    .slice(0, sinir);
}

// ——— Eylem dağılımı ———

export type EylemDagilimi = { dagilim: { eylem: Eylem; sayi: number }[]; belirtilmemis: number; toplam: number };

/** Tüm gecelerdeki oyunların eylem sayıları (çoktan aza; eşitlikte sözlük sırası); eylemi yazılmamış oyunlar ayrı sayılır. */
export function eylemDagilimi(geceler: readonly Gece[]): EylemDagilimi {
  const sayilar = new Map<Eylem, number>();
  let belirtilmemis = 0;
  let toplam = 0;
  for (const gece of geceler) {
    for (const oyun of gece.oyunlar) {
      toplam += 1;
      if (oyun.eylem) sayilar.set(oyun.eylem, (sayilar.get(oyun.eylem) ?? 0) + 1);
      else belirtilmemis += 1;
    }
  }
  const dagilim = EYLEM_ANAHTARLARI.filter((e) => sayilar.has(e))
    .map((eylem) => ({ eylem, sayi: sayilar.get(eylem)! }))
    .sort((a, b) => b.sayi - a.sayi || EYLEM_ANAHTARLARI.indexOf(a.eylem) - EYLEM_ANAHTARLARI.indexOf(b.eylem));
  return { dagilim, belirtilmemis, toplam };
}

// ——— Liderlik serileri ———

export type LiderlikSerisi = { kimlik: string; oyuncu: string; takim: string; /** Her geceden sonraki birikimli puan (geceler dizisiyle aynı uzunluk). */ puanlar: number[] };
export type LiderlikVerisi = { tarihler: Date[]; seriler: LiderlikSerisi[] };

/**
 * Güncel sıralamadaki ilk `n` oyuncunun gece gece birikimli puanı. Her geceden sonraki tablo, sezon tablosuyla aynı kurallarla
 * hesaplanır (top10.ts → sezonTablosu); oyuncu o geceye kadar hiç görünmediyse puanı 0'dır.
 */
export function liderlikSerileri(geceler: readonly Gece[], n = 5): LiderlikVerisi {
  const sirali = [...geceler].sort(artan);
  const ilkler = sezonTablosu(sirali).slice(0, n);
  const seriler: LiderlikSerisi[] = ilkler.map((s) => ({ kimlik: s.kimlik, oyuncu: s.oyuncu, takim: s.takim, puanlar: [] }));
  sirali.forEach((_, i) => {
    const o = new Map(sezonTablosu(sirali.slice(0, i + 1)).map((s) => [s.kimlik, s.puanBirim]));
    for (const seri of seriler) seri.puanlar.push((o.get(seri.kimlik) ?? 0) / PUAN_BIRIMI);
  });
  return { tarihler: sirali.map((g) => g.tarih), seriler };
}

// ——— Grafik koordinatları ———

export type Kenar = { ust: number; sag: number; alt: number; sol: number };

/** Grafik değerlerinin üst sınırı ve eksen adımı: en çok `enCokTik` aralık, adım 1-2-5 dizisinden. */
export function eksenOlcegi(enBuyuk: number, enCokTik = 5): { ust: number; adim: number } {
  if (!(enBuyuk > 0)) return { ust: enCokTik, adim: 1 };
  let ondalik = 1;
  while (ondalik * 10 <= enBuyuk / enCokTik) ondalik *= 10;
  for (const carpan of [1, 2, 5, 10]) {
    const adim = carpan * ondalik;
    if (Math.ceil(enBuyuk / adim) <= enCokTik) return { ust: Math.ceil(enBuyuk / adim) * adim, adim };
  }
  return { ust: Math.ceil(enBuyuk / (10 * ondalik)) * 10 * ondalik, adim: 10 * ondalik };
}

/** Sıralı etiketlerin dikey ortalarını (y) üst üste binmeyecek biçimde yerleştirir; sıra korunur, [ust, alt] aralığında kalır. Girdi sırasıyla döner. */
export function etiketleriYerlestir(girdi: readonly { y: number; yukseklik: number }[], ust: number, alt: number): number[] {
  const sira = girdi.map((g, i) => ({ ...g, i })).sort((a, b) => a.y - b.y || a.i - b.i);
  const p = sira.map((s) => s.y);
  const ara = (a: number, b: number) => (sira[a]!.yukseklik + sira[b]!.yukseklik) / 2;
  const ileri = () => {
    for (let k = 0; k < p.length; k++) {
      p[k] = Math.max(p[k]!, k === 0 ? ust + sira[0]!.yukseklik / 2 : p[k - 1]! + ara(k - 1, k));
    }
  };
  ileri();
  const son = p.length - 1;
  if (son >= 0 && p[son]! + sira[son]!.yukseklik / 2 > alt) {
    p[son] = alt - sira[son]!.yukseklik / 2;
    for (let k = son - 1; k >= 0; k--) p[k] = Math.min(p[k]!, p[k + 1]! - ara(k, k + 1));
    ileri(); // alan yetmiyorsa taşma alttan değil üstten olmasın: yeniden ileri geçiş
  }
  const sonuc: number[] = [];
  sira.forEach((s, k) => (sonuc[s.i] = p[k]!));
  return sonuc;
}

/** Etiketi en çok `enCok` karakterlik satırlara böler (boşluktan ve tireden sonra); tek sözcük uzunsa o satır taşar. */
export function etiketSatirlari(ad: string, enCok = 13): string[] {
  const parcalar = ad.trim().split(/(?<=-)|\s+/).filter(Boolean);
  const satirlar: string[] = [];
  let simdiki = '';
  for (const parca of parcalar) {
    const birlesik = simdiki === '' ? parca : simdiki.endsWith('-') ? simdiki + parca : `${simdiki} ${parca}`;
    if (simdiki === '' || birlesik.length <= enCok) simdiki = birlesik;
    else {
      satirlar.push(simdiki);
      simdiki = parca;
    }
  }
  if (simdiki) satirlar.push(simdiki);
  return satirlar;
}

/** x ekseninde etiketlenecek gece indisleri: ilk, son ve aralarında eşit aralıklı, en çok `enCok` tane (dar grafikte etiketler birbirine değmesin diye 4). */
export function xTikIndeksleri(n: number, enCok = 4): number[] {
  if (n <= 0) return [];
  if (n <= enCok) return Array.from({ length: n }, (_, i) => i);
  return [...new Set(Array.from({ length: enCok }, (_, k) => Math.round((k * (n - 1)) / (enCok - 1))))];
}

export type GrafikDuzeni = {
  genislik: number;
  yukseklik: number;
  /** Çizim alanı: x0..x1, y0 (üst)..y1 (taban). */
  alan: { x0: number; x1: number; y0: number; y1: number };
  eksen: { ust: number; tikler: { deger: number; y: number }[] };
  xTikleri: { indeks: number; x: number }[];
  seriler: {
    kimlik: string;
    oyuncu: string;
    /** "M x y L x y …" */
    yol: string;
    noktalar: { x: number; y: number }[];
    son: { x: number; y: number };
    etiket: { x: number; y: number; satirlar: string[] };
  }[];
};

const yuvarla = (n: number) => Math.round(n * 10) / 10;
/** Grafikte iki oyuncu adı etiketinin arasında kalacak en az boşluk (birim). */
const ETIKET_ARALIGI = 8;

/**
 * Liderlik verisini SVG koordinatlarına çevirir. x: geceler eşit aralıklı (tek geceyse ortada); y: 0'dan `eksenOlcegi` üst sınırına.
 * Her çizginin sonuna oyuncu adı konur; kapışan etiketler `etiketleriYerlestir` ile ayrılır. Tüm sayılar 0,1 hassasiyetinde yuvarlanır.
 */
export function grafikDuzeni(veri: LiderlikVerisi, secenek: { genislik: number; yukseklik: number; kenar: Kenar; satirYuksekligi: number; etiketSatirUzunlugu?: number }): GrafikDuzeni {
  const { genislik, yukseklik, kenar, satirYuksekligi } = secenek;
  const x0 = kenar.sol;
  const x1 = genislik - kenar.sag;
  const y0 = kenar.ust;
  const y1 = yukseklik - kenar.alt;
  const n = veri.tarihler.length;
  const enBuyuk = Math.max(0, ...veri.seriler.flatMap((s) => s.puanlar));
  const { ust, adim } = eksenOlcegi(enBuyuk);
  const xAt = (i: number) => yuvarla(n <= 1 ? (x0 + x1) / 2 : x0 + (i * (x1 - x0)) / (n - 1));
  const yAt = (v: number) => yuvarla(y1 - (v / ust) * (y1 - y0));
  const tikler = Array.from({ length: Math.round(ust / adim) + 1 }, (_, k) => ({ deger: k * adim, y: yAt(k * adim) }));

  const ham = veri.seriler.map((s) => {
    const noktalar = s.puanlar.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
    return { s, noktalar, satirlar: etiketSatirlari(s.oyuncu, secenek.etiketSatirUzunlugu) };
  });
  const etiketY = etiketleriYerlestir(
    // Komşu etiketler tek blok gibi okunmasın diye her etiketin altına/üstüne pay bırakılır (ETIKET_ARALIGI).
    ham.map((h) => ({ y: h.noktalar.at(-1)?.y ?? y1, yukseklik: h.satirlar.length * satirYuksekligi + ETIKET_ARALIGI })),
    y0 - satirYuksekligi / 2,
    y1 + satirYuksekligi / 2,
  );
  return {
    genislik,
    yukseklik,
    alan: { x0, x1, y0, y1 },
    eksen: { ust, tikler },
    xTikleri: xTikIndeksleri(n).map((indeks) => ({ indeks, x: xAt(indeks) })),
    seriler: ham.map((h, i) => ({
      kimlik: h.s.kimlik,
      oyuncu: h.s.oyuncu,
      yol: h.noktalar.map((p, k) => `${k === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' '),
      noktalar: h.noktalar,
      son: h.noktalar.at(-1) ?? { x: x1, y: y1 },
      etiket: { x: yuvarla(x1 + 10), y: yuvarla(etiketY[i]!), satirlar: h.satirlar },
    })),
  };
}

// ——— Yatay çubuk grafiği ———

export type CubukDuzeni = {
  yukseklik: number;
  satirlar: { indeks: number; /** Satırın üst kenarı. */ y: number; /** Çubuğun sol kenarı 0'dır; bu, genişliği. */ cubukGenislik: number; cubukY: number; etiketY: number; sayiX: number; sayiY: number }[];
};

/**
 * Yatay çubuk grafiğinin yerleşimi: her satırda üstte etiket, altında çubuk, çubuğun hemen sağında sayı metni.
 * Çubuk genişliği değerle orantılıdır; en büyük değer `genislik - sayiPayi`'nı doldurur (sayı için yer kalır). Değer 0 ise çubuk yoktur (genişlik 0).
 */
export function cubukDuzeni(degerler: readonly number[], secenek: { genislik: number; satirYuksekligi: number; sayiPayi: number; etiketYuksekligi: number; cubukYuksekligi: number }): CubukDuzeni {
  const { genislik, satirYuksekligi, sayiPayi, etiketYuksekligi, cubukYuksekligi } = secenek;
  const enBuyuk = Math.max(0, ...degerler);
  const alan = Math.max(0, genislik - sayiPayi);
  return {
    yukseklik: degerler.length * satirYuksekligi,
    satirlar: degerler.map((d, indeks) => {
      const y = indeks * satirYuksekligi;
      const cubukGenislik = enBuyuk > 0 ? yuvarla((d / enBuyuk) * alan) : 0;
      const cubukY = y + etiketYuksekligi + 4;
      return { indeks, y, cubukGenislik, cubukY, etiketY: y + etiketYuksekligi - 3, sayiX: cubukGenislik + 8, sayiY: cubukY + cubukYuksekligi - 2 };
    }),
  };
}

// ——— Rakip ve yetenek listeleri ———

export type SayimSatiri = {
  kimlik: string;
  /** Son görünmedeki yazım. */
  oyuncu: string;
  /** Hareket sayısı (puan değil). */
  sayi: number;
  sonGorunme: Date;
  /** Yalnızca `rakipToplam` satırlarında: hangi türden kaç kez rakip olduğu (bir oyun birden çok türde olabilir; toplam `sayi`'dan büyük çıkabilir). */
  dagilim?: { posterlenen: number; bloklanan: number; calimlanan: number };
};
export type SayimListeleri = {
  /** Poster, blok ya da çalım oyunlarında rakip olanlar, oyun başına bir kez (üç rakip listesinin toplamı). */
  rakipToplam: SayimSatiri[];
  /** Poster etiketli oyunların rakibi: en çok posterlenenler. */
  posterlenen: SayimSatiri[];
  /** Eylemi blok olan oyunların rakibi: en çok bloklananlar. */
  bloklanan: SayimSatiri[];
  /** Eylemi çalım ya da etiketi crossover olan oyunların rakibi (aynı oyun bir kez): en çok çalımlananlar. */
  calimlanan: SayimSatiri[];
  /** Poster etiketli oyunlarda rolü bitiren olan katkı sahipleri. */
  posterBasan: SayimSatiri[];
  /** Eyleme bakmadan rolü bloklayan olan tüm katkı sahipleri (örn. eylemi smaç olan blok + hızlı hücum oyunu da sayılır); eylemi blok olup bloklayan rolü yoksa ve tek katkı varsa o kişi. Aynı oyunda aynı kişi bir kez. */
  blokYapan: SayimSatiri[];
};

/**
 * Hareket sayılarına göre beş liste (puan değil), her biri ilk `sinir`: çoktan aza; eşitlikte daha yeni son görünme, sonra ad.
 * Rakibi boş oyunlar rakip listelerine girmez. `harita` verilirse adlar önce ad sözlüğüyle kanonik ada çevrilir (içerik katmanı
 * adları zaten çevirmiş olarak verir); oyuncular slug'a (top10.ts → kimlik) göre birleşir.
 */
export function sayimListeleri(geceler: readonly Gece[], sinir = 5, harita?: AdHaritasi): SayimListeleri {
  const kaynak = harita ? adlariUygula(geceler, harita) : [...geceler];
  type Sayac = Map<string, SayimSatiri>;
  const yeni = (): Sayac => new Map();
  const l = { rakipToplam: yeni(), posterlenen: yeni(), bloklanan: yeni(), calimlanan: yeni(), posterBasan: yeni(), blokYapan: yeni() };
  const say = (sayac: Sayac, ad: string, tarih: Date) => {
    const k = kimlik(ad);
    const m = sayac.get(k);
    if (!m) sayac.set(k, { kimlik: k, oyuncu: ad, sayi: 1, sonGorunme: tarih });
    else {
      m.sayi += 1;
      if (tarih.valueOf() >= m.sonGorunme.valueOf()) Object.assign(m, { oyuncu: ad, sonGorunme: tarih });
    }
  };
  for (const gece of [...kaynak].sort(artan)) {
    for (const o of gece.oyunlar) {
      const poster = o.etiketler?.includes('poster') ?? false;
      const blok = o.eylem === 'blok';
      const calim = o.eylem === 'calim' || (o.etiketler?.includes('crossover') ?? false);
      if (o.rakip) {
        if (poster || blok || calim) say(l.rakipToplam, o.rakip, gece.tarih);
        if (poster) say(l.posterlenen, o.rakip, gece.tarih);
        if (blok) say(l.bloklanan, o.rakip, gece.tarih);
        if (calim) say(l.calimlanan, o.rakip, gece.tarih);
      }
      if (poster) for (const k of o.katkilar) if (k.rol === 'bitiren') say(l.posterBasan, k.oyuncu, gece.tarih);
      const bloklayanlar = o.katkilar.filter((k) => k.rol === 'bloklayan');
      const yapanlar = bloklayanlar.length > 0 ? bloklayanlar : blok && o.katkilar.length === 1 ? o.katkilar : [];
      for (const ad of new Set(yapanlar.map((k) => k.oyuncu))) say(l.blokYapan, ad, gece.tarih);
    }
  }
  const sirala = (sayac: Sayac) =>
    [...sayac.values()].sort((a, b) => b.sayi - a.sayi || b.sonGorunme.valueOf() - a.sonGorunme.valueOf() || a.oyuncu.localeCompare(b.oyuncu, 'tr')).slice(0, sinir);
  const rakipToplam = sirala(l.rakipToplam).map((r) => ({
    ...r,
    dagilim: { posterlenen: l.posterlenen.get(r.kimlik)?.sayi ?? 0, bloklanan: l.bloklanan.get(r.kimlik)?.sayi ?? 0, calimlanan: l.calimlanan.get(r.kimlik)?.sayi ?? 0 },
  }));
  return { rakipToplam, posterlenen: sirala(l.posterlenen), bloklanan: sirala(l.bloklanan), calimlanan: sirala(l.calimlanan), posterBasan: sirala(l.posterBasan), blokYapan: sirala(l.blokYapan) };
}

// ——— Kim kime: oyuncu–rakip çiftleri ———

export type CiftTurleri = { poster: number; blok: number; crossover: number };
export type Cift = {
  yapanKimlik: string;
  rakipKimlik: string;
  /** Son görünmedeki yazımlar. */
  yapan: string;
  rakip: string;
  /** Bu çiftin kaç ayrı oyunda yaşandığı (aynı oyun bir kez). */
  sayi: number;
  /** Türlere göre dağılım (bir oyun birden çok türde olabilir; toplam `sayi`'dan büyük çıkabilir). */
  turler: CiftTurleri;
  sonGorunme: Date;
};

/**
 * "X, Y'ye şunu yaptı" çiftleri: poster (yapan = rolü bitiren), blok (rolü bloklayan; yoksa ve tek katkı varsa o kişi), crossover
 * (eylem çalım ya da etiket crossover; yapan = rolü çalım atan). Rakibi boş oyunlar ve yapanı belirsiz oyunlar girmez; kişi kendine rakip olamaz.
 * Yalnızca en az `enAz` (varsayılan 2) kez yaşanan çiftler döner; çoktan aza, eşitlikte daha yeni son görünme, sonra adlar.
 * `harita` verilirse adlar önce ad sözlüğüyle kanonik ada çevrilir.
 */
export function ciftler(geceler: readonly Gece[], enAz = 2, harita?: AdHaritasi): Cift[] {
  const kaynak = harita ? adlariUygula(geceler, harita) : [...geceler];
  const tum = new Map<string, Cift>();
  for (const gece of [...kaynak].sort(artan)) {
    for (const o of gece.oyunlar) {
      const rakip = o.rakip;
      if (!rakip) continue;
      const poster = o.etiketler?.includes('poster') ?? false;
      const blok = o.eylem === 'blok';
      const crossover = o.eylem === 'calim' || (o.etiketler?.includes('crossover') ?? false);
      const buOyunda = new Map<string, Partial<CiftTurleri>>();
      const ekle = (ad: string, tur: keyof CiftTurleri) => {
        if (kimlik(ad) === kimlik(rakip)) return;
        buOyunda.set(ad, { ...buOyunda.get(ad), [tur]: 1 });
      };
      if (poster) for (const k of o.katkilar) if (k.rol === 'bitiren') ekle(k.oyuncu, 'poster');
      if (blok) {
        const bloklayanlar = o.katkilar.filter((k) => k.rol === 'bloklayan');
        for (const k of bloklayanlar.length > 0 ? bloklayanlar : o.katkilar.length === 1 ? o.katkilar : []) ekle(k.oyuncu, 'blok');
      }
      if (crossover) for (const k of o.katkilar) if (k.rol === 'calim_atan') ekle(k.oyuncu, 'crossover');
      for (const [yapan, t] of buOyunda) {
        const anahtar = `${kimlik(yapan)}|${kimlik(rakip)}`;
        const c: Cift = tum.get(anahtar) ?? { yapanKimlik: kimlik(yapan), rakipKimlik: kimlik(rakip), yapan, rakip, sayi: 0, turler: { poster: 0, blok: 0, crossover: 0 }, sonGorunme: gece.tarih };
        c.sayi += 1;
        c.turler.poster += t.poster ?? 0;
        c.turler.blok += t.blok ?? 0;
        c.turler.crossover += t.crossover ?? 0;
        if (gece.tarih.valueOf() >= c.sonGorunme.valueOf()) Object.assign(c, { yapan, rakip, sonGorunme: gece.tarih });
        tum.set(anahtar, c);
      }
    }
  }
  return [...tum.values()]
    .filter((c) => c.sayi >= enAz)
    .sort((a, b) => b.sayi - a.sayi || b.sonGorunme.valueOf() - a.sonGorunme.valueOf() || a.yapan.localeCompare(b.yapan, 'tr') || a.rakip.localeCompare(b.rakip, 'tr'));
}

/** Kim kime bölümünün görünmesi için gereken en az tekrar eden (en az 2 kez yaşanan) çift sayısı. */
export const VERSUS_ESIK = 3;
