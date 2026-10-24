import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** SHOW_DRAFTS=true ise (preview) taslaklar da derlenir. content.config.ts `astro:env` okuyamadığı için doğrudan ortama bakar. */
export const taslakGoster = () =>
  process.env.SHOW_DRAFTS === 'true' || import.meta.env.SHOW_DRAFTS === 'true';

const ONYAZI = /^---\r?\n([\s\S]*?)\r?\n---/;
const TASLAK_SATIRI = /^taslak:\s*true\s*$/m;

/**
 * Production'da `taslak: true` klasörlerini `glob()` desenine olumsuzlayarak (`!klasor/index.mdx`) verir.
 * Yalnızca belgelenmiş API kullanılır: desenden çıkan dosya hiç yüklenmez, işlenmez; böylece sayfa, RSS,
 * sitemap, OG görseli ve `image()` / MDX `import` ile gelen görseller dist/'e girmez.
 * Preview'da (SHOW_DRAFTS=true) boş döner, hepsi dahildir.
 */
export function taslakKlasorDesenleri(base: string): string[] {
  if (taslakGoster() || !existsSync(base)) return [];
  const desenler: string[] = [];
  for (const klasor of readdirSync(base, { withFileTypes: true })) {
    if (!klasor.isDirectory()) continue;
    for (const dosya of ['index.mdx', 'index.md']) {
      const yol = join(base, klasor.name, dosya);
      if (!existsSync(yol)) continue;
      const onyazi = ONYAZI.exec(readFileSync(yol, 'utf8'))?.[1] ?? '';
      if (TASLAK_SATIRI.test(onyazi)) desenler.push(`!${klasor.name}/${dosya}`);
    }
  }
  return desenler;
}
