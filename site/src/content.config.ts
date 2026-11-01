import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
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

// /hakkimda/ özgeçmişi: tek kayıtlı veri dosyası (kimlik: `ozgecmis`). Tarihler "YYYY-AA" ya da "YYYY"; `bitis` yoksa süren kayıt.
const tarih = z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, 'YYYY ya da YYYY-AA');

const ozgecmis = defineCollection({
  loader: file('./src/content/ozgecmis.yaml'),
  schema: z.object({
    // true iken production'da özgeçmiş görünmez (SHOW_DRAFTS=true ile preview'da görünür).
    taslak: z.boolean().default(false),
    ad: z.string(),
    unvan: z.string(),
    konum: z.string().optional(),
    ozet: z.string(),
    deneyim: z
      .array(
        z.object({
          kurum: z.string(),
          rol: z.string(),
          konum: z.string().optional(),
          baslangic: tarih,
          bitis: tarih.optional(),
          maddeler: z.array(z.string()).default([]),
        }),
      )
      .default([]),
    egitim: z
      .array(
        z.object({
          kurum: z.string(),
          bolum: z.string(),
          derece: z.string().optional(),
          baslangic: tarih,
          bitis: tarih.optional(),
        }),
      )
      .default([]),
    beceriler: z.array(z.object({ grup: z.string(), ogeler: z.array(z.string()).min(1) })).default([]),
    diller: z.array(z.object({ dil: z.string(), seviye: z.string() })).default([]),
    baglantilar: z.array(z.object({ ad: z.string(), href: z.string() })).default([]),
  }),
});

export const collections = { sinema, basketbol, projeler, ozgecmis };
