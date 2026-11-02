import { describe, expect, it } from 'vitest';
import { json, oge, YT_ANAHTAR, type Cagri } from './test-yardim';
import { sonVideolar, videoKimligi, videoMeta } from './youtube';

describe('sonVideolar', () => {
  it('uploads listesinden playlistItems.list ile (search.list değil) sayfalayarak okur, pencereye gelince durur', async () => {
    const cagrilar: Cagri[] = [];
    const fetchFn = (async (girdi: URL | string) => {
      const url = new URL(String(girdi));
      cagrilar.push({ url: url.toString() });
      if (!url.searchParams.get('pageToken')) {
        return json({ nextPageToken: 'P2', items: [oge('a', "NBA's Top 5 Plays of the Night | November 1, 2026", '2026-11-02T05:26:50Z'), oge('b', 'Private video', '2026-11-02T04:00:00Z')] });
      }
      return json({ nextPageToken: 'P3', items: [oge('c', "NBA's Top 10 Plays of the Night | October 31, 2026", '2026-11-01T05:00:00Z'), oge('d', 'eski', '2026-10-29T05:00:00Z')] });
    }) as unknown as typeof fetch;
    const videolar = await sonVideolar({ anahtar: YT_ANAHTAR, fetchFn, kadar: new Date('2026-10-30T00:00:00Z') });
    expect(videolar.map((x) => x.id)).toEqual(['a', 'c', 'd']); // özel video atlandı; 'd' pencereden eski → sayfa 3 okunmadı
    expect(cagrilar).toHaveLength(2);
    for (const c of cagrilar) {
      const u = new URL(c.url);
      expect(u.pathname).toBe('/youtube/v3/playlistItems');
      expect(u.searchParams.get('playlistId')).toBe('UUWJ2lWNubArHWmf3FIHbfcQ');
      expect(u.searchParams.get('maxResults')).toBe('50');
    }
  });

  it('uploads listesi 404 verirse kanaldan çözer ve yeniden dener', async () => {
    const yollar: string[] = [];
    const fetchFn = (async (girdi: URL | string) => {
      const url = new URL(String(girdi));
      yollar.push(`${url.pathname}:${url.searchParams.get('playlistId') ?? url.searchParams.get('id')}`);
      if (url.pathname.endsWith('/channels')) return json({ items: [{ contentDetails: { relatedPlaylists: { uploads: 'UUGERCEK' } } }] });
      if (url.searchParams.get('playlistId') === 'UUGERCEK') return json({ items: [oge('x', "NBA's Top 10 Plays of the Night | November 1, 2026", '2026-11-02T05:00:00Z')] });
      return json({ error: { message: 'playlistNotFound' } }, 404);
    }) as unknown as typeof fetch;
    const videolar = await sonVideolar({ anahtar: YT_ANAHTAR, fetchFn, kadar: new Date('2026-11-01T00:00:00Z') });
    expect(videolar.map((x) => x.id)).toEqual(['x']);
    expect(yollar).toEqual(['/youtube/v3/playlistItems:UUWJ2lWNubArHWmf3FIHbfcQ', '/youtube/v3/channels:UCWJ2lWNubArHWmf3FIHbfcQ', '/youtube/v3/playlistItems:UUGERCEK']);
  });

  it('API hatasında anahtar hata iletisine sızmaz', async () => {
    const fetchFn = (async () => json({ error: { message: `API key not valid: ${YT_ANAHTAR}` } }, 403)) as unknown as typeof fetch;
    const hata = await sonVideolar({ anahtar: YT_ANAHTAR, fetchFn, kadar: new Date() }).catch((e: Error) => e);
    expect(hata).toBeInstanceOf(Error);
    expect((hata as Error).message).toContain('403');
    expect((hata as Error).message).not.toContain(YT_ANAHTAR);
  });

  it('ağ hatasında anahtar sızmaz', async () => {
    const fetchFn = (async (girdi: URL | string) => {
      throw new TypeError(`fetch failed ${String(girdi)}`);
    }) as unknown as typeof fetch;
    const hata = (await sonVideolar({ anahtar: YT_ANAHTAR, fetchFn, kadar: new Date() }).catch((e: Error) => e)) as Error;
    expect(hata.message).toContain('başarısız');
    expect(hata.message).not.toContain(YT_ANAHTAR);
  });
});

