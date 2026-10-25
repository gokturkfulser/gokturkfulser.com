# Yayın öncesi kontrol listesi

Her madde işaretlenmeden `gokturkfulser.com` custom domain'i bağlanmaz. Sırayla, production build üzerinde (`pnpm --filter site build`, `SHOW_DRAFTS` tanımsız) yapılır. Kurulum için bkz. [DEPLOY.md](DEPLOY.md).

## İçerik

- [ ] **`YER-TUTUCULAR.md` boş.** Dosyadaki tüm yer tutucular gerçek içerikle değiştirildi ya da silindi, listede satır kalmadı; ardından dosyanın kendisi silindi. Doğrulama: production build'den sonra aşağıdaki komut **hiç satır** döndürmemeli:

  ```powershell
  Get-ChildItem site/dist -Recurse -File | Where-Object { $_.FullName -notlike '*\pagefind\*' } | Select-String -SimpleMatch -Pattern 'Paris, Texas','Pick and roll','Dakika','Salon Rehberi','Eski Portföy','flower.mp4','github.io'
  ```

  (`dist/pagefind/` dışarıda bırakılır: Pagefind'ın kendi betiği `github.io` içerir. Aranacak dizeleri yer tutucu listesine göre güncelleyin; kendi gerçek içeriğinizde geçen bir ad yanlış alarm verirse listeden çıkarın.)
- [ ] **Gerçek "Hakkımda" metni** yazıldı (`src/pages/hakkimda.astro`): uydurma biyografi, uydurma iletişim/sosyal bağlantı yok; e-posta ve profil bağlantıları gerçek.
- [ ] **En az bir gerçek yazı** (`taslak: false`) yayında: sinema veya basketbol. `site/dist/yazilar/` altında (sinema/basketbol dizinleri dışında) en az bir yazı klasörü var; ana sayfada ve ilgili listede görünüyor; boş durum ("Henüz yazı yok") görünmüyor.
- [ ] Gerçek yazıdan sonra **CI'daki "taslaklar dahil" ikinci build adımı** (`.github/workflows/site.yml`) kaldırıldı; Lighthouse ve lychee artık gerçek yazıyı denetliyor.

## Görsel ve atıf

- [ ] **TMDB logosu** `site/public/tmdb-logo.svg` (ya da `tmdb-logo.png`) olarak eklendi (themoviedb.org → API → logo kılavuzu). Footer'da atıf cümlesinin solunda 14 px yükseklikte görünüyor, sitenin kendi başlığından belirgin değil. Atıf cümlesi duruyor.
- [ ] **OG görselleri doğru.** Her yazı için `/og/<bolum>/<slug>.png` açılıyor, 1200×630; başlıkta `ğ ş ı İ ö ü ç` varsa harfler tofu olmadan çıkıyor; kapak/başlık gerçek içeriğe ait. Ana sayfa ve genel sayfalar `/og/varsayilan.png` kullanıyor. Paylaşım önizlemesi için Facebook Sharing Debugger / LinkedIn Post Inspector ile bir yazı adresi denendi (yayından sonra).

## Sayfalar ve akışlar

- [ ] **404 sayfası:** olmayan bir adres (`/yok-boyle-sayfa/`) sitenin 404 sayfasını **HTTP 404** ile döndürüyor (`not_found_handling: 404-page`), menü ve "ana sayfaya dön" bağlantısı çalışıyor.

  ```powershell
  curl.exe -s -o NUL -w "%{http_code}`n" https://gokturkfulser.com/yok-boyle-sayfa/   # 404
  ```
- [ ] **RSS geçerli.** `/rss.xml`, `/yazilar/sinema/rss.xml`, `/yazilar/basketbol/rss.xml` W3C Feed Validation Service'ten (validator.w3.org/feed) uyarısız geçiyor; yer tutucu yazı yok; `<link>` adresleri `https://gokturkfulser.com/...` ve sonunda `/` var.
- [ ] **Arama** (`/arama/`) bir gerçek yazıda aranan kelimeyle sonuç döndürüyor, konsolda hata yok.
- [ ] **robots.txt** production'da `Disallow: /` içermiyor ve sitemap adresini veriyor; sayfalarda `noindex` yok.

## Güvenlik ve performans

- [ ] Ana sayfa, bir yazı, `/arama/` ve (varsa) oyunlu proje sayfasında tarayıcı konsolunda **CSP ihlali yok** (DevTools → Console, "Content Security Policy" araması).
- [ ] `curl.exe -sI https://gokturkfulser.com/` yanıtında `content-security-policy: frame-ancestors 'none'`, `referrer-policy`, `permissions-policy`, `x-content-type-options` var.
- [ ] Lighthouse (CI'da veya PageSpeed Insights): ana sayfa ve bir yazıda performans ve erişilebilirlik ≥ 95 (hedef 100).
- [ ] Yazı sayfalarında `ld+json` dışında `<script>` yok; `CF_ANALYTICS_TOKEN` tanımlıysa tek harici script (beacon) bilinçli bir istisna.

## Yayın

- [ ] Cloudflare **build değişkenleri** girildi (DEPLOY.md bölüm 4), `SHOW_DRAFTS` tanımsız.
- [ ] `main`'deki build yeşil, deploy tamam; `gokturkfulser.com` custom domain bağlı, `www` yönlendirmesi çalışıyor.
- [ ] Search Console doğrulandı, `sitemap-index.xml` gönderildi.
