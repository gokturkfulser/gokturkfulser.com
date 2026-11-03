import { describe, expect, it } from 'vitest';
import { geceVideolari, karar, kilitliMi, pencereTarihleri, planla, type Mevcut } from './otomatik';
import type { Video } from './youtube';

const v = (id: string, baslik: string, yayin = '2026-11-02T05:00:00Z'): Video => ({ id, baslik, yayin });
const YOK: Mevcut = { dosyaVar: false };

describe('pencereTarihleri: son 3 gece, ABD (Doğu) takvim günü', () => {
  it('İstanbul sabahı (ABD hâlâ önceki gün gecesi)', () => {
    // 2 Kasım 2026 07:00 UTC = 03:00 ET (EST, UTC-5 → ABD'de 2 Kasım 02:00; DST 1 Kasım'da bitti)
    expect(pencereTarihleri(new Date('2026-11-02T07:00:00Z'), 3, 'America/New_York')).toEqual(['2026-10-31', '2026-11-01', '2026-11-02']);
  });
  it('UTC gece yarısından hemen sonra ABD hâlâ bir önceki gündedir', () => {
    expect(pencereTarihleri(new Date('2026-11-02T01:30:00Z'), 3, 'America/New_York')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
  });
  it('ay ve yıl sınırı', () => {
    expect(pencereTarihleri(new Date('2027-01-01T15:00:00Z'), 3, 'America/New_York')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01']);
  });
});

describe('geceVideolari', () => {
  it('yalnızca kalıba uyan ve dışlanmayan videolar; Top 10 Top 5\'ten önce gelir', () => {
    const harita = geceVideolari([
      v('a', "NBA's Nightly Recap | November 1, 2026"),
      v('b', "NBA's Top 5 Plays of the Night | November 1, 2026"),
      v('c', "NBA's Top 10 Plays of the Night | November 1, 2026"),
      v('d', 'The TOP Plays of Week 2 | 2026-27 NBA Season'),
      v('e', "NBA's Top 10 Plays of the Night | October 31, 2026"),
    ]);
    expect([...harita.keys()].sort()).toEqual(['2026-10-31', '2026-11-01']);
    expect(harita.get('2026-11-01')).toMatchObject({ tur: 'top10', video: { id: 'c' } });
  });
  it('aynı gece iki yükleme: ilk gelen (en yeni) kalır', () => {
    const harita = geceVideolari([v('yeni', "NBA's Top 10 Plays of the Night | November 1, 2026"), v('eski', "NBA's Top 10 Plays of the Night | November 1, 2026")]);
    expect(harita.get('2026-11-01')!.video.id).toBe('yeni');
  });
});

describe('karar: dosya kilidi kuralları', () => {
  it('dosya yoksa: video varsa üret, yoksa "henüz yok"', () => {
    expect(karar(YOK, true, false)).toBe('uret');
    expect(karar(YOK, false, false)).toBe('video-yok');
  });
  it('gemini + bekliyor: dokunma (yeniden üretme yok); --uzerine-yaz ile ve video varsa üzerine yazılır', () => {
    const bekleyen: Mevcut = { dosyaVar: true, kaynak: 'gemini', inceleme: 'bekliyor' };
    expect(karar(bekleyen, true, false)).toBe('bekliyor');
    expect(karar({ dosyaVar: true, kaynak: 'gemini' }, true, false)).toBe('bekliyor'); // inceleme yazılmamış = bekliyor
    expect(karar(bekleyen, true, true)).toBe('uzerine-yaz');
    expect(karar(bekleyen, false, true)).toBe('video-yok');
  });
  it('onaylandi, elle, elle_duzenlendi ve okunamayan dosyaya --uzerine-yaz ile bile asla dokunulmaz', () => {
    for (const m of [
      { dosyaVar: true, kaynak: 'gemini', inceleme: 'onaylandi' },
      { dosyaVar: true, kaynak: 'elle', inceleme: 'bekliyor' },
      { dosyaVar: true, kaynak: 'elle' },
      { dosyaVar: true },
      { dosyaVar: true, okunamadi: true },
      // elle_duzenlendi: true (kontrol düzenleyicisi) kaynak ve inceleme ne olursa olsun kilitler
      { dosyaVar: true, kaynak: 'gemini', inceleme: 'bekliyor', eleDuzenlendi: true },
      { dosyaVar: true, kaynak: 'gemini', eleDuzenlendi: true },
    ] as Mevcut[]) {
      expect(kilitliMi(m)).toBe(true);
      expect(karar(m, true, false)).toBe('kilitli');
      expect(karar(m, true, true)).toBe('kilitli');
    }
  });
});

describe('planla: 3 günlük pencere', () => {
  it('her gece için karar; videosu olmayan gece "video-yok", kilitli dosya "kilitli"', () => {
    const mevcut: Record<string, Mevcut> = {
      '2026-10-31': { dosyaVar: true, kaynak: 'elle' },
      '2026-11-01': { dosyaVar: true, kaynak: 'gemini', inceleme: 'bekliyor' },
    };
    const plan = planla({
      tarihler: ['2026-10-31', '2026-11-01', '2026-11-02'],
      videolar: [v('x', "NBA's Top 10 Plays of the Night | October 31, 2026"), v('y', "NBA's Top 5 Plays of the Night | November 1, 2026")],
      mevcutOku: (t) => mevcut[t] ?? YOK,
    });
    expect(plan.map((p) => [p.tarih, p.karar])).toEqual([
      ['2026-10-31', 'kilitli'],
      ['2026-11-01', 'bekliyor'],
      ['2026-11-02', 'video-yok'],
    ]);
  });
  it('pencere dışındaki videolar plana girmez', () => {
    const plan = planla({ tarihler: ['2026-11-02'], videolar: [v('eski', "NBA's Top 10 Plays of the Night | October 1, 2026")], mevcutOku: () => YOK });
    expect(plan).toEqual([{ tarih: '2026-11-02', karar: 'video-yok', video: undefined }]);
  });
});
