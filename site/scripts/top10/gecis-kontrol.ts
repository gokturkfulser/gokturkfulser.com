// Tek seferlik geçiş: mevcut gece dosyalarındaki YAML yorumlarından (güven, oy oranı, alternatifler, uyarılar) her oyunun `kontrol` alanını üretir.
// Yalnızca `kontrol` alanını ekler ve yorumları o alandan yeniden üretir; başka hiçbir alanı, `inceleme` durumunu ya da veriyi değiştirmez.
// Dosya yazılmadan önce ayrıştırılmış nesne karşılaştırmasıyla (kontrol dışındaki her şey birebir aynı) ve metin düzeyinde doğrulanır;
// doğrulama geçmezse o dosyaya dokunulmaz ve çıkış kodu 1 olur. Tekrar çalıştırmak güvenlidir (kontrolü olan oyunlara dokunmaz).
//
// Kullanım: node scripts/top10/gecis-kontrol.ts [--klasor <top10 klasörü>] [--kuru]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { Document, parse, parseDocument, type YAMLMap, type YAMLSeq } from 'yaml';
import { top10Sema } from '../../src/lib/top10-sema.ts';
import { kontrolYorumlari, yorumdanKontrol } from './kontrol.ts';

export type GecisSonucu =
  | { durum: 'degisti'; metin: string; eklenen: number; atlanan: number }
  | { durum: 'degismedi'; neden: string }
  | { durum: 'hata'; hata: string };

/** Oyun satırlarındaki `kontrol` alanını çıkarır (kontrol dışındaki içeriği karşılaştırmak için). */
function kontrolsuz(veri: any): any {
  if (!veri || !Array.isArray(veri.oyunlar)) return veri;
  return { ...veri, oyunlar: veri.oyunlar.map(({ kontrol: _k, ...oyun }: any) => oyun) };
}

