// GITHUB_STEP_SUMMARY için Markdown özet ve terminal toplamları. Sır içermez (anahtarlar bu modüle hiç gelmez).
import { videoZamanAdresi, type Gece } from '../../src/lib/top10.ts';
import { eylemAdi, rolAdi, type Eylem } from '../../src/lib/top10-sozluk.ts';
import { katkiDokumu, type OyunNotu } from './gece.ts';
import type { Kullanim } from './gemini.ts';
import type { Karar } from './otomatik.ts';
import type { MevcutBenzer } from '../../src/lib/top10.ts';

export type GeceSonucu = {
  tarih: string;
  karar: Karar;
  durum: 'uretildi' | 'basarisiz' | 'bekliyor' | 'kilitli' | 'video-yok';
  baslik?: string;
  video?: string;
  tur?: string;
  dosya?: string;
  hata?: string;
  gece?: Gece;
  oyunNotlari?: OyunNotu[];
  adUyarilari?: string[];
  mevcutBenzerler?: MevcutBenzer[];
  uyarilar?: string[];
};

const DURUM_METNI: Record<GeceSonucu['durum'], string> = {
  uretildi: 'üretildi (inceleme bekliyor)',
  basarisiz: 'BAŞARISIZ',
  bekliyor: 'dokunulmadı (bekleyen gemini dosyası; yeniden üretmek için --uzerine-yaz / uzerine_yaz)',
  kilitli: 'dokunulmadı (elle/onaylı dosya)',
  'video-yok': 'henüz video yok',
};

const hucre = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const sayi = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });

/** 754 → "12:34"; 3725 → "1:02:05". */
export function sureYaz(saniye: number): string {
  const s = Math.round(saniye);
  const sa = Math.floor(s / 3600);
  const dk = Math.floor((s % 3600) / 60);
  const sn = s % 60;
  return sa > 0 ? `${sa}:${String(dk).padStart(2, '0')}:${String(sn).padStart(2, '0')}` : `${dk}:${String(sn).padStart(2, '0')}`;
}

/** sureSn: videoların süresi (her video bir kez). islenenSn/cagriSayisi: Gemini'de işlenen toplam süre (her çağrı videoyu bir kez işler: oylama, yeniden deneme). */
export type Toplamlar = { sureSn?: number; islenenSn?: number; cagriSayisi?: number; kullanim?: Kullanim };

/** Bir Gemini çağrısı: hangi gece, kaçıncı çalıştırma (--tekrar), kaçıncı deneme (1 = ilk, 2 = yeniden deneme), token kullanımı ve girdi sınırı. */
export type TokenCagrisi = { tarih: string; calisma: number; deneme: number; kullanim?: Kullanim; sinir?: number };

const asildi = (c: TokenCagrisi) => c.sinir !== undefined && c.kullanim?.girdi !== undefined && c.kullanim.girdi > c.sinir;

/** Çağrı başına satırlar + kategori toplamları (ilk deneme / yeniden denemeler / ek oylama çalıştırmaları) + sınır aşımları. */
export function tokenRaporu(cagrilar: readonly TokenCagrisi[]) {
  const girdi = (liste: readonly TokenCagrisi[]) => liste.reduce((t, c) => t + (c.kullanim?.girdi ?? 0), 0);
  const ilk = cagrilar.filter((c) => c.calisma === 1 && c.deneme === 1);
  const yeniden = cagrilar.filter((c) => c.deneme > 1);
  const tekrar = cagrilar.filter((c) => c.calisma > 1 && c.deneme === 1);
  const satirlar = cagrilar.map((c) => {
    const k = c.kullanim;
    const metin = k ? `girdi ${sayi(k.girdi ?? 0)}, çıktı ${sayi(k.cikti ?? 0)}, düşünme ${sayi(k.dusunme ?? 0)}, toplam ${sayi(k.toplam ?? 0)}` : 'token bilgisi yok';
    return `${c.tarih} çalıştırma ${c.calisma}, deneme ${c.deneme}: ${metin}${c.sinir !== undefined ? ` (girdi sınırı ${sayi(c.sinir)})` : ''}${asildi(c) ? ' SINIR AŞILDI' : ''}`;
  });
  const kategoriler = `girdi token'ı: ilk denemeler ${sayi(girdi(ilk))}; yeniden denemeler ${sayi(girdi(yeniden))}; ek oylama çalıştırmaları ${sayi(girdi(tekrar))}; toplam ${sayi(girdi(cagrilar))}`;
  const uyarilar = cagrilar
    .filter(asildi)
    .map((c) => `${c.tarih} çalıştırma ${c.calisma}, deneme ${c.deneme}: girdi token'ı ${sayi(c.kullanim!.girdi!)} video başına üst sınırı (${sayi(c.sinir!)}) aştı; video süresi ve istek içeriği kontrol edilmeli`);
  return { satirlar, kategoriler, uyarilar };
}

