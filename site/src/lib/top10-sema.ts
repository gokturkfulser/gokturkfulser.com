// `top10` koleksiyonunun şeması (content.config.ts bunu kullanır). Ayrı dosyada durur ki birim testleri ve scripts/top10
// (Gemini çıktısını dosyaya yazmadan önce doğrular) aynı şemayı Astro'ya bağlanmadan yükleyebilsin.
import { z } from 'astro/zod';
import { katkiHatasi, KONTROL_GUVEN, siraHatasi, varsayilanInceleme, videoAdresiMi, ZAMAN_BICIMI } from './top10.ts';
import { ETIKET_ANAHTARLARI, EYLEM_ANAHTARLARI, ROL_ANAHTARLARI, TAKIM_KODLARI } from './top10-sozluk.ts';

export const top10Sema = z
  .object({
    tarih: z.coerce.date(),
    video: z.url().refine(videoAdresiMi, 'video bağlantısı https ile youtube.com ya da nba.com üzerinde olmalı'),
    tur: z.enum(['top10', 'top5']).default('top10'),
    // Verinin nereden geldiği: elle girilmiş ya da Gemini betiğiyle çıkarılmış.
    kaynak: z.enum(['gemini', 'elle']).default('elle'),
    // Kontrol durumu. Yazılmazsa kaynağa göre: gemini → bekliyor, elle → onaylandi. 'onaylandi' dosyaya bot bir daha dokunmaz.
    inceleme: z.enum(['bekliyor', 'onaylandi']).optional(),
    // true ise gece dosyası elle düzenlenmiştir (kontrol düzenleyicisi her kayıtta yazar): Gemini betiği o dosyaya hiçbir koşulda dokunmaz (uzerine_yaz dahil).
    elle_duzenlendi: z.boolean().optional(),
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
            // Oyunun videodaki başlangıcı ("m:ss" ya da "mm:ss"); sayfada videonun o saniyesine bağlantı olur. Metin olarak yazılır ("1:05" tırnaklı).
            zaman: z.string().regex(ZAMAN_BICIMI, 'zaman "m:ss" ya da "mm:ss" olmalı (ör. 1:05)').optional(),
            // Kontrol verisi (yalnızca betik yazar, yalnızca kontrol sayfası okar): herkese açık bileşenler bu alanı kullanmaz ve HTML'e yazmaz.
            // YAML yorumları bu alandan üretilir (scripts/top10/kontrol.ts); tek kaynak burasıdır.
            kontrol: z
              .strictObject({
                guven: z.enum(KONTROL_GUVEN),
                // Oy oranı, ör. "2/3" (yalnızca çoğunluk oylamasında).
                oy: z.string().regex(/^\d+\/\d+$/, 'oy "k/n" biçiminde olmalı (ör. 2/3)').optional(),
                uyarilar: z.array(z.string().trim().min(1)).optional(),
                alternatifler: z.array(z.string().trim().min(1)).optional(),
                // Modelin çalıştırma başına kendi güveni: "yuksek", "orta (gerekçe)"…
                model_guveni: z.array(z.string().trim().min(1)).optional(),
              })
              .optional(),
            katkilar: z
              .array(
                z.strictObject({
                  oyuncu: z.string().trim().min(1),
                  // NBA'in 30 takım kısaltmasından biri (lib/top10-sozluk.ts → TAKIM_KODLARI).
                  takim: z.enum(TAKIM_KODLARI, { error: "takım NBA'in 30 kısaltmasından biri olmalı (ör. SAS, GSW, NYK)" }),
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
  })
  .transform((gece) => ({ ...gece, inceleme: gece.inceleme ?? varsayilanInceleme(gece.kaynak) }));
