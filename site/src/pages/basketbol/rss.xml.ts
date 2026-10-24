import type { APIContext } from 'astro';
import { basketbolYazilari } from '../../lib/content';
import { yaziFeed } from '../../lib/rss';

export async function GET(context: APIContext) {
  const yazilar = (await basketbolYazilari()).map((entry) => ({
    bolum: 'basketbol' as const,
    entry,
  }));
  return yaziFeed(context, 'Göktürk Fulser · Basketbol', 'Basketbol notları ve analizler.', yazilar);
}
