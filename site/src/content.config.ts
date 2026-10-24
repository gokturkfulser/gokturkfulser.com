import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
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
      kapak: image(),
      etiketler: z.array(z.string()).default([]),
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
      kapak: image(),
      etiketler: z.array(z.string()).default([]),
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
      oneCikan: z.boolean().default(false),
      sira: z.number().int().default(100),
      // true ise production'da görünmez (SHOW_DRAFTS=true ile preview'da görünür).
      taslak: z.boolean().default(false),
    }),
});

export const collections = { sinema, basketbol, projeler };
