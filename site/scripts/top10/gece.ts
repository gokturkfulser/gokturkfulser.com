// Gemini'nin ham çıktısı → doğrulanmış gece → YAML dosyası. Doğrulama sitenin kendi şemasıdır (src/lib/top10-sema.ts):
// dosyaya yalnızca site build'inin de kabul edeceği veri yazılır. YAML, repoda kullanılan `yaml` paketinin Document API'siyle yazılır
// (inceleme yorumlarıyla); yazılan metin yeniden okunup şemadan geçirilir.
import { Document, parse, Scalar, YAMLMap, YAMLSeq } from 'yaml';
import { aciklamaKontrolu, aciklamadanOyuncular, adNormallestir, type AciklamaKontrolu } from './aciklama.ts';
import { top10Sema } from '../../src/lib/top10-sema.ts';
import { benzerAdlar, benzerAdlarMevcutla, kimlik, katkiPaylari, sezonKlasoru, SIRA_SAYISI, zamanSaniye, ZAMAN_BICIMI, type Gece, type Kontrol, type MevcutBenzer, type Tur } from '../../src/lib/top10.ts';
import { eylemAdi, GEMINI_ETIKET, GEMINI_EYLEM, GEMINI_ROL, rolAdi, takimKodunuCevir } from '../../src/lib/top10-sozluk.ts';
import { kanonikAd, type AdHaritasi } from '../../src/lib/top10-adlar.ts';
import type { Guven, HamGece, HamOyun } from './gemini.ts';
import { kontrolYorumlari, notuKontrole } from './kontrol.ts';

/** Çoğunluk oylamasında bir satırın oy bilgisi (oylama.ts üretir; N = 1 iken yoktur). */
export type OyBilgisi = {
  /** Katkı sahipleri kümesi oy oranı, ör. "2/3". */
  oran: string;
  eylemOran: string;
  payOran: string;
  /** Satır seviyesi = (küme, eylem, pay) oylarının en kötüsü: oy birliği → yuksek, çoğunluk → orta, uzlaşma yok → dusuk. */
  seviye: 'yuksek' | 'orta' | 'dusuk';
  /** Katkı kümesinde çoğunluk yok: en çok oy alan küme seçildi. */
  uzlasmaYok: boolean;
  /** Azınlıkta kalan alternatifler, ör. "diğer: Brayden Burries 1/3". */
  alternatifler: string[];
};

/** Bir oyunun inceleme notları: özet ve YAML yorumları buradan üretilir. */
export type OyunNotu = {
  sira: number;
  guven: Guven;
  guvenNedeni?: string;
  /** Paylı oyunda (birden çok katkı) modelin pay gerekçesi. */
  payNedeni?: string;
  payli: boolean;
  zaman?: string;
  /** Zaman damgası geçersizdi, yazılmadı. */
  zamanUyari?: string;
  /** Bu oyundaki adların mevcut veriyle benzerliği ("mevcut yazım: X?"). */
  adUyarilari: string[];
  /** Video açıklamasındaki oyuncu listesinde geçmeyen katkı sahipleri. */
  aciklamadaYok: string[];
  /** Eylem ile en büyük paylı katkının rolü uyuşmuyor (yalnızca uyarı). */
  eylemUyari?: string;
  /** Aynı sırada, aynı takımda, aynı soyadlı ama farklı ön adlı adaylar (ayrı aday olarak oylandı): "benzer ad, aynı kişi mi? X / Y; aynıysa sözlüğe ekle, farklıysa yoksay". Yön belirtilmez; sözlüğü betik değiştirmez. */
  benzerAdUyarilari?: string[];
  /** Sözlükte ve mevcut top10 verisinde olmayan ad(lar) + düşük güven: "doğrulanmamış ad" (ör. spiker esprisinin oyuncu adı sanılması). */
  dogrulanmamisAdlar?: string[];
  /** Çoğunluk oylaması (N ≥ 2): oy bilgisi. `guven` bu durumda oylamadan türetilir (oy birliği → high, çoğunluk → medium, uzlaşma yok → low). */
  oy?: OyBilgisi;
  /** Modelin kendi güveni ve gerekçesi (çalıştırma başına); oylamada da yorum olarak kalır. */
  modelGuvenleri?: { guven: Guven; neden?: string }[];
};

