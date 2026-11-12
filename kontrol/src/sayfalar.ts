// Sunucu tarafında üretilen sayfalar (mobil öncelikli, tablo yok). Stil /stil.css, etkileşim /uygulama.js (yalnızca küçük etkileşimler: katkı ekle/çıkar,
// alternatif ada dokunma, pay seçeneklerini katkı sayısına uydurma, "Onayla" düğmesini değişiklik varken kapatma). Satır içi betik/stil yok.
import { bakilacakMi, duzenleAdresi, kontrolOzeti, zamanBaglantisi, type KontrolGirdisi } from '../../site/src/lib/top10-kontrol.ts';
import { izinliBolusumler, type Gece, type Oyun } from '../../site/src/lib/top10.ts';
import { etiketAdi, ETIKET_ANAHTARLARI, eylemAdi, EYLEM_ANAHTARLARI, rolAdi, ROL_ANAHTARLARI, TAKIM_KODLARI } from '../../site/src/lib/top10-sozluk.ts';
import { birlestir, esc, h, Ham } from './html.ts';
import { EN_COK_KATKI, ESIT, oyundanDurum, type OyunDurumu } from './form.ts';
import type { NbaDurumu } from './nba.ts';

const tarihYaz = (d: Date) => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
const tarihIso = (d: Date) => d.toISOString().slice(0, 10);
const GUVEN: Record<string, string> = { yuksek: 'Yüksek', orta: 'Orta', dusuk: 'Düşük' };
const TUR: Record<string, string> = { top10: 'Top 10', top5: 'Top 5' };

export function sayfa(baslik: string, govde: Ham, aktif: 'liste' | 'sozluk' | 'nba' | '' = ''): string {
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(baslik)} · kontrol</title>
<link rel="stylesheet" href="/stil.css">
<script src="/uygulama.js" defer></script>
</head>
<body>
<a class="atla" href="#icerik">İçeriğe geç</a>
<header class="bant bant--koyu ust">
  <div class="kap ust-ic">
    <p class="marka">Top 10 kontrol</p>
    <nav aria-label="Bölümler" class="menu">
      <a href="/"${aktif === 'liste' ? ' aria-current="page"' : ''}>Geceler</a>
      <a href="/sozluk"${aktif === 'sozluk' ? ' aria-current="page"' : ''}>Ad sözlüğü</a>
      <a href="/nba"${aktif === 'nba' ? ' aria-current="page"' : ''}>NBA verisi</a>
    </nav>
  </div>
</header>
<main id="icerik" class="bant bant--acik ana">
  <div class="kap">
${govde.deger}
  </div>
</main>
</body>
</html>
`;
}

export const hataSayfasi = (baslik: string, aciklama: string, geri?: { href: string; ad: string }) =>
  sayfa(baslik, h`<h1 class="baslik">${baslik}</h1><p class="duyuru" role="alert">${aciklama}</p>${geri ? h`<p><a class="dugme" href="${geri.href}">${geri.ad}</a></p>` : ''}`);

const duyuru = (ok: string | null) =>
  ok === 'kaydedildi'
    ? h`<p class="duyuru duyuru-ok" role="status">Kaydedildi: değişiklik main'e commit edildi; site her zamanki gibi yayınlanacak.</p>`
    : ok === 'onaylandi'
      ? h`<p class="duyuru duyuru-ok" role="status">Onaylandı: değişiklik main'e commit edildi; site her zamanki gibi yayınlanacak.</p>`
      : ok === 'degisiklik-yok'
        ? h`<p class="duyuru" role="status">Değişiklik yok; commit atılmadı.</p>`
        : ok === 'eklendi'
          ? h`<p class="duyuru duyuru-ok" role="status">Takma ad eklendi ve main'e commit edildi.</p>`
          : '';

/** NBA verisi kaydedildi bildirimi: `ad` ve `satir` adresten gelir; yalnızca bilinen ad ve sayı olarak gösterilir. */
const nbaDuyurusu = (ok: string | null, ad: string | undefined, satir: number | undefined) =>
  ok === 'nba-kaydedildi' && ad && satir !== undefined
    ? h`<p class="duyuru duyuru-ok" role="status">${ad} kaydedildi: ${satir} satır okundu ve main'e commit edildi; site her zamanki gibi yayınlanacak.</p>`
    : '';

