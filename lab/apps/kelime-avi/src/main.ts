import './style.css';
import { KELIMELER } from './kelimeler.ts';
import type { Durum } from './mantik.ts';
import {
  HAK,
  HARF_SAYISI,
  KLAVYE_SATIRLARI,
  dahaIyi,
  degerlendir,
  gunNumarasi,
  gunlukKelime,
  rastgeleKelime,
  tusuHarfeCevir,
} from './mantik.ts';

type Mod = 'gunluk' | 'rastgele';

const DEPO_ANAHTARI = 'kelime-avi:v1';
const DURUM_METNI: Record<Durum, string> = {
  dogru: 'doğru yerde',
  var: 'kelimede, başka yerde',
  yok: 'kelimede yok',
};

const kok = document.querySelector<HTMLElement>('#oyun')!;
kok.innerHTML = `
  <header class="ust">
    <div class="baslik-alani">
      <h1 class="baslik">Kelime Avı</h1>
      <p class="mod" id="mod"></p>
    </div>
    <div class="araclar">
      <button type="button" class="dugme" id="yardim">Nasıl oynanır?</button>
      <button type="button" class="dugme" id="tam-ekran" hidden>Tam ekran</button>
    </div>
  </header>
  <main class="sahne" id="sahne">
    <div class="tahta" id="tahta" role="group" aria-label="Tahmin ızgarası"></div>
  </main>
  <section class="alt" aria-label="Klavye ve durum">
    <p class="mesaj" id="mesaj" role="status" aria-live="polite"></p>
    <div class="yeni" id="yeni" hidden>
      <button type="button" class="dugme" id="rastgele">Rastgele yeni kelime</button>
      <button type="button" class="dugme" id="gunluk" hidden>Günün kelimesi</button>
    </div>
    <div class="klavye" id="klavye" role="group" aria-label="Ekran klavyesi"></div>
  </section>
  <dialog class="yardim" id="yardim-kutusu" aria-labelledby="yardim-baslik">
    <h2 id="yardim-baslik">Nasıl oynanır?</h2>
    <p>Beş harfli Türkçe kelimeyi ${HAK} tahminde bul. Her tahminden sonra harfler renklenir:</p>
    <ul class="ornek">
      <li><span class="hucre" data-durum="dogru">K</span> Harf kelimede ve <strong>doğru yerde</strong>.</li>
      <li><span class="hucre" data-durum="var">A</span> Harf kelimede ama <strong>başka yerde</strong>.</li>
      <li><span class="hucre" data-durum="yok">Z</span> Harf kelimede <strong>yok</strong>.</li>
    </ul>
    <p>Her gün yeni bir kelime gelir; istersen bitirdikten sonra rastgele kelimelerle oynayabilirsin.</p>
    <p>Türkçe harfler ayrıdır: <strong>İ</strong> ile <strong>I</strong>, <strong>Ş</strong>, <strong>Ğ</strong>, <strong>Ç</strong>, <strong>Ö</strong>, <strong>Ü</strong> farklı harflerdir. Klavyeden yazabilir ya da ekran klavyesini kullanabilirsin; Enter tahmini gönderir.</p>
    <button type="button" class="dugme" id="yardim-kapat">Tamam</button>
  </dialog>
`;

const $ = <T extends HTMLElement>(kimlik: string) => document.getElementById(kimlik) as T;
const tahta = $('tahta');
const mesaj = $('mesaj');
const modYazisi = $('mod');
const klavye = $('klavye');
const yeniKutu = $('yeni');
const rastgeleDugme = $<HTMLButtonElement>('rastgele');
const gunlukDugme = $<HTMLButtonElement>('gunluk');
const yardimKutusu = $<HTMLDialogElement>('yardim-kutusu');
const tamEkranDugme = $<HTMLButtonElement>('tam-ekran');

const azHareket = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Durum ----------------------------------------------------------------------------------
let mod: Mod = 'gunluk';
let hedef = '';
let tahminler: string[] = [];
let gecerli: string[] = [];
let bitti = false;
let kilit = false;
let mesajZamanlayici = 0;
const tusDurumlari = new Map<string, Durum>();

// ---- Izgara ---------------------------------------------------------------------------------
const satirlar: HTMLElement[] = [];
const hucreler: HTMLElement[][] = [];

for (let s = 0; s < HAK; s += 1) {
  const satir = document.createElement('div');
  satir.className = 'satir';
  satir.setAttribute('role', 'group');
  satir.setAttribute('aria-label', `${s + 1}. tahmin`);
  const sutunlar: HTMLElement[] = [];
  for (let c = 0; c < HARF_SAYISI; c += 1) {
    const h = document.createElement('span');
    h.className = 'hucre';
    h.style.setProperty('--sira', String(c));
    sutunlar.push(h);
    satir.append(h);
  }
  satirlar.push(satir);
  hucreler.push(sutunlar);
  tahta.append(satir);
}

