// Otomatik mod planı: son N gecelik pencere, gece başına hangi video, dosya kilidi kuralları. Saf fonksiyonlar (ağ ve disk yok;
// dosyanın mevcut durumu `Mevcut` olarak dışarıdan verilir).
import { baslikCoz, type Tur } from './baslik.ts';
import type { Video } from './youtube.ts';

export type Mevcut = {
  dosyaVar: boolean;
  kaynak?: 'gemini' | 'elle';
  inceleme?: 'bekliyor' | 'onaylandi';
  /** Dosya var ama ayrıştırılamadı: dokunulmaz. */
  okunamadi?: boolean;
};

/** uret: dosya yok, video var · uzerine-yaz: bekleyen gemini dosyası, elle tetiklemede --uzerine-yaz · bekliyor: bekleyen gemini dosyası, dokunulmaz
 *  · kilitli: elle ya da onaylı (ya da okunamayan) dosya, asla dokunulmaz · video-yok: henüz video yok (başarısızlık değil). */
export type Karar = 'uret' | 'uzerine-yaz' | 'bekliyor' | 'kilitli' | 'video-yok';

const GUN_MS = 24 * 60 * 60 * 1000;

/** Pencere: `simdi`nin `saatDilimi`ndeki takvim günü ve önceki gun-1 gün; eskiden yeniye "YYYY-AA-GG". */
export function pencereTarihleri(simdi: Date, gun: number, saatDilimi: string): string[] {
  const bugun = new Intl.DateTimeFormat('en-CA', { timeZone: saatDilimi, year: 'numeric', month: '2-digit', day: '2-digit' }).format(simdi);
  const taban = Date.parse(`${bugun}T00:00:00Z`);
  return Array.from({ length: gun }, (_, i) => new Date(taban - (gun - 1 - i) * GUN_MS).toISOString().slice(0, 10));
}

const gecerliTarih = (t: string) => {
  const d = new Date(`${t}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) && !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === t;
};

/**
 * Geçmiş gece doldurma aralığı (--baslangic, isteğe bağlı --bitis): eskiden yeniye tüm geceler (uçlar dahil). `bitis` yoksa dün (`saatDilimi`ne göre).
 * Hatalar: geçersiz tarih, başlangıç bitişten sonra, bitiş bugünden sonra, aralık `enCok` günden uzun (varsayılan 31).
 */
export function aralikTarihleri(baslangic: string, bitis: string | undefined, simdi: Date, saatDilimi: string, enCok = 31): { tarihler: string[] } | { hata: string } {
  if (!gecerliTarih(baslangic)) return { hata: `--baslangic geçerli bir tarih (YYYY-AA-GG) olmalı: ${baslangic}` };
  if (bitis !== undefined && !gecerliTarih(bitis)) return { hata: `--bitis geçerli bir tarih (YYYY-AA-GG) olmalı: ${bitis}` };
  const bugun = pencereTarihleri(simdi, 1, saatDilimi)[0]!;
  const dun = new Date(Date.parse(`${bugun}T00:00:00Z`) - GUN_MS).toISOString().slice(0, 10);
  const son = bitis ?? dun;
  if (son > bugun) return { hata: `--bitis bugünden (${bugun}, ABD saatine göre) sonra olamaz: ${son}` };
  if (baslangic > son) return { hata: `--baslangic (${baslangic}) bitişten (${son}) sonra olamaz` };
  const gun = Math.round((Date.parse(`${son}T00:00:00Z`) - Date.parse(`${baslangic}T00:00:00Z`)) / GUN_MS) + 1;
  if (gun > enCok) return { hata: `aralık en çok ${enCok} gün olabilir (${baslangic} .. ${son} = ${gun} gün); aralığı bölün` };
  return { tarihler: Array.from({ length: gun }, (_, i) => new Date(Date.parse(`${baslangic}T00:00:00Z`) + i * GUN_MS).toISOString().slice(0, 10)) };
}

export const kilitliMi = (m: Mevcut): boolean =>
  m.dosyaVar && (m.okunamadi === true || (m.kaynak ?? 'elle') === 'elle' || m.inceleme === 'onaylandi');

export function karar(mevcut: Mevcut, videoVar: boolean, uzerineYaz: boolean): Karar {
  if (mevcut.dosyaVar) {
    if (kilitliMi(mevcut)) return 'kilitli';
    if (!uzerineYaz) return 'bekliyor';
    return videoVar ? 'uzerine-yaz' : 'video-yok';
  }
  return videoVar ? 'uret' : 'video-yok';
}

export type GeceVideosu = { video: Video; tur: Tur };

/** Videoları geceye göre eşler: yalnızca "Top 10/5 Plays of the Night" kalıbına uyan ve tarihi ayrıştırılan videolar; aynı gece için
 *  Top 10 önce, sonra en yeni yükleme. */
export function geceVideolari(videolar: readonly Video[]): Map<string, GeceVideosu> {
  const harita = new Map<string, GeceVideosu>();
  for (const video of videolar) {
    const cozulen = baslikCoz(video.baslik);
    if (!cozulen) continue;
    const onceki = harita.get(cozulen.tarih);
    if (!onceki || (onceki.tur === 'top5' && cozulen.tur === 'top10')) harita.set(cozulen.tarih, { video, tur: cozulen.tur });
  }
  return harita;
}

export type Plan = { tarih: string; karar: Karar; video?: GeceVideosu };

/** Pencerenin her gecesi için karar. `mevcutOku`, o gecenin dosyasının durumunu verir. */
export function planla(secenek: {
  tarihler: readonly string[];
  videolar: readonly Video[];
  mevcutOku: (tarih: string) => Mevcut;
  uzerineYaz?: boolean;
}): Plan[] {
  const eslesme = geceVideolari(secenek.videolar);
  return secenek.tarihler.map((tarih) => {
    const video = eslesme.get(tarih);
    return { tarih, karar: karar(secenek.mevcutOku(tarih), video !== undefined, secenek.uzerineYaz === true), video };
  });
}
