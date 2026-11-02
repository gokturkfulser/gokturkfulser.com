// Gemini API (Interactions API, resmi dokümandaki biçim): videoyu İNDİRMEDEN, yalnızca resmi YouTube URL girişiyle gönderir
// ({ type: 'video', uri }); yanıtı JSON şemasıyla (response_format) alır. Anahtar `x-goog-api-key` başlığıyla gider, hiçbir yere yazılmaz.
// İstem metni istem.md'de durur ve her çalıştırmada dosyadan okunur (düzenlenebilir); şemadaki alan adları ve enum değerleri onunla birebir aynıdır.
// Dokümanlar: aistudio.google.com/docs/video-understanding, /docs/structured-output, /docs/interactions-breaking-changes-may-2026.
import { readFileSync } from 'node:fs';
import { COZUNURLUKLER, GEMINI_API_REVIZYONU, GEMINI_API_TABANI, GEMINI_ZAMAN_ASIMI_MS, VARSAYILAN_COZUNURLUK, type Cozunurluk } from './ayarlar.ts';
import type { FetchFn } from './youtube.ts';
import { GEMINI_ETIKET_DEGERLERI, GEMINI_EYLEM_DEGERLERI, GEMINI_ROL_DEGERLERI } from '../../src/lib/top10-sozluk.ts';

export type Guven = 'high' | 'medium' | 'low';
export type HamKatki = { player: string; team: string; role: string; share: number; share_reason?: string | null };
export type HamOyun = {
  rank: number;
  action: string;
  contributors: HamKatki[];
  opponent?: string | null;
  tags?: string[];
  description?: string | null;
  timestamp?: string | null;
  confidence: Guven;
  confidence_reason?: string | null;
};
export type HamGece = { date?: string; type?: string; plays: HamOyun[] };
export type Kullanim = { girdi?: number; cikti?: number; dusunme?: number; toplam?: number };

/** İstem dosyası: her çalıştırmada okunur. */
export const ISTEM_DOSYASI = new URL('./istem.md', import.meta.url);

export function istemOku(dosya: URL | string = ISTEM_DOSYASI): string {
  let metin: string;
  try {
    metin = readFileSync(dosya, 'utf8');
  } catch {
    throw new Error(`İstem dosyası okunamadı: scripts/top10/istem.md`);
  }
  metin = metin.replace(/\r\n/g, '\n').trim();
  if (!metin) throw new Error('İstem dosyası boş: scripts/top10/istem.md');
  return metin;
}

/** İstemdeki {tarih} ve {sezon} yer tutucularını doldurur (başlıktan gelen tarih ve betiğin sezon türetmesi). Yer tutucu yoksa metin aynen kalır. */
export const istemHazirla = (istem: string, bilgi: { tarih: string; sezon: string }) => istem.replaceAll('{tarih}', bilgi.tarih).replaceAll('{sezon}', bilgi.sezon);

/** GEMINI_COZUNURLUK: boşsa varsayılan (high); geçersiz değer → hata. "unspecified" çözünürlük alanı göndermez. */
export function cozunurlukCoz(deger: string | undefined): Cozunurluk {
  const d = deger?.trim().toLowerCase();
  if (!d) return VARSAYILAN_COZUNURLUK;
  if (!(COZUNURLUKLER as readonly string[]).includes(d)) throw new Error(`GEMINI_COZUNURLUK geçersiz: "${deger}" (geçerli: ${COZUNURLUKLER.join(', ')})`);
  return d as Cozunurluk;
}

const bosOlabilir = (tip: string) => ({ type: [tip, 'null'] });

/** Gemini'nin yanıt şeması (JSON Schema alt kümesi; minLength vb. yok sayılır, asıl doğrulama top10Sema'dadır).
 *  Alan adları ve enum değerleri istem.md'dekilerle aynıdır. `confidence_reason` istemde ayrı bir alan adı olarak geçmez
 *  ("confidence ... with one short reason if not high"); gerekçe için şemaya eklenmiştir. */
export const YANIT_SEMASI = {
  type: 'object',
  required: ['date', 'type', 'plays'],
  properties: {
    date: { type: 'string' },
    type: { type: 'string', enum: ['top10', 'top5'] },
    plays: {
      type: 'array',
      items: {
        type: 'object',
        required: ['rank', 'action', 'contributors', 'confidence'],
        properties: {
          rank: { type: 'integer', minimum: 1, maximum: 10 },
          action: { type: 'string', enum: GEMINI_EYLEM_DEGERLERI },
          contributors: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            items: {
              type: 'object',
              required: ['player', 'team', 'role', 'share'],
              properties: {
                player: { type: 'string' },
                team: { type: 'string' },
                role: { type: 'string', enum: GEMINI_ROL_DEGERLERI },
                share: { type: 'integer', minimum: 1, maximum: 100 },
                share_reason: bosOlabilir('string'),
              },
            },
          },
          opponent: bosOlabilir('string'),
          tags: { type: 'array', items: { type: 'string', enum: GEMINI_ETIKET_DEGERLERI } },
          description: bosOlabilir('string'),
          timestamp: bosOlabilir('string'),
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          confidence_reason: bosOlabilir('string'),
        },
      },
    },
  },
} as const;

