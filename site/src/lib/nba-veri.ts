// NBA.com/stats tablolarından elle kaydedilen veri (src/data/nba/*.tsv): Dunk Score ve clutch. Saf fonksiyonlar, Astro'ya dokunmaz.
// Dosyalar sayfadaki tablonun kopyalanıp yapıştırılmasıyla yenilenir (sekme ayrımlı metin); ağdan hiçbir şey çekilmez.
// Okuyucular yapıştırma artıklarına dayanıklıdır: üst başlık satırı, "Glossary", "300 Rows", sayfa numarası gibi satırlar ve tekrarlanan başlıklar yok sayılır,
// aynı kayıt iki kez yapıştırılırsa bir kez sayılır; sayı ya da tarihi bozuk veri satırı atlanır ve `hatalar`'da bildirilir.
// Ana puanlamaya hiçbir etkisi yoktur: veriler yalnızca bilgi olarak gösterilir. Birim testleri `nba-veri.test.ts`'tedir.
import { kimlik, sezonTablosu, type Gece } from './top10.ts';
import { kanonikAd, type AdHaritasi } from './top10-adlar.ts';

export type Okuma<T> = { satirlar: T[]; hatalar: string[] };

export type DunkSatiri = {
  oyuncu: string;
  takim: string;
  /** "CLE @ MIL" */
  mac: string;
  /** Maçın ABD tarihi (UTC gece yarısı); gece dosyalarındaki `tarih` ile aynı gün. */
  tarih: Date;
  skor: number;
  atlama: number;
  guc: number;
  stil: number;
  savunma: number;
};

export type ClutchSatiri = {
  oyuncu: string;
  takim: string;
  yas: number;
  mac: number;
  galibiyet: number;
  maglubiyet: number;
  /** Maç başı ortalama (tablonun kendisi maç başı gelir; dosyadaki değerler olduğu gibi tutulur). */
  dakika: number;
  sayi: number;
  isabet: number;
  uclukIsabet: number;
  ribaund: number;
  asist: number;
  calma: number;
  blok: number;
  artiEksi: number;
};