// ——— Liste ———

export function listeSayfasi(girdiler: readonly KontrolGirdisi[], okunamayanlar: readonly string[], eskiVar: boolean, nba: readonly NbaDurumu[] = []): string {
  const guncellenecek = nba.filter((n) => n.eski);
  const { bekleyen, onayli } = kontrolOzeti(girdiler);
  const kart = (b: (typeof bekleyen)[number]) => {
    const tarih = tarihIso(b.gece.tarih);
    return h`<li class="gece-satiri">
      <a class="gece-baglanti" href="/gece/${tarih}"><time datetime="${tarih}">${tarihYaz(b.gece.tarih)}</time></a>
      <ul class="ozet" role="list">
        <li>${TUR[b.gece.tur]}</li>
        <li>${b.satirSayisi} satır</li>
        <li class="${b.bakilacakSayisi ? 'vurgulu' : ''}">${b.bakilacakSayisi} bakılacak satır</li>
        ${b.gece.elle_duzenlendi ? h`<li>Elle düzenlendi</li>` : ''}
      </ul>
    </li>`;
  };
  return sayfa(
    'Geceler',
    h`<h1 class="baslik">Geceler</h1>
    ${guncellenecek.length ? h`<section aria-labelledby="nba-uyari-b"><h2 id="nba-uyari-b" class="bolum">NBA verisi güncellenmeli</h2><ul role="list">${guncellenecek.map((n) => h`<li class="duyuru duyuru-hata" role="alert">${n.ad}: ${n.mesaj} <a href="/nba#${n.kod}">Güncelle</a></li>`)}</ul></section>` : ''}
    <section aria-labelledby="bekleyen-b"><h2 id="bekleyen-b" class="bolum">Bekleyen geceler</h2>
      ${bekleyen.length ? h`<ul class="geceler" role="list">${bekleyen.map(kart)}</ul>` : h`<p>Bekleyen gece yok.</p>`}
    </section>
    <section aria-labelledby="onayli-b"><h2 id="onayli-b" class="bolum">Onaylı geceler</h2>
      ${onayli.length ? h`<ul class="geceler" role="list">${onayli.map((o) => h`<li class="gece-satiri"><a class="gece-baglanti" href="/gece/${tarihIso(o.gece.tarih)}"><time datetime="${tarihIso(o.gece.tarih)}">${tarihYaz(o.gece.tarih)}</time></a><ul class="ozet" role="list"><li>${TUR[o.gece.tur]}</li>${o.gece.elle_duzenlendi ? h`<li>Elle düzenlendi</li>` : ''}</ul></li>`)}</ul>` : h`<p>Onaylı gece yok.</p>`}
    </section>
    ${okunamayanlar.length ? h`<section aria-labelledby="hata-b"><h2 id="hata-b" class="bolum">Okunamayan dosyalar</h2><ul role="list">${okunamayanlar.map((m) => h`<li class="duyuru">${m}</li>`)}</ul></section>` : ''}
    ${eskiVar ? h`<p class="not">Yalnızca en yeni geceler listelendi; daha eski geceleri adresten açabilirsiniz (/gece/YYYY-AA-GG).</p>` : ''}`,
    'liste',
  );
}

// ——— Gece düzenleme ———

/** "diğer: A + B 1/3" → ["A", "B"]; başka alternatif türleri (eylem/pay diğer) ad içermez. */
export function alternatifAdlari(alt: string): string[] {
  const m = /^diğer: (.+) \d+\/\d+$/.exec(alt);
  return m ? m[1]!.split(' + ').map((s) => s.trim()).filter(Boolean) : [];
}

const BOLUSUM_ETIKETI = (b: number[]) => b.join(' / ');
/** Katkı sayısına göre pay seçenekleri: [değer, etiket]. */
export const bolusumSecenekleri = (n: number): [string, string][] => [...izinliBolusumler(n).map((b): [string, string] => [b.join('-'), BOLUSUM_ETIKETI(b)]), [ESIT, 'Eşit bölüşüm (pay yazılmaz)']];
const tumBolusumler = () => Object.fromEntries([1, 2, 3].map((n) => [n, bolusumSecenekleri(n)]));