function hucreYaz(h: HTMLElement, harf: string, durum?: Durum) {
  h.textContent = harf;
  if (harf) h.dataset.dolu = '';
  else delete h.dataset.dolu;
  if (durum) {
    h.dataset.durum = durum;
    const not = document.createElement('span');
    not.className = 'sr';
    not.textContent = `, ${DURUM_METNI[durum]}`;
    h.append(not);
  } else {
    delete h.dataset.durum;
  }
}

function izgarayiSifirla() {
  for (let s = 0; s < HAK; s += 1) {
    for (const h of hucreler[s]!) {
      hucreYaz(h, '');
      h.classList.remove('ac');
    }
  }
}

function gecerliSatiriCiz() {
  const s = tahminler.length;
  if (s >= HAK) return;
  hucreler[s]!.forEach((h, i) => hucreYaz(h, gecerli[i] ?? ''));
}

// ---- Klavye ---------------------------------------------------------------------------------
const tusDugmeleri = new Map<string, HTMLButtonElement>();

function tusYap(etiket: string, sinif: string, eylem: string): HTMLButtonElement {
  const d = document.createElement('button');
  d.type = 'button';
  d.className = `tus ${sinif}`;
  d.textContent = etiket;
  d.dataset.eylem = eylem;
  return d;
}

KLAVYE_SATIRLARI.forEach((harfler, i) => {
  const satir = document.createElement('div');
  satir.className = 'tus-satiri';
  if (i === KLAVYE_SATIRLARI.length - 1) {
    const gonder = tusYap('Gönder', 'genis', 'gonder');
    gonder.setAttribute('aria-label', 'Tahmini gönder');
    satir.append(gonder);
  }
  for (const harf of Array.from(harfler)) {
    const d = tusYap(harf, '', harf);
    tusDugmeleri.set(harf, d);
    satir.append(d);
  }
  if (i === KLAVYE_SATIRLARI.length - 1) {
    const sil = tusYap('Sil', 'genis', 'sil');
    sil.setAttribute('aria-label', 'Son harfi sil');
    satir.append(sil);
  }
  klavye.append(satir);
});

function klavyeyiBoya() {
  for (const [harf, d] of tusDugmeleri) {
    const durum = tusDurumlari.get(harf);
    if (durum) {
      d.dataset.durum = durum;
      d.setAttribute('aria-label', `${harf}, ${DURUM_METNI[durum]}`);
    } else {
      delete d.dataset.durum;
      d.removeAttribute('aria-label');
    }
  }
}

// ---- Mesajlar -------------------------------------------------------------------------------
function mesajYaz(metin: string, kalici = false) {
  window.clearTimeout(mesajZamanlayici);
  mesaj.textContent = metin;
  if (!kalici && metin) mesajZamanlayici = window.setTimeout(() => (mesaj.textContent = ''), 2600);
}

function sars() {
  const satir = satirlar[tahminler.length];
  if (!satir) return;
  satir.classList.remove('sars');
  void satir.offsetWidth; // animasyonu yeniden başlatır
  satir.classList.add('sars');
  window.setTimeout(() => satir.classList.remove('sars'), 500);
}

// ---- Depo (yalnızca günlük mod; erişilemezse sessizce atlanır) ------------------------------
function depoyaYaz() {
  if (mod !== 'gunluk') return;
  try {
    localStorage.setItem(DEPO_ANAHTARI, JSON.stringify({ gun: gunNumarasi(new Date()), tahminler }));
  } catch {
    /* özel pencere / engelli depolama */
  }
}

function depodanOku(): string[] {
  try {
    const ham = localStorage.getItem(DEPO_ANAHTARI);
    if (!ham) return [];
    const v = JSON.parse(ham) as { gun?: number; tahminler?: unknown };
    if (v.gun !== gunNumarasi(new Date()) || !Array.isArray(v.tahminler)) return [];
    return v.tahminler.filter(
      (t): t is string => typeof t === 'string' && Array.from(t).length === HARF_SAYISI,
    );
  } catch {
    return [];
  }
}

// ---- Oyun akışı -----------------------------------------------------------------------------
function tahminiUygula(tahmin: string, satirNo: number, animasyonlu: boolean) {
  const durumlar = degerlendir(tahmin, hedef);
  const harfler = Array.from(tahmin);
  hucreler[satirNo]!.forEach((h, i) => {
    hucreYaz(h, harfler[i]!, durumlar[i]);
    if (animasyonlu) {
      h.classList.remove('ac');
      void h.offsetWidth;
      h.classList.add('ac');
    }
  });
  harfler.forEach((harf, i) => tusDurumlari.set(harf, dahaIyi(tusDurumlari.get(harf), durumlar[i]!)));
  return durumlar.every((d) => d === 'dogru');
}

