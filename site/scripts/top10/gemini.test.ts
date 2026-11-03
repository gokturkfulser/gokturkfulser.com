import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { geceUret, ISTEM_DOSYASI, istekGovdesi, istemMetni, istemOku, kullanimCoz, yanitMetni, YANIT_SEMASI } from './gemini';
import { GEMINI_ETIKET_DEGERLERI, GEMINI_EYLEM_DEGERLERI, GEMINI_ROL_DEGERLERI } from '../../src/lib/top10-sozluk';
import { geminiYaniti, GM_ANAHTAR, gecerliHam, json } from './test-yardim';

describe('istem.md', () => {
  it('her çağrıda dosyadan okunur (düzenlemeler bir sonraki çalıştırmada geçerli olur)', () => {
    const k = mkdtempSync(join(tmpdir(), 'istem-'));
    const f = join(k, 'istem.md');
    writeFileSync(f, 'Birinci metin\n');
    expect(istemOku(f)).toBe('Birinci metin');
    writeFileSync(f, 'İkinci metin (düzenlendi)\r\nsatır 2\r\n');
    expect(istemOku(f)).toBe('İkinci metin (düzenlendi)\nsatır 2');
    rmSync(k, { recursive: true });
  });
  it('dosya yoksa ya da boşsa açık hata', () => {
    expect(() => istemOku(join(tmpdir(), 'yok-istem-dosyasi.md'))).toThrow(/stem dosyası okunamadı/);
    const k = mkdtempSync(join(tmpdir(), 'istem-'));
    writeFileSync(join(k, 'bos.md'), '  \n');
    expect(() => istemOku(join(k, 'bos.md'))).toThrow(/boş/);
    rmSync(k, { recursive: true });
  });
  it('depodaki istem.md istenen metni içerir ve şema alan adlarıyla/enum değerleriyle uyumludur', () => {
    const istem = istemOku(ISTEM_DOSYASI);
    expect(istem.startsWith('This video covers NBA games played on {tarih} (season {sezon}). Rosters and rookies are those of that season; do not rely on earlier seasons')).toBe(true);
    expect(istem).toContain('This is the NBA "Top 10 Plays of the Night" video. Identify each ranked play.');
    expect(istem).toContain('Return only JSON: {"date": "...", "type": "top10" | "top5", "plays": [...]}');
    // sonradan eklenen kurallar (mevcut metin silinmeden sona/action tanımının altına)
    expect(istem).toContain('The action must match the most spectacular part of the play');
    expect(istem).toContain("Determine each player's team only from what is visible or audible in this video");
    expect(istem).toContain('If you cannot access or watch the video, return an empty plays list. Never produce plays you did not see.');
    expect(istem.trimEnd().endsWith('set confidence to low.')).toBe(true);
    expect(istem).toContain('never output such a phrase as a player name');
    // çalım / eşitleyen / rakip kuralları
    expect(istem).toContain('dribble_move = the highlight is a dribble move (crossover, ankle breaker, behind-the-back or between-the-legs dribble)');
    expect(istem).toContain('The ball handler gets role ball_handler.');
    expect(istem).toContain('game_tying = a shot that ties the game late in the fourth quarter or overtime; never use game_winner for it.');
    expect(istem).toContain('For every block, poster dunk, crossover and dribble_move, set opponent to the defender or shooter involved');
    // metindeki alan adları şemada var
    const oyun = YANIT_SEMASI.properties.plays.items.properties;
    for (const alan of ['rank', 'action', 'contributors', 'opponent', 'tags', 'description', 'timestamp', 'confidence']) {
      expect(istem).toContain(`- ${alan}:`);
      expect(Object.keys(oyun)).toContain(alan);
    }
    const katki = oyun.contributors.items.properties;
    for (const alan of ['player', 'team', 'role', 'share', 'share_reason']) {
      expect(istem).toContain(`- ${alan}:`);
      expect(Object.keys(katki)).toContain(alan);
    }
    for (const alan of ['date', 'type', 'plays']) expect(Object.keys(YANIT_SEMASI.properties)).toContain(alan);
    // metindeki enum listeleri şemadakilerle birebir aynı
    const liste = (ad: string) => new RegExp(`${ad}[^\\n]*?: ([a-z_, ]+)`).exec(istem)![1]!.split(',').map((x) => x.trim());
    expect(liste('action: the play\'s main action, exactly one of')).toEqual(GEMINI_EYLEM_DEGERLERI);
    expect(liste('role: exactly one of')).toEqual(GEMINI_ROL_DEGERLERI);
    expect(liste('tags: zero or more of')).toEqual(GEMINI_ETIKET_DEGERLERI);
    expect(oyun.action.enum).toEqual(GEMINI_EYLEM_DEGERLERI);
    expect(oyun.tags.items.enum).toEqual(GEMINI_ETIKET_DEGERLERI);
    expect(katki.role.enum).toEqual(GEMINI_ROL_DEGERLERI);
  });
});