const secenekler = (liste: readonly [string, string][], secili: string) => birlestir(liste.map(([d, e]) => h`<option value="${d}"${d === secili ? ' selected' : ''}>${e}</option>`));

function katkiSatiri(sira: number, i: number, k: { oyuncu: string; takim: string; rol: string }, cikarilabilir: boolean): Ham {
  const id = `o${sira}_k${i}`;
  return h`<div class="katki" data-i="${i}">
    <div class="alan alan-ad"><label for="${id}_oyuncu">Oyuncu</label><input id="${id}_oyuncu" name="${id}_oyuncu" type="text" value="${k.oyuncu}" list="oyuncu-adlari" autocomplete="off" autocapitalize="words" required></div>
    <div class="alan"><label for="${id}_takim">Takım</label><select id="${id}_takim" name="${id}_takim">${secenekler(TAKIM_KODLARI.map((t) => [t, t]), k.takim)}</select></div>
    <div class="alan"><label for="${id}_rol">Rol</label><select id="${id}_rol" name="${id}_rol">${secenekler(ROL_ANAHTARLARI.map((r) => [r, rolAdi(r, 'tr')]), k.rol)}</select></div>
    <button type="button" class="dugme katki-cikar"${cikarilabilir ? '' : ' hidden'}>Katkıyı çıkar</button>
  </div>`;
}

function oyunKarti(gece: Gece, oyun: Oyun, d: OyunDurumu, hatalar: readonly string[]): Ham {
  const k = oyun.kontrol;
  const zaman = oyun.zaman ? zamanBaglantisi(gece, oyun) : undefined;
  const bakilacak = bakilacakMi(oyun);
  const sira = d.sira;
  const hataId = `o${sira}_hata`;
  const katkilar = d.katkilar.length ? d.katkilar : [{ oyuncu: '', takim: 'SAS', rol: 'bitiren' }];
  return h`<article class="oyun${bakilacak ? ' oyun--bakilacak' : ''}${hatalar.length ? ' oyun--hata' : ''}" id="oyun-${sira}" data-sira="${sira}" data-guven="${k?.guven ?? ''}"${hatalar.length ? new Ham(` aria-describedby="${esc(hataId)}"`) : ''}>
    <header class="oyun-ust">
      <h3 class="oyun-baslik">Sıra ${sira}</h3>
      ${zaman ? h`<a class="zaman" href="${zaman}" rel="noopener noreferrer">Videoda ${oyun.zaman}</a>` : h`<span class="zaman-yok">Zaman yok</span>`}
      ${bakilacak ? h`<p class="etiket-bakilacak">Bakılacak satır</p>` : ''}
    </header>
    ${hatalar.length ? h`<div class="hatalar" id="${hataId}" role="alert"><p class="hata-baslik">Bu satırda hata var:</p><ul role="list">${hatalar.map((m) => h`<li>${m}</li>`)}</ul></div>` : ''}
    ${k
      ? h`<dl class="kontrol-bilgi">
        <div><dt>Güven</dt><dd class="guven">${GUVEN[k.guven]}</dd></div>
        ${k.oy ? h`<div><dt>Oy</dt><dd>${k.oy}</dd></div>` : ''}
        ${k.alternatifler?.length ? h`<div><dt>Alternatifler</dt><dd><ul class="alternatifler" role="list">${k.alternatifler.map((a) => {
          const adlar = alternatifAdlari(a);
          return adlar.length
            ? h`<li><span class="alt-metin">diğer:</span> ${adlar.map((ad) => h`<button type="button" class="alt-ad" data-ad="${ad}">${ad}</button> `)}<span class="alt-oy">${/\d+\/\d+$/.exec(a)?.[0]}</span></li>`
            : h`<li>${a}</li>`;
        })}</ul></dd></div>` : ''}
        ${k.uyarilar?.length ? h`<div><dt>Uyarılar</dt><dd><ul class="uyarilar" role="list">${k.uyarilar.map((u) => h`<li><span class="uyari-etiketi">Uyarı:</span> ${u}</li>`)}</ul></dd></div>` : ''}
        ${k.model_guveni?.length ? h`<div><dt>Model</dt><dd>${k.model_guveni.join('; ')}</dd></div>` : ''}
      </dl>`
      : ''}
    <input type="hidden" name="o${sira}_kn" value="${katkilar.length}">
    <div class="alan"><label for="o${sira}_eylem">Eylem</label><select id="o${sira}_eylem" name="o${sira}_eylem"><option value="">(yok)</option>${secenekler(EYLEM_ANAHTARLARI.map((e) => [e, eylemAdi(e, 'tr')]), d.eylem)}</select></div>
    <fieldset class="etiketler"><legend>Etiketler</legend>
      <div class="etiket-listesi">${ETIKET_ANAHTARLARI.map((e) => h`<label class="onay"><input type="checkbox" name="o${sira}_etiket" value="${e}"${d.etiketler.includes(e) ? ' checked' : ''}> <span>${etiketAdi(e, 'tr')}</span></label>`)}</div>
    </fieldset>
    <fieldset class="katkilar"><legend>Katkı sahipleri</legend>
      ${katkilar.map((kt, i) => katkiSatiri(sira, i, kt, katkilar.length > 1))}
      <button type="button" class="dugme katki-ekle"${katkilar.length >= EN_COK_KATKI ? ' hidden' : ''}>Katkı ekle</button>
      <div class="alan"><label for="o${sira}_bolusum">Pay bölüşümü</label><select id="o${sira}_bolusum" name="o${sira}_bolusum" class="bolusum">${secenekler(bolusumSecenekleri(katkilar.length), d.bolusum)}</select></div>
    </fieldset>
    <div class="alan"><label for="o${sira}_rakip">Rakip (üstüne smaç basılan / bloklanan)</label><input id="o${sira}_rakip" name="o${sira}_rakip" type="text" value="${d.rakip}" list="oyuncu-adlari" autocomplete="off" autocapitalize="words"></div>
    <div class="alan"><label for="o${sira}_aciklama">Açıklama</label><textarea id="o${sira}_aciklama" name="o${sira}_aciklama" rows="3">${d.aciklama}</textarea></div>
  </article>`;
}