function bitir(kazandi: boolean) {
  bitti = true;
  yeniKutu.hidden = false;
  gunlukDugme.hidden = mod === 'gunluk';
  if (kazandi) {
    mesajYaz(`Tebrikler! ${tahminler.length}. tahminde buldun.`, true);
  } else {
    mesajYaz(`Olmadı. Kelime: ${hedef}.`, true);
  }
  rastgeleDugme.focus({ preventScroll: true });
}

function gonder() {
  if (bitti || kilit) return;
  if (gecerli.length < HARF_SAYISI) {
    mesajYaz('Beş harf gerekli.');
    sars();
    return;
  }
  const tahmin = gecerli.join('');
  const satirNo = tahminler.length;
  tahminler.push(tahmin);
  gecerli = [];
  const animasyonlu = !azHareket();
  const kazandi = tahminiUygula(tahmin, satirNo, animasyonlu);
  depoyaYaz();
  kilit = true;
  const bekleme = animasyonlu ? 250 * (HARF_SAYISI - 1) + 520 : 0;
  window.setTimeout(() => {
    klavyeyiBoya();
    kilit = false;
    if (kazandi) bitir(true);
    else if (tahminler.length >= HAK) bitir(false);
  }, bekleme);
}

function harfEkle(harf: string) {
  if (bitti || kilit || gecerli.length >= HARF_SAYISI) return;
  gecerli.push(harf);
  gecerliSatiriCiz();
  const h = hucreler[tahminler.length]![gecerli.length - 1]!;
  h.classList.remove('pop');
  void h.offsetWidth;
  h.classList.add('pop');
}

function harfSil() {
  if (bitti || kilit || gecerli.length === 0) return;
  gecerli.pop();
  gecerliSatiriCiz();
}

function oyunuBaslat(yeniMod: Mod) {
  mod = yeniMod;
  window.clearTimeout(mesajZamanlayici);
  mesaj.textContent = '';
  bitti = false;
  kilit = false;
  gecerli = [];
  tahminler = [];
  tusDurumlari.clear();
  yeniKutu.hidden = true;
  izgarayiSifirla();

  if (mod === 'gunluk') {
    hedef = gunlukKelime(KELIMELER, gunNumarasi(new Date()));
    modYazisi.textContent = 'Günün kelimesi';
    // Bugünkü kayıtlı tahminleri animasyonsuz geri yükle.
    const kayitli = depodanOku();
    let kazandi = false;
    for (const t of kayitli) {
      if (tahminler.length >= HAK) break;
      tahminler.push(t);
      kazandi = tahminiUygula(t, tahminler.length - 1, false);
      if (kazandi) break;
    }
    klavyeyiBoya();
    if (kazandi) bitir(true);
    else if (tahminler.length >= HAK) bitir(false);
  } else {
    hedef = rastgeleKelime(KELIMELER);
    modYazisi.textContent = 'Rastgele kelime';
    klavyeyiBoya();
  }
  gecerliSatiriCiz();
}

// ---- Olaylar --------------------------------------------------------------------------------
klavye.addEventListener('click', (e) => {
  const d = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-eylem]');
  if (!d) return;
  const eylem = d.dataset.eylem!;
  if (eylem === 'gonder') gonder();
  else if (eylem === 'sil') harfSil();
  else harfEkle(eylem);
});

window.addEventListener('keydown', (e) => {
  if (yardimKutusu.open || e.isComposing) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const hedefEleman = e.target as HTMLElement;
  // Odaktaki "Yeni kelime"/yardım düğmeleri kendi Enter'ını işlesin; klavye ve tahta tuşları bizim.
  const klavyeTusu = hedefEleman.closest?.('.klavye') != null;
  if (e.key === 'Enter') {
    if (hedefEleman instanceof HTMLButtonElement && !klavyeTusu) return;
    e.preventDefault();
    gonder();
  } else if (e.key === 'Backspace') {
    e.preventDefault();
    harfSil();
  } else {
    const harf = tusuHarfeCevir(e.key);
    if (harf) {
      e.preventDefault();
      harfEkle(harf);
    }
  }
});

rastgeleDugme.addEventListener('click', () => oyunuBaslat('rastgele'));
gunlukDugme.addEventListener('click', () => oyunuBaslat('gunluk'));

$('yardim').addEventListener('click', () => yardimKutusu.showModal());
$('yardim-kapat').addEventListener('click', () => yardimKutusu.close());
yardimKutusu.addEventListener('click', (e) => {
  if (e.target === yardimKutusu) yardimKutusu.close(); // dolgu alanına (arka plana) tıklama
});

// Tam ekran düğmesi yalnızca doğrudan açılışta ve destekleniyorsa; iframe'de site kendi düğmesini sunar.
if (window.top === window.self && document.fullscreenEnabled) {
  tamEkranDugme.hidden = false;
  tamEkranDugme.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  });
  document.addEventListener('fullscreenchange', () => {
    tamEkranDugme.textContent = document.fullscreenElement ? 'Tam ekrandan çık' : 'Tam ekran';
  });
}

oyunuBaslat('gunluk');
