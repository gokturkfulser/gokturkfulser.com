# Kelime listesi: kaynak ve lisans

## Tahmin sözlüğü (`src/sozluk.txt`)

Oyunda bir tahminin kabul edilmesi için bu dosyada (ya da cevap listesinde) bulunması gerekir. Dosya, aşağıdaki açık lisanslı Türkçe yazım denetimi sözlüğünden **üretilmiştir**, elle yazılmamıştır.

| | |
| --- | --- |
| Kaynak sözlük | **Turkish Spellcheck Dictionary** (Hunspell biçimi: `index.dic` + `index.aff`), yazar **Harun Reşit Zafer**; OpenOffice eklentisi, sürüm 1.3 (22.07.2015): <https://extensions.openoffice.org/en/project/turkish-spellcheck-dictionary> |
| Aldığımız paket | npm `dictionary-tr` **2.0.0** (wooorm/dictionaries'ten üretilmiş, yukarıdaki eklentiden normalleştirilmiş): <https://github.com/wooorm/dictionaries/tree/main/dictionaries/tr> |
| Lisans | **MIT**, telif: © 2014 Harun Reşit Zafer. Lisans metni pakette `license` dosyası olarak gelir, paketin `package.json` alanı da `MIT`'tir. Yeniden dağıtıma izin verir; telif ve izin bildiriminin kopyalarda bulunması koşuldur (aşağıda). |
| Genişletme | `nspell` **2.1.5** (MIT) Hunspell ek kurallarını uygular; çekimli biçimler de elde edilir (1.358.260 biçim). |

> Not: Eklentinin OpenOffice sayfasında ayrı bir "lisans" alanı yoktur. MIT beyanı, sözlükle birlikte dağıtılan lisans dosyasından (yazarın adıyla) ve `dictionary-tr` paketinden gelir. Lisansa ilişkin bir kuşkunuz olursa `src/sozluk.txt` ve `scripts/sozluk-uret.mjs` silinip tahmin doğrulaması kapatılabilir (`main.ts` içindeki `sozluguYukle`/`tahminGecerli`).

### Süzgeç (`scripts/sozluk-uret.mjs`, `pnpm --filter lab-kelime-avi sozluk`)

1. Tüm genişletilmiş biçimler alınır.
2. **Yalnızca tamamen küçük harfli** biçimler kalır: özel isimler (`Ankara`), kısaltmalar (`AA`), noktalı girdiler (`a.ş.`) elenir.
3. Tam olarak **5 harf** ve yalnızca Türk alfabesinin küçük harfleri (`abcçdefgğhıijklmnoöprsştuüvyz`; `q w x` yok).
4. Tekilleştirilir, Türkçe sıraya dizilir. Sonuç: **14.548 kelime**, 96.157 bayt (gzip ~38 KB).

Dosya satır başına bir kelimedir (LF). Üretim yeniden yapılabilir: aynı paket sürümleriyle aynı dosya çıkar (MD5 `0472e5fb9bf405f80c22df48fa440bab`). Üretim bağımlılıkları (`dictionary-tr`, `nspell`) yalnızca `devDependencies`'tedir; oyun paketine girmez.

**Sınırlar.** Bu bir yazım denetimi sözlüğüdür: çekimli biçimleri (`yolun`, `okula`) ve seyrek ya da argo sözcükleri de içerir; tahmin doğrulaması için bu bilinçli olarak cömerttir (gerçek bir kelimeyi reddetmek, seyrek bir kelimeyi kabul etmekten daha kötüdür). Özel isimler kabul edilmez.

### Dağıtım

`src/sozluk.txt` Vite ile ayrı, parmak izli bir dosya olarak (`/kelime-avi/assets/sozluk-<hash>.txt`) yayımlanır ve **tembel yüklenir**: sayfa açıldıktan 1,5 sn sonra boşta ya da ilk tahmin gönderilirken indirilir. Ana betiğe (JS ~11 KB) girmez. İndirilemezse (çevrimdışı) oyun kilitlenmez; tahmin denetlenmeden kabul edilir.

## Cevap listesi (`src/kelimeler.ts`)

371 kelime, **bu sözlükten türetilmemiştir**: yaygın, çekimsiz, özel isim olmayan kelimeler elle seçilmiştir. Sözlükle karşılaştırıldı (`mantik.test.ts` her build'de doğrular): **371 kelimenin hepsi sözlükte vardır, sözlükte olmayan kelime yoktur.** Ayrıca cevaplar, sözlükte olmasalar bile her zaman geçerli tahmin sayılır.

## Lisans metni (kopyaya eklenmesi gereken bildirim)

```
The MIT License (MIT)

Copyright (c) 2014 Harun Reşit Zafer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