export type Uretilen = {
  gece: Gece;
  yaml: string;
  oyunNotlari: OyunNotu[];
  /** Gece içindeki birbirine çok benzeyen adlar (yazım şüphesi). */
  adUyarilari: string[];
  /** Mevcut top10 verisindeki bir adla çok benzer ama farklı yazılan adlar (ad değiştirilmez). */
  mevcutBenzerler: MevcutBenzer[];
  /** Diğer uyarılar (ör. modelin tarihi başlıktakinden farklı, açıklama kontrolü atlandı). */
  uyarilar: string[];
  /** Video açıklaması çapraz kontrolü (liste yalnızca kontrol içindir, veri olarak yazılmaz). */
  aciklamaKontrol: AciklamaKontrolu;
  /** Bilgi satırları (ör. "takım kodu çevrildi: PHO → PHX"); uyarı değildir. */
  bilgiler: string[];
};

// Sezon klasörü hesabı kontrol düzenleyicisiyle paylaşılır (src/lib/top10.ts).
export { sezonKlasoru };

/** Zod hata listesinin özeti: en çok 3 hata, her biri "alan = değer: ileti" (yeniden deneme nedeni; modele de geri verilir). */
export function semaHatasi(issues: readonly { path: readonly PropertyKey[]; message: string }[], aday: unknown): string {
  const yol = (p: readonly PropertyKey[]) => p.reduce<string>((m, k) => (typeof k === 'number' ? `${m}[${k}]` : m ? `${m}.${String(k)}` : String(k)), '');
  const deger = (p: readonly PropertyKey[]) => p.reduce<any>((v, k) => v?.[k as any], aday);
  const ozet = issues.slice(0, 3).map((i) => {
    const d = deger(i.path);
    const dm = d === undefined || (typeof d === 'object' && d !== null) ? '' : ` = ${JSON.stringify(d)}`;
    return `${yol(i.path) || '(kök)'}${dm}: ${i.message}`;
  });
  return ozet.join('; ') + (issues.length > 3 ? ` (+${issues.length - 3} hata daha)` : '');
}

const tek = (metin: string | null | undefined) => (metin ?? '').replace(/\s+/g, ' ').trim();
const nedenYok = (m: string | null | undefined) => (tek(m) ? tek(m) : undefined);

/** İngilizce istem değerlerini sitenin anahtarlarına çevirir. Bilinmeyen değer → hata iletisi (yeniden deneme yoluna gider). */
function oyunDonustur(o: HamOyun, bilgiler: Set<string>): { oyun: Record<string, unknown>; not: OyunNotu } | { hata: string } {
  const eylem = GEMINI_EYLEM[o.action];
  if (!eylem) return { hata: `plays[rank ${o.rank}].action: "${o.action}" geçerli değil` };
  const etiketler: string[] = [];
  for (const t of o.tags ?? []) {
    const e = GEMINI_ETIKET[t];
    if (!e) return { hata: `plays[rank ${o.rank}].tags: "${t}" geçerli değil` };
    if (!etiketler.includes(e)) etiketler.push(e);
  }
  const katkilar: Record<string, unknown>[] = [];
  for (const k of o.contributors) {
    const rol = GEMINI_ROL[k.role];
    if (!rol) return { hata: `plays[rank ${o.rank}].contributors.role: "${k.role}" geçerli değil` };
    const takim = takimKodunuCevir(tek(k.team));
    if (takim.cevrildi) bilgiler.add(`takım kodu çevrildi: ${tek(k.team).toUpperCase()} → ${takim.kod}`);
    katkilar.push({ oyuncu: tek(k.player), takim: takim.kod, rol, pay: k.share });
  }
  const zamanHam = tek(o.timestamp);
  const zamanGecerli = zamanHam !== '' && ZAMAN_BICIMI.test(zamanHam);
  const oyun: Record<string, unknown> = { sira: o.rank, eylem };
  if (etiketler.length) oyun.etiketler = etiketler;
  if (tek(o.description)) oyun.aciklama = tek(o.description);
  if (tek(o.opponent)) oyun.rakip = tek(o.opponent);
  if (zamanGecerli) oyun.zaman = zamanHam;
  oyun.katkilar = katkilar;
  const payli = katkilar.length > 1;
  return {
    oyun,
    not: {
      sira: o.rank,
      guven: o.confidence,
      guvenNedeni: nedenYok(o.confidence_reason),
      payNedeni: payli ? nedenYok(o.contributors.map((k) => k.share_reason).find((r) => tek(r))) : undefined,
      payli,
      zaman: zamanGecerli ? zamanHam : undefined,
      zamanUyari: zamanHam !== '' && !zamanGecerli ? `zaman damgası geçersiz ("${zamanHam}"), yazılmadı` : zamanHam === '' ? 'zaman damgası yok' : undefined,
      adUyarilari: [],
      aciklamadaYok: [],
    },
  };
}