describe('videoKimligi: yalnızca üç adres biçimi, 11 karakterlik kimlik', () => {
  it('geçerli biçimler', () => {
    for (const u of [
      'https://www.youtube.com/watch?v=abcdefghijk',
      'https://youtube.com/watch?v=abc_DEF-123&t=5',
      'https://m.youtube.com/watch?v=abcdefghijk',
      'https://youtu.be/abcdefghijk',
      'https://youtu.be/abcdefghijk?t=9',
      'https://www.youtube.com/shorts/abcdefghijk',
    ]) {
      expect(videoKimligi(u), u).toMatch(/^[A-Za-z0-9_-]{11}$/);
    }
    expect(videoKimligi('https://youtu.be/abc_DEF-123')).toBe('abc_DEF-123');
  });
  it('geçersiz: yer tutucu "...", kısa/uzun kimlik, boş, kimliksiz, başka site/yol, yalın kimlik', () => {
    for (const u of [
      'https://www.youtube.com/watch?v=...',
      'https://www.youtube.com/watch?v=',
      'https://www.youtube.com/watch',
      'https://www.youtube.com/watch?v=abcdefghij',
      'https://www.youtube.com/watch?v=abcdefghijkl',
      'https://www.youtube.com/watch?v=abc defghijk',
      'https://youtu.be/',
      'https://youtu.be/abcdefghij',
      'https://www.youtube.com/shorts/abcdefghijkl',
      'https://www.youtube.com/embed/abcdefghijk',
      'https://www.youtube.com/@nba',
      'https://vimeo.com/123456789',
      'https://www.nba.com/watch/video/abcdefghijk',
      'https://evil.example/watch?v=abcdefghijk',
      'ftp://www.youtube.com/watch?v=abcdefghijk',
      'abcdefghijk',
      'www.youtube.com/watch?v=abcdefghijk',
      '',
    ]) {
      expect(videoKimligi(u), u).toBeUndefined();
    }
  });
});

describe('videoMeta (videos.list: başlık, açıklama, süre, gizlilik)', () => {
  it('snippet + contentDetails + status tek çağrıda; bulunamayan kimlik haritada yoktur', async () => {
    const cagrilar: string[] = [];
    const fetchFn = (async (girdi: URL | string) => {
      cagrilar.push(String(girdi));
      return json({ items: [{ id: 'abcdefghijk', snippet: { title: 'Başlık', description: 'Açıklama' }, contentDetails: { duration: 'PT10M30S' }, status: { privacyStatus: 'public' } }] });
    }) as unknown as typeof fetch;
    const m = await videoMeta(fetchFn, YT_ANAHTAR, ['abcdefghijk', 'yokyokyokyo']);
    expect(m.get('abcdefghijk')).toEqual({ id: 'abcdefghijk', baslik: 'Başlık', aciklama: 'Açıklama', sureSn: 630, gizlilik: 'public' });
    expect(m.has('yokyokyokyo')).toBe(false);
    expect(cagrilar).toHaveLength(1);
    expect(new URL(cagrilar[0]!).searchParams.get('part')).toBe('snippet,contentDetails,status');
  });
});

describe('video süreleri', () => {
  it('ISO 8601 süre → saniye', async () => {
    const { sureSaniye } = await import('./youtube');
    expect(sureSaniye('PT10M30S')).toBe(630);
    expect(sureSaniye('PT1H2M3S')).toBe(3723);
    expect(sureSaniye('PT45S')).toBe(45);
    expect(sureSaniye('PT2M')).toBe(120);
    expect(sureSaniye('abc')).toBeUndefined();
    expect(sureSaniye('PT')).toBeUndefined();
  });
});
