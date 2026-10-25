// Site genelinde kullanılan sabitler (kök CLAUDE.md "Adlar" bölümüyle uyumlu).
export const SITE_ADI = 'Göktürk Fulser';

export const EPOSTA = 'merhaba@gokturkfulser.com';

export const PROFILLER = [
  { ad: 'GitHub', href: 'https://github.com/gokturkfulser' },
  { ad: 'RSS', href: '/rss.xml' },
] as const;

export const MENU = [
  { ad: 'Ana sayfa', href: '/', tam: true },
  { ad: 'Yazılar', href: '/yazilar/' },
  { ad: 'Projeler', href: '/projeler/' },
  { ad: 'Hakkımda', href: '/hakkimda/' },
] as const;

// İsteğe bağlı tanıtım metinleri. Boş bırakılırsa ilgili öğe hiç render edilmez (başlık, paragraf ya da boşluk kalmaz);
// metin yazıldığında kendiliğinden görünür.
/** Ana sayfa hero'sunda adın altındaki tek cümle. */
export const HERO_CUMLESI = '';
/** Ana sayfadaki "Kısaca" bölümünün metni (bölüm, metin yazılana kadar görünmez). */
export const KISACA_METNI = '';
