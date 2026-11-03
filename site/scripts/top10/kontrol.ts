// Oyun satırının yapılandırılmış kontrol verisi (`oyun.kontrol`, şema: src/lib/top10-sema.ts) ile YAML yorumları arasındaki dönüşümler.
// Tek kaynak kontrol alanıdır: betik önce alanı doldurur (notuKontrole), yorumlar ondan üretilir (kontrolYorumlari).
// Geçiş betiği (gecis-kontrol.ts) eski yorumlardan alanı geri kurar (yorumdanKontrol).
import type { Kontrol, KontrolGuven } from '../../src/lib/top10.ts';
import type { Guven } from './gemini.ts';
import type { OyunNotu } from './gece.ts';

const GUVEN_ANAHTARI: Record<Guven, KontrolGuven> = { high: 'yuksek', medium: 'orta', low: 'dusuk' };
/** Yorumlarda ve sayfada görünen Türkçe ad. */
export const GUVEN_ADI: Record<KontrolGuven, string> = { yuksek: 'yüksek', orta: 'orta', dusuk: 'düşük' };
/** model_guveni içinde pay gerekçesini işaretleyen önek. */
const PAY_ONEKI = 'pay: ';
const ANAHTAR_TR: Record<string, KontrolGuven> = { yüksek: 'yuksek', orta: 'orta', düşük: 'dusuk' };

/** "2/3" gibi bir oran oy birliği mi (pay = payda)? */
const oyBirligi = (oran: string) => {
  const [a, b] = oran.split('/');
  return a === b;
};

/** Bir oyunun inceleme notundan kontrol verisi. Boş listeler yazılmaz. */
export function notuKontrole(not: OyunNotu): Kontrol {
  const uyarilar: string[] = [];
  if (not.oy) {
    if (not.oy.uzlasmaYok) uyarilar.push('uzlaşma yok');
    if (!oyBirligi(not.oy.eylemOran)) uyarilar.push(`eylem oyu ${not.oy.eylemOran}`);
    if (!oyBirligi(not.oy.payOran)) uyarilar.push(`pay oyu ${not.oy.payOran}`);
  }
  for (const a of not.adUyarilari) uyarilar.push(`ad uyarısı: ${a}`);
  for (const a of not.benzerAdUyarilari ?? []) uyarilar.push(a);
  if (not.dogrulanmamisAdlar?.length) uyarilar.push(`doğrulanmamış ad: ${not.dogrulanmamisAdlar.join(', ')} (sözlükte ve mevcut veride yok, güven düşük)`);
  if (not.aciklamadaYok.length) uyarilar.push(`açıklamada yok: ${not.aciklamadaYok.join(', ')}`);
  if (not.eylemUyari) uyarilar.push(not.eylemUyari);
  if (not.zamanUyari) uyarilar.push(not.zamanUyari);
  const modelGuveni = not.oy
    ? (not.modelGuvenleri ?? []).map((m) => GUVEN_ADI[GUVEN_ANAHTARI[m.guven]] + (m.neden ? ` (${m.neden})` : ''))
    : not.guvenNedeni
      ? [`${GUVEN_ADI[GUVEN_ANAHTARI[not.guven]]} (${not.guvenNedeni})`]
      : [];
  // Modelin pay gerekçesi bir açıklamadır, uyarı değil: model_guveni içinde "pay: ..." girdisi olarak durur (bakılacak satır ölçütünü şişirmez).
  if (not.payli) modelGuveni.push(`${PAY_ONEKI}${not.payNedeni ?? 'gerekçe verilmedi'}`);
  const kontrol: Kontrol = { guven: GUVEN_ANAHTARI[not.guven] };
  if (not.oy) kontrol.oy = not.oy.oran;
  if (uyarilar.length) kontrol.uyarilar = uyarilar;
  if (not.oy?.alternatifler.length) kontrol.alternatifler = [...not.oy.alternatifler];
  if (modelGuveni.length) kontrol.model_guveni = modelGuveni;
  return kontrol;
}

