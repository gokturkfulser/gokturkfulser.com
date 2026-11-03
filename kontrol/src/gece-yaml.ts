// Gece dosyasını `yaml` paketinin Document API'siyle yeniden yazar: yorumlar, `zaman` (tırnaklı) ve `kontrol` alanı korunur; oyunun düzenlenen
// alanları sitenin dosya düzenine uygun yazılır (katkılar ve etiketler akış biçiminde). `elle_duzenlendi: true` her kayıtta yazılır;
// `inceleme` yalnızca istenirse değişir (Kaydet: olduğu gibi; Kaydet ve onayla / Onayla: onaylandi).
import { parse, parseDocument, YAMLMap, YAMLSeq, type Document, type Pair } from 'yaml';
import { derinEsit } from './derin-esit.ts';
import type { OyunGirdisi } from './form.ts';

const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);

export type YazimSecenegi = { inceleme?: 'onaylandi' };

const akisSeq = (belge: Document, dizi: unknown[]) => {
  const n = belge.createNode(dizi) as YAMLSeq;
  n.flow = true;
  return n;
};

/** `oyunlar`: dosyadaki her sıra için yeni değerler (eksik sıra olamaz). Doğrulama içindedir; tutarsızlıkta hata fırlatır. */
export function geceyiYenidenYaz(girdi: string, oyunlar: readonly OyunGirdisi[], secenek: YazimSecenegi = {}): string {
  const crlf = girdi.includes(CR + LF);
  const kaynak = girdi.split(CR + LF).join(LF);
  const onceki: any = parse(kaynak);
  const belge = parseDocument(kaynak);
  const seq = belge.get('oyunlar', true) as YAMLSeq<YAMLMap> | undefined;
  if (!seq?.items) throw new Error('oyunlar listesi bulunamadı');
  if (seq.items.length !== oyunlar.length) throw new Error('oyun sayısı dosyayla uyuşmuyor');

  seq.items = seq.items.map((eski) => {
    const sira = eski.get('sira') as number;
    const o = oyunlar.find((x) => x.sira === sira);
    if (!o) throw new Error(`sıra ${sira} için değer yok`);
    const yeni = new YAMLMap(belge.schema);
    const ekle = (k: string, v: unknown) => yeni.items.push(belge.createPair(k, v) as Pair);
    ekle('sira', sira);
    if (o.eylem) ekle('eylem', o.eylem);
    if (o.etiketler?.length) ekle('etiketler', akisSeq(belge, o.etiketler));
    if (o.aciklama) ekle('aciklama', o.aciklama);
    if (o.rakip) ekle('rakip', o.rakip);
    const zaman = eski.get('zaman', true);
    if (zaman !== undefined) ekle('zaman', zaman);
    const katkilar = new YAMLSeq(belge.schema);
    for (const k of o.katkilar) {
      const m = belge.createNode({ oyuncu: k.oyuncu, takim: k.takim, rol: k.rol, ...(k.pay !== undefined ? { pay: k.pay } : {}) }) as YAMLMap;
      m.flow = true;
      katkilar.items.push(m);
    }
    ekle('katkilar', katkilar);
    const kontrol = eski.get('kontrol', true);
    if (kontrol !== undefined) ekle('kontrol', kontrol);
    yeni.commentBefore = eski.commentBefore; // kontrolden üretilmiş yorumlar (kontrol alanı değişmedi)
    return yeni;
  });

  // Üst düzey: inceleme (istenirse onaylandi) ve elle_duzenlendi (inceleme'nin hemen altında).
  const ust = belge.contents as YAMLMap;
  if (secenek.inceleme) {
    if (ust.has('inceleme')) ust.set('inceleme', secenek.inceleme);
    else ust.items.splice(sonrasi(ust, 'kaynak'), 0, belge.createPair('inceleme', secenek.inceleme) as Pair);
  }
  if (ust.has('elle_duzenlendi')) ust.set('elle_duzenlendi', true);
  else ust.items.splice(sonrasi(ust, 'inceleme', 'kaynak'), 0, belge.createPair('elle_duzenlendi', true) as Pair);

  const cikti = belge.toString({ lineWidth: 0 });
  // Doğrulama: ayrıştırılmış sonuç beklenenle birebir aynı olmalı (zaman ve kontrol korunmuş, yalnızca istenen alanlar değişmiş).
  const beklenen = {
    ...onceki,
    ...(secenek.inceleme ? { inceleme: secenek.inceleme } : {}),
    elle_duzenlendi: true,
    oyunlar: onceki.oyunlar.map((eski: any) => {
      const o = oyunlar.find((x) => x.sira === eski.sira)!;
      return {
        sira: eski.sira,
        ...(o.eylem ? { eylem: o.eylem } : {}),
        ...(o.etiketler?.length ? { etiketler: o.etiketler } : {}),
        ...(o.aciklama ? { aciklama: o.aciklama } : {}),
        ...(o.rakip ? { rakip: o.rakip } : {}),
        ...(eski.zaman !== undefined ? { zaman: eski.zaman } : {}),
        katkilar: o.katkilar,
        ...(eski.kontrol !== undefined ? { kontrol: eski.kontrol } : {}),
      };
    }),
  };
  if (!derinEsit(parse(cikti), beklenen)) throw new Error('yazılan dosya beklenenle uyuşmuyor; kaydedilmedi');
  return crlf ? cikti.split(LF).join(CR + LF) : cikti;
}

/** `anahtarlar` içinden son bulunanın hemen sonrasının indeksi (hiçbiri yoksa sona). */
function sonrasi(harita: YAMLMap, ...anahtarlar: string[]): number {
  for (const a of anahtarlar) {
    const i = harita.items.findIndex((p) => (p.key as { value?: unknown })?.value === a);
    if (i >= 0) return i + 1;
  }
  return harita.items.length;
}

