// GitHub REST contents API istemcisi (docs.github.com/en/rest/repos/contents). Repo ve dal sabit (ortam.ts → DEPO); her çağrıdan önce yol
// beyaz listeden geçer (yollar.ts). Token yalnızca Authorization başlığına gider; hata iletilerine, loga ya da yanıta yazılmaz.
import { DEPO, GITHUB_API_SURUMU, GITHUB_API_TABANI, WORKER_ADI } from './ortam.ts';
import { yolDogrula } from './yollar.ts';

/** Dosya, okunduktan sonra başkası tarafından değiştirildi (sha uyuşmuyor). */
export class CakismaHatasi extends Error {
  constructor() {
    super('dosya değişti');
  }
}

export class GitHubHatasi extends Error {
  constructor(
    readonly durum: number,
    mesaj: string,
  ) {
    super(mesaj);
  }
}

const kodla = (metin: string): string => {
  const bayt = new TextEncoder().encode(metin);
  let s = '';
  for (let i = 0; i < bayt.length; i += 0x8000) s += String.fromCharCode(...bayt.subarray(i, i + 0x8000));
  return btoa(s);
};
const coz = (b64: string): string => {
  const s = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0)));
};

export type DizinOgesi = { ad: string; tur: 'file' | 'dir'; sha: string };

export class GitHub {
  constructor(
    private readonly token: string,
    private readonly fetchFn: typeof fetch,
    private readonly taban: string = GITHUB_API_TABANI,
  ) {}

  private adres(yol: string): string {
    return `${this.taban}/repos/${DEPO.sahip}/${DEPO.ad}/contents/${yol.split('/').map(encodeURIComponent).join('/')}`;
  }

  private basliklar(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': GITHUB_API_SURUMU,
      'User-Agent': WORKER_ADI,
    };
  }

  /** Gece/sözlük dosyasını okur: metin ve sha. Dosya yoksa null. */
  async oku(yol: string): Promise<{ metin: string; sha: string } | null> {
    const tur = yolDogrula(yol, 'oku');
    if (tur === 'dizin') throw new GitHubHatasi(400, 'dosya yolu bekleniyordu');
    const r = await this.fetchFn(`${this.adres(yol)}?ref=${DEPO.dal}`, { headers: this.basliklar() });
    if (r.status === 404) return null;
    if (!r.ok) throw new GitHubHatasi(r.status, `GitHub okuma hatası (${r.status})`);
    const v = (await r.json()) as { sha?: string; content?: string; encoding?: string; type?: string };
    if (v.type !== 'file' || typeof v.sha !== 'string' || typeof v.content !== 'string' || v.encoding !== 'base64') throw new GitHubHatasi(502, 'GitHub yanıtı beklenen biçimde değil');
    return { metin: coz(v.content), sha: v.sha };
  }

  /** Dizin listesi (yalnızca top10 klasörü ve sezon klasörleri). */
  async listele(yol: string): Promise<DizinOgesi[]> {
    if (yolDogrula(yol, 'oku') !== 'dizin') throw new GitHubHatasi(400, 'dizin yolu bekleniyordu');
    const r = await this.fetchFn(`${this.adres(yol)}?ref=${DEPO.dal}`, { headers: this.basliklar() });
    if (r.status === 404) return [];
    if (!r.ok) throw new GitHubHatasi(r.status, `GitHub listeleme hatası (${r.status})`);
    const v = (await r.json()) as unknown;
    if (!Array.isArray(v)) throw new GitHubHatasi(502, 'GitHub yanıtı beklenen biçimde değil');
    return v.map((o: { name: string; type: string; sha: string }) => ({ ad: o.name, tur: o.type === 'dir' ? 'dir' : 'file', sha: o.sha }));
  }

  /**
   * Dosyayı `sha` (okunduğu andaki blob sha'sı) ile günceller ve main'e commit eder. sha uyuşmazsa (409; GitHub 422 ile de bildirebilir) CakismaHatasi.
   * Yeni dosya oluşturulmaz (düzenleyici yalnızca mevcut dosyaları günceller).
   */
  async yaz(yol: string, metin: string, sha: string, mesaj: string): Promise<{ sha: string }> {
    yolDogrula(yol, 'yaz');
    const r = await this.fetchFn(this.adres(yol), {
      method: 'PUT',
      headers: { ...this.basliklar(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: mesaj, content: kodla(metin), sha, branch: DEPO.dal }),
    });
    if (r.status === 409) throw new CakismaHatasi();
    if (r.status === 422) {
      const g = (await r.json().catch(() => ({}))) as { message?: string };
      if (/sha|does not match|stale/i.test(g.message ?? '')) throw new CakismaHatasi();
      throw new GitHubHatasi(422, 'GitHub kaydı reddetti (422)');
    }
    if (!r.ok) throw new GitHubHatasi(r.status, `GitHub yazma hatası (${r.status})`);
    const v = (await r.json()) as { content?: { sha?: string } };
    return { sha: v.content?.sha ?? '' };
  }
}
