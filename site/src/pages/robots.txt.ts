import type { APIContext } from 'astro';
import { SHOW_DRAFTS } from 'astro:env/server';

export function GET({ site }: APIContext) {
  // Taslakların göründüğü preview build'leri indekslenmesin.
  const govde = SHOW_DRAFTS
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap-index.xml', site).href}\n`;
  return new Response(govde, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
