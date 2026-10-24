# lab/ — lab.gokturkfulser.com

Kök [CLAUDE.md](../CLAUDE.md) (özellikle "Adlar" ve "Sürümler") bu klasör için de geçerlidir. Worker `gokturkfulser-lab` → lab.gokturkfulser.com. Kurulum ve dashboard değerleri: [DEPLOY.md](DEPLOY.md).

## Yapı

- `lab/` kökü pnpm paketi **`lab`** (toplayıcı); her app `lab/apps/<slug>/` altında **`lab-<slug>`** paketi. `slug`: küçük harf, rakam, tire.
- `scripts/build.mjs` her app'i `pnpm --filter lab-<slug> build` ile kendi aracıyla build eder, çıktıları (`apps/<slug>/dist`) `lab/dist/<slug>/` altında toplar, `lab/public/` (headers, favicon) ve yazı tiplerini kopyalar, `lab/dist/index.html` (liste) ve `404.html` üretir. Liste sayfası `scripts/sayfalar.mjs`'tedir; renk/ölçü değerleri `site/DESIGN.md` token'larıdır, orada değişmeden burada değişmez.
- `templates/vanilla-ts/` yeni app şablonu (Vite + TypeScript vanilla). `templates/` bir workspace paketi değildir.
- `wrangler.jsonc`: Worker `gokturkfulser-lab`, static assets `./dist`, `not_found_handling: 404-page`. Worker kodu yok.
- `public/_headers`: tüm yollar için `frame-ancestors 'self' https://gokturkfulser.com` (yalnızca benim siteme gömülebilir), parmak izli dosyalar (`/:app/assets/*`) için bir yıllık immutable cache, HTML için kısa cache. `/kelime-avi/*` için ayrıca sıkı CSP vardır.

## Komutlar (kökten)

```powershell
pnpm lab:new <slug>      # lab/apps/<slug>/ oluşturur, pnpm install çalıştırır
pnpm lab:dev [slug]      # slug ile tek app (http://localhost:5173/<slug>/), slug'sız hepsi paralel
pnpm lab:build           # tüm app'ler + lab/dist
```

## Kurallar

- **Çıktı statik, base path `/<slug>/`.** Her app `vite.config`'te (ya da kendi aracında) `base: '/<slug>/'` ile `dist/` klasörüne build eder. Araç serbest (vanilla, Vite, Phaser, React…). `build.mjs` `dist/index.html` içinde `/<slug>/` dışında kök-mutlak (`/assets/…`) yol bulursa build'i durdurur.
- **Tek Worker'da path fallback yoktur** (`/<slug>/yol` bir dosyaya denk gelmezse 404). SPA'lar **hash routing** (`#/…`) kullanır; `history` API ile yol üretilmez.
- **Her app'te `meta.json`**: `ad`, `ozet`, `tur` (`oyun`, `arac`, `uygulama`, `site`), `kapak` (`public/` içindeki görsel dosya adı; liste sayfasında 4:3 gösterilir). Eksik alan ya da bulunmayan kapak build'i durdurur.
- Paket adı `lab-<slug>` olmalı; app'in `build` script'i bulunmalı.
- **CSP:** `pnpm lab:new` yeni app açarken `lab/public/_headers`'a o app için otomatik **sıkı bir CSP kuralı** ekler (`/<slug>/*`; `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'self'; object-src 'none'; form-action 'none'`, kelime-avi'dekiyle aynı; metin `scripts/ortak.mjs` → `SIKI_CSP`). Kural zaten varsa dokunmaz. App'e özel ihtiyaçlar (harici kaynak, `blob:`, wasm, satır içi stil…) o kural **elle gevşetilir**. Aynı header birden fazla kuralla eşleşirse değerler birleşir ve iki CSP kesişir (`/*` altındaki `frame-ancestors` ile birlikte uygulanır). App silinirse kuralını da elle silin. Kurulan şablon bu CSP ile uyumludur: `assetsInlineLimit: 0` (data: URI yok), satır içi betik/stil yok.
- İçerik ve arayüz dili Türkçe; `<html lang="tr">`. Türkçe büyük harf dönüşümü her zaman `toLocaleUpperCase('tr')` (`i → İ`, `ı → I`).
- `prefers-reduced-motion: reduce` saygı görür; görünür klavye odağı kalır; renk kontrastı WCAG AA.
- Gizli bilgi repoya girmez. Git işlemlerine dokunulmaz (kök kural).
- Windows + PowerShell: script'ler Node'dur (`.mjs`), bash gerektirmez.

