// NBA Top 10 gecesi verisinden sezonluk puan tablosu. Saf fonksiyonlar: Astro'ya, dosya sistemine ve içerik koleksiyonuna
// dokunmaz (veriyi lib/content.ts getirir); birim testleri `top10.test.ts`'tedir. Puan kuralı site/CLAUDE.md "Top 10 verisi".
// Puan oyuna verilir ve katkı sahiplerine bölünür; iç hesap tam sayıdır (1 puan = 100 birim), kayan nokta hatası birikmez.
import { slugify } from './slug';
import type { Eylem, Etiket, Rol } from './top10-sozluk';

export type Tur = 'top10' | 'top5';
export type Kaynak = 'gemini' | 'elle';
export type Katki = { oyuncu: string; takim: string; rol: Rol; pay?: number };
export type Oyun = {
  sira: number;
  eylem?: Eylem;
  etiketler?: Etiket[];
  aciklama?: string;
  /** Üstüne smaç basılan / bloklanan oyuncu; puan almaz. */
  rakip?: string;
  katkilar: Katki[];
};
/** Bir gecenin listesi. `tarih`, maçların ABD gecesidir (videonun başlığındaki tarih). */
export type Gece = { tarih: Date; tur: Tur; video: string; kaynak?: Kaynak; oyunlar: Oyun[] };

/** Gecenin türüne göre sıra sayısı. */
export const SIRA_SAYISI: Record<Tur, number> = { top10: 10, top5: 5 };

/** İç hesapta 1 puan = 100 birim. */
export const PUAN_BIRIMI = 100;

/** Oyun puanı = 11 − sıra; top5 gecesinde de aynı (1. sıra her zaman 10). */
export const puan = (sira: number) => 11 - sira;

/** Oyuncu kimliği: adın slug'ı (lib/slug.ts). Ad yazımı farklı olsa da slug aynıysa aynı oyuncudur. */
export const kimlik = (oyuncu: string) => slugify(oyuncu);

const ISO = (tarih: Date) => tarih.toISOString().slice(0, 10);

// ——— Doğrulama (build'i durdurur) ———

/** `sira` değerleri tekil ve 1..N aralığında olmalı (N: top10 → 10, top5 → 5), eksik sıra olmamalı. Hata yoksa undefined. */
export function siraHatasi(tur: Tur, oyunlar: readonly Pick<Oyun, 'sira'>[]): string | undefined {
  const n = SIRA_SAYISI[tur];
  const gorulen = new Set<number>();
  for (const { sira } of oyunlar) {
    if (!Number.isInteger(sira) || sira < 1 || sira > n) return `sira ${sira}: ${tur} gecesinde 1..${n} aralığında olmalı.`;
    if (gorulen.has(sira)) return `sira ${sira} birden fazla kez geçiyor; sıralar tekil olmalı.`;
    gorulen.add(sira);
  }
  const eksik = Array.from({ length: n }, (_, i) => i + 1).filter((s) => !gorulen.has(s));
  if (eksik.length > 0) return `${tur} gecesinde eksik sıra: ${eksik.join(', ')}.`;
  return undefined;
}

/** İzinli açık bölüşümler (azalan sıralı; katkıların sırası serbesttir, yani permütasyonlar da geçerlidir). */
const IZINLI_PAYLAR: readonly (readonly number[])[] = [[100], [50, 50], [70, 30], [34, 33, 33], [50, 25, 25]];

/**
 * Bir oyunun katkıları: 1–3 öğe, aynı oyuncu iki kez olamaz; pay ya hiçbirinde yok (eşit bölüşüm) ya hepsinde var;
 * pay varsa toplam 100 ve bölüşüm izinli olanlardan biri: [100], [50,50], [70,30], [30,70], [34,33,33] ve [50,25,25] permütasyonları.
 * Hata yoksa undefined.
 */