const hucreler = (satir: string) => satir.split('\t').map((h) => h.trim());
const sayiyaCevir = (h: string | undefined): number | undefined => {
  if (h === undefined || h === '') return undefined;
  const n = Number(h.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/** "10/31/2026" (A/G/Y) → UTC gece yarısı; geçersizse undefined. */
export function nbaTarihi(metin: string): Date | undefined {
  const e = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(metin.trim());
  if (!e) return undefined;
  const [ay, gun, yil] = [Number(e[1]), Number(e[2]), Number(e[3])];
  const t = new Date(Date.UTC(yil, ay - 1, gun));
  return t.getUTCFullYear() === yil && t.getUTCMonth() === ay - 1 && t.getUTCDate() === gun ? t : undefined;
}

/**
 * Dosyadaki "# guncellendi: YYYY-AA-GG" damgası (kontrol düzenleyicisi yapıştırınca İstanbul gününü yazar); yoksa ya da geçersizse undefined.
 * Damga veri satırı değildir: okuyucular `#` satırını yok sayar.
 */
export function guncellemeTarihi(metin: string): string | undefined {
  const e = /^#\s*guncellendi:\s*(\d{4}-\d{2}-\d{2})\s*$/m.exec(metin);
  if (!e) return undefined;
  const t = new Date(`${e[1]}T00:00:00Z`);
  return !Number.isNaN(t.valueOf()) && t.toISOString().slice(0, 10) === e[1] ? e[1] : undefined;
}

/** Başlık satırını bulur (verilen tüm adları içeren ilk satır); sütun adı → konum. Boş başlıklı sütunlar konum sayar ama adlandırılmaz. */
function baslikBul(satirlar: string[], gerekli: string[]): { index: number; konum: Map<string, number>; uzunluk: number } | undefined {
  for (let i = 0; i < satirlar.length; i++) {
    const h = hucreler(satirlar[i]!);
    const kucuk = h.map((x) => x.toLowerCase());
    if (gerekli.every((g) => kucuk.includes(g))) {
      const konum = new Map<string, number>();
      kucuk.forEach((ad, k) => {
        if (ad !== '' && !konum.has(ad)) konum.set(ad, k);
      });
      return { index: i, konum, uzunluk: h.length };
    }
  }
  return undefined;
}

/** Ortak okuma döngüsü: başlıktan sonraki satırlar; veri gibi görünmeyenler (kısa satırlar, tekrarlanan başlık) sessizce atlanır. */
function oku<T>(metin: string, gerekli: string[], satirOku: (h: string[], konum: Map<string, number>) => T | string, anahtar: (x: T) => string): Okuma<T> {
  const satirlar = metin.split(/\r?\n/);
  const baslik = baslikBul(satirlar, gerekli);
  if (!baslik) return { satirlar: [], hatalar: metin.trim() === '' ? [] : ['başlık satırı bulunamadı'] };
  const sonuc = new Map<string, T>();
  const hatalar: string[] = [];
  for (let i = baslik.index + 1; i < satirlar.length; i++) {
    const ham = satirlar[i]!;
    const h = hucreler(ham);
    const kucuk = h.map((x) => x.toLowerCase());
    if (gerekli.every((g) => kucuk.includes(g))) continue; // sayfa başlığı yeniden yapıştırılmış
    if (h.length < Math.min(6, baslik.uzunluk)) continue; // "Glossary", "300 Rows", sayfa numarası gibi artıklar
    if (h.length < baslik.uzunluk) {
      hatalar.push(`satır ${i + 1}: sütun sayısı uymuyor (${h.length}/${baslik.uzunluk})`);
      continue;
    }
    const s = satirOku(h, baslik.konum);
    if (typeof s === 'string') hatalar.push(`satır ${i + 1}: ${s}`);
    else sonuc.set(anahtar(s), s);
  }
  return { satirlar: [...sonuc.values()], hatalar };
}

/** Dunk Score tablosu (nba.com/stats/players/dunk-scores). Çıktı skora göre çoktan aza; eşitlikte daha yeni tarih, sonra ad. */
export function dunkScoreOku(metin: string): Okuma<DunkSatiri> {
  const r = oku<DunkSatiri>(
    metin,
    ['player', 'team', 'game date', 'score'],
    (h, k) => {
      const al = (ad: string) => h[k.get(ad) ?? -1];
      const tarih = nbaTarihi(al('game date') ?? '');
      const sayilar = ['score', 'jmp', 'pwr', 'styl', 'def'].map((ad) => sayiyaCevir(al(ad)));
      const oyuncu = al('player');
      if (!oyuncu) return 'oyuncu adı boş';
      if (!tarih) return `geçersiz tarih (${al('game date') ?? ''})`;
      if (sayilar.some((x) => x === undefined)) return `geçersiz sayı (${oyuncu})`;
      const [skor, atlama, guc, stil, savunma] = sayilar as number[];
      return { oyuncu, takim: al('team') ?? '', mac: al('match up') ?? '', tarih, skor: skor!, atlama: atlama!, guc: guc!, stil: stil!, savunma: savunma! };
    },
    (x) => `${kimlik(x.oyuncu)}|${x.tarih.toISOString().slice(0, 10)}|${x.skor}|${x.mac}`,
  );
  r.satirlar.sort((a, b) => b.skor - a.skor || b.tarih.valueOf() - a.tarih.valueOf() || a.oyuncu.localeCompare(b.oyuncu, 'tr'));
  return r;
}

/** Oyuncu clutch tablosu (nba.com/stats/players/clutch-traditional); dosya sırası korunur (NBA'in sıralaması). */
export function clutchOku(metin: string): Okuma<ClutchSatiri> {
  return oku<ClutchSatiri>(
    metin,
    ['player', 'team', 'gp', 'pts'],
    (h, k) => {
      const al = (ad: string) => h[k.get(ad) ?? -1];
      const oyuncu = al('player');
      const adlar = ['age', 'gp', 'w', 'l', 'min', 'pts', 'fg%', '3p%', 'reb', 'ast', 'stl', 'blk', '+/-'];
      const s = adlar.map((ad) => sayiyaCevir(al(ad)));
      if (!oyuncu) return 'oyuncu adı boş';
      if (s.some((x) => x === undefined)) return `geçersiz sayı (${oyuncu})`;
      const [yas, mac, galibiyet, maglubiyet, dakika, sayi, isabet, uclukIsabet, ribaund, asist, calma, blok, artiEksi] = s as number[];
      return {
        oyuncu,
        takim: al('team') ?? '',
        yas: yas!,
        mac: mac!,
        galibiyet: galibiyet!,
        maglubiyet: maglubiyet!,
        dakika: dakika!,
        sayi: sayi!,
        isabet: isabet!,
        uclukIsabet: uclukIsabet!,
        ribaund: ribaund!,
        asist: asist!,
        calma: calma!,
        blok: blok!,
        artiEksi: artiEksi!,
      };
    },
    (x) => `${kimlik(x.oyuncu)}|${x.takim}`,
  );
}

// ——— Bizim verimizle eşleştirme ———

/** Bu eylemler ya da `poster` etiketi smaç sayılır (Dunk Score yalnızca smaçlar içindir). */
const SMAC_EYLEMLERI: readonly string[] = ['smac', 'alley_oop'];

/**
 * Her Dunk Score satırı için o smacın Top 10 gecesindeki sırası; yoksa undefined. Eşleşme: aynı ABD günü ve aynı oyuncu (ad sözlüğüyle kanonik ada çevrilir),
 * oyunda smaç eylemi ya da poster etiketi ve oyuncunun bitiren rolü olmalı. Zaman damgası NBA tarafında olmadığı için bir oyuncunun aynı gece birden çok smacında
 * yalnızca en yüksek skorlu olan eşleştirilir (diğerleri undefined kalır): bu bir tahmindir.
 */
export function dunkTop10Sirasi(dunklar: readonly DunkSatiri[], geceler: readonly Gece[], harita: AdHaritasi = new Map()): (number | undefined)[] {
  const gun = (t: Date) => t.toISOString().slice(0, 10);
  const enIyi = new Map<string, number>();
  dunklar.forEach((d, i) => {
    const k = `${kimlik(kanonikAd(d.oyuncu, harita))}|${gun(d.tarih)}`;
    const onceki = enIyi.get(k);
    if (onceki === undefined || d.skor > dunklar[onceki]!.skor) enIyi.set(k, i);
  });
  return dunklar.map((d, i) => {
    const k = `${kimlik(kanonikAd(d.oyuncu, harita))}|${gun(d.tarih)}`;
    if (enIyi.get(k) !== i) return undefined;
    const gece = geceler.find((g) => gun(g.tarih) === gun(d.tarih));
    if (!gece) return undefined;
    const kisi = kimlik(kanonikAd(d.oyuncu, harita));
    const siralar = gece.oyunlar
      .filter((o) => (SMAC_EYLEMLERI.includes(o.eylem ?? '') || (o.etiketler?.includes('poster') ?? false)) && o.katkilar.some((x) => x.rol === 'bitiren' && kimlik(x.oyuncu) === kisi))
      .map((o) => o.sira);
    return siralar.length > 0 ? Math.min(...siralar) : undefined;
  });
}

/** Sezon tablomuzdaki sıra (1'den): oyuncu kimliği → sıra. */
export function sezonSiralari(geceler: readonly Gece[]): Map<string, number> {
  return new Map(sezonTablosu(geceler).map((s, i) => [s.kimlik, i + 1]));
}

/** NBA'in yazımıyla bizim kanonik adımız aynı kişi mi ayrımı için kimlik: sözlükle kanonik ada çevrilip slug'lanır. */
export const nbaKimligi = (ad: string, harita: AdHaritasi = new Map()): string => kimlik(kanonikAd(ad, harita));