/** Yorum satırlarını ve `kontrol:` bloklarını atar; kalan metin geçişten etkilenmemiş olmalıdır (metin düzeyinde ikinci doğrulama). */
export function kontrolDisiMetin(metin: string): string {
  const satirlar = metin.split('\n');
  const cikti: string[] = [];
  let atla = 0;
  for (const satir of satirlar) {
    if (/^\s*#/.test(satir)) continue;
    const kontrolBasi = /^(\s+)kontrol:\s*$/.exec(satir);
    if (kontrolBasi) {
      atla = kontrolBasi[1]!.length;
      continue;
    }
    if (atla) {
      const girinti = /^(\s*)\S/.exec(satir)?.[1]!.length ?? 0;
      if (satir.trim() === '' || girinti > atla) continue;
      atla = 0;
    }
    cikti.push(satir);
  }
  return cikti.join('\n').trimEnd(); // dosya sonundaki boşluk/satır sonu karşılaştırmaya girmez
}

/** Bir gece dosyasının metnine kontrol alanını ekler; doğrulama (nesne eşitliği + metin eşitliği + şema) içindedir. */
export function kontrolEkle(girdi: string): GecisSonucu {
  // Dosyaların satır sonu karışık olabilir (CRLF); işlem LF üzerinde yapılır, çıktı dosyanın kendi satır sonuyla yazılır.
  const CR = String.fromCharCode(13);
  const LF = String.fromCharCode(10);
  const crlf = girdi.includes(CR + LF);
  const metin = girdi.split(CR + LF).join(LF);
  let onceki: unknown;
  try {
    onceki = parse(metin);
  } catch (e) {
    return { durum: 'hata', hata: `YAML okunamadı: ${(e as Error).message}` };
  }
  const belge = parseDocument(metin);
  const oyunlar = belge.get('oyunlar', true) as YAMLSeq<YAMLMap> | undefined;
  if (!oyunlar?.items) return { durum: 'hata', hata: 'oyunlar listesi bulunamadı' };
  let eklenen = 0;
  let atlanan = 0;
  for (const [i, oyun] of oyunlar.items.entries()) {
    if (oyun.has('kontrol')) {
      atlanan++;
      continue;
    }
    // Okunurken ilk oyunun yorumu oyunlar listesine (`seq`), diğerlerininki kendi öğesine bağlanır.
    const yorumSahibi = i === 0 ? oyunlar : oyun;
    const satirlar = (yorumSahibi.commentBefore ?? '').split('\n').map((s) => s.replace(/^ /, '')).filter((s) => s.trim() !== '');
    const kontrol = yorumdanKontrol(satirlar);
    if (!kontrol) return { durum: 'hata', hata: `oyun #${i + 1}: yorumlardan kontrol alanı üretilemedi (${satirlar.length ? `"${satirlar[0]}"` : 'yorum yok'})` };
    oyun.set('kontrol', belge.createNode(kontrol));
    yorumSahibi.commentBefore = kontrolYorumlari(kontrol).map((s) => ` ${s}`).join('\n');
    eklenen++;
  }
  if (eklenen === 0) return { durum: 'degismedi', neden: 'tüm oyunlarda kontrol alanı zaten var' };
  const yeni = belge.toString({ lineWidth: 0 });
  // Doğrulama 1: ayrıştırılmış nesne, kontrol alanları çıkarılınca birebir aynı (inceleme, kaynak, katkılar, pay… hiçbiri değişmemiş).
  let sonraki: unknown;
  try {
    sonraki = parse(yeni);
  } catch (e) {
    return { durum: 'hata', hata: `üretilen YAML okunamadı: ${(e as Error).message}` };
  }
  if (!isDeepStrictEqual(kontrolsuz(onceki), kontrolsuz(sonraki))) return { durum: 'hata', hata: 'kontrol dışındaki içerik değişti (nesne karşılaştırması)' };
  // Doğrulama 2: metin düzeyinde (yorumlar ve kontrol blokları hariç) aynı.
  if (kontrolDisiMetin(metin) !== kontrolDisiMetin(yeni)) return { durum: 'hata', hata: 'kontrol dışındaki metin değişti (metin karşılaştırması)' };
  // Doğrulama 3: sitenin şeması yeni dosyayı kabul ediyor.
  const sema = top10Sema.safeParse(sonraki);
  if (!sema.success) return { durum: 'hata', hata: `şema: ${sema.error.issues[0]!.path.join('.')}: ${sema.error.issues[0]!.message}` };
  return { durum: 'degisti', metin: crlf ? yeni.split(LF).join(CR + LF) : yeni, eklenen, atlanan };
}

/** Bir klasördeki (`<sezon>/<tarih>.yaml`) tüm gece dosyalarını dönüştürür; `kuru` ise yazmaz. Dönüş: dosya başına sonuç. */
export function klasoruDonustur(klasor: string, kuru: boolean, yaz: (s: string) => void = console.log): { dosya: string; sonuc: GecisSonucu }[] {
  const sonuclar: { dosya: string; sonuc: GecisSonucu }[] = [];
  for (const sezon of readdirSync(klasor, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    for (const ad of readdirSync(join(klasor, sezon)).filter((f) => /^\d{4}-\d{2}-\d{2}\.yaml$/.test(f)).sort()) {
      const yol = join(klasor, sezon, ad);
      const sonuc = kontrolEkle(readFileSync(yol, 'utf8'));
      if (sonuc.durum === 'degisti' && !kuru) writeFileSync(yol, sonuc.metin);
      yaz(`${sezon}/${ad}: ${sonuc.durum === 'degisti' ? `${sonuc.eklenen} oyuna kontrol eklendi${sonuc.atlanan ? `, ${sonuc.atlanan} zaten vardı` : ''}${kuru ? ' (kuru: yazılmadı)' : ''}` : sonuc.durum === 'degismedi' ? `dokunulmadı (${sonuc.neden})` : `HATA: ${sonuc.hata}`}`);
      sonuclar.push({ dosya: `${sezon}/${ad}`, sonuc });
    }
  }
  return sonuclar;
}

const buDosya = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === buDosya) {
  const argumanlar = process.argv.slice(2);
  const i = argumanlar.indexOf('--klasor');
  const klasor = resolve(i >= 0 ? argumanlar[i + 1]! : join(dirname(buDosya), '../../src/content/top10'));
  const kuru = argumanlar.includes('--kuru');
  const sonuclar = klasoruDonustur(klasor, kuru);
  const hatali = sonuclar.filter((s) => s.sonuc.durum === 'hata').length;
  console.log(`\n${sonuclar.length} dosya; değişen ${sonuclar.filter((s) => s.sonuc.durum === 'degisti').length}, hatalı ${hatali}.`);
  process.exit(hatali ? 1 : 0);
}
