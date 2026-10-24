// Türkçe okuma süresi. Türkçe sondan eklemeli olduğu için kelimeler uzun; ekranda sessiz
// okumada ortalama ~180 kelime/dakika alınır. Görsel ve tablo başına küçük bir ek süre eklenir.
const DAKIKADA_KELIME = 180;
const GORSEL_SANIYE = 8;

const kelimeBolucu = new Intl.Segmenter('tr', { granularity: 'word' });

function temizle(mdx: string): string {
  return mdx
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*(import|export)\s.+$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`|~-]+/g, ' ');
}

export function okumaSuresi(govde: string | undefined) {
  const metin = temizle(govde ?? '');
  let kelime = 0;
  for (const parca of kelimeBolucu.segment(metin)) if (parca.isWordLike) kelime++;
  const gorsel = (govde?.match(/<(Gorsel|IkiGorsel|IstatistikTablosu)\b/g) ?? []).length;
  const saniye = (kelime / DAKIKADA_KELIME) * 60 + gorsel * GORSEL_SANIYE;
  const dakika = Math.max(1, Math.ceil(saniye / 60));
  return { dakika, kelime };
}