/** Modele giden metin: istem.md aynen; yeniden denemede önceki doğrulama hatası eklenir. */
export const istemMetni = (istem: string, oncekiHata?: string) =>
  oncekiHata ? `${istem}\n\nYour previous answer was rejected by validation: ${oncekiHata} Fix exactly that and answer again.` : istem;

/** Interactions API istek gövdesi. */
export function istekGovdesi(model: string, videoUrl: string, istem: string, oncekiHata?: string, cozunurluk?: Cozunurluk) {
  return {
    model,
    input: [
      { type: 'text', text: istemMetni(istem, oncekiHata) },
      { type: 'video', uri: videoUrl, ...(cozunurluk && cozunurluk !== 'unspecified' ? { resolution: cozunurluk } : {}) },
    ],
    response_format: { type: 'text', mime_type: 'application/json', schema: YANIT_SEMASI },
    generation_config: { temperature: 0.2 },
  };
}

/** Yanıttan nihai metin: son `model_output` adımının `content` dizisindeki metin blokları (resmi yanıt biçimi: steps[]). */
export function yanitMetni(yanit: any): string {
  const adimlar: any[] = Array.isArray(yanit?.steps) ? yanit.steps : [];
  const son = [...adimlar].reverse().find((a) => a?.type === 'model_output');
  const metin = (son?.content ?? [])
    .filter((c: any) => c?.type === 'text' && typeof c.text === 'string')
    .map((c: any) => c.text)
    .join('');
  if (!metin) throw new Error('Gemini yanıtında model_output metni yok.');
  return metin;
}

/** Yanıtın bildirdiği model sürümü (varsa): `model`, `model_version` ya da `modelVersion` alanı; yoksa undefined. */
export function modelSurumuCoz(yanit: any): string | undefined {
  for (const alan of ['model_version', 'modelVersion', 'model']) {
    const v = yanit?.[alan];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

/** Yanıttaki `usage` (resmi alan adları: total_input_tokens, total_output_tokens, total_thought_tokens, total_tokens); yoksa undefined. */
export function kullanimCoz(yanit: any): Kullanim | undefined {
  const u = yanit?.usage;
  if (!u || typeof u !== 'object') return undefined;
  const sayi = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  const k: Kullanim = { girdi: sayi(u.total_input_tokens), cikti: sayi(u.total_output_tokens), dusunme: sayi(u.total_thought_tokens), toplam: sayi(u.total_tokens) };
  return Object.values(k).some((v) => v !== undefined) ? k : undefined;
}

const temizle = (metin: string, anahtar: string) => (anahtar ? metin.split(anahtar).join('***') : metin);

/** Bir videoyu Gemini'ye verir, ham gece verisini ve (yanıtta varsa) token kullanımını döndürür. İçerik doğrulaması çağıranda. */
export async function geceUret(secenek: {
  anahtar: string;
  model: string;
  videoUrl: string;
  istem: string;
  fetchFn: FetchFn;
  oncekiHata?: string;
  /** Video girdi parçasındaki `resolution` değeri; undefined ya da "unspecified" = alan gönderilmez. */
  cozunurluk?: Cozunurluk;
}): Promise<{ ham: HamGece; kullanim?: Kullanim; modelSurumu?: string; cozunurlukReddedildi?: boolean }> {
  const { anahtar, model, videoUrl, istem, fetchFn, oncekiHata } = secenek;
  const gonder = async (cozunurluk?: Cozunurluk) => {
    try {
      return await fetchFn(`${GEMINI_API_TABANI}/interactions`, {
        method: 'POST',
        headers: { 'x-goog-api-key': anahtar, 'Content-Type': 'application/json', 'Api-Revision': GEMINI_API_REVIZYONU },
        body: JSON.stringify(istekGovdesi(model, videoUrl, istem, oncekiHata, cozunurluk)),
        signal: AbortSignal.timeout(GEMINI_ZAMAN_ASIMI_MS),
      });
    } catch (hata) {
      throw new Error(`Gemini isteği başarısız: ${temizle(hata instanceof Error ? hata.message : String(hata), anahtar)}`);
    }
  };
  let yanit = await gonder(secenek.cozunurluk);
  let metin = await yanit.text();
  let cozunurlukReddedildi = false;
  // Dokümanda `resolution`'ın YouTube URL girdisinde desteklendiği yazmıyor: API alanı reddederse (400 + "resolution") alansız bir kez daha denenir.
  if (!yanit.ok && yanit.status === 400 && secenek.cozunurluk && secenek.cozunurluk !== 'unspecified' && /resolution/i.test(metin)) {
    cozunurlukReddedildi = true;
    yanit = await gonder(undefined);
    metin = await yanit.text();
  }
  if (!yanit.ok) throw new Error(`Gemini ${yanit.status}: ${temizle(metin.slice(0, 400), anahtar)}`);
  let govde: unknown;
  let veri: unknown;
  try {
    govde = JSON.parse(metin);
    veri = JSON.parse(yanitMetni(govde));
  } catch (hata) {
    throw new Error(`Gemini yanıtı ayrıştırılamadı: ${temizle(hata instanceof Error ? hata.message : String(hata), anahtar)}`);
  }
  if (!veri || typeof veri !== 'object' || !Array.isArray((veri as HamGece).plays)) throw new Error('Gemini yanıtında "plays" dizisi yok.');
  return { ham: veri as HamGece, kullanim: kullanimCoz(govde), modelSurumu: modelSurumuCoz(govde), cozunurlukReddedildi };
}