## Her görev sonunda

```powershell
pnpm lab:build
```

Hatasız geçmeden görev bitmiş sayılmaz. Bir app değiştiyse production çıktısı yerelde `pnpm --filter lab exec wrangler dev` ile servis edilip Playwright ile denenir (`_headers` yalnızca Wrangler'da/Workers'ta uygulanır, Vite dev/preview'da değil): doğrudan açılış, `site/`'taki proje sayfasındaki iframe, konsolda `securitypolicyviolation` yok, farklı boyutlarda taşma yok. Bu denemede iki host `page.route` ile `https://gokturkfulser.com` ve `https://lab.gokturkfulser.com` olarak eşlenir (frame-ancestors/frame-src gerçek adlarla sınanır).

## kelime-avi

- İlk app. Mantık (`src/mantik.ts`, DOM'suz) `node --test src/mantik.test.ts` ile test edilir; bu test `build` script'inin başında koşar. Kelime listesi `src/kelimeler.ts` (5 harf, Türk alfabesi, test doğrular). Günün kelimesi İstanbul gününe göre seçilir; ardışık günler listede komşu kelimelere denk gelmez.
- **Tahmin doğrulaması:** `src/sozluk.txt` (14.548 beş harfli kelime, MIT lisanslı Hunspell sözlüğünden üretilmiş; kaynak, lisans ve süzgeç: `KAYNAK.md`). Sözlükte olmayan tahmin kabul edilmez, nazik bir uyarı çıkar ve hak harcanmaz. Dosya ayrı bir asset'tir ve tembel yüklenir (sayfa açıldıktan 1,5 sn sonra ya da ilk gönderimde); indirilemezse oyun kilitlenmez. Yeniden üretmek için `pnpm --filter lab-kelime-avi sozluk`. Cevap listesi (`kelimeler.ts`) elle seçilmiştir; testler hepsinin sözlükte bulunduğunu doğrular ve cevaplar her zaman geçerli tahmindir.
- **Ekran klavyesi:** 4 satır, 8 birimlik (son satır Gönder + 5 harf + Sil). Tuşlar arasında gerçek boşluk yok; görünen aralık saydam kenarlıktır, böylece dokunma alanı görünen kutudan büyüktür. Ölçülen en küçük dokunma alanı (genişlik × yükseklik): 320 px → 39×44, 360 px → 44×47, 390 px → 48×56, 414 px → 51×56 (Gönder/Sil daha geniştir). Klavyeyi değiştirirken bu genişliklerde yeniden ölçün; yükseklik 44 px altına inmemeli.
- Playwright ile denerken: `max-age=300` HTML tarayıcıda 5 dk önbelleğe alınır; yeni build'i görmek için URL'ye `?v=<rastgele>` ekleyin.
- Düzen `container query` birimleriyle ölçeklenir: dar/uzun ekranda yığılı, geniş ve alçak (iframe, telefon yatay) ekranda tahta solda klavye sağda. Tam ekran düğmesi yalnızca iframe dışında görünür; iframe'de `site/`'ın `OyunKutusu` bileşeni kendi "Tam ekran" düğmesini sunar.
- Kapak ve `site/`'daki proje ekran görüntüleri gerçek oyundan alınmıştır (Playwright, sabit tarihle: 2026-10-24, kelime `IRMAK`). Oyunun görünümü değişirse yeniden alınır: `lab/apps/kelime-avi/public/kapak.png` ve `site/src/content/projeler/kelime-avi/{kapak,oyun-1,oyun-2}.png`.


