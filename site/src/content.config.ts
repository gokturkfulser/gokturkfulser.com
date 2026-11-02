import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { parse as parseYaml } from 'yaml';
import { slugify } from './lib/slug';
import { taslakDosyaDesenleri, taslakKlasorDesenleri } from './lib/taslak-loader';
import { dosyaYoluHatasi, katkiHatasi, siraHatasi, videoAdresiMi } from './lib/top10';
import { ETIKET_ANAHTARLARI, EYLEM_ANAHTARLARI, ROL_ANAHTARLARI } from './lib/top10-sozluk';

// Her içerik kendi klasöründe: <koleksiyon>/<slug>/index.mdx + görseller.
// id, klasör adının Türkçe transliterasyonlu slug'ıdır. Production'da taslak klasörleri desenden çıkar.
// Çeviri ayrı bir yazıdır: kendi klasörü, kendi slug'ı, `dil: 'en'` ve (isteğe bağlı) `ceviri: <diğer dildeki yazının slug'ı>`.
const klasorLoader = (base: string) =>
  glob({
    base,
    pattern: ['*/index.{md,mdx}', ...taslakKlasorDesenleri(base, ['index.mdx', 'index.md'])],
    generateId: ({ entry }) => slugify(entry.split('/')[0] ?? entry),
  });

// Yazıların ortak alanları. Her yazı yalnızca kendi dilinin adres ağacında yaşar; `ceviri` diğer dildeki yazının slug'ıdır
// (yalnızca bir taraftan yazılması yeterli; karşılık iki yönlü çözülür, lib/content.ts).
const yaziDili = {
  dil: z.enum(['tr', 'en']).default('tr'),
  ceviri: z.string().optional(),
};