export function katkiHatasi(katkilar: readonly Pick<Katki, 'oyuncu' | 'pay'>[]): string | undefined {
  if (katkilar.length < 1 || katkilar.length > 3) return `katkılar 1–3 öğe olmalı (${katkilar.length} var).`;
  const kimlikler = new Set<string>();
  for (const { oyuncu } of katkilar) {
    const k = kimlik(oyuncu);
    if (kimlikler.has(k)) return `"${oyuncu}" aynı oyunda iki kez katkı sahibi olamaz.`;
    kimlikler.add(k);
  }
  const payli = katkilar.filter((k) => k.pay !== undefined).length;
  if (payli === 0) return undefined;
  if (payli !== katkilar.length) return 'pay ya hiçbir katkıda yazılmaz (eşit bölüşüm) ya hepsinde yazılır; bazılarında var, bazılarında yok.';
  const paylar = katkilar.map((k) => k.pay as number);
  if (paylar.some((p) => !Number.isInteger(p) || p < 1)) return `pay pozitif tam sayı olmalı (${paylar.join(', ')}).`;
  const toplam = paylar.reduce((a, b) => a + b, 0);
  if (toplam !== 100) return `pay toplamı 100 olmalı (${paylar.join(' + ')} = ${toplam}).`;
  const sirali = [...paylar].sort((a, b) => b - a);
  if (!IZINLI_PAYLAR.some((izinli) => izinli.length === sirali.length && izinli.every((p, i) => p === sirali[i]))) {
    return `izinsiz bölüşüm (${paylar.join('/')}); izinli olanlar: 100, 50/50, 70/30, 30/70, 34/33/33 ve 50/25/25 (her sırayla).`;
  }
  return undefined;
}

/** Katkı başına pay (yüzde, tam sayı): açık pay yoksa eşit bölüşüm (2 kişi 50/50, 3 kişi 34/33/33, fazlalık ilk katkıya). */
export function katkiPaylari(katkilar: readonly Pick<Katki, 'oyuncu' | 'pay'>[]): number[] {
  const hata = katkiHatasi(katkilar);
  if (hata) throw new Error(`katkılar geçersiz: ${hata}`);
  if (katkilar[0]!.pay !== undefined) return katkilar.map((k) => k.pay as number);
  const n = katkilar.length;
  const taban = Math.floor(100 / n);
  const artan = 100 - taban * n;
  return katkilar.map((_, i) => taban + (i === 0 ? artan : 0));
}

