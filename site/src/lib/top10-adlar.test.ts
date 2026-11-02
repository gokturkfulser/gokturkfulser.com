import { describe, expect, it } from 'vitest';
import { adlariUygula, kanonikAd, kanonikGece, sozlukHaritasi, sozlukHatasi } from './top10-adlar';
import { benzerAdlar, sezonTablosu, type Gece, type Oyun } from './top10';

const SOZLUK = { 'Svi Mykhailiuk': ['Sviatoslav Mykhailiuk'], 'Brayden Burries': ['Braden Burries'] };
const harita = sozlukHaritasi(SOZLUK);

const oyun = (sira: number, ad: string, takim = 'SAS'): Oyun => ({ sira, katkilar: [{ oyuncu: ad, takim, rol: 'bitiren' }] });
const gece = (tarih: string, ...oyunlar: Oyun[]): Gece => ({ tarih: new Date(`${tarih}T00:00:00Z`), tur: 'top5', video: 'https://www.youtube.com/watch?v=x', oyunlar });

describe('sozlukHatasi (build\'i durdurur)', () => {
  it('geçerli sözlük', () => {
    expect(sozlukHatasi(SOZLUK)).toBeUndefined();
    expect(sozlukHatasi({})).toBeUndefined();
    expect(sozlukHatasi({ 'Ada Bee': [] })).toBeUndefined();
  });
  it('bir takma ad iki kanonik ada bağlanamaz (aksan/büyük harf farkı sayılmaz)', () => {
    expect(sozlukHatasi({ 'Ada Bee': ['Cem Dee'], 'Eda Eff': ['cem dee'] })).toMatch(/iki kanonik ada bağlı/);
    expect(sozlukHatasi({ 'Ada Bee': ['Şengün'], 'Eda Eff': ['Sengun'] })).toMatch(/iki kanonik ada bağlı/);
  });
  it('kanonik ad başka bir kaydın takma adı olamaz', () => {
    expect(sozlukHatasi({ 'Ada Bee': ['Cem Dee'], 'Cem Dee': ['Eda Eff'] })).toMatch(/başka bir kaydın kanonik adı/);
    expect(sozlukHatasi({ 'Cem Dee': ['Eda Eff'], 'Ada Bee': ['CEM DEE'] })).toMatch(/başka bir kaydın kanonik adı/);
  });
  it('aynı kimlikli iki kanonik ad, kendi kanonik adıyla aynı takma ad ve boş ad', () => {
    expect(sozlukHatasi({ 'Ada Bee': [], 'ada  bee': [] })).toMatch(/aynı oyuncu kimliğine/);
    expect(sozlukHatasi({ 'Ada Bee': ['ADA BEE'] })).toMatch(/kendi kanonik adı/);
    expect(sozlukHatasi({ 'Ada Bee': ['  '] })).toMatch(/takma ad geçersiz/);
  });
  it('aynı takma ad aynı kanonik adın listesinde iki kez geçerse çakışma sayılmaz', () => {
    expect(sozlukHatasi({ 'Ada Bee': ['Cem Dee', 'cem dee'] })).toBeUndefined();
  });
});

describe('kanonik ad uygulaması', () => {
  it('takma ad (ve aksan/büyük harf farkı) kanonik ada çevrilir; bilinmeyen ad aynen kalır', () => {
    expect(kanonikAd('Braden Burries', harita)).toBe('Brayden Burries');
    expect(kanonikAd('BRADEN BURRIES', harita)).toBe('Brayden Burries');
    expect(kanonikAd('Sviatoslav Mykhailiuk', harita)).toBe('Svi Mykhailiuk');
    expect(kanonikAd('Brayden Burries', harita)).toBe('Brayden Burries');
    expect(kanonikAd('Baska Oyuncu', harita)).toBe('Baska Oyuncu');
  });
  it('rakip alanı da çevrilir; girdi değiştirilmez', () => {
    const g = gece('2026-10-31', { sira: 1, rakip: 'Braden Burries', katkilar: [{ oyuncu: 'Sviatoslav Mykhailiuk', takim: 'GSW', rol: 'bitiren' }] });
    const k = kanonikGece(g, harita);
    expect(k.oyunlar[0]!.rakip).toBe('Brayden Burries');
    expect(k.oyunlar[0]!.katkilar[0]!.oyuncu).toBe('Svi Mykhailiuk');
    expect(g.oyunlar[0]!.katkilar[0]!.oyuncu).toBe('Sviatoslav Mykhailiuk');
  });
});

describe('takma adla yazılmış iki gece tek oyuncuda toplanır', () => {
  const geceler = [
    gece('2026-10-30', oyun(1, 'Braden Burries', 'SAS'), oyun(2, 'Sviatoslav Mykhailiuk', 'GSW')),
    gece('2026-10-31', oyun(1, 'Brayden Burries', 'SAS'), oyun(3, 'Svi Mykhailiuk', 'GSW')),
  ];
  it('sözlük olmadan iki ayrı satır; sözlükle tek satır, kanonik ad, puanlar toplanır', () => {
    const sozluksuz = sezonTablosu(geceler);
    expect(sozluksuz.filter((s) => /Burries/.test(s.oyuncu))).toHaveLength(2);
    const t = sezonTablosu(adlariUygula(geceler, harita));
    const burries = t.filter((s) => /Burries/.test(s.oyuncu));
    expect(burries).toHaveLength(1);
    expect(burries[0]).toMatchObject({ oyuncu: 'Brayden Burries', puan: 20, gece: 2, birinci: 2 });
    const svi = t.filter((s) => /Mykhailiuk/.test(s.oyuncu));
    expect(svi).toHaveLength(1);
    expect(svi[0]).toMatchObject({ oyuncu: 'Svi Mykhailiuk', puan: 17, gece: 2 }); // 9 + 8
  });
  it('"benzer ad" uyarısı sözlükle eşleşmiş çiftler için susar', () => {
    expect(benzerAdlar(geceler).length).toBeGreaterThan(0); // sözlüksüz: Braden/Brayden şüpheli
    expect(benzerAdlar(adlariUygula(geceler, harita))).toEqual([]);
  });
});