export type Baglam = {
  tarih: string;
  video: string;
  /** Başlıktan gelen tür; `--zorla` ile başlık kalıba uymuyorsa undefined (tür modelin `type` değerinden alınır, sayı kontrolü yapılmaz). */
  tur?: Tur;
  model: string;
  uretildi: Date;
  /** Video süresi (YouTube Data API); zaman damgaları 0 ile bu değer arasında olmalıdır. */
  sureSn?: number;
  /** Video açıklaması (YouTube Data API): oyuncu listesi çapraz kontrolü için; veri olarak yazılmaz. */
  aciklama?: string;
};

export type DogrulamaHatasi = {
  hata: string;
  /** true: yeniden denemenin anlamı yok (ör. model boş liste döndürdü; videoyu bir kez daha göndermek boşa token yakar). */
  kesin?: boolean;
};

const EYLEM_ROL_UYUMU: Record<string, readonly string[]> = {
  pasor: ['pas'],
  bloklayan: ['blok'],
  top_calan: ['top_calma'],
  bitiren: ['smac', 'turnike', 'ucluk', 'orta_mesafe'],
};

/**
 * Tutarlılık uyarısı (sonucu değiştirmez): eylem alley_oop değilse ve en büyük paylı katkının rolü eylemle uyuşmuyorsa
 * (pasor ↔ pas, bloklayan ↔ blok, top_calan ↔ top_calma, bitiren ↔ smac/turnike/ucluk/orta_mesafe). En büyük pay eşitse (eşit paylı oyun),
 * rol ya da eylem `diger` ise ya da eylem yoksa uyarı yok.
 */
export function eylemPayUyarisi(oyun: Gece['oyunlar'][number]): string | undefined {
  if (!oyun.eylem || oyun.eylem === 'alley_oop' || oyun.eylem === 'diger') return undefined;
  const paylar = katkiPaylari(oyun.katkilar);
  const enBuyuk = Math.max(...paylar);
  if (paylar.filter((p) => p === enBuyuk).length > 1) return undefined;
  const katki = oyun.katkilar[paylar.indexOf(enBuyuk)]!;
  const uyumlu = EYLEM_ROL_UYUMU[katki.rol];
  if (!uyumlu || uyumlu.includes(oyun.eylem)) return undefined;
  return `eylem ile en büyük pay uyuşmuyor (eylem: ${eylemAdi(oyun.eylem, 'tr')}; en büyük pay: ${katki.oyuncu} %${enBuyuk}, ${rolAdi(katki.rol, 'tr')})`;
}

/**
 * Gece verisini `yaml` paketinin Document API'siyle yazar. Her oyunun `kontrol` alanı yazılır ve oyunun üstündeki yorumlar o alandan üretilir
 * (tek kaynak kontrol alanıdır, kontrol.ts); dosyanın başına üretim zamanı + model yorumu eklenir.
 */