/** Video bağlantısı https olmalı ve youtube.com ya da nba.com (alt alan adları dahil) üzerinde olmalı. */
export function videoAdresiMi(adres: string): boolean {
  let url: URL;
  try {
    url = new URL(adres);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  return ['youtube.com', 'nba.com'].some((alan) => url.hostname === alan || url.hostname.endsWith(`.${alan}`));
}

/**
 * Veri dosyasının yolu (`<sezon>/<YYYY-AA-GG>.yaml`, içerik klasörüne göre) ile içindeki `tarih` tutarlı olmalı:
 * sezon klasörü `2026-27` biçiminde, dosya adı ile `tarih` aynı gün. Hata yoksa undefined.
 */
export function dosyaYoluHatasi(yol: string, tarih: unknown): string | undefined {
  const eslesme = /^(\d{4})-(\d{2})\/(\d{4}-\d{2}-\d{2})\.yaml$/.exec(yol);
  if (!eslesme) return `"${yol}": yol "<sezon>/<YYYY-AA-GG>.yaml" biçiminde olmalı (ör. 2026-27/2026-11-01.yaml).`;
  const [, yil, ertesi, dosyaTarihi] = eslesme;
  if (Number(ertesi) !== (Number(yil) + 1) % 100) return `"${yol}": sezon klasörü ardışık yıllar olmalı (ör. 2026-27).`;
  const yazilan = tarih instanceof Date ? (Number.isNaN(tarih.valueOf()) ? '' : ISO(tarih)) : String(tarih ?? '');
  if (yazilan !== dosyaTarihi) return `"${yol}": dosya adındaki tarih (${dosyaTarihi}) ile tarih alanı (${yazilan || 'yok'}) aynı gün olmalı.`;
  return undefined;
}

/** Aynı güne birden fazla gece yazılmışsa o günler (puanlar iki kez sayılırdı). */
export function yinelenenTarihler(geceler: readonly Gece[]): string[] {
  const gorulen = new Set<string>();
  const yinelenen = new Set<string>();
  for (const g of geceler) {
    const gun = ISO(g.tarih);
    if (gorulen.has(gun)) yinelenen.add(gun);
    gorulen.add(gun);
  }
  return [...yinelenen].sort();
}

// ——— Puanlama ———

export type Satir = {
  kimlik: string;
  /** Son görünmedeki yazım. */
  oyuncu: string;
  /** En yeni katkısındaki takım. */
  takim: string;
  /** Toplam puan, tam sayı birimle (1 puan = 100 birim): sıralama ve eşitlik bunun üstündendir. */
  puanBirim: number;
  /** Toplam puan (puanBirim / 100); yalnızca gösterim içindir. */
  puan: number;
  /** Herhangi bir katkısının olduğu gece sayısı (aynı gecede birden çok katkı tek gece sayılır). */
  gece: number;
  /** 1 numaralı oyunun katkı sahibi olduğu gece sayısı. */
  birinci: number;
  sonGorunme: Date;
};

const artan = (a: Gece, b: Gece) => a.tarih.valueOf() - b.tarih.valueOf();

/** Eşitlikte sırasıyla: daha çok 1 numara, daha çok gece, daha yeni son görünme, ad. */
export const satirSirasi = (a: Satir, b: Satir) =>
  b.puanBirim - a.puanBirim ||
  b.birinci - a.birinci ||
  b.gece - a.gece ||
  b.sonGorunme.valueOf() - a.sonGorunme.valueOf() ||
  a.oyuncu.localeCompare(b.oyuncu, 'tr');

/** Bir katkı sahibinin bir oyundan aldığı puan, birim olarak (tam sayı): (11 − sıra) × pay. */
export const katkiBirimi = (sira: number, pay: number) => puan(sira) * pay;

/** Gecenin puanlarını durumun üstüne ekler. Geceler tarih sırasıyla verilmelidir ("son" takım/yazım en yeni gecedendir). */
function geceyiEkle(durum: Map<string, Satir>, gece: Gece) {
  // Aynı gecede birden fazla katkısı olan oyuncunun puanları toplanır; takım/yazım o gecenin en iyi sıralı katkısından alınır.
  const bu = new Map<string, { oyuncu: string; takim: string; birim: number; birinci: number; enIyi: number }>();
  for (const oyun of gece.oyunlar) {
    const paylar = katkiPaylari(oyun.katkilar);
    oyun.katkilar.forEach((katki, i) => {
      const k = kimlik(katki.oyuncu);
      const m = bu.get(k) ?? { oyuncu: katki.oyuncu, takim: katki.takim, birim: 0, birinci: 0, enIyi: oyun.sira };
      m.birim += katkiBirimi(oyun.sira, paylar[i]!);
      if (oyun.sira === 1) m.birinci += 1;
      if (oyun.sira < m.enIyi) Object.assign(m, { oyuncu: katki.oyuncu, takim: katki.takim, enIyi: oyun.sira });
      bu.set(k, m);
    });
  }
  for (const [k, m] of bu) {
    const onceki = durum.get(k);
    const birim = (onceki?.puanBirim ?? 0) + m.birim;
    durum.set(k, {
      kimlik: k,
      oyuncu: m.oyuncu,
      takim: m.takim,
      puanBirim: birim,
      puan: birim / PUAN_BIRIMI,
      gece: (onceki?.gece ?? 0) + 1,
      birinci: (onceki?.birinci ?? 0) + m.birinci,
      sonGorunme: gece.tarih,
    });
  }
}

/** Sezonluk tablo (puan çoktan aza, eşitlik kırıcılarıyla). Boş sezon → boş dizi. */
export function sezonTablosu(geceler: readonly Gece[]): Satir[] {
  const durum = new Map<string, Satir>();
  for (const gece of [...geceler].sort(artan)) geceyiEkle(durum, gece);
  return [...durum.values()].sort(satirSirasi);
}

export type LiderDegisimi = {
  tarih: Date;
  /** O geceden sonraki lider (o günkü puan ve sayılarıyla). */
  lider: Satir;
  /** Bir önceki lider; ilk gecede yok. */
  onceki?: { kimlik: string; oyuncu: string; takim: string };
};

/** Her geceden sonra lideri hesaplar; yalnızca liderin değiştiği geceleri (ilk gece dahil) döndürür. */
export function liderGecmisi(geceler: readonly Gece[]): LiderDegisimi[] {
  const durum = new Map<string, Satir>();
  const degisimler: LiderDegisimi[] = [];
  let onceki: Satir | undefined;
  for (const gece of [...geceler].sort(artan)) {
    geceyiEkle(durum, gece);
    const lider = [...durum.values()].sort(satirSirasi)[0];
    if (!lider) continue;
    if (lider.kimlik !== onceki?.kimlik) {
      degisimler.push({
        tarih: gece.tarih,
        lider: { ...lider },
        onceki: onceki && { kimlik: onceki.kimlik, oyuncu: onceki.oyuncu, takim: onceki.takim },
      });
    }
    onceki = { ...lider };
  }
  return degisimler;
}

/** En yeni gece (yoksa undefined). */
export const sonGece = (geceler: readonly Gece[]): Gece | undefined => [...geceler].sort(artan).at(-1);

// ——— Yazım hatası şüphesi ———

function uzaklik(a: string, b: string): number {
  let onceki = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const simdiki = [i];
    for (let j = 1; j <= b.length; j++) {
      simdiki[j] = Math.min(onceki[j]! + 1, simdiki[j - 1]! + 1, onceki[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    onceki = simdiki;
  }
  return onceki[b.length]!;
}

export type BenzerAd = { a: { kimlik: string; oyuncu: string }; b: { kimlik: string; oyuncu: string } };

/**
 * Slug'ları farklı ama birbirine çok benzeyen adlar (yazım hatası şüphesi): düzenleme uzaklığı ≤ 1; iki slug da en az
 * 8 karakterse ≤ 2. Katkılardaki ve `rakip` alanındaki tüm adlar taranır. Yalnızca uyarı içindir, build'i durdurmaz
 * (iki ayrı oyuncu da olabilir).
 */
export function benzerAdlar(geceler: readonly Gece[]): BenzerAd[] {
  const adlar = new Map<string, string>();
  for (const gece of [...geceler].sort(artan)) {
    for (const o of gece.oyunlar) {
      for (const k of o.katkilar) adlar.set(kimlik(k.oyuncu), k.oyuncu);
      if (o.rakip) adlar.set(kimlik(o.rakip), o.rakip);
    }
  }
  const liste = [...adlar].sort(([x], [y]) => x.localeCompare(y));
  const sonuc: BenzerAd[] = [];
  for (let i = 0; i < liste.length; i++) {
    for (let j = i + 1; j < liste.length; j++) {
      const [ka, oa] = liste[i]!;
      const [kb, ob] = liste[j]!;
      const esik = Math.min(ka.length, kb.length) >= 8 ? 2 : 1;
      if (Math.abs(ka.length - kb.length) <= esik && uzaklik(ka, kb) <= esik) {
        sonuc.push({ a: { kimlik: ka, oyuncu: oa }, b: { kimlik: kb, oyuncu: ob } });
      }
    }
  }
  return sonuc;
}
