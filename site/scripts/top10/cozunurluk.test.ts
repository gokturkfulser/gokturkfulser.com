// Video çözünürlüğü, istem yer tutucuları, model sürümü ve token sınırı (ağ yok).
import { describe, expect, it } from 'vitest';
import { COZUNURLUKLER, tokenSiniri } from './ayarlar';
import { cozunurlukCoz, geceUret, istekGovdesi, istemHazirla, modelSurumuCoz } from './gemini';
import { geminiYaniti, GM_ANAHTAR, gecerliHam, json } from './test-yardim';

describe('istem yer tutucuları', () => {
  it('{tarih} ve {sezon} doldurulur (tüm geçişler); yer tutucu yoksa metin aynen kalır', () => {
    const istem = 'This video covers NBA games played on {tarih} (season {sezon}). Rosters are those of {sezon}.';
    expect(istemHazirla(istem, { tarih: '2026-10-31', sezon: '2026-27' })).toBe('This video covers NBA games played on 2026-10-31 (season 2026-27). Rosters are those of 2026-27.');
    expect(istemHazirla('Yer tutucu yok', { tarih: '2026-10-31', sezon: '2026-27' })).toBe('Yer tutucu yok');
  });
  it('doldurulmuş istemde yer tutucu kalmaz', () => {
    expect(istemHazirla('{tarih} {sezon} {tarih}', { tarih: '2027-01-15', sezon: '2026-27' })).not.toMatch(/[{}]/);
  });
});

describe('GEMINI_COZUNURLUK', () => {
  it('boşsa varsayılan yüksek; geçerli değerler; geçersizse hata', () => {
    expect(cozunurlukCoz(undefined)).toBe('high');
    expect(cozunurlukCoz('')).toBe('high');
    expect(cozunurlukCoz(' LOW ')).toBe('low');
    for (const c of COZUNURLUKLER) expect(cozunurlukCoz(c)).toBe(c);
    expect(() => cozunurlukCoz('ultra')).toThrow(/GEMINI_COZUNURLUK geçersiz/);
  });
  it('istek: video parçasına resolution eklenir; unspecified ya da boşsa eklenmez', () => {
    const video = (g: ReturnType<typeof istekGovdesi>) => g.input[1] as Record<string, unknown>;
    expect(video(istekGovdesi('m', 'u', 'I', undefined, 'high'))).toEqual({ type: 'video', uri: 'u', resolution: 'high' });
    expect(video(istekGovdesi('m', 'u', 'I', undefined, 'low'))).toEqual({ type: 'video', uri: 'u', resolution: 'low' });
    expect(video(istekGovdesi('m', 'u', 'I', undefined, 'unspecified'))).toEqual({ type: 'video', uri: 'u' });
    expect(video(istekGovdesi('m', 'u', 'I'))).toEqual({ type: 'video', uri: 'u' });
  });
  it('API resolution alanını reddederse (400) alansız bir kez daha denenir ve bildirilir', async () => {
    const govdeler: Record<string, unknown>[] = [];
    const fetchFn = (async (_u: string, init: RequestInit) => {
      const g = JSON.parse(String(init.body)) as { input: Record<string, unknown>[] };
      govdeler.push(g.input[1]!);
      return g.input[1]!.resolution ? json({ error: { message: 'Unknown name resolution' } }, 400) : json(geminiYaniti(gecerliHam('top5')));
    }) as unknown as typeof fetch;
    const s = await geceUret({ anahtar: GM_ANAHTAR, model: 'm', videoUrl: 'u', istem: 'I', fetchFn, cozunurluk: 'high' });
    expect(s.cozunurlukReddedildi).toBe(true);
    expect(govdeler).toEqual([{ type: 'video', uri: 'u', resolution: 'high' }, { type: 'video', uri: 'u' }]);
    expect(s.ham.plays).toHaveLength(5);
  });
  it('resolution ile ilgisiz 400 hatası yeniden denenmez', async () => {
    let cagri = 0;
    const fetchFn = (async () => {
      cagri += 1;
      return json({ error: { message: 'Invalid model' } }, 400);
    }) as unknown as typeof fetch;
    await expect(geceUret({ anahtar: GM_ANAHTAR, model: 'm', videoUrl: 'u', istem: 'I', fetchFn, cozunurluk: 'high' })).rejects.toThrow(/400/);
    expect(cagri).toBe(1);
  });
});

describe('token üst sınırı seçilen çözünürlüğün oranını kullanır ve %25 pay ekler', () => {
  it('yüksek ≈300 token/sn, düşük/varsayılan ≈100 token/sn; (süre × oran + 5.000) × 1,25', () => {
    expect(tokenSiniri(630, 'high')).toBe(Math.round((630 * 300 + 5000) * 1.25));
    expect(tokenSiniri(630, 'low')).toBe(Math.round((630 * 100 + 5000) * 1.25));
    expect(tokenSiniri(630, 'medium')).toBe(tokenSiniri(630, 'low'));
    expect(tokenSiniri(630, 'unspecified')).toBe(tokenSiniri(630, 'low'));
    expect(tokenSiniri(146)).toBe(61000); // varsayılan yüksek: 2:26 video
  });
  it('gerçek ölçüm (2:26 video, yüksek çözünürlük, 42.988 girdi token) sınırın altında ve rahat uzaklıkta; 1,33 milyon aşar', () => {
    const sinir = tokenSiniri(146, 'high');
    expect(42988).toBeLessThan(sinir);
    expect(42988 / sinir).toBeLessThan(0.75);
    expect(1330160).toBeGreaterThan(sinir);
  });
});

describe('modelSurumuCoz', () => {
  it('yanıtın bildirdiği model sürümü (model_version / modelVersion / model); yoksa undefined', () => {
    expect(modelSurumuCoz({ model_version: 'gemini-3.6-flash-001' })).toBe('gemini-3.6-flash-001');
    expect(modelSurumuCoz({ modelVersion: 'x-2' })).toBe('x-2');
    expect(modelSurumuCoz({ model: 'gemini-3.6-flash' })).toBe('gemini-3.6-flash');
    expect(modelSurumuCoz({})).toBeUndefined();
    expect(modelSurumuCoz({ model: '  ' })).toBeUndefined();
  });
  it('geceUret model sürümünü döndürür', async () => {
    const fetchFn = (async () => json({ ...geminiYaniti(gecerliHam('top5')), model: 'gemini-3.6-flash-preview-0901' })) as unknown as typeof fetch;
    expect((await geceUret({ anahtar: GM_ANAHTAR, model: 'm', videoUrl: 'u', istem: 'I', fetchFn })).modelSurumu).toBe('gemini-3.6-flash-preview-0901');
  });
});