/** "Toplam video süresi: 12:34; token: girdi X, çıktı Y, toplam Z" (terminal ve özet için tek satır). */
export function toplamSatiri(t: Toplamlar): string {
  const sure = t.sureSn !== undefined ? sureYaz(t.sureSn) : 'bilinmiyor';
  const k = t.kullanim;
  const token = k
    ? [k.girdi !== undefined && `girdi ${sayi(k.girdi)}`, k.cikti !== undefined && `çıktı ${sayi(k.cikti)}`, k.dusunme !== undefined && `düşünme ${sayi(k.dusunme)}`, k.toplam !== undefined && `toplam ${sayi(k.toplam)}`].filter(Boolean).join(', ')
    : 'yanıtta token bilgisi yok';
  const islenen = t.islenenSn !== undefined && t.cagriSayisi ? `; Gemini'de işlenen toplam süre: ${sureYaz(t.islenenSn)} (${t.cagriSayisi} çağrı)` : '';
  return `Toplam video süresi: ${sure}${islenen}; token: ${token}`;
}

function oyunSatiri(o: Gece['oyunlar'][number], video: string | undefined, not?: OyunNotu): string {
  const dokum = katkiDokumu(o)
    .map((k) => `${k.oyuncu} (${k.takim}, ${rolAdi(k.rol, 'tr')}, %${k.pay}, ${sayi(k.puan)} puan)`)
    .join(', ');
  const zaman = o.zaman ? `[${o.zaman}](${(video && videoZamanAdresi(video, o.zaman)) || video || ''}) ` : '';
  return `${o.sira}. ${zaman}${o.eylem ? `${eylemAdi(o.eylem as Eylem, 'tr')}: ` : ''}${dokum}${o.rakip ? `; rakip: ${o.rakip}` : ''}${not?.oy ? ` (oy ${not.oy.oran})` : ''}`;
}

const kisa = (m: string, n = 120) => (m.length > n ? `${m.slice(0, n)}…` : m);

/** Geçmiş gece doldurma sonu: başarılı / başarısız / video yok / dokunulmadı (kilitli ya da bekleyen dosya) listeleri (terminal ve özet için satırlar). */
export function aralikOzeti(sonuclar: readonly GeceSonucu[]): string[] {
  const tarihler = (d: GeceSonucu['durum']) => sonuclar.filter((r) => r.durum === d).map((r) => r.tarih);
  const basarili = tarihler('uretildi');
  const basarisiz = sonuclar.filter((r) => r.durum === 'basarisiz');
  const yok = tarihler('video-yok');
  const dokunulmadi = sonuclar.filter((r) => r.durum === 'kilitli' || r.durum === 'bekliyor').map((r) => r.tarih);
  return [
    `Aralık sonucu: başarılı ${basarili.length}, başarısız ${basarisiz.length}, video yok ${yok.length}, dokunulmadı (dosyası var) ${dokunulmadi.length}`,
    `  başarılı: ${basarili.join(', ') || '-'}`,
    `  başarısız (yeniden çalıştırınca yalnızca bunlar ve dosyası olmayan geceler işlenir): ${basarisiz.map((r) => `${r.tarih} (${kisa(r.hata ?? '')})`).join('; ') || '-'}`,
    `  video yok: ${yok.join(', ') || '-'}`,
    `  dokunulmadı: ${dokunulmadi.join(', ') || '-'}`,
  ];
}

