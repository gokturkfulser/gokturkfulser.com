// Adres haritası: İngilizce kökte, Türkçe `/tr/` altında; yol parçaları dile göre yerelleşir (writing ↔ yazilar…).
// Sayfa dosyaları `src/pages/` (en) ve `src/pages/tr/` altındadır; bu tablo dosya adlarıyla aynı kalmalıdır.
import { DILLER, type Dil } from './index';

export type Bolum = 'sinema' | 'basketbol';
export type ProjeTuru = 'oyun' | 'uygulama' | 'site' | 'arac';

const YOL = {
  en: { yazilar: 'writing', sinema: 'cinema', basketbol: 'basketball', projeler: 'projects', tur: 'type', hakkimda: 'about', arama: 'search', etiketler: 'tags' },
  tr: { yazilar: 'yazilar', sinema: 'sinema', basketbol: 'basketbol', projeler: 'projeler', tur: 'tur', hakkimda: 'hakkimda', arama: 'arama', etiketler: 'etiketler' },
} as const;

const TUR_SLUG: Record<Dil, Record<ProjeTuru, string>> = {
  en: { oyun: 'game', uygulama: 'app', site: 'site', arac: 'tool' },
  tr: { oyun: 'oyun', uygulama: 'uygulama', site: 'site', arac: 'arac' },
};
export const turSlug = (dil: Dil, tur: ProjeTuru) => TUR_SLUG[dil][tur];
export const turuBul = (dil: Dil, slug: string) =>
  (Object.keys(TUR_SLUG[dil]) as ProjeTuru[]).find((t) => TUR_SLUG[dil][t] === slug);

const on = (dil: Dil) => (dil === 'tr' ? '/tr' : '');

export const yol = {
  ana: (dil: Dil) => `${on(dil)}/`,
  yazilar: (dil: Dil, bolum?: Bolum) => `${on(dil)}/${YOL[dil].yazilar}/${bolum ? `${YOL[dil][bolum]}/` : ''}`,
  yazi: (dil: Dil, slug: string) => `${on(dil)}/${YOL[dil].yazilar}/${slug}/`,
  projeler: (dil: Dil) => `${on(dil)}/${YOL[dil].projeler}/`,
  proje: (dil: Dil, slug: string) => `${on(dil)}/${YOL[dil].projeler}/${slug}/`,
  projeTuru: (dil: Dil, tur: ProjeTuru) => `${on(dil)}/${YOL[dil].projeler}/${YOL[dil].tur}/${TUR_SLUG[dil][tur]}/`,
  hakkimda: (dil: Dil) => `${on(dil)}/${YOL[dil].hakkimda}/`,
  arama: (dil: Dil) => `${on(dil)}/${YOL[dil].arama}/`,
  etiket: (dil: Dil, slug: string) => `${on(dil)}/${YOL[dil].etiketler}/${slug}/`,
  rss: (dil: Dil, bolum?: Bolum) => (bolum ? `${yol.yazilar(dil, bolum)}rss.xml` : `${on(dil)}/rss.xml`),
  /** OG görselleri: /og/<dil>/<bolum>/<slug>.png ve /og/<dil>/varsayilan.png */
  og: (dil: Dil, bolum: Bolum, slug: string) => `/og/${dil}/${bolum}/${slug}.png`,
  ogVarsayilan: (dil: Dil) => `/og/${dil}/varsayilan.png`,
};

/** Bir sayfanın dillerdeki gerçek karşılıkları (hreflang). Yalnızca var olanlar yazılır. */
export type Esdeger = Partial<Record<Dil, string>>;
/** Her dilde aynı biçimde var olan sayfalar için. */
export const ikiDilde = (f: (dil: Dil) => string): Esdeger => Object.fromEntries(DILLER.map((d) => [d, f(d)]));
