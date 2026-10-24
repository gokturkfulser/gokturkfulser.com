import type { APIRoute } from 'astro';
import { ogPng } from '../../lib/og';

// Yazı olmayan sayfalar için ortak OG görseli.
export const GET: APIRoute = async () => {
  const png = await ogPng({ dunya: 'varsayilan', baslik: 'Sinema, basketbol ve yaptığım projeler' });
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
