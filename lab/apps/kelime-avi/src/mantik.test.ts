import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { KELIMELER } from './kelimeler.ts';
import {
  ALFABE,
  KLAVYE_SATIRLARI,
  adim,
  buyukHarf,
  degerlendir,
  gunNumarasi,
  gecerliKelimeler,
  gunlukKelime,
  kucukHarf,
  tahminGecerli,
  tusuHarfeCevir,
} from './mantik.ts';

test('Türkçe büyük harf: i → İ, ı → I', () => {
  assert.equal(buyukHarf('ışık'), 'IŞIK');
  assert.equal(buyukHarf('iğne'), 'İĞNE');
  assert.equal(buyukHarf('çağrı'), 'ÇAĞRI');
  assert.notEqual(buyukHarf('i'), 'I');
});

test('klavyeden gelen tuşlar doğru harfe çevrilir', () => {
  assert.equal(tusuHarfeCevir('i'), 'İ');
  assert.equal(tusuHarfeCevir('ı'), 'I');
  assert.equal(tusuHarfeCevir('I'), 'I');
  assert.equal(tusuHarfeCevir('ğ'), 'Ğ');
  assert.equal(tusuHarfeCevir('ş'), 'Ş');
  assert.equal(tusuHarfeCevir('q'), null);
  assert.equal(tusuHarfeCevir('w'), null);
  assert.equal(tusuHarfeCevir('Enter'), null);
  assert.equal(tusuHarfeCevir('1'), null);
});

test('alfabe 29 harf; ekran klavyesi hepsini bir kez içerir', () => {
  assert.equal(Array.from(ALFABE).length, 29);
  const tuslar = Array.from(KLAVYE_SATIRLARI.join('')).sort();
  assert.deepEqual(tuslar, Array.from(ALFABE).sort());
});

test('değerlendirme: doğru yer / var / yok', () => {
  assert.deepEqual(degerlendir('KALEM', 'KALEM'), ['dogru', 'dogru', 'dogru', 'dogru', 'dogru']);
  assert.deepEqual(degerlendir('ELMAS', 'KALEM'), ['var', 'var', 'var', 'var', 'yok']);
});

test('değerlendirme: tekrarlı harfte fazladan "var" yok', () => {
  // cevapta tek A var: ilk A doğru yerde, ikincisi "yok" olmalı
  assert.deepEqual(degerlendir('ABABA', 'AKLEM'), ['dogru', 'yok', 'yok', 'yok', 'yok']);
  // cevapta iki A var, tahminde üç
  assert.deepEqual(degerlendir('AAAZZ', 'BAKAL'), ['var', 'dogru', 'yok', 'yok', 'yok']);
});

test('değerlendirme: i/ı ve İ/I ayrı harflerdir', () => {
  assert.deepEqual(degerlendir('KIRIK', 'KİRİŞ'), ['dogru', 'yok', 'dogru', 'yok', 'yok']);
  assert.deepEqual(degerlendir('IABCD', 'İXABC'), ['yok', 'var', 'var', 'var', 'yok']);
  // küçük harfle girilse de Türkçe büyütme uygulanır: "iz" ile "İ" eşleşir, "ı" ile eşleşmez
  assert.equal(degerlendir('izmir', 'İZMİR').every((d) => d === 'dogru'), true);
});

test('kelime listesi: 5 harf, Türk alfabesi, tekil', () => {
  assert.ok(KELIMELER.length >= 300);
  assert.equal(new Set(KELIMELER).size, KELIMELER.length);
  for (const k of KELIMELER) {
    const harfler = Array.from(buyukHarf(k));
    assert.equal(harfler.length, 5, k);
    assert.ok(harfler.every((h) => ALFABE.includes(h)), k);
  }
});

test('günlük kelime: gün içinde sabit, ardışık günlerde farklı, adım asal', () => {
  const gun = gunNumarasi(new Date('2026-10-24T12:00:00+03:00'));
  assert.equal(gunlukKelime(KELIMELER, gun), gunlukKelime(KELIMELER, gun));
  assert.notEqual(gunlukKelime(KELIMELER, gun), gunlukKelime(KELIMELER, gun + 1));
  // İstanbul gece yarısı sınırı: 23:59 ve 00:01 farklı gün
  assert.equal(gunNumarasi(new Date('2026-10-24T23:59:00+03:00')) + 1, gunNumarasi(new Date('2026-10-25T00:01:00+03:00')));
  // bir tur boyunca hiçbir kelime tekrarlanmaz
  const n = KELIMELER.length;
  const goruldu = new Set(Array.from({ length: n }, (_, i) => gunlukKelime(KELIMELER, i)));
  assert.equal(goruldu.size, n);
  assert.equal(adim(n) % 1, 0);
});

test('sözlük: Türkçe küçük harf ve doğrulama', () => {
  assert.equal(kucukHarf('IRMAK'), 'ırmak');
  assert.equal(kucukHarf('İZMİR'), 'izmir');
  const g = gecerliKelimeler('kitap\nırmak\n', ['KALEM']);
  assert.equal(tahminGecerli('KİTAP', g), true); // İ → i
  assert.equal(tahminGecerli('IRMAK', g), true); // I → ı
  assert.equal(tahminGecerli('IRMAK'.replace('I', 'İ'), g), false); // iRMAK ≠ ırmak
  assert.equal(tahminGecerli('KALEM', g), true); // cevaplar sözlükte olmasa da kabul
  assert.equal(tahminGecerli('QWXZZ', g), false);
});

test('sözlük dosyası: 5 harf, küçük harf, Türk alfabesi, tekil; tüm cevapları içerir', () => {
  const satirlar = readFileSync(new URL('./sozluk.txt', import.meta.url), 'utf8').split('\n').filter(Boolean);
  assert.ok(satirlar.length > 5000, 'sözlük beklenenden küçük');
  assert.equal(new Set(satirlar).size, satirlar.length);
  for (const k of satirlar) {
    assert.equal(k, kucukHarf(k), k);
    const harfler = Array.from(k);
    assert.equal(harfler.length, 5, k);
    assert.ok(harfler.every((h) => ALFABE.includes(buyukHarf(h))), k);
  }
  const kume = new Set(satirlar);
  const eksik = KELIMELER.filter((k) => !kume.has(kucukHarf(k)));
  assert.deepEqual(eksik, [], 'cevap listesinde sözlükte olmayan kelimeler var');
});