const sinema = defineCollection({
  loader: klasorLoader('./src/content/sinema'),
  schema: ({ image }) =>
    z.object({
      ...yaziDili,
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
      ...yaziDili,
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

// Projeler iki parçadır. `projeler`: dilden bağımsız ortak alanlar (`<slug>/proje.yaml`: görsel, bağlantılar, tür, durum, stack, embedUrl…).
// `projeMetinleri`: dile bağlı metinler (`<slug>/metin.tr.mdx`, `metin.en.mdx`: özet, vaka ne/neden/nasıl ve MDX gövdesi).
// Bir dili eksik proje diğer dile düşer ve sayfada küçük bir notla belirtilir (lib/content.ts → `projeler(dil)`).
const yerel = z.object({ en: z.string().trim(), tr: z.string().trim() });

const projeKlasoru = './src/content/projeler';
const projeler = defineCollection({
  loader: glob({
    base: projeKlasoru,
    pattern: ['*/proje.yaml', ...taslakKlasorDesenleri(projeKlasoru, ['proje.yaml'])],
    generateId: ({ entry }) => slugify(entry.split('/')[0] ?? entry),
  }),
  schema: ({ image }) =>
    z.object({
      // Ürün adı iki dilde de aynıdır (özel ad).
      ad: z.string(),
      // Oyunun/uygulamanın kendi dili; sayfanın dilinden farklıysa sayfada belirtilir (Türkçe oyunlar İngilizce sayfada).
      icerikDili: z.enum(['tr', 'en']).optional(),
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
      // Detay sayfasında gösterilen ekran görüntüleri; alt metin zorunlu ve iki dilli.
      ekranGoruntuleri: z
        .array(z.object({ gorsel: image(), alt: yerel, altyazi: yerel.optional() }))
        .default([]),
      // Doğrudan video dosyası (.mp4/.webm), YouTube ya da Vimeo bağlantısı.
      demoVideo: z.url().optional(),
      oneCikan: z.boolean().default(false),
      sira: z.number().int().default(100),
      // true ise production'da görünmez (SHOW_DRAFTS=true ile preview'da görünür).
      taslak: z.boolean().default(false),
    }),
});

const projeMetinleri = defineCollection({
  loader: glob({
    base: projeKlasoru,
    pattern: [
      '*/metin.{tr,en}.mdx',
      ...taslakKlasorDesenleri(projeKlasoru, ['proje.yaml'], ['metin.tr.mdx', 'metin.en.mdx']),
    ],
    // id: `<slug>.<dil>`
    generateId: ({ entry }) => {
      const [klasor = entry, dosya = ''] = entry.split('/');
      return `${slugify(klasor)}.${dosya.split('.')[1]}`;
    },
  }),
  schema: z.object({
    ozet: z.string(),
    // Vaka çalışması modülleri (proje sayfasının varsayılan düzeni): ne, neden, nasıl. Boş/eksik olan modül hiç render edilmez.
    // Uzun anlatım MDX gövdesindedir; bu alanlar sayfanın üstündeki kısa, taranabilir özetlerdir.
    vaka: z
      .object({
        ne: z.string().trim().optional(),
        neden: z.string().trim().optional(),
        nasil: z.string().trim().optional(),
      })
      .optional(),
  }),
});

// /hakkimda/ özgeçmişi: tek kayıtlı veri dosyası (kimlik: `ozgecmis`). Dosya düz bir belgedir; yükleyici onu tek kayda sarar.
// Metin alanları { en, tr } biçiminde iki dilli; sayfa kendi dilini gösterir, boşsa diğerine düşer (`yerel`, i18n/index.ts).
// Tarihler "YYYY-AA" ya da "YYYY" (YAML `2016`'yı sayı okur, bu yüzden metne çevrilir); `bitis: null` ya da yok = devam ediyor.
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
                // "Yol" zaman çizelgesindeki tek cümle.
                kisa: yerel.optional(),
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
          kisa: yerel.optional(),
        }),
      )
      .default([]),
    // "Yol" zaman çizelgesinde deneyim ve eğitimin dışında kalan duraklar.
    duraklar: z
      .array(
        z.object({
          kurum: yerel,
          baslangic: tarih,
          bitis,
          // Site içi bölüm (isteğe bağlı); adresi dile göre i18n/yollar.ts üretir.
          href: z.enum(['projeler', 'yazilar', 'hakkimda']).optional(),
          kisa: yerel,
        }),
      )
      .default([]),
    // Elle girilen büyük sayılar (yayındaki proje ve yazı sayısı otomatiktir). Boş/sıfır olan gösterilmez.
    sayilar: z
      .array(z.object({ deger: z.union([z.number(), z.string().trim()]), etiket: yerel, not: yerel.optional() }))
      .default([]),
    // "Şu sıralar": boş gruplar gösterilmez.
    su_siralar: z
      .array(
        z.object({
          baslik: yerel,
          ogeler: z.array(z.object({ metin: yerel, slug: z.string().optional() })).default([]),
        }),
      )
      .default([]),
    // Site içi proje slug'ları (src/content/projeler/<slug>); bulunamayan ya da taslak olan atlanır.
    projeler: z.array(z.object({ slug: z.string() })).default([]),
    diller: z.array(z.object({ ad: yerel, seviye: yerel })).default([]),
    beceriler: z.array(z.object({ grup: yerel, cumle: yerel.optional(), ogeler: z.array(z.string()).min(1) })).default([]),
  }),
});

// /hakkimda/ kapak metni: src/content/hakkimda.<dil>.md (frontmatter `baslik` = büyük cümle, gövde = birinci tekil şahıs paragrafları).
// id dildir (`tr`, `en`). Başlık ya da gövde boşsa kapak bandı hiç render edilmez.
const hakkimda = defineCollection({
  loader: glob({
    base: './src/content',
    pattern: 'hakkimda.{tr,en}.md',
    generateId: ({ entry }) => entry.split('.')[1] ?? entry,
  }),
  schema: z.object({ baslik: z.string().trim().default('') }),
});

