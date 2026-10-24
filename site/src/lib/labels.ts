export const TUR: Record<string, string> = {
  oyun: 'Oyun',
  uygulama: 'Uygulama',
  site: 'Site',
  arac: 'Araç',
};

export const DURUM: Record<string, string> = {
  yayinda: 'Yayında',
  gelistiriliyor: 'Geliştiriliyor',
  yakinda: 'Yakında',
  arsiv: 'Arşiv',
};

export const BARINDIRMA: Record<string, string> = {
  cloudflare: 'Cloudflare',
  lab: 'Lab',
  vps: 'VPS',
  harici: 'Harici',
};

export const STORE: Record<string, string> = {
  appStore: 'App Store',
  googlePlay: 'Google Play',
  steam: 'Steam',
  itch: 'itch.io',
};

/** /projeler/tur/<slug>/ için tür slug'ları (şemadaki enum değerleriyle aynı). */
export const TUR_SIRASI = ['oyun', 'uygulama', 'site', 'arac'] as const;