export function ozetMarkdown(
  sonuclar: readonly GeceSonucu[],
  bilgi: { model: string; mod: string; cozunurluk?: string; oylama?: number; modelSurumleri?: readonly string[]; cagrilar?: readonly TokenCagrisi[]; kotaSatiri?: string; aralik?: boolean } & Toplamlar,
): string {
  const surum = bilgi.modelSurumleri?.length ? `; yanıtta bildirilen model: ${bilgi.modelSurumleri.map((m) => `\`${m}\``).join(', ')}` : '; yanıtta model sürümü yok';
  const s: string[] = ['## top10: otomatik gece üretimi', '', `Model: \`${bilgi.model}\`${surum}.`, `Mod: ${bilgi.mod}${bilgi.oylama ? `; oylama: ${bilgi.oylama}` : ''}${bilgi.cozunurluk ? `; video çözünürlüğü: ${bilgi.cozunurluk}` : ''}.`, ''];
  s.push('| Gece | Durum | Video |', '| --- | --- | --- |');
  for (const r of sonuclar) {
    const video = r.video ? `[${hucre(r.baslik ?? r.video)}](${r.video})` : '-';
    s.push(`| ${r.tarih} | ${DURUM_METNI[r.durum]}${r.hata ? `: ${hucre(r.hata)}` : ''} | ${video} |`);
  }
  for (const r of sonuclar.filter((x) => x.durum === 'uretildi' && x.gece)) {
    s.push('', `### ${r.tarih} (${r.tur === 'top5' ? 'Top 5' : 'Top 10'})`, '');
    if (r.dosya) s.push(`Dosya: \`${r.dosya}\``, '');
    const notlar = r.oyunNotlari ?? [];
    for (const o of [...r.gece!.oyunlar].sort((a, b) => a.sira - b.sira)) s.push(oyunSatiri(o, r.video, notlar.find((n) => n.sira === o.sira)));
    const kontrol: string[] = [];
    for (const n of notlar) {
      if (n.oy) {
        // Oylama: oy birliği olmayan her satır kontrol listesindedir; güven oylamadan türer, modelin kendi güveni ayrıca yazılır.
        if (n.oy.seviye !== 'yuksek') {
          const guven = n.guven === 'medium' ? 'orta' : 'düşük';
          const model = (n.modelGuvenleri ?? []).map((m) => (m.guven === 'high' ? 'yüksek' : m.guven === 'medium' ? 'orta' : 'düşük') + (m.neden ? ` (${m.neden})` : '')).join('; ');
          kontrol.push(`sıra ${n.sira}: oy ${n.oy.oran}${n.oy.uzlasmaYok ? ', uzlaşma yok' : ''}; eylem ${n.oy.eylemOran}; pay ${n.oy.payOran} (güven ${guven}); ${n.oy.alternatifler.join('; ')}${model ? `; model güveni: ${model}` : ''}`);
        }
      } else if (n.guven !== 'high') kontrol.push(`sıra ${n.sira}: güven ${n.guven === 'medium' ? 'orta' : 'düşük'}${n.guvenNedeni ? `; ${n.guvenNedeni}` : ''}`);
      if (n.payli) kontrol.push(`sıra ${n.sira}: pay gerekçesi: ${n.payNedeni ?? 'verilmedi'}`);
      if (n.zamanUyari) kontrol.push(`sıra ${n.sira}: ${n.zamanUyari}`);
      for (const a of n.adUyarilari) kontrol.push(`sıra ${n.sira}: ad uyarısı: ${a}`);
      for (const a of n.takmaAdOnerileri ?? []) kontrol.push(`sıra ${n.sira}: ${a}`);
      if (n.aciklamadaYok.length) kontrol.push(`sıra ${n.sira}: açıklamada yok: ${n.aciklamadaYok.join(', ')}`);
      if (n.eylemUyari) kontrol.push(`sıra ${n.sira}: ${n.eylemUyari}`);
    }
    for (const a of r.adUyarilari ?? []) kontrol.push(`ad uyarısı (gece içi): ${a}`);
    for (const u of r.uyarilar ?? []) kontrol.push(u);
    s.push('', '**Kontrol edilecek satırlar**', '');
    s.push(...(kontrol.length ? kontrol.map((k) => `- ${k}`) : ['- (yok)']));
  }
  s.push('', toplamSatiri(bilgi));
  if (bilgi.kotaSatiri) s.push('', bilgi.kotaSatiri);
  if (bilgi.aralik) s.push('', '### Aralık sonucu', '', ...aralikOzeti(sonuclar).map((l, i) => (i === 0 ? l : `- ${l.trim()}`)));
  if (bilgi.cagrilar?.length) {
    const r = tokenRaporu(bilgi.cagrilar);
    s.push('', '### Token kullanımı (çağrı başına)', '', ...r.satirlar.map((x) => `- ${x}`), '', r.kategoriler);
    if (r.uyarilar.length) s.push('', '**Token üst sınırı uyarıları**', '', ...r.uyarilar.map((x) => `- ${x}`));
  }
  s.push('');
  return s.join('\n');
}
