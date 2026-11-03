// Top 10 kontrol sayfasının saf mantığı (Astro'ya ve içerik koleksiyonuna bağlı değil; testi top10-kontrol.test.ts).
// Sayfa yalnızca SHOW_DRAFTS build'lerinde üretilir; veriyi lib/content.ts → top10KontrolGirdileri() getirir.
import { incelemeBekliyor, videoZamanAdresi, type Gece, type Oyun } from './top10.ts';

/** Düzenleme bağlantıları için depo (kök CLAUDE.md "Adlar": github kullanıcı gokturkfulser, repo gokturkfulser.com). */
export const KONTROL_DEPO = 'gokturkfulser/gokturkfulser.com';

/** `<sezon>/<YYYY-AA-GG>` kimliğinin repodaki dosya yolu (depo kökünden). */
export const geceDosyaYolu = (id: string) => `site/src/content/top10/${id}.yaml`;

/** GitHub'ın web düzenleyicisi (main dalı): github.com/<depo>/edit/main/<dosya yolu>. */
export const duzenleAdresi = (id: string) => `https://github.com/${KONTROL_DEPO}/edit/main/${geceDosyaYolu(id)}`;

/** Onaylama formunun bulunduğu workflow sayfası (Actions → site-top10). */
export const ONAY_FORMU_ADRESI = `https://github.com/${KONTROL_DEPO}/actions/workflows/site-top10.yml`;

/**
 * top10-kontrol dalının Cloudflare önizleme adresi biçimi. Cloudflare dokümanı (Previews → URLs): workers.dev önizleme adresi
 * `<önizleme-adı>-<worker-adı>.<alt-alan>.workers.dev`, önizleme adı varsayılan olarak Git dalının adıdır; Worker adı gokturkfulser-site
 * (kök CLAUDE.md "Adlar"). `<alt-alan>` hesabın workers.dev alt alanıdır (repodan bilinmez).
 */
export const ONIZLEME_ADRESI_BICIMI = 'top10-kontrol-gokturkfulser-site.<alt-alan>.workers.dev/kontrol/top10/';

export type KontrolGirdisi = { id: string; gece: Gece };
export type BakilacakSatir = { id: string; gece: Gece; oyun: Oyun };
export type BekleyenGece = { id: string; gece: Gece; satirSayisi: number; bakilacakSayisi: number; kontrolsuzSayisi: number };

/** Satır kontrol gerektiriyor mu: güven orta/düşük ya da uyarı var. (Kontrol alanı olmayan satır burada sayılmaz; gece düzeyinde "kontrolsüz" diye ayrıca sayılır.) */
export function bakilacakMi(oyun: Pick<Oyun, 'kontrol'>): boolean {
  const k = oyun.kontrol;
  if (!k) return false;
  return k.guven === 'orta' || k.guven === 'dusuk' || (k.uyarilar?.length ?? 0) > 0;
}

const yeniOnce = (a: KontrolGirdisi, b: KontrolGirdisi) => b.gece.tarih.valueOf() - a.gece.tarih.valueOf();

/**
 * Sayfanın üç bölümü: `bakilacak` (inceleme: bekliyor gecelerdeki bakılacak satırlar; en yeni gece önce, gece içinde sıra artan),
 * `bekleyen` (inceleme: bekliyor geceler; en yeni önce), `onayli` (diğer geceler; en yeni önce).
 */
export function kontrolOzeti(girdiler: readonly KontrolGirdisi[]): { bakilacak: BakilacakSatir[]; bekleyen: BekleyenGece[]; onayli: KontrolGirdisi[] } {
  const sirali = [...girdiler].sort(yeniOnce);
  const bekleyenler = sirali.filter((g) => incelemeBekliyor(g.gece));
  return {
    bakilacak: bekleyenler.flatMap(({ id, gece }) =>
      [...gece.oyunlar].sort((a, b) => a.sira - b.sira).filter(bakilacakMi).map((oyun) => ({ id, gece, oyun })),
    ),
    bekleyen: bekleyenler.map(({ id, gece }) => ({
      id,
      gece,
      satirSayisi: gece.oyunlar.length,
      bakilacakSayisi: gece.oyunlar.filter(bakilacakMi).length,
      kontrolsuzSayisi: gece.oyunlar.filter((o) => !o.kontrol).length,
    })),
    onayli: sirali.filter((g) => !incelemeBekliyor(g.gece)),
  };
}

/** Bir satırın zaman bağlantısı: YouTube ise videonun o saniyesi, değilse (nba.com) videonun kendisi; zaman yoksa undefined. */
export function zamanBaglantisi(gece: Pick<Gece, 'video'>, oyun: Pick<Oyun, 'zaman'>): string | undefined {
  if (!oyun.zaman) return undefined;
  return videoZamanAdresi(gece.video, oyun.zaman) ?? gece.video;
}