// "İnsan highlight makarası": NBA Top 10 gecelerinin verisi. Her gece bir dosya: top10/<sezon>/<YYYY-AA-GG>.yaml (tarih = maçların ABD gecesi).
// Puanlama ve doğrulama kuralları lib/top10.ts'te. Doğrulama build'i durdurur: şema (sıralar 1..N, tekil, eksiksiz; video adresi) ve
// yükleyicinin kimlik üretimi (dosya adı ile `tarih` aynı gün). id: `<sezon>/<YYYY-AA-GG>`. `taslak: true` dosyalar production'da
// yüklenmez (içerik taslak sistemiyle aynı üç katman: yükleyici deseni, lib/content.ts süzgeci, sayfada getCollection yok).
const top10Klasoru = './src/content/top10';
const top10 = defineCollection({
  loader: glob({
    base: top10Klasoru,
    pattern: ['*/*.yaml', ...taslakDosyaDesenleri(top10Klasoru)],
    generateId: ({ entry, data }) => {
      const hata = dosyaYoluHatasi(entry, data.tarih);
      if (hata) throw new Error(`top10: ${hata}`);
      return entry.replace(/\.yaml$/, '');
    },
  }),
  schema: z
    .object({
      tarih: z.coerce.date(),
      video: z.url().refine(videoAdresiMi, 'video bağlantısı https ile youtube.com ya da nba.com üzerinde olmalı'),
      tur: z.enum(['top10', 'top5']).default('top10'),
      // Verinin nereden geldiği: elle girilmiş ya da Gemini betiğiyle çıkarılmış.
      kaynak: z.enum(['gemini', 'elle']).default('elle'),
      // Puan oyuna verilir ve katkı sahiplerine bölünür (lib/top10.ts). Eylem/etiket/rol anahtarları lib/top10-sozluk.ts'tedir;
      // listede olmayan değer build'i durdurur. Satır katıdır: kaldırılan eski alanlar (oyuncu, takim, asist) hata verir.
      oyunlar: z
        .array(
          z
            .strictObject({
              sira: z.number().int(),
              eylem: z.enum(EYLEM_ANAHTARLARI).optional(),
              etiketler: z.array(z.enum(ETIKET_ANAHTARLARI)).optional(),
              aciklama: z.string().trim().min(1).optional(),
              // Üstüne smaç basılan / bloklanan oyuncu; puan almaz.
              rakip: z.string().trim().min(1).optional(),
              katkilar: z
                .array(
                  z.strictObject({
                    oyuncu: z.string().trim().min(1),
                    // NBA takım kısaltması: 3 büyük harf (SAS, OKC…)
                    takim: z.string().regex(/^[A-Z]{3}$/, 'takım 3 büyük harf olmalı (ör. SAS)'),
                    rol: z.enum(ROL_ANAHTARLARI),
                    // Yüzde, tam sayı; ya hiçbir katkıda yok (eşit bölüşüm) ya hepsinde var (kurallar: katkiHatasi).
                    pay: z.number().int().optional(),
                  }),
                )
                .min(1)
                .max(3),
            })
            .superRefine((oyun, ctx) => {
              const hata = katkiHatasi(oyun.katkilar);
              if (hata) ctx.addIssue({ code: 'custom', message: `sira ${oyun.sira}: ${hata}`, path: ['katkilar'] });
            }),
        )
        .min(1),
      // true ise production'da görünmez (SHOW_DRAFTS=true ile preview'da görünür). Örnek veriler taslaktır.
      taslak: z.boolean().default(false),
    })
    .superRefine((gece, ctx) => {
      const hata = siraHatasi(gece.tur, gece.oyunlar);
      if (hata) ctx.addIssue({ code: 'custom', message: hata, path: ['oyunlar'] });
    }),
});

export const collections = { sinema, basketbol, projeler, projeMetinleri, ozgecmis, hakkimda, top10 };
