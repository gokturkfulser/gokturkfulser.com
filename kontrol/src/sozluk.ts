// Oyuncu adı sözlüğü (site/src/content/top10/oyuncu-adlari.yaml: kanonik ad → takma adlar). Doğrulama sitenin kendi kuralıdır
// (top10-adlar.ts → sozlukHatasi): geçmeyen ekleme reddedilir. Yazım `yaml` Document API'siyle yapılır (yorumlar ve biçim korunur).
import { parse, parseDocument, YAMLMap, YAMLSeq } from 'yaml';
import { sozlukHaritasi, sozlukHatasi, type AdHaritasi, type AdSozlugu } from '../../site/src/lib/top10-adlar.ts';

/** Dosya metni → sözlük nesnesi (boş dosya ya da null değerler boş liste). */
export function sozlukOku(metin: string | null): Record<string, string[]> {
  const ham = (metin ? parse(metin) : null) as Record<string, unknown> | null;
  const s: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(ham ?? {})) s[k] = Array.isArray(v) ? v.map(String) : [];
  return s;
}

export const sozlukHaritasiOlustur = (metin: string | null): AdHaritasi => sozlukHaritasi(sozlukOku(metin) as AdSozlugu);

const temizle = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Kanonik ada takma ad ekler (kanonik ad yoksa yeni kayıt açılır). Sözlük kurallarını bozuyorsa hata. */
export function takmaAdEkle(metin: string | null, kanonikHam: string, takmaHam: string): { metin: string } | { hata: string } {
  const kanonik = temizle(kanonikHam);
  const takma = temizle(takmaHam);
  if (!kanonik || !takma) return { hata: 'kanonik ad ve takma ad boş olamaz' };
  if (kanonik.length > 80 || takma.length > 80) return { hata: 'adlar en çok 80 karakter olabilir' };
  if (/[:#\[\]{},&*!|>'"%@`\n]/.test(kanonik + takma)) return { hata: 'adlarda özel YAML karakterleri (: # [ ] { } , & * ! | > \' " % @ `) kullanılamaz' };
  const mevcut = sozlukOku(metin);
  const yeni: Record<string, string[]> = { ...mevcut, [kanonik]: [...(mevcut[kanonik] ?? [])] };
  if (!yeni[kanonik]!.includes(takma)) yeni[kanonik]!.push(takma);
  const hata = sozlukHatasi(yeni as AdSozlugu);
  if (hata) return { hata };
  if (JSON.stringify(mevcut) === JSON.stringify(yeni)) return { hata: 'bu takma ad zaten kayıtlı' };

  // Önce satır düzeyinde düzenleme (dosyanın mevcut biçimi, yorumları ve diğer satırlar aynen kalır); beklenmedik biçimde Document API'ye düşülür.
  const cikti = satirDuzeyiEkle(metin ?? '', kanonik, takma) ?? belgeIleEkle(metin ?? '', kanonik, takma);
  // Doğrulama: yazılan metin beklenen sözlüğü verir ve sözlük kurallarından geçer.
  const geri = sozlukOku(cikti);
  if (JSON.stringify(Object.entries(geri).sort()) !== JSON.stringify(Object.entries(yeni).sort())) return { hata: 'yazılan sözlük beklenenle uyuşmuyor; kaydedilmedi' };
  return { metin: cikti.endsWith('\n') ? cikti : `${cikti}\n` };
}

const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);

/** `Anahtar: [a, b]`, `Anahtar:` ya da `Anahtar: []` biçimindeki satırı günceller; yoksa sona yeni satır ekler. Tanınmayan biçimde null. */
function satirDuzeyiEkle(metin: string, kanonik: string, takma: string): string | null {
  const crlf = metin.includes(CR + LF);
  const satirlar = metin.split(CR + LF).join(LF).split(LF);
  const bos = satirlar[satirlar.length - 1] === '';
  if (bos) satirlar.pop();
  const idx = satirlar.findIndex((s) => {
    const m = /^(?:"([^"]+)"|'([^']+)'|([^:#\s\[][^:#]*?))\s*:(?:\s|$)/.exec(s);
    return m !== null && (m[1] ?? m[2] ?? m[3])!.trim() === kanonik;
  });
  if (idx >= 0) {
    const m = /^(.*?:)\s*(.*?)\s*$/.exec(satirlar[idx]!)!;
    const rest = m[2]!;
    if (rest === '' || rest === 'null' || rest === '~') satirlar[idx] = `${m[1]} [${takma}]`;
    else if (rest.startsWith('[') && rest.endsWith(']') && !rest.includes('#')) {
      const ic = rest.slice(1, -1).trim();
      satirlar[idx] = `${m[1]} [${ic ? `${ic}, ` : ''}${takma}]`;
    } else return null;
    // "Anahtar:" satırının altında blok liste varsa (satır "- ..." ile devam) bu yol uygun değil.
    if (rest === '' && /^\s+-\s/.test(satirlar[idx + 1] ?? '')) return null;
  } else satirlar.push(`${kanonik}: [${takma}]`);
  const cikti = `${satirlar.join(LF)}${LF}`;
  return crlf ? cikti.split(LF).join(CR + LF) : cikti;
}

function belgeIleEkle(metin: string, kanonik: string, takma: string): string {
  const belge = parseDocument(metin);
  if (!(belge.contents instanceof YAMLMap)) belge.contents = new YAMLMap(belge.schema) as never;
  const harita = belge.contents as YAMLMap;
  const dugum = harita.get(kanonik, true);
  if (dugum instanceof YAMLSeq) dugum.add(takma);
  else {
    const seq = belge.createNode([takma]) as YAMLSeq;
    seq.flow = true;
    if (harita.has(kanonik)) harita.set(kanonik, seq);
    else harita.items.push(belge.createPair(kanonik, seq) as never);
  }
  return belge.toString({ lineWidth: 0 });
}
