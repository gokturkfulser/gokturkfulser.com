// NBA Top 10 gecesi verisinden sezonluk puan tablosu. Saf fonksiyonlar: Astro'ya, dosya sistemine ve içerik koleksiyonuna
// dokunmaz (veriyi lib/content.ts getirir); birim testleri `top10.test.ts`'tedir. Puan kuralı site/CLAUDE.md "Top 10 verisi".
import { slugify } from './slug';

export type Tur = 'top10' | 'top5';
export type Oyun = { sira: number; oyuncu: string; takim: string; asist?: string; not?: string };
/** Bir gecenin listesi. `tarih`, maçların ABD gecesidir (videonun başlığındaki tarih). */
export type Gece = { tarih: Date; tur: Tur; video: string; oyunlar: Oyun[] };

/** Gecenin türüne göre sıra sayısı. */
export const SIRA_SAYISI: Record<Tur, number> = { top10: 10, top5: 5 };

/** Puan = 11 − sıra; top5 gecesinde de aynı (1. sıra her zaman 10). `asist` puan almaz. */
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
  /** Son görünmedeki takım. */
  takim: string;
  puan: number;
  /** Listeye girdiği gece sayısı (aynı gecede iki oyun tek gece sayılır). */
  gece: number;
  /** 1 numara olduğu gece sayısı. */
  birinci: number;
  sonGorunme: Date;
};

const artan = (a: Gece, b: Gece) => a.tarih.valueOf() - b.tarih.valueOf();

/** Eşitlikte sırasıyla: daha çok 1 numara, daha çok gece, daha yeni son görünme, ad. */
export const satirSirasi = (a: Satir, b: Satir) =>
  b.puan - a.puan ||
  b.birinci - a.birinci ||
  b.gece - a.gece ||
  b.sonGorunme.valueOf() - a.sonGorunme.valueOf() ||
  a.oyuncu.localeCompare(b.oyuncu, 'tr');

/** Gecenin puanlarını durumun üstüne ekler. Geceler tarih sırasıyla verilmelidir ("son" takım/yazım en yeni gecedir). */
function geceyiEkle(durum: Map<string, Satir>, gece: Gece) {
  // Aynı gecede birden fazla oyunla gelen oyuncunun puanları toplanır; takım/yazım o gecenin en iyi sıralı oyunundan alınır.
  const bu = new Map<string, { oyuncu: string; takim: string; puan: number; birinci: number; enIyi: number }>();
  for (const o of gece.oyunlar) {
    const k = kimlik(o.oyuncu);
    const m = bu.get(k) ?? { oyuncu: o.oyuncu, takim: o.takim, puan: 0, birinci: 0, enIyi: o.sira };
    m.puan += puan(o.sira);
    if (o.sira === 1) m.birinci += 1;
    if (o.sira < m.enIyi) Object.assign(m, { oyuncu: o.oyuncu, takim: o.takim, enIyi: o.sira });
    bu.set(k, m);
  }
  for (const [k, m] of bu) {
    const onceki = durum.get(k);
    durum.set(k, {
      kimlik: k,
      oyuncu: m.oyuncu,
      takim: m.takim,
      puan: (onceki?.puan ?? 0) + m.puan,
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
 * 8 karakterse ≤ 2. Yalnızca uyarı içindir, build'i durdurmaz (iki ayrı oyuncu da olabilir).
 */
export function benzerAdlar(geceler: readonly Gece[]): BenzerAd[] {
  const adlar = new Map<string, string>();
  for (const gece of [...geceler].sort(artan)) for (const o of gece.oyunlar) adlar.set(kimlik(o.oyuncu), o.oyuncu);
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