/** Kontrol verisinden YAML yorum satırları (başındaki boşluk ve "#" yazılmaz). Sıra: güven, alternatifler, model güveni, uyarılar. */
export function kontrolYorumlari(k: Kontrol): string[] {
  const tum = k.model_guveni ?? [];
  const payGerekceleri = tum.filter((e) => e.startsWith(PAY_ONEKI));
  const m = tum.filter((e) => !e.startsWith(PAY_ONEKI));
  const satirlar: string[] = [];
  if (k.oy) {
    satirlar.push(`güven: ${GUVEN_ADI[k.guven]} (oy ${k.oy})`, ...(k.alternatifler ?? []));
    if (m.length) satirlar.push(`model güveni: ${m.join('; ')}`);
  } else {
    // Oylamasız (tek çalıştırma): modelin gerekçesi güven satırında.
    const neden = m.length === 1 ? /\((.*)\)$/.exec(m[0]!)?.[1] : undefined;
    satirlar.push(`güven: ${GUVEN_ADI[k.guven]}${neden ? ` (${neden})` : ''}`, ...(k.alternatifler ?? []));
  }
  satirlar.push(...payGerekceleri, ...(k.uyarilar ?? []));
  return satirlar;
}

/** Üst düzey ";" ile ayırır (parantez içindeki ";" ayırıcı sayılmaz). */
function ustDuzeyBol(metin: string): string[] {
  const parcalar: string[] = [];
  let derinlik = 0;
  let simdiki = '';
  for (const c of metin) {
    if (c === '(') derinlik++;
    if (c === ')') derinlik = Math.max(0, derinlik - 1);
    if (c === ';' && derinlik === 0) {
      parcalar.push(simdiki.trim());
      simdiki = '';
    } else simdiki += c;
  }
  if (simdiki.trim()) parcalar.push(simdiki.trim());
  return parcalar.filter(Boolean);
}

const ALTERNATIF = /^(diğer|eylem diğer|pay diğer): .+ \d+\/\d+$/;

/**
 * Eski biçimdeki yorum satırlarından (her biri başındaki "#" ve boşluk atılmış) kontrol verisini kurar; geçiş betiği kullanır.
 * Güven satırı yoksa null (kontrol alanı üretilemez). Tanınmayan her satır uyarı olarak korunur (bilgi kaybı yok).
 */
export function yorumdanKontrol(satirlar: readonly string[]): Kontrol | null {
  const ilk = satirlar.find((s) => s.startsWith('güven: '));
  if (!ilk) return null;
  const eslesme = /^güven: (yüksek|orta|düşük)(?: \((.*)\))?$/.exec(ilk);
  if (!eslesme) return null;
  const kontrol: Kontrol = { guven: ANAHTAR_TR[eslesme[1]!]! };
  const uyarilar: string[] = [];
  const alternatifler: string[] = [];
  let modelGuveni: string[] = [];
  const icerik = eslesme[2];
  if (icerik !== undefined && /^oy \d+\/\d+/.test(icerik)) {
    const parcalar = ustDuzeyBol(icerik);
    const oy = /^oy (\d+\/\d+)(, uzlaşma yok)?$/.exec(parcalar[0]!);
    if (!oy) return null;
    kontrol.oy = oy[1]!;
    if (oy[2]) uyarilar.push('uzlaşma yok');
    for (const p of parcalar.slice(1)) {
      const e = /^(eylem|pay) (\d+\/\d+)$/.exec(p);
      if (!e) return null;
      if (!oyBirligi(e[2]!)) uyarilar.push(`${e[1]} oyu ${e[2]}`);
    }
  } else if (icerik !== undefined) {
    modelGuveni = [`${eslesme[1]} (${icerik})`];
  }
  const payGerekceleri: string[] = [];
  for (const s of satirlar) {
    if (s === ilk) continue;
    if (s.startsWith('model güveni: ')) modelGuveni = ustDuzeyBol(s.slice('model güveni: '.length));
    else if (s.startsWith(PAY_ONEKI)) payGerekceleri.push(s);
    else if (ALTERNATIF.test(s)) alternatifler.push(s);
    else uyarilar.push(s);
  }
  if (uyarilar.length) kontrol.uyarilar = uyarilar;
  if (alternatifler.length) kontrol.alternatifler = alternatifler;
  modelGuveni = [...modelGuveni, ...payGerekceleri];
  if (modelGuveni.length) kontrol.model_guveni = modelGuveni;
  return kontrol;
}