export function geceYaml(veri: { tarih: string; video: string; tur: string; oyunlar: Record<string, unknown>[] }, baglam: Pick<Baglam, 'model' | 'uretildi'>): string {
  const belge = new Document({
    tarih: veri.tarih,
    video: veri.video,
    ...(veri.tur !== 'top10' ? { tur: veri.tur } : {}),
    kaynak: 'gemini',
    inceleme: 'bekliyor',
    oyunlar: veri.oyunlar,
  });
  belge.commentBefore = ` Gemini ile üretildi: ${baglam.uretildi.toISOString()}, model ${baglam.model}`;
  const oyunlar = belge.get('oyunlar', true) as unknown as YAMLSeq<YAMLMap>;
  oyunlar.items.forEach((oyun, i) => {
    const katkilar = oyun.get('katkilar', true) as unknown as YAMLSeq<YAMLMap>;
    for (const k of katkilar.items) k.flow = true;
    const etiketler = oyun.get('etiketler', true) as unknown as YAMLSeq | undefined;
    if (etiketler) etiketler.flow = true;
    const zaman = oyun.get('zaman', true) as unknown as Scalar | undefined;
    if (zaman) zaman.type = 'QUOTE_DOUBLE'; // "1:05" metin kalsın (YAML 1.1 yükleyicileri 1:05'i sayı sanabilir)
    const kontrol = veri.oyunlar[i]!.kontrol as Kontrol | undefined;
    if (kontrol) oyun.commentBefore = kontrolYorumlari(kontrol).map((satir) => ` ${satir}`).join(String.fromCharCode(10));
  });
  return belge.toString({ lineWidth: 0 });
}

/** YAML metnini okuyup sitenin şemasından geçirir (yazılan dosyanın kendisi için). */
export function yamlDogrula(metin: string): { hata: string } | { gece: Gece } {
  let veri: unknown;
  try {
    veri = parse(metin);
  } catch (hata) {
    return { hata: `YAML okunamadı: ${(hata as Error).message}` };
  }
  const sonuc = top10Sema.safeParse(veri);
  if (!sonuc.success) return { hata: semaHatasi(sonuc.error.issues, veri) };
  return { gece: sonuc.data as unknown as Gece };
}

/**
 * Ham çıktıyı sitenin anahtarlarına çevirir, videoyla tutarlılığını denetler ve şemadan geçirir. Hatalıysa `{ hata }`
 * (ilk sorun, ikinci denemede modele geri verilir; `kesin` ise yeniden denenmez).
 * Videoyla tutarlılık: boş liste, oyun sayısı = başlıktaki tür, zaman damgaları 0..video süresi, video açıklamasındaki
 * "featuring" listesiyle katkı sahipleri (yarıdan azı listede yoksa "videoyla tutarsız").
 * `mevcutGeceler`: sitedeki mevcut top10 verisi (ad benzerliği uyarısı için; adlar değiştirilmez).
 */
