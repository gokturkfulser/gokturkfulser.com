import type { APIContext } from 'astro';
import { tumYazilar } from '../lib/content';
import { yaziFeed } from '../lib/rss';

export async function GET(context: APIContext) {
  return yaziFeed(
    context,
    'Göktürk Fulser',
    'Sinema ve basketbol yazıları.',
    await tumYazilar(),
  );
}
