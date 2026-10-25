import type { APIContext } from 'astro';
import { bolumYazilari } from '../../../lib/content';
import { yaziFeed } from '../../../lib/rss';

export async function GET(context: APIContext) {
  return yaziFeed(context, 'Göktürk Fulser · Sinema', 'Film yazıları ve izleme notları.', await bolumYazilari('sinema'));
}