export function dogrula(ham: HamGece, baglam: Baglam, mevcutGeceler: readonly Gece[] = [], bilinenAdlar: readonly string[] = []): DogrulamaHatasi | Uretilen {
  const uyarilar: string[] = [];
  const bilgiler = new Set<string>();
  if (ham.plays.length === 0) {
    return { hata: 'model boş oyun listesi döndürdü (videoya erişemedi ya da hiç oyun göremedi); uydurma sonuç yazılmadı', kesin: true };
  }
  const tur: Tur = baglam.tur ?? (ham.type === 'top5' ? 'top5' : 'top10');
  if (baglam.tur) {
    const n = SIRA_SAYISI[baglam.tur];
    if (ham.plays.length !== n) return { hata: `oyun sayısı ${ham.plays.length}; başlıktaki tür (${baglam.tur === 'top10' ? 'Top 10' : 'Top 5'}) ${n} oyun gerektirir` };
    if (ham.type !== undefined && ham.type !== baglam.tur) return { hata: `type: model "${ham.type}" dedi ama video ${baglam.tur === 'top10' ? 'Top 10' : 'Top 5'} (başlık)` };
  }
  if (ham.date && ham.date !== baglam.tarih) uyarilar.push(`modelin tarihi (${ham.date}) başlıktaki tarihten (${baglam.tarih}) farklı; başlık esas alındı`);
  const donusenler = [...ham.plays].sort((a, b) => a.rank - b.rank).map((o) => oyunDonustur(o, bilgiler));
  const hatali = donusenler.find((d): d is { hata: string } => 'hata' in d);
  if (hatali) return { hata: hatali.hata };
  const oyunlar = (donusenler as { oyun: Record<string, unknown>; not: OyunNotu }[]).map((d) => d.oyun);
  const notlar = (donusenler as { oyun: Record<string, unknown>; not: OyunNotu }[]).map((d) => d.not);
  const aday = { tarih: baglam.tarih, video: baglam.video, tur, kaynak: 'gemini', inceleme: 'bekliyor', oyunlar };
  const sonuc = top10Sema.safeParse(aday);
  if (!sonuc.success) return { hata: semaHatasi(sonuc.error.issues, aday) };
  const gece = sonuc.data as unknown as Gece;
  // Zaman damgaları 0 ile video süresi arasında olmalı.
  if (baglam.sureSn !== undefined) {
    for (const o of gece.oyunlar) {
      const sn = o.zaman ? zamanSaniye(o.zaman) : undefined;
      if (sn !== undefined && (sn < 0 || sn > baglam.sureSn)) {
        return { hata: `plays[rank ${o.sira}].timestamp: ${o.zaman} video süresinin (${Math.floor(baglam.sureSn / 60)}:${String(baglam.sureSn % 60).padStart(2, '0')}) dışında` };
      }
    }
  }
  return sonIsle(gece, notlar, { ...baglam, tur }, mevcutGeceler, uyarilar, [...bilgiler], bilinenAdlar);
}

/**
 * Doğrulanmış (şemadan geçmiş) bir gecenin son işlemleri: video açıklaması çapraz kontrolü, eylem/pay uyarısı, ad benzerliği ve YAML.
 * Tek çalıştırma (`dogrula`) ve çoğunluk oylaması sonucu (`oylamaSonrasi`) aynı yolu kullanır.
 */
