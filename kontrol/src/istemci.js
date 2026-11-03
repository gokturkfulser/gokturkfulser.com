// Küçük etkileşimler (CSP: harici dosya, satır içi betik yok). JS olmadan sayfa ve form çalışır; yalnızca "katkı ekle/çıkar" ve "alternatif ada dokun" JS ister.
(function () {
  'use strict';
  var form = document.querySelector('.gece-form');
  if (!form) return;
  var bolusumler = {};
  try {
    bolusumler = JSON.parse(form.getAttribute('data-bolusumler') || '{}');
  } catch (e) {
    bolusumler = {};
  }
  var sablon = document.getElementById('katki-sablon');
  var onayla = form.querySelector('.onayla-dugmesi');
  var sonOyuncu = {}; // oyun sırası → son odaklanan oyuncu alanı

  function kirli() {
    if (!onayla) return;
    onayla.disabled = true;
    onayla.title = 'Değişiklik yaptınız: bunun yerine "Kaydet ve onayla"yı kullanın.';
  }

  function yenidenIndeksle(kart) {
    var sira = kart.getAttribute('data-sira');
    var satirlar = kart.querySelectorAll('.katki');
    satirlar.forEach(function (satir, i) {
      satir.setAttribute('data-i', String(i));
      satir.querySelectorAll('[name], [id], label[for]').forEach(function (el) {
        ['name', 'id'].forEach(function (a) {
          var v = el.getAttribute(a);
          if (v) el.setAttribute(a, v.replace(/^o\d+_k\d+_/, 'o' + sira + '_k' + i + '_'));
        });
        if (el.tagName === 'LABEL') el.setAttribute('for', (el.getAttribute('for') || '').replace(/^o\d+_k\d+_/, 'o' + sira + '_k' + i + '_'));
      });
      var cikar = satir.querySelector('.katki-cikar');
      if (cikar) cikar.hidden = satirlar.length <= 1;
    });
    kart.querySelector('input[name$="_kn"]').value = String(satirlar.length);
    var ekle = kart.querySelector('.katki-ekle');
    if (ekle) ekle.hidden = satirlar.length >= 3;
    // Pay seçenekleri katkı sayısına uyar; önceki seçim hâlâ izinliyse korunur, değilse "eşit bölüşüm".
    var sel = kart.querySelector('.bolusum');
    var secenekler = bolusumler[String(satirlar.length)];
    if (sel && secenekler) {
      var onceki = sel.value;
      sel.innerHTML = '';
      secenekler.forEach(function (s) {
        var o = document.createElement('option');
        o.value = s[0];
        o.textContent = s[1];
        sel.appendChild(o);
      });
      sel.value = secenekler.some(function (s) { return s[0] === onceki; }) ? onceki : 'esit';
    }
  }

  form.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('button') : null;
    if (!t) return;
    var kart = t.closest('.oyun');
    if (!kart) return;
    if (t.classList.contains('katki-ekle') && sablon) {
      var kopya = sablon.content.firstElementChild.cloneNode(true);
      t.parentNode.insertBefore(kopya, t);
      yenidenIndeksle(kart);
      var alan = kopya.querySelector('input[type="text"]');
      if (alan) alan.focus();
      kirli();
    } else if (t.classList.contains('katki-cikar')) {
      var satir = t.closest('.katki');
      if (satir && kart.querySelectorAll('.katki').length > 1) {
        satir.parentNode.removeChild(satir);
        yenidenIndeksle(kart);
        kirli();
      }
    } else if (t.classList.contains('alt-ad')) {
      var sira = kart.getAttribute('data-sira');
      var hedef = sonOyuncu[sira] || kart.querySelector('.katki input[name$="_oyuncu"]');
      if (hedef) {
        hedef.value = t.getAttribute('data-ad') || '';
        hedef.focus();
        kirli();
      }
    }
  });
  form.addEventListener('focusin', function (e) {
    var el = e.target;
    if (el && el.matches && el.matches('input[name$="_oyuncu"]')) {
      var kart = el.closest('.oyun');
      if (kart) sonOyuncu[kart.getAttribute('data-sira')] = el;
    }
  });
  form.addEventListener('input', kirli);
  form.addEventListener('change', kirli);
})();
