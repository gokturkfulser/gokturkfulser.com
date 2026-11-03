// `--onayla`: workflow'dan toplu onaylama. Gemini/YouTube çağrısı yoktur; verilen her gecenin dosyasında YALNIZCA `inceleme: bekliyor` satırı
// `inceleme: onaylandi` olur (metin düzeyinde tek satır değişir; yorumlar, kontrol alanı, veri aynen kalır).
// Dosyası olmayan, zaten onaylı ya da `kaynak: elle` olan tarih için bilgi verilir; bu iş kırmızı bitirmez. Okunamayan/şemaya uymayan dosya hatadır.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parse } from 'yaml';
import { sezonKlasoru, yamlDogrula } from './gece.ts';

const TARIH_KALIBI = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-10-20, 2026-10-21" → ["2026-10-20", "2026-10-21"] (tekrarlar atılır, sıra korunur). Geçersiz biçim ya da boş liste → hata (kullanım hatası). */
export function onaylaTarihleri(metin: string): string[] {
  const parcalar = metin.split(',').map((t) => t.trim()).filter((t) => t !== '');
  if (parcalar.length === 0) throw new Error('--onayla için en az bir tarih gerekir (YYYY-AA-GG, virgülle ayrılmış).');
  for (const t of parcalar) {
    const gecerli = TARIH_KALIBI.test(t) && !Number.isNaN(Date.parse(`${t}T00:00:00Z`)) && new Date(`${t}T00:00:00Z`).toISOString().slice(0, 10) === t;
    if (!gecerli) throw new Error(`--onayla tarihi YYYY-AA-GG olmalı (gerçek bir takvim günü): "${t}"`);
  }
  return [...new Set(parcalar)];
}

export type OnaySonucu =
  | { tarih: string; durum: 'onaylandi'; dosya: string }
  | { tarih: string; durum: 'bilgi'; neden: string }
  | { tarih: string; durum: 'hata'; hata: string };

/** Dosya metninde yalnızca inceleme satırını değiştirir. Doğrulama içindedir; geçmezse hata. */
export function incelemeyiOnayla(girdi: string): { metin: string } | { bilgi: string } | { hata: string } {
  let onceki: any;
  try {
    onceki = parse(girdi);
  } catch (e) {
    return { hata: `YAML okunamadı: ${(e as Error).message}` };
  }
  const sema = yamlDogrula(girdi);
  if ('hata' in sema) return { hata: `şemaya uymuyor: ${sema.hata}` };
  const kaynak = sema.gece.kaynak ?? 'elle';
  if (kaynak === 'elle') return { bilgi: 'kaynak: elle; elle yazılmış dosyaya dokunulmaz' };
  if (sema.gece.inceleme === 'onaylandi') return { bilgi: 'zaten onaylı' };
  const satirlar = girdi.split('\n');
  const i = satirlar.findIndex((s) => /^inceleme:\s*bekliyor\s*(#.*)?\r?$/.test(s));
  let yeni: string[];
  if (i >= 0) {
    yeni = [...satirlar];
    yeni[i] = satirlar[i]!.replace(/bekliyor/, 'onaylandi');
  } else {
    // `inceleme` yazılmamış (varsayılan: bekliyor): kaynak satırının hemen altına eklenir.
    const k = satirlar.findIndex((s) => /^kaynak:/.test(s));
    if (k < 0) return { hata: 'inceleme ve kaynak satırı bulunamadı' };
    const cr = satirlar[k]!.endsWith('\r') ? '\r' : '';
    yeni = [...satirlar.slice(0, k + 1), `inceleme: onaylandi${cr}`, ...satirlar.slice(k + 1)];
  }
  const metin = yeni.join('\n');
  // Doğrulama: ayrıştırılmış nesne yalnızca `inceleme` alanında farklı olmalı.
  const sonraki: any = parse(metin);
  if (sonraki?.inceleme !== 'onaylandi' || !isDeepStrictEqual({ ...onceki, inceleme: undefined }, { ...sonraki, inceleme: undefined })) {
    return { hata: 'onaylama inceleme dışında bir alanı değiştirdi; dosyaya dokunulmadı' };
  }
  return { metin };
}

/** Verilen tarihleri onaylar; dosyalara yazar. Gemini/YouTube çağrısı yapmaz. */
export function onayla(tarihler: readonly string[], icerikKlasoru: string): OnaySonucu[] {
  return tarihler.map((tarih): OnaySonucu => {
    const yol = join(icerikKlasoru, sezonKlasoru(tarih), `${tarih}.yaml`);
    if (!existsSync(yol)) return { tarih, durum: 'bilgi', neden: 'gece dosyası yok' };
    const s = incelemeyiOnayla(readFileSync(yol, 'utf8'));
    if ('hata' in s) return { tarih, durum: 'hata', hata: s.hata };
    if ('bilgi' in s) return { tarih, durum: 'bilgi', neden: s.bilgi };
    writeFileSync(yol, s.metin);
    return { tarih, durum: 'onaylandi', dosya: `${sezonKlasoru(tarih)}/${tarih}.yaml` };
  });
}

/** Terminal satırı. */
export const onaySatiri = (r: OnaySonucu): string =>
  r.durum === 'onaylandi' ? `${r.tarih}: onaylandı (inceleme: bekliyor → onaylandi)` : r.durum === 'bilgi' ? `${r.tarih}: BİLGİ: ${r.neden}; dokunulmadı` : `${r.tarih}: HATA: ${r.hata}`;

/** Step summary Markdown'ı. */
export function onayOzeti(sonuclar: readonly OnaySonucu[]): string {
  const sayi = (d: OnaySonucu['durum']) => sonuclar.filter((r) => r.durum === d).length;
  return [
    '## top10 onaylama',
    '',
    `Onaylanan: ${sayi('onaylandi')}; bilgi: ${sayi('bilgi')}; hata: ${sayi('hata')}. Gemini ve YouTube çağrılmadı.`,
    '',
    ...sonuclar.map((r) => `- ${onaySatiri(r)}`),
    '',
  ].join('\n');
}