export function sonIsle(gece: Gece, notlar: OyunNotu[], baglam: Baglam & { tur: Tur }, mevcutGeceler: readonly Gece[], uyarilar: string[], bilgiler: string[] = [], bilinenAdlar: readonly string[] = []): DogrulamaHatasi | Uretilen {
  const oyunlar = gece.oyunlar as unknown as Record<string, unknown>[];
  const aday = { tarih: baglam.tarih, video: baglam.video, tur: baglam.tur, kaynak: 'gemini', inceleme: 'bekliyor', oyunlar };
  // Video açıklamasındaki oyuncu listesiyle çapraz kontrol (liste yalnızca kontrol içindir).
  const katkiAdlari = gece.oyunlar.flatMap((o) => o.katkilar.map((k) => k.oyuncu));
  const kontrol = aciklamaKontrolu(katkiAdlari, aciklamadanOyuncular(baglam.aciklama ?? ''));
  if (kontrol.tutarsiz) {
    return { hata: `videoyla tutarsız: katkı sahiplerinin yalnızca ${kontrol.eslesen}/${kontrol.toplam} kadarı video açıklamasındaki oyuncu listesinde geçiyor (listede olmayanlar: ${kontrol.eksikler.join(', ')}); adlar ve takımlar yalnızca videodan okunmalı` };
  }
  if (kontrol.atlandi) uyarilar.push('video açıklamasında "featuring" oyuncu listesi bulunamadı; açıklama çapraz kontrolü atlandı');
  else {
    const eksik = new Set(kontrol.eksikler);
    gece.oyunlar.forEach((o, i) => {
      notlar[i]!.aciklamadaYok = o.katkilar.map((k) => k.oyuncu).filter((a) => eksik.has(a));
    });
  }
  // Doğrulanmamış ad: sözlükte ve mevcut top10 verisinde olmayan ad + düşük güven (oylamada türetilen ya da modelin kendi düşük güveni).
  // Spiker esprileri/şarkı adları oyuncu adı sanılabiliyor; bu uyarı o satırı gözden geçirmeye çağırır.
  const bilinen = new Set(bilinenAdlar.map(adNormallestir));
  gece.oyunlar.forEach((o, i) => {
    const dusuk = notlar[i]!.guven === 'low' || (notlar[i]!.modelGuvenleri ?? []).some((m) => m.guven === 'low');
    if (!dusuk) return;
    const adlar = [...new Set([...o.katkilar.map((k) => k.oyuncu), ...(o.rakip ? [o.rakip] : [])])];
    const bilinmeyen = adlar.filter((a) => !bilinen.has(adNormallestir(a)));
    if (bilinmeyen.length) notlar[i]!.dogrulanmamisAdlar = bilinmeyen;
  });
  // Eylem ile en büyük pay tutarlılığı (yalnızca uyarı).
  gece.oyunlar.forEach((o, i) => {
    notlar[i]!.eylemUyari = eylemPayUyarisi(o);
  });
  // Ad benzerliği: mevcut veriyle (ad değiştirilmez, yoruma "mevcut yazım: X?" eklenir) ve gece içinde.
  const mevcutBenzerler = benzerAdlarMevcutla(gece, mevcutGeceler);
  for (const b of mevcutBenzerler) {
    gece.oyunlar.forEach((o, i) => {
      const adlar = [...o.katkilar.map((k) => k.oyuncu), ...(o.rakip ? [o.rakip] : [])];
      if (adlar.some((a) => kimlik(a) === b.yeniKimlik)) notlar[i]!.adUyarilari.push(`"${b.yeni}", mevcut yazım: ${b.mevcut}?`);
    });
  }
  // Kontrol alanı: notlardan üretilir ve oyunun son alanı olarak yazılır; yorumlar ondan türetilir. Sonuç yine sitenin şemasından geçer.
  const kontrollu = oyunlar.map((o, i) => ({ ...o, kontrol: notuKontrole(notlar[i]!) }));
  const kontrolluAday = { ...aday, oyunlar: kontrollu };
  const kontrolSonuc = top10Sema.safeParse(kontrolluAday);
  if (!kontrolSonuc.success) return { hata: `kontrol alanı şemadan geçmedi: ${semaHatasi(kontrolSonuc.error.issues, kontrolluAday)}` };
  return {
    gece: kontrolSonuc.data as unknown as Gece,
    yaml: geceYaml(kontrolluAday, baglam),
    oyunNotlari: notlar,
    adUyarilari: benzerAdlar([gece]).map(({ a, b }) => `"${a.oyuncu}" ile "${b.oyuncu}" çok benzer (yazım hatası olabilir)`),
    mevcutBenzerler,
    uyarilar,
    aciklamaKontrol: kontrol,
    bilgiler,
  };
}

/** Oyun başına kişi başı puan dökümü (özet için): [{ oyuncu, takim, rol, pay, puan }]. */
export function katkiDokumu(oyun: Gece['oyunlar'][number]) {
  const paylar = katkiPaylari(oyun.katkilar);
  return oyun.katkilar.map((k, i) => ({ ...k, pay: paylar[i]!, puan: ((11 - oyun.sira) * paylar[i]!) / 100 }));
}

/** Modelin ham çıktısındaki adları (katkı sahipleri ve rakip) sözlükle kanonik ada çevirir; oylamadan ve doğrulamadan önce uygulanır. Girdiyi değiştirmez. */
export function hamAdlariniUygula(ham: HamGece, harita: AdHaritasi): HamGece {
  if (harita.size === 0) return ham;
  return {
    ...ham,
    plays: ham.plays.map((o) => ({
      ...o,
      ...(o.opponent ? { opponent: kanonikAd(o.opponent, harita) } : {}),
      contributors: o.contributors.map((k) => ({ ...k, player: kanonikAd(String(k.player), harita) })),
    })),
  };
}