export type GeceSayfasiGirdisi = {
  id: string;
  gece: Gece;
  sha: string;
  /** Formdaki değerler (hata sonrası gönderilen değerler; ilk açılışta dosyadan). */
  durumlar: readonly OyunDurumu[];
  oyunHatalari?: Record<number, string[]>;
  genelHatalar?: readonly string[];
  adlar: readonly string[];
  ok?: string | null;
  /** Kayıtta ortak kuralın clutch eklediği oyun sıraları (kayıt sonrası not). */
  clutchEklenen?: readonly number[];
};

export function geceSayfasi(g: GeceSayfasiGirdisi): string {
  const tarih = tarihIso(g.gece.tarih);
  const bekliyor = (g.gece.inceleme ?? 'onaylandi') === 'bekliyor';
  const oyunlar = [...g.gece.oyunlar].sort((a, b) => a.sira - b.sira);
  const hataSayisi = Object.keys(g.oyunHatalari ?? {}).length + (g.genelHatalar?.length ?? 0);
  const sablon = h`<template id="katki-sablon">${katkiSatiri(0, 0, { oyuncu: '', takim: 'SAS', rol: 'bitiren' }, true)}</template>`;
  return sayfa(
    tarihYaz(g.gece.tarih),
    h`<p class="geri"><a href="/">Geceler</a></p>
    <h1 class="baslik"><time datetime="${tarih}">${tarihYaz(g.gece.tarih)}</time></h1>
    <ul class="ozet ozet-ust" role="list">
      <li>${TUR[g.gece.tur]}</li>
      <li>${bekliyor ? 'İnceleme bekliyor' : 'Onaylı'}</li>
      ${g.gece.elle_duzenlendi ? h`<li>Elle düzenlendi (bot dokunmaz)</li>` : ''}
      <li><a class="video" href="${g.gece.video}" rel="noopener noreferrer">Videoyu aç</a></li>
      <li><a href="${duzenleAdresi(g.id)}" rel="noopener noreferrer">GitHub'da düzenle</a></li>
    </ul>
    ${duyuru(g.ok ?? null)}
    ${g.clutchEklenen?.length ? h`<p class="duyuru" role="status">Clutch otomatik eklendi (sıra ${g.clutchEklenen.join(', ')}): maçı kazandıran ya da eşitleyen etiketi olan her oyun clutch sayılır.</p>` : ''}
    ${hataSayisi ? h`<p class="duyuru duyuru-hata" role="alert">Kaydedilmedi: ${hataSayisi} yerde hata var. Aşağıda satır satır işaretlendi; yazdığınız değerler korundu.</p>` : ''}
    ${g.genelHatalar?.length ? h`<ul class="hatalar" role="alert">${g.genelHatalar.map((m) => h`<li>${m}</li>`)}</ul>` : ''}
    <form method="post" action="/gece/${tarih}" class="gece-form" data-bolusumler="${JSON.stringify(tumBolusumler())}">
      <input type="hidden" name="sha" value="${g.sha}">
      <datalist id="oyuncu-adlari">${g.adlar.map((a) => h`<option value="${a}"></option>`)}</datalist>
      ${oyunlar.map((o) => oyunKarti(g.gece, o, g.durumlar.find((d) => d.sira === o.sira) ?? oyundanDurum(o), g.oyunHatalari?.[o.sira] ?? []))}
      <div class="eylemler">
        <button type="submit" name="islem" value="kaydet" class="dugme">Kaydet</button>
        <button type="submit" name="islem" value="kaydet-onayla" class="dugme dugme-birincil">Kaydet ve onayla</button>
        ${bekliyor ? h`<button type="submit" name="islem" value="onayla" class="dugme onayla-dugmesi" formnovalidate>Onayla (değişiklik yokken)</button>` : ''}
      </div>
      <p class="not">Kaydet: inceleme durumu olduğu gibi kalır. Her kayıt dosyaya <code>elle_duzenlendi: true</code> yazar; bot bu dosyaya bir daha dokunmaz.</p>
    </form>
    ${sablon}`,
    'liste',
  );
}