describe('istekGovdesi', () => {
  it('istem metni aynen gider; video yalnızca YouTube URL girişiyle; yanıt JSON şemalıdır', () => {
    const g = istekGovdesi('gemini-3.6-flash', 'https://www.youtube.com/watch?v=abcdefghijk', 'ISTEM METNI');
    expect(g.model).toBe('gemini-3.6-flash');
    expect(g.input[0]).toEqual({ type: 'text', text: 'ISTEM METNI' });
    expect(g.input[1]).toEqual({ type: 'video', uri: 'https://www.youtube.com/watch?v=abcdefghijk' });
    expect(g.response_format).toMatchObject({ type: 'text', mime_type: 'application/json' });
  });
  it('ikinci denemede önceki hata modele geri verilir', () => {
    expect(istemMetni('X', 'sira 3: eksik')).toContain('sira 3: eksik');
    expect(istemMetni('X')).toBe('X');
  });
});

describe('yanitMetni / kullanimCoz', () => {
  it('son model_output adımının metin bloklarını birleştirir', () => {
    expect(yanitMetni({ steps: [{ type: 'model_output', content: [{ type: 'text', text: 'ilk' }] }, { type: 'model_output', content: [{ type: 'text', text: '{"a":' }, { type: 'text', text: '1}' }] }] })).toBe('{"a":1}');
  });
  it('model_output yoksa hata', () => {
    expect(() => yanitMetni({ steps: [{ type: 'thought' }] })).toThrow(/model_output/);
  });
  it('usage (resmi alan adları) ayrıştırılır; yoksa undefined', () => {
    expect(kullanimCoz({ usage: { total_input_tokens: 10, total_output_tokens: 5, total_thought_tokens: 2, total_tokens: 17 } })).toEqual({ girdi: 10, cikti: 5, dusunme: 2, toplam: 17 });
    expect(kullanimCoz({ usage: { total_tokens: 42 } })).toEqual({ girdi: undefined, cikti: undefined, dusunme: undefined, toplam: 42 });
    expect(kullanimCoz({})).toBeUndefined();
    expect(kullanimCoz({ usage: {} })).toBeUndefined();
  });
});

describe('geceUret (sahte fetch)', () => {
  it('istek: POST /interactions, anahtar yalnızca başlıkta; yanıt + token kullanımı döner', async () => {
    let gorulen: { url: string; init: RequestInit } | undefined;
    const fetchFn = (async (url: string, init: RequestInit) => {
      gorulen = { url, init };
      return json(geminiYaniti(gecerliHam('top5')));
    }) as unknown as typeof fetch;
    const s = await geceUret({ anahtar: GM_ANAHTAR, model: 'gemini-3.6-flash', videoUrl: 'https://www.youtube.com/watch?v=abcdefghijk', istem: 'ISTEM', fetchFn });
    expect(s.ham.plays).toHaveLength(5);
    expect(s.kullanim).toEqual({ girdi: 2000, cikti: 500, dusunme: 100, toplam: 2600 });
    expect(gorulen!.url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect((gorulen!.init.headers as Record<string, string>)['x-goog-api-key']).toBe(GM_ANAHTAR);
    expect(gorulen!.url).not.toContain(GM_ANAHTAR);
    expect(String(gorulen!.init.body)).not.toContain(GM_ANAHTAR);
  });
  it('yanıtta usage yoksa kullanım undefined', async () => {
    const fetchFn = (async () => json(geminiYaniti(gecerliHam('top5'), null))) as unknown as typeof fetch;
    expect((await geceUret({ anahtar: GM_ANAHTAR, model: 'm', videoUrl: 'u', istem: 'I', fetchFn })).kullanim).toBeUndefined();
  });
  it('API hatasında anahtar iletiye sızmaz', async () => {
    const fetchFn = (async () => json({ error: { message: `bad key ${GM_ANAHTAR}` } }, 400)) as unknown as typeof fetch;
    const hata = (await geceUret({ anahtar: GM_ANAHTAR, model: 'm', videoUrl: 'u', istem: 'I', fetchFn }).catch((e: Error) => e)) as Error;
    expect(hata.message).toContain('400');
    expect(hata.message).not.toContain(GM_ANAHTAR);
  });
  it('JSON olmayan metin ya da plays dizisi olmayan yanıt hata verir', async () => {
    const bozuk = (async () => json({ steps: [{ type: 'model_output', content: [{ type: 'text', text: 'merhaba' }] }] })) as unknown as typeof fetch;
    await expect(geceUret({ anahtar: GM_ANAHTAR, model: 'm', videoUrl: 'u', istem: 'I', fetchFn: bozuk })).rejects.toThrow(/ayrıştırılamadı/);
    const dizisiz = (async () => json(geminiYaniti({ baska: 1 }))) as unknown as typeof fetch;
    await expect(geceUret({ anahtar: GM_ANAHTAR, model: 'm', videoUrl: 'u', istem: 'I', fetchFn: dizisiz })).rejects.toThrow(/plays/);
  });
});
