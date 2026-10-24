import type { APIRoute, GetStaticPaths } from 'astro';
import { BOLUM_ADLARI, tumYazilar } from '../../../lib/content';
import { tarihYaz } from '../../../lib/format';
import { ogPng } from '../../../lib/og';

// Her yazı için build sırasında 1200×630 PNG üretilir: /og/<bolum>/<slug>.png
export const getStaticPaths = (async () => {
  return (await tumYazilar()).map((yazi) => ({
    params: { bolum: yazi.bolum, slug: yazi.entry.id },
    props: {
      dunya: yazi.bolum,
      baslik: yazi.entry.data.baslik,
      tarih: yazi.entry.data.tarih,
    },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props, params }) => {
  const png = await ogPng({
    dunya: props.dunya,
    baslik: props.baslik,
    bolumAdi: BOLUM_ADLARI[params.bolum as 'sinema' | 'basketbol'],
    altBilgi: tarihYaz(props.tarih),
  });
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
