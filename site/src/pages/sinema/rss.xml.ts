import type { APIContext } from 'astro';
import { sinemaYazilari } from '../../lib/content';
import { yaziFeed } from '../../lib/rss';

export async function GET(context: APIContext) {
  const yazilar = (await sinemaYazilari()).map((entry) => ({ bolum: 'sinema' as const, entry }));
  return yaziFeed(context, 'Göktürk Fulser · Sinema', 'Film yazıları ve izleme notları.', yazilar);
}
