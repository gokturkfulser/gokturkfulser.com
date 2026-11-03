// Form ↔ gece nesnesi. Doğrulama sitenin kendi şemasıdır (top10-sema.ts: sıralar, eylem/etiket/rol/takım, pay kuralları); pay bölüşümleri
// ve ad sözlüğü mantığı da site/src/lib'den paylaşılır, burada kopyalanmaz.
import { parse } from 'yaml';
import { kanonikAd, type AdHaritasi } from '../../site/src/lib/top10-adlar.ts';
import { izinliBolusumler, type Oyun } from '../../site/src/lib/top10.ts';
import { top10Sema } from '../../site/src/lib/top10-sema.ts';
import { ETIKET_ANAHTARLARI, EYLEM_ANAHTARLARI, ROL_ANAHTARLARI, TAKIM_KODLARI } from '../../site/src/lib/top10-sozluk.ts';

export type KatkiDurumu = { oyuncu: string; takim: string; rol: string };
/** Formun bir oyunu: gönderilen değerler olduğu gibi (geçersiz olsalar da) saklanır, hata sayfasında yeniden gösterilir. */
export type OyunDurumu = { sira: number; eylem: string; etiketler: string[]; rakip: string; aciklama: string; bolusum: string; katkilar: KatkiDurumu[] };
/** Dosyaya yazılacak doğrulanmış oyun (zaman ve kontrol alanları yazım sırasında eski dosyadan korunur). */
export type OyunGirdisi = { sira: number; eylem?: string; etiketler?: string[]; aciklama?: string; rakip?: string; katkilar: { oyuncu: string; takim: string; rol: string; pay?: number }[] };

export const EN_COK_KATKI = 3;
export const ESIT = 'esit';

/** Şemadan geçmiş bir oyun → form durumu. */
export function oyundanDurum(o: Oyun): OyunDurumu {
  const paylar = o.katkilar.map((k) => k.pay);
  return {
    sira: o.sira,
    eylem: o.eylem ?? '',
    etiketler: [...(o.etiketler ?? [])],
    rakip: o.rakip ?? '',
    aciklama: o.aciklama ?? '',
    bolusum: paylar.every((p) => p !== undefined) ? paylar.join('-') : ESIT,
    katkilar: o.katkilar.map((k) => ({ oyuncu: k.oyuncu, takim: k.takim, rol: k.rol })),
  };
}

type FormOkuyucu = { get(ad: string): string | null | File; getAll(ad: string): (string | File)[] };
const metin = (f: FormOkuyucu, ad: string) => {
  const v = f.get(ad);
  return typeof v === 'string' ? v : '';
};
const bosluk = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Gönderilen formdan oyun durumları. `siralar`: dosyadaki oyun sıraları (formdaki başka alanlar yok sayılır). */
export function formdanDurumlar(f: FormOkuyucu, siralar: readonly number[]): OyunDurumu[] {
  return siralar.map((sira) => {
    const kn = Math.min(Math.max(Number.parseInt(metin(f, `o${sira}_kn`), 10) || 0, 0), EN_COK_KATKI + 1);
    return {
      sira,
      eylem: metin(f, `o${sira}_eylem`),
      etiketler: f.getAll(`o${sira}_etiket`).filter((x): x is string => typeof x === 'string'),
      rakip: bosluk(metin(f, `o${sira}_rakip`)),
      aciklama: metin(f, `o${sira}_aciklama`).replace(/\s+/g, ' ').trim(),
      bolusum: metin(f, `o${sira}_bolusum`),
      katkilar: Array.from({ length: kn }, (_, i) => ({
        oyuncu: bosluk(metin(f, `o${sira}_k${i}_oyuncu`)),
        takim: metin(f, `o${sira}_k${i}_takim`).trim().toUpperCase(),
        rol: metin(f, `o${sira}_k${i}_rol`),
      })),
    };
  });
}

export type DogrulamaSonucu = { tamam: true; oyunlar: OyunGirdisi[] } | { tamam: false; genel: string[]; oyun: Record<number, string[]> };

/**
 * Form durumlarını doğrular. `ham`: dosyanın ayrıştırılmış hâli (tarih, video, tur, kaynak, zaman, kontrol… korunur).
 * Adlar sözlükle kanonik ada çevrilir. Hatalar oyun sırasına göre toplanır (satır satır gösterim için).
 */
