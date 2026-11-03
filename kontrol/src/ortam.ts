// Worker ortamı ve sabitler. Sırlar yalnızca `env`den okunur; hiçbir yanıta, loga ya da HTML'e yazılmaz.

export interface Env {
  /** Statik varlıklar (wrangler.jsonc → assets.binding). */
  ASSETS: { fetch(istek: Request): Promise<Response> };
  /** Worker secret'ı: fine-grained GitHub token (yalnızca bu repo, Contents: Read and write). */
  GITHUB_TOKEN_KONTROL?: string;
  /** Worker secret'ı: https://<ekip-adı>.cloudflareaccess.com (şemasız yazılırsa https:// eklenir). */
  ACCESS_TEAM_DOMAIN?: string;
  /** Worker secret'ı: Access uygulamasının Application Audience (AUD) etiketi. */
  ACCESS_AUD?: string;
  /** İsteğe bağlı ek emniyet: yalnızca bu e-posta (Access politikasının üstüne). */
  ACCESS_IZINLI_EPOSTA?: string;
  /** Yerel geliştirme: "evet" ve istek localhost'a geliyorsa Access doğrulaması atlanır. Production'da yok sayılır. */
  KONTROL_GELISTIRME?: string;
  /** Yerel geliştirme: sahte GitHub adresi. Yalnızca geliştirme bayrağı geçerliyken kullanılır (token başka adrese gitmesin). */
  GITHUB_API_TABANI?: string;
}

/** Bağımlılıklar (testte sahtelenir). */
export type Bagimlilik = { fetch: typeof fetch; simdi: () => number };

/** Repo ve dal sabittir (kullanıcı girdisi değildir). */
export const DEPO = { sahip: 'gokturkfulser', ad: 'gokturkfulser.com', dal: 'main' } as const;
export const GITHUB_API_TABANI = 'https://api.github.com';
/** GitHub REST API sürümü (docs.github.com/en/rest/repos/contents sayfasında listelenen). */
export const GITHUB_API_SURUMU = '2026-03-10';

/** Yerel geliştirme bayrağı: yalnızca açıkça "evet" ve istek localhost/127.0.0.1/[::1]'e geliyorsa geçerli; başka her durumda (production dahil) yok sayılır. */
export function gelistirmeModu(env: Env, istekAdresi: string): boolean {
  if (env.KONTROL_GELISTIRME !== 'evet') return false;
  const host = new URL(istekAdresi).hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}
