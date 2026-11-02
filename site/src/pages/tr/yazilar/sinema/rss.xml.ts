import type { APIContext } from 'astro';
import { yaziFeed } from '../../../../lib/rss';

export const GET = (context: APIContext) => yaziFeed(context, 'tr', 'sinema');
