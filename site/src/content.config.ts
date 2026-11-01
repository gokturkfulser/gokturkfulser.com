import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { parse as parseYaml } from 'yaml';
import { slugify } from './lib/slug';
import { taslakKlasorDesenleri } from './lib/taslak-loader';

// Her içerik kendi klasöründe: <koleksiyon>/<slug>/index.mdx + görseller.
// id, klasör adının Türkçe transliterasyonlu slug'ıdır. Production'da taslak klasörleri desenden çıkar.
const klasorLoader = (base: string) =>
  glob({
    base,
    pattern: ['*/index.{md,mdx}', ...taslakKlasorDesenleri(base)],
    generateId: ({ entry }) => slugify(entry.split('/')[0] ?? entry),
  });

const sinema = defineCollection({
  loader: klasorLoader('./src/content/sinema'),
  schema: ({ image }) =>
    z.object({
      baslik: z.string(),
      tarih: z.coerce.date(),
      ozet: z.string(),
      film: z.object({
        ad: z.string(),
        orijinalAd: z.string().optional(),
        yil: z.number().int(),
        yonetmen: z.string(),
        tmdbId: z.number().int().positive().optional(),
      }),
      // 0–5 arası, yarım puanlı
      puan: z.number().min(0).max(5).multipleOf(0.5).optional(),
      // Yoksa TMDB backdrop'u (film.tmdbId), o da yoksa görselsiz yedek kapak (projektör ışığı + yıl).
      kapak: image().optional(),
      etiketler: z.array(z.string()).default([]),
      // Ana sayfada öne çıkar; hiçbiri işaretli değilse en yeniler gösterilir.
      oneCikan: z.boolean().default(false),
      taslak: z.boolean().default(false),
    }),
});

const basketbol = defineCollection({
  loader: klasorLoader('./src/content/basketbol'),
  schema: ({ image }) =>
    z.object({
      baslik: z.string(),
      tarih: z.coerce.date(),
      ozet: z.string(),
      sezon: z.string().optional(),
      takimlar: z.array(z.string()).optional(),
      oyuncular: z.array(z.string()).optional(),
      // İsteğe bağlı istatistik satırı: başlıkta skorbord gibi gösterilir.
      istatistik: z
        .array(
          z.object({
            etiket: z.string(),
            deger: z.union([z.string(), z.number()]),
          }),
        )
        .max(6)
        .optional(),
      // Yoksa görselsiz yedek kapak (saha çizgileri + sezon/istatistik) üretilir.
      kapak: image().optional(),
      etiketler: z.array(z.string()).default([]),
      oneCikan: z.boolean().default(false),
      taslak: z.boolean().default(false),
    }),
});

const projeler = defineCollection({
  loader: klasorLoader('./src/content/projeler'),
  schema: ({ image }) =>
    z.object({
      ad: z.string(),
      ozet: z.string(),
      tur: z.enum(['oyun', 'uygulama', 'site', 'arac']),
      barindirma: z.enum(['cloudflare', 'lab', 'vps', 'harici']),
      durum: z.enum(['yayinda', 'gelistiriliyor', 'yakinda', 'arsiv']),
      url: z.url().optional(),
      embedUrl: z.url().optional(),
      repo: z.url().optional(),
      storeLinkleri: z
        .object({
          appStore: z.url().optional(),
          googlePlay: z.url().optional(),
          steam: z.url().optional(),
          itch: z.url().optional(),
        })
        .optional(),
      stack: z.array(z.string()).default([]),
      gorsel: image(),
      // Detay sayfasında gösterilen ekran görüntüleri; alt metin zorunlu.
      ekranGoruntuleri: z
        .array(z.object({ gorsel: image(), alt: z.string(), altyazi: z.string().optional() }))
        .default([]),
      // Doğrudan video dosyası (.mp4/.webm), YouTube ya da Vimeo bağlantısı.
      demoVideo: z.url().optional(),
      // Vaka çalışması modülleri (proje sayfasının varsayılan düzeni): ne, neden, nasıl. Boş/eksik olan modül hiç render edilmez.
      // Uzun anlatım MDX gövdesindedir; bu alanlar sayfanın üstündeki kısa, taranabilir özetlerdir.
      vaka: z
        .object({
          ne: z.string().trim().optional(),
          neden: z.string().trim().optional(),
          nasil: z.string().trim().optional(),
        })
        .optional(),
      oneCikan: z.boolean().default(false),
      sira: z.number().int().default(100),
      // true ise production'da görünmez (SHOW_DRAFTS=true ile preview'da görünür).
      taslak: z.boolean().default(false),
    }),
});

// /hakkimda/ özgeçmişi: tek kayıtlı veri dosyası (kimlik: `ozgecmis`). Dosya düz bir belgedir; yükleyici onu tek kayda sarar.
// Metin alanları { en, tr } biçiminde iki dilli; i18n gelene kadar sayfa `tr`'yi gösterir (`yerel`, lib/format.ts).
// Tarihler "YYYY-AA" ya da "YYYY" (YAML `2016`'yı sayı okur, bu yüzden metne çevrilir); `bitis: null` ya da yok = devam ediyor.
const yerel = z.object({ en: z.string().trim(), tr: z.string().trim() });
const tarih = z.coerce.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, 'YYYY ya da YYYY-AA');
const bitis = tarih.nullish();

const ozgecmis = defineCollection({
  loader: file('./src/content/ozgecmis.yaml', {
    parser: (metin) => [{ id: 'ozgecmis', ...(parseYaml(metin) as Record<string, unknown>) }],
  }),
  schema: z.object({
    // true iken production'da özgeçmiş görünmez (SHOW_DRAFTS=true ile preview'da görünür).
    taslak: z.boolean().default(false),
    kimlik: z.object({
      ad: z.string(),
      unvan: yerel,
      konum: yerel.optional(),
      eposta: z.email().optional(),
      baglantilar: z.array(z.object({ ad: z.string(), url: z.url() })).default([]),
    }),
    // Boş (en ve tr boş) ise render edilmez.
    ozet: yerel.optional(),
    deneyim: z
      .array(
        z.object({
          kurum: z.string(),
          konum: z.string().optional(),
          web: z.union([z.url(), z.literal('')]).optional(),
          // Bir kurumun altında birden çok rol olabilir.
          roller: z
            .array(
              z.object({
                unvan: yerel,
                baslangic: tarih,
                bitis,
                // Unvanın altında küçük bir satır olarak gösterilir.
                not: yerel.optional(),
                maddeler: z.array(yerel).default([]),
              }),
            )
            .min(1),
        }),
      )
      .default([]),
    egitim: z
      .array(
        z.object({
          kurum: yerel,
          derece: yerel,
          konum: z.string().optional(),
          web: z.union([z.url(), z.literal('')]).optional(),
          baslangic: tarih,
          bitis,
        }),
      )
      .default([]),
    // Site içi proje slug'ları (src/content/projeler/<slug>); bulunamayan ya da taslak olan atlanır.
    projeler: z.array(z.object({ slug: z.string() })).default([]),
    diller: z.array(z.object({ ad: yerel, seviye: yerel })).default([]),
    beceriler: z.array(z.object({ grup: yerel, ogeler: z.array(z.string()).min(1) })).default([]),
  }),
});

export const collections = { sinema, basketbol, projeler, ozgecmis };
