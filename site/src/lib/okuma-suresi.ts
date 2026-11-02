// Okuma süresi. Dilin kelime hızı i18n/index.ts'te (tr sondan eklemeli, kelimeler uzun: ~180/dk; en ~230/dk).
// Görsel ve tablo başına küçük bir ek süre eklenir.
import { AYAR, type Dil } from '../i18n';

const GORSEL_SANIYE = 8;

const kelimeBolucu = new Intl.Segmenter('tr', { granularity: 'word' }); // İngilizce için de yeterli (boşluk/noktalama ayrımı)

function temizle(mdx: string): string {
  return mdx
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*(import|export)\s.+$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`|~-]+/g, ' ');
}

export function okumaSuresi(govde: string | undefined, dil: Dil) {
  const metin = temizle(govde ?? '');
  let kelime = 0;
  for (const parca of kelimeBolucu.segment(metin)) if (parca.isWordLike) kelime++;
  const gorsel = (govde?.match(/<(Gorsel|IkiGorsel|IstatistikTablosu|Grafik\w+)\b/g) ?? []).length;
  const saniye = (kelime / AYAR[dil].kelimeHizi) * 60 + gorsel * GORSEL_SANIYE;
  const dakika = Math.max(1, Math.ceil(saniye / 60));
  return { dakika, kelime };
}
