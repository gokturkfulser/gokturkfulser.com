import Alinti from './Alinti.astro';
import Gorsel from './Gorsel.astro';
import IkiGorsel from './IkiGorsel.astro';
import IstatistikTablosu from './IstatistikTablosu.astro';
import GrafikIlkSekizHafta from '../grafik/GrafikIlkSekizHafta.astro';
import GrafikSakatlikOranlari from '../grafik/GrafikSakatlikOranlari.astro';
import GrafikSakatlikSuresi from '../grafik/GrafikSakatlikSuresi.astro';

/** MDX içinde import gerektirmeden kullanılan bileşenler: <Content components={mdxBilesenleri} /> */
export const mdxBilesenleri = {
  Alinti,
  Gorsel,
  IkiGorsel,
  IstatistikTablosu,
  GrafikIlkSekizHafta,
  GrafikSakatlikOranlari,
  GrafikSakatlikSuresi,
};