// ——— NBA verisi ———

export type NbaSayfasiGirdisi = {
  /** Her tablo için durum ve dosyanın okunduğu andaki sha'sı (forma konur). */
  tablolar: readonly (NbaDurumu & { sha: string })[];
  ok?: string | null;
  okAd?: string;
  okSatir?: number;
  /** Reddedilen yapıştırma: hangi tablo, hatalar ve gönderilen değerler (korunur). */
  red?: { kod: string; hatalar: readonly string[]; veri: string; mod: string };
};

export function nbaSayfasi(g: NbaSayfasiGirdisi): string {
  const bolum = (t: NbaSayfasiGirdisi['tablolar'][number]) => {
    const red = g.red?.kod === t.kod ? g.red : undefined;
    return h`<section aria-labelledby="${t.kod}-b" id="${t.kod}">
      <h2 id="${t.kod}-b" class="bolum">${t.ad}</h2>
      <p class="duyuru${t.eski ? ' duyuru-hata' : ' duyuru-ok'}" role="${t.eski ? 'alert' : 'status'}">${t.mesaj}</p>
      <ul class="ozet" role="list">
        <li>${t.satir} satır</li>
        <li>${t.guncelleme ? `Son güncelleme: ${t.guncelleme}` : 'Son güncelleme bilinmiyor'}</li>
        <li><a href="${t.adres}" target="_blank" rel="noopener noreferrer">NBA sayfasını aç (yeni sekme)</a></li>
      </ul>
      <p class="not">${t.gerekce}</p>
      ${t.hatalar.length ? h`<div class="hatalar" role="status"><p class="hata-baslik">Dosyada okunamayan satırlar var:</p><ul role="list">${t.hatalar.slice(0, 8).map((m) => h`<li>${m}</li>`)}</ul></div>` : ''}
      ${red ? h`<div class="hatalar" role="alert"><p class="hata-baslik">Kaydedilmedi:</p><ul role="list">${red.hatalar.map((m) => h`<li>${m}</li>`)}</ul></div>` : ''}
      ${t.sha ? h`<form method="post" action="/nba/${t.kod}" class="nba-form">
        <input type="hidden" name="sha" value="${t.sha}">
        <div class="alan"><label for="veri-${t.kod}">NBA tablosunu buraya yapıştırın (başlık satırıyla)</label><textarea id="veri-${t.kod}" name="veri" rows="8" spellcheck="false" autocomplete="off" required>${red?.veri ?? ''}</textarea></div>
        <fieldset><legend>Nasıl kaydedilsin</legend>
          <label class="onay"><input type="radio" name="mod" value="degistir"${red?.mod === 'ekle' ? '' : ' checked'}> <span>Değiştir (dosya yalnızca bu metinle yazılır)</span></label>
          <label class="onay"><input type="radio" name="mod" value="ekle"${red?.mod === 'ekle' ? ' checked' : ''}> <span>Mevcut veriye ekle (çok sayfalı tabloda sayfa sayfa; aynı satırlar bir kez kalır)</span></label>
        </fieldset>
        <div class="eylemler"><button type="submit" class="dugme dugme-birincil">Doğrula ve kaydet</button></div>
      </form>` : ''}
    </section>`;
  };
  return sayfa(
    'NBA verisi',
    h`<h1 class="baslik">NBA verisi</h1>
    <p class="not">Sitedeki Dunk Score ve clutch tabloları NBA.com/stats'tan elle yapıştırılan veriyle çalışır (ana puanlamaya katılmaz). Kayıt, sitenin kendi okuyucusuyla doğrulanır; bozuk satır varsa hiçbir şey kaydedilmez. Kayıt main'e commit edilir ve site yeniden yayınlanır.</p>
    ${nbaDuyurusu(g.ok ?? null, g.okAd, g.okSatir)}
    ${g.tablolar.map(bolum)}`,
    'nba',
  );
}

