import type { APIRoute } from 'astro';
import { DILLER, sozluk, type Dil } from '../../../i18n';
import { ogPng } from '../../../lib/og';

// Yazı olmayan sayfalar için dil başına ortak OG görseli: /og/<dil>/varsayilan.png
export const getStaticPaths = () => DILLER.map((dil) => ({ params: { dil } }));

export const GET: APIRoute = async ({ params }) => {
  const png = await ogPng({ dunya: 'varsayilan', baslik: sozluk(params.dil as Dil).site.ogBaslik });
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
