// GitHub istemcisi: istek biçimi (sha ile güncelleme, sabit repo ve dal), base64 UTF-8, çakışma, yol beyaz listesi, token sızıntısı.
import { describe, expect, it } from 'vitest';
import { CakismaHatasi, GitHub, GitHubHatasi } from './github.ts';
import { GECE_YOLU, geceMetni, sahteGitHub, TOKEN } from './test-yardim.ts';
import { YolHatasi } from './yollar.ts';

describe('GitHub istemcisi', () => {
  it('okur: UTF-8 metin ve blob sha; istek sabit repo, main dalı ve token başlığıyla gider', async () => {
    const metin = geceMetni().replace('A lobs', 'Çağrı: ığüşöç');
    const sahte = sahteGitHub({ [GECE_YOLU]: metin });
    const gh = new GitHub(TOKEN, sahte.fetch);
    const d = await gh.oku(GECE_YOLU);
    expect(d?.metin).toBe(metin);
    expect(d?.sha).toBe(await sahte.sha(GECE_YOLU));
    expect(sahte.istekler[0]).toMatchObject({ yontem: 'GET', yol: GECE_YOLU, yetki: `Bearer ${TOKEN}` });
  });

  it('dosya yoksa null; dizin listeler', async () => {
    const sahte = sahteGitHub({ [GECE_YOLU]: geceMetni() });
    const gh = new GitHub(TOKEN, sahte.fetch);
    expect(await gh.oku('site/src/content/top10/2026-27/2026-10-31.yaml')).toBeNull();
    expect(await gh.listele('site/src/content/top10/2026-27')).toEqual([{ ad: '2026-11-01.yaml', tur: 'file', sha: await sahte.sha(GECE_YOLU) }]);
    expect(await gh.listele('site/src/content/top10')).toEqual([{ ad: '2026-27', tur: 'dir', sha: 'agac' }]);
  });

  it('yazar: PUT gövdesi message, base64 content, okunan sha ve branch=main; commit kaydı oluşur', async () => {
    const sahte = sahteGitHub({ [GECE_YOLU]: geceMetni() });
    const gh = new GitHub(TOKEN, sahte.fetch);
    const d = (await gh.oku(GECE_YOLU))!;
    await gh.yaz(GECE_YOLU, 'yeni içerik ğü', d.sha, 'top10: elle düzenleme 2026-11-01');
    const put = sahte.istekler.find((i) => i.yontem === 'PUT')!;
    expect(put.govde).toMatchObject({ message: 'top10: elle düzenleme 2026-11-01', sha: d.sha, branch: 'main' });
    expect(sahte.commitler).toEqual([{ mesaj: 'top10: elle düzenleme 2026-11-01', yol: GECE_YOLU, metin: 'yeni içerik ğü', dal: 'main', sha: d.sha }]);
  });

  it('sha uyuşmazsa (dosya araya giren bir commit ile değişti) CakismaHatasi; hiçbir şey yazılmaz', async () => {
    const sahte = sahteGitHub({ [GECE_YOLU]: geceMetni() });
    const gh = new GitHub(TOKEN, sahte.fetch);
    const d = (await gh.oku(GECE_YOLU))!;
    sahte.depo.set(GECE_YOLU, geceMetni('2026-11-01', 'onaylandi')); // bot ya da başkası araya girdi
    await expect(gh.yaz(GECE_YOLU, 'x', d.sha, 'm')).rejects.toBeInstanceOf(CakismaHatasi);
    expect(sahte.commitler).toHaveLength(0);
  });

  it('GitHub 422 "sha does not match" da çakışmadır; başka 422 ve diğer hatalar GitHubHatasi', async () => {
    const yanit = (durum: number, mesaj: string) => (async () => new Response(JSON.stringify({ message: mesaj }), { status: durum })) as unknown as typeof fetch;
    await expect(new GitHub(TOKEN, yanit(422, 'GECE_YOLU does not match abc')).yaz(GECE_YOLU, 'x', 's', 'm')).rejects.toBeInstanceOf(CakismaHatasi);
    await expect(new GitHub(TOKEN, yanit(422, 'Invalid request')).yaz(GECE_YOLU, 'x', 's', 'm')).rejects.toBeInstanceOf(GitHubHatasi);
    await expect(new GitHub(TOKEN, yanit(500, 'boom')).yaz(GECE_YOLU, 'x', 's', 'm')).rejects.toMatchObject({ durum: 500 });
    await expect(new GitHub(TOKEN, yanit(403, 'Resource not accessible')).oku(GECE_YOLU)).rejects.toMatchObject({ durum: 403 });
  });

  it('beyaz liste dışı yol: GitHub\'a hiçbir istek gitmez (okuma, yazma, listeleme)', async () => {
    const sahte = sahteGitHub({ 'site/package.json': '{}' });
    const gh = new GitHub(TOKEN, sahte.fetch);
    await expect(gh.oku('site/package.json')).rejects.toBeInstanceOf(YolHatasi);
    await expect(gh.yaz('.github/workflows/site-top10.yml', 'x', 's', 'm')).rejects.toBeInstanceOf(YolHatasi);
    await expect(gh.listele('site')).rejects.toBeInstanceOf(YolHatasi);
    await expect(gh.yaz('site/src/content/top10/2026-27', 'x', 's', 'm')).rejects.toBeInstanceOf(YolHatasi); // dizine yazma yok
    expect(sahte.istekler).toHaveLength(0);
  });

  it('token yalnızca Authorization başlığına gider: hata iletileri ve gövde token içermez', async () => {
    const sahte = sahteGitHub({ [GECE_YOLU]: geceMetni() });
    const gh = new GitHub(TOKEN, sahte.fetch);
    const d = (await gh.oku(GECE_YOLU))!;
    await gh.yaz(GECE_YOLU, 'x', d.sha, 'm');
    for (const i of sahte.istekler) expect(JSON.stringify(i.govde ?? {})).not.toContain(TOKEN);
    const kotu = new GitHub(TOKEN, (async () => new Response(`hata ${TOKEN}`, { status: 500 })) as unknown as typeof fetch);
    const hata = await kotu.oku(GECE_YOLU).catch((e: Error) => e);
    expect(String((hata as Error).message)).not.toContain(TOKEN);
  });
});