// ——— Ad sözlüğü ———

export function sozlukSayfasi(girdi: { sozluk: Record<string, string[]>; sha: string; hata?: string; kanonik?: string; takma?: string; ok?: string | null }): string {
  const kayitlar = Object.entries(girdi.sozluk).sort(([a], [b]) => a.localeCompare(b, 'tr'));
  return sayfa(
    'Ad sözlüğü',
    h`<h1 class="baslik">Ad sözlüğü</h1>
    ${duyuru(girdi.ok ?? null)}
    ${girdi.hata ? h`<p class="duyuru duyuru-hata" role="alert">Eklenmedi: ${girdi.hata}</p>` : ''}
    <form method="post" action="/sozluk" class="sozluk-form">
      <input type="hidden" name="sha" value="${girdi.sha}">
      <datalist id="kanonik-adlar">${kayitlar.map(([k]) => h`<option value="${k}"></option>`)}</datalist>
      <div class="alan"><label for="kanonik">Kanonik ad (sitede görünecek yazım)</label><input id="kanonik" name="kanonik" type="text" value="${girdi.kanonik ?? ''}" list="kanonik-adlar" autocomplete="off" required></div>
      <div class="alan"><label for="takma">Takma ad (modelin yazdığı yazım)</label><input id="takma" name="takma" type="text" value="${girdi.takma ?? ''}" autocomplete="off" required></div>
      <div class="eylemler"><button type="submit" class="dugme dugme-birincil">Takma adı ekle</button></div>
      <p class="not">Ekleme sözlük kurallarından geçmezse (bir takma ad iki kanonik ada bağlanamaz vb.) reddedilir. Sözlüğü bot yazmaz; yalnızca bu form ve elle düzenleme.</p>
    </form>
    <h2 class="bolum">Kayıtlar</h2>
    ${kayitlar.length ? h`<ul class="sozluk" role="list">${kayitlar.map(([k, t]) => h`<li><span class="ad">${k}</span> <span class="takmalar">${t.length ? t.join(', ') : '(takma ad yok)'}</span></li>`)}</ul>` : h`<p>Sözlük boş.</p>`}`,
    'sozluk',
  );
}
