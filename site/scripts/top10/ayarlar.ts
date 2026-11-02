// scripts/top10 sabitleri: tek yerde. Sır yok (anahtarlar yalnızca ortamdan okunur).

/** NBA resmi YouTube kanalı. Doğrulama: https://www.youtube.com/feeds/videos.xml?channel_id=<KANAL_ID> akışının başlığı/yazarı "NBA"
 *  (2 Kasım 2026'da kontrol edildi; akışta "NBA's Top 5 Plays of the Night | November 1, 2026" gibi başlıklar var). */
export const KANAL_ID = 'UCWJ2lWNubArHWmf3FIHbfcQ';
/** Kanalın "uploads" oynatma listesi (kanal kimliğinin "UC" öneki "UU" olur). playlistItems.list 1 kota birimidir (search.list 100).
 *  Liste bulunamazsa (404) çalışma zamanında channels.list → contentDetails.relatedPlaylists.uploads ile çözülür (youtube.ts). */
export const YUKLEMELER_LISTESI = `UU${KANAL_ID.slice(2)}`;

/** Otomatik modda bakılan gece sayısı: ABD (Doğu) saatine göre bugün ve önceki iki gün. */
export const PENCERE_GUN = 3;
/** "Gece" ABD gecesidir; pencere bu saat dilimindeki takvim gününe göre hesaplanır. */
export const PENCERE_SAAT_DILIMI = 'America/New_York';

/** Gemini modeli: GEMINI_MODEL ortam değişkeni (GitHub'da repository variable) yoksa bu. Gerçek çalıştırmalarla doğrulandı: yüksek çözünürlük + 3 oylamayla 10/10 doğru oyuncu. */
export const VARSAYILAN_MODEL = 'gemini-3.8-flash';
export const GEMINI_API_TABANI = 'https://generativelanguage.googleapis.com/v1beta';
/** Interactions API şema revizyonu (resmi dokümanda 2026-05-20; 8 Haziran 2026'dan sonra başlık yok sayılır, yeni şema varsayılandır). */
export const GEMINI_API_REVIZYONU = '2026-05-20';
export const YOUTUBE_API_TABANI = 'https://www.googleapis.com/youtube/v3';

/** Gemini'nin bir videoyu işlemesi dakikalar sürebilir. */
export const GEMINI_ZAMAN_ASIMI_MS = 5 * 60 * 1000;
export const YOUTUBE_ZAMAN_ASIMI_MS = 30 * 1000;
/** Pencereyi kapsamak için en çok kaç sayfa (50'şer) oynatma listesi okunur (NBA günde onlarca video yükler). */
export const EN_COK_SAYFA = 8;
/** Geçmiş gece doldurma (--baslangic): en çok 31 gün; NBA günde onlarca video yükler (31 gün ≈ 15-20 sayfa), bu yüzden sayfa üst sınırı geniştir. */
export const EN_COK_ARALIK_GUN = 31;
export const EN_COK_SAYFA_ARALIK = 40;

/** Video medya çözünürlüğü (Gemini Interactions API: video girdi parçasındaki `resolution` alanı; GEMINI_COZUNURLUK ile değişir).
 *  Kaynak: aistudio.google.com/docs/media-resolution (değerler: unspecified, low, medium, high, ultra_high; ultra_high yalnızca içerik parçası başına;
 *  Gemini 3/4'te video kare başına: unspecified/low/medium 70 token, high 280 token; ses 25 token/sn) ve /docs/video-understanding (≈100 token/sn
 *  varsayılan-düşük, ≈300 token/sn yüksek; 1 FPS). Dokümanda `resolution`'ın video/YouTube URL girdisinde çalıştığına dair örnek YOKTUR;
 *  API alanı reddederse betik çözünürlüksüz yeniden dener ve uyarır (gemini.ts). */
export const COZUNURLUKLER = ['unspecified', 'low', 'medium', 'high', 'ultra_high'] as const;
export type Cozunurluk = (typeof COZUNURLUKLER)[number];
export const VARSAYILAN_COZUNURLUK: Cozunurluk = 'high';

/** Çözünürlüğe göre video girdi token oranı (token/sn). ultra_high için dokümanda oran yok: yüksek oran alınır (alt sınır tahmini). */
export const TOKEN_SANIYE: Record<Cozunurluk, number> = { unspecified: 100, low: 100, medium: 100, high: 300, ultra_high: 300 };
/** İstem + yanıt şeması için tahmini pay. */
export const TOKEN_ISTEM_PAYI = 5000;
/** Sınıra eklenen yüzde payı. Gerçek ölçüm (2:26 video, yüksek çözünürlük): 42.988 girdi token'ı; süre × 300 + 5.000 = 48.800 sınırın %88'iydi, yani
 *  sınıra çok yakındı (oran yaklaşık, video başına sabit yükler ve kare sayımı oynar). %25 pay ile sınır 61.000 olur (ölçüm sınırın %70'i);
 *  anormal artışlar (ör. 1,33 milyon) hâlâ yakalanır. */
export const TOKEN_PAY_YUZDESI = 25;

/** Video başına girdi token'ı üst sınırı (uyarı eşiği) = (süre (sn) × seçilen çözünürlüğün oranı + TOKEN_ISTEM_PAYI) × (1 + %pay). Aşılırsa uyarı verilir (iş durmaz). */
export const tokenSiniri = (sureSn: number, cozunurluk: Cozunurluk = VARSAYILAN_COZUNURLUK) =>
  Math.round((sureSn * TOKEN_SANIYE[cozunurluk] + TOKEN_ISTEM_PAYI) * (1 + TOKEN_PAY_YUZDESI / 100));

/** Çoğunluk oylaması: bir gece için bağımsız çalıştırma sayısı (varsayılan; --oylama ile değişir). */
export const VARSAYILAN_OYLAMA = 3;
export const EN_COK_OYLAMA = 7;