export function durumlariDogrula(ham: unknown, durumlar: readonly OyunDurumu[], harita: AdHaritasi): DogrulamaSonucu {
  const oyunHata: Record<number, string[]> = {};
  const genel: string[] = [];
  const ekle = (sira: number, m: string) => (oyunHata[sira] ??= []).push(m);
  const hamNesne = (ham ?? {}) as Record<string, any>;
  const hamOyunlar: any[] = Array.isArray(hamNesne.oyunlar) ? hamNesne.oyunlar : [];

  const yeniOyunlar = durumlar.map((d) => {
    if (d.eylem !== '' && !(EYLEM_ANAHTARLARI as readonly string[]).includes(d.eylem)) ekle(d.sira, `eylem geçersiz: "${d.eylem}"`);
    for (const e of d.etiketler) if (!(ETIKET_ANAHTARLARI as readonly string[]).includes(e)) ekle(d.sira, `etiket geçersiz: "${e}"`);
    if (d.katkilar.length < 1 || d.katkilar.length > EN_COK_KATKI) ekle(d.sira, `katkı sayısı 1–${EN_COK_KATKI} olmalı (${d.katkilar.length} var)`);
    d.katkilar.forEach((k, i) => {
      if (k.oyuncu === '') ekle(d.sira, `katkı ${i + 1}: oyuncu adı boş (satırı çıkarın ya da adı yazın)`);
      if (!(TAKIM_KODLARI as readonly string[]).includes(k.takim)) ekle(d.sira, `katkı ${i + 1}: takım NBA'in 30 kısaltmasından biri olmalı ("${k.takim}")`);
      if (!(ROL_ANAHTARLARI as readonly string[]).includes(k.rol)) ekle(d.sira, `katkı ${i + 1}: rol geçersiz: "${k.rol}"`);
    });
    let paylar: number[] | undefined;
    if (d.bolusum !== ESIT) {
      const izinli = izinliBolusumler(d.katkilar.length).find((b) => b.join('-') === d.bolusum);
      if (!izinli) ekle(d.sira, `pay bölüşümü katkı sayısına (${d.katkilar.length}) uygun değil: "${d.bolusum}"`);
      else paylar = izinli;
    }
    const eski = hamOyunlar.find((o) => o?.sira === d.sira) ?? {};
    const oyun: Record<string, unknown> = { sira: d.sira };
    if (d.eylem) oyun.eylem = d.eylem;
    if (d.etiketler.length) {
      // Dosyadaki mevcut etiket sırası korunur (dokunulmamış etiketlerde gereksiz fark çıkmasın); yeni etiketler sona eklenir.
      const secili = [...new Set(d.etiketler)];
      const eskiSira: string[] = Array.isArray(eski.etiketler) ? eski.etiketler : [];
      oyun.etiketler = [...eskiSira.filter((e) => secili.includes(e)), ...secili.filter((e) => !eskiSira.includes(e))];
    }
    if (d.aciklama) oyun.aciklama = d.aciklama;
    if (d.rakip) oyun.rakip = kanonikAd(d.rakip, harita);
    if (eski.zaman !== undefined) oyun.zaman = eski.zaman;
    if (eski.kontrol !== undefined) oyun.kontrol = eski.kontrol;
    oyun.katkilar = d.katkilar.map((k, i) => ({ oyuncu: kanonikAd(k.oyuncu, harita), takim: k.takim, rol: k.rol, ...(paylar ? { pay: paylar[i] } : {}) }));
    return oyun;
  });

  const aday = { ...hamNesne, elle_duzenlendi: true, oyunlar: yeniOyunlar };
  const sema = top10Sema.safeParse(aday);
  if (!sema.success) {
    for (const hata of sema.error.issues) {
      const [kok, idx, ...gerisi] = hata.path;
      const sira = kok === 'oyunlar' && typeof idx === 'number' ? (yeniOyunlar[idx] as { sira: number } | undefined)?.sira : undefined;
      const yol = gerisi.map(String).join('.');
      // Okunur ileti: katkı pay/ad kurallarının "katkilar: sira N:" öneki satır başlığında zaten belli.
      const iletisi = `${yol && yol !== 'katkilar' ? `${yol}: ` : ''}${hata.message.replace(/^sira \d+: /, '')}`;
      // Özel denetimlerin zaten bildirdiği takım/rol/eylem hataları şemadan tekrar gelmesin.
      if (sira !== undefined) {
        if (!(oyunHata[sira] ?? []).some((m) => iletisi.includes(m.slice(0, 20)))) ekle(sira, iletisi);
      } else genel.push(`${hata.path.map(String).join('.') || '(kök)'}: ${hata.message}`);
    }
  }
  if (genel.length || Object.keys(oyunHata).length) return { tamam: false, genel, oyun: oyunHata };
  return {
    tamam: true,
    oyunlar: (sema.data!.oyunlar as unknown as Oyun[]).map((o) => ({
      sira: o.sira,
      ...(o.eylem ? { eylem: o.eylem } : {}),
      ...(o.etiketler?.length ? { etiketler: o.etiketler as string[] } : {}),
      ...(o.aciklama ? { aciklama: o.aciklama } : {}),
      ...(o.rakip ? { rakip: o.rakip } : {}),
      katkilar: o.katkilar.map((k) => ({ oyuncu: k.oyuncu, takim: k.takim, rol: k.rol as string, ...(k.pay !== undefined ? { pay: k.pay } : {}) })),
    })),
  };
}

/** Dosya metnini ayrıştırıp sitenin şemasından geçirir; geçmezse hata iletisi. */
export function geceOku(yamlMetni: string): { tamam: true; ham: unknown; gece: ReturnType<typeof top10Sema.parse> } | { tamam: false; hata: string } {
  try {
    const ham = parse(yamlMetni);
    const s = top10Sema.safeParse(ham);
    if (!s.success) return { tamam: false, hata: `gece dosyası şemadan geçmiyor: ${s.error.issues[0]!.path.join('.')}: ${s.error.issues[0]!.message}` };
    return { tamam: true, ham, gece: s.data };
  } catch (e) {
    return { tamam: false, hata: `YAML okunamadı: ${(e as Error).message}` };
  }
}
