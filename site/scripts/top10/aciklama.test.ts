import { describe, expect, it } from 'vitest';
import { aciklamaKontrolu, aciklamadanOyuncular, adNormallestir } from './aciklama';
import { ACIKLAMA_ORNEK } from './test-yardim';

describe('adNormallestir', () => {
  it('aksan, nokta, büyük/küçük harf, tire ve tek boşluk', () => {
    expect(adNormallestir('Nikola Jokić')).toBe('nikola jokic');
    expect(adNormallestir('Luka Dončić')).toBe('luka doncic');
    expect(adNormallestir('Alperen Şengün')).toBe('alperen sengun');
    expect(adNormallestir('Kristaps Porziņģis')).toBe('kristaps porzingis');
    expect(adNormallestir('  SHAI   Gilgeous-Alexander ')).toBe('shai gilgeous alexander');
    expect(adNormallestir('P.J. Washington')).toBe('pj washington');
    expect(adNormallestir('Łukasz Kowalski')).toBe('lukasz kowalski');
  });
  it('Jr./Sr./II/III/IV soneki yok sayılır', () => {
    expect(adNormallestir('Jaime Jaquez Jr.')).toBe('jaime jaquez');
    expect(adNormallestir('Jaime Jaquez Jr')).toBe('jaime jaquez');
    expect(adNormallestir('Gary Payton II')).toBe('gary payton');
    expect(adNormallestir('Wendell Carter Jr.')).toBe(adNormallestir('wendell carter'));
    expect(adNormallestir('Trey Murphy III')).toBe('trey murphy');
    expect(adNormallestir('Marvin Bagley III')).toBe(adNormallestir('Marvin Bagley'));
    expect(adNormallestir('Kenny Smith Sr.')).toBe('kenny smith');
    expect(adNormallestir('Ray Allen IV')).toBe('ray allen');
  });
  it("kesme işaretli adlar (düz ve kıvrık): De'Aaron Fox, Jae'Sean Tate", () => {
    expect(adNormallestir("De'Aaron Fox")).toBe('deaaron fox');
    expect(adNormallestir('De’Aaron Fox')).toBe('deaaron fox');
    expect(adNormallestir("DeAaron Fox")).toBe(adNormallestir("De'Aaron Fox"));
    expect(adNormallestir("Jae'Sean Tate")).toBe('jaesean tate');
    expect(adNormallestir("Tyus Jones")).toBe('tyus jones');
  });
  it('tek kelimelik ad sonekle silinmez', () => {
    expect(adNormallestir('V')).toBe('v');
  });
});

describe('aciklamadanOyuncular', () => {
  it('NBA tarzı "featuring" listesi: virgül ve "and"', () => {
    expect(aciklamadanOyuncular(ACIKLAMA_ORNEK)).toEqual([
      'Tomas Veltri', 'Kofi Adebayo', 'Ilse Brandt', 'Rafael Quintero', 'Jun Takeda', 'Dario Fenn', 'Nils Haugen', 'Amara Osei', 'Leo Marchetti', 'Mirko Daval',
    ]);
  });
  it('Jr. gibi noktalar cümle sonu sayılmaz; "&" ve "and more" desteklenir', () => {
    expect(aciklamadanOyuncular('Top plays featuring Jaime Jaquez Jr., Gary Payton II & Trey Murphy III.')).toEqual(['Jaime Jaquez Jr.', 'Gary Payton II', 'Trey Murphy III']);
    expect(aciklamadanOyuncular('Plays featuring A Bee, C Dee, E Eff and more...')).toEqual(['A Bee', 'C Dee', 'E Eff']);
  });
  it('liste yoksa ya da üçten az ad varsa undefined (kontrol atlanır)', () => {
    expect(aciklamadanOyuncular('Never miss a moment with the latest news, trending stories and highlights')).toBeUndefined();
    expect(aciklamadanOyuncular('')).toBeUndefined();
    expect(aciklamadanOyuncular('Plays featuring Ada Bee and Cem Dee')).toBeUndefined();
  });
});

describe('aciklamaKontrolu', () => {
  const liste = ['Nikola Jokić', 'Luka Dončić', "De'Aaron Fox", 'Jaime Jaquez Jr.'];
  it('aksan/Jr./kesme işareti farkları eşleşir', () => {
    const k = aciklamaKontrolu(['Nikola Jokic', 'LUKA DONCIC', 'DeAaron Fox', 'Jaime Jaquez'], liste);
    expect(k).toMatchObject({ atlandi: false, eslesen: 4, toplam: 4, eksikler: [], tutarsiz: false });
  });
  it('tek tek eksikler listelenir; yarıdan azı eşleşirse tutarsız', () => {
    const bir = aciklamaKontrolu(['Nikola Jokic', 'Luka Doncic', 'Baska Biri'], liste);
    expect(bir).toMatchObject({ eslesen: 2, toplam: 3, eksikler: ['Baska Biri'], tutarsiz: false });
    const yari = aciklamaKontrolu(['Nikola Jokic', 'Baska Biri'], liste); // tam yarısı: tutarsız değil
    expect(yari.tutarsiz).toBe(false);
    const az = aciklamaKontrolu(['Nikola Jokic', 'Baska Biri', 'Bir Diger'], liste); // 1/3 < yarı
    expect(az).toMatchObject({ eslesen: 1, toplam: 3, tutarsiz: true });
    expect(aciklamaKontrolu(['A Bee', 'C Dee'], liste).tutarsiz).toBe(true);
  });
  it('aynı oyuncu birden çok oyunda tek sayılır', () => {
    expect(aciklamaKontrolu(['Nikola Jokic', 'nikola jokić', 'Baska Biri'], liste)).toMatchObject({ toplam: 2, eslesen: 1 });
  });
  it('liste yoksa kontrol atlanır', () => {
    expect(aciklamaKontrolu(['A Bee'], undefined)).toMatchObject({ atlandi: true, tutarsiz: false, eksikler: [] });
  });
});
