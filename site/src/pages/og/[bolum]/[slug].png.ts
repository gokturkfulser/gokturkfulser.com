import type { APIRoute, GetStaticPaths } from 'astro';
import { BOLUM_ADLARI, basketbolCevirileri, tumYazilar } from '../../../lib/content';
import { tarihYaz } from '../../../lib/format';
import { ogPng } from '../../../lib/og';

const tarihEn = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });

// Her yazı için build sırasında 1200×630 PNG üretilir: /og/<bolum>/<slug>.png
// İngilizce çevirilerin görseli de aynı yolda, id'leriyle (`<slug>--en`) üretilir.
export const getStaticPaths = (async () => {
  const yazilar = (await tumYazilar()).map((yazi) => ({
    params: { bolum: yazi.bolum, slug: yazi.entry.id },
    props: { dunya: yazi.bolum, baslik: yazi.entry.data.baslik, tarih: yazi.entry.data.tarih, en: false },
  }));
  const cevirilar = (await basketbolCevirileri()).map((entry) => ({
    params: { bolum: 'basketbol', slug: entry.id },
    props: { dunya: 'basketbol' as const, baslik: entry.data.baslik, tarih: entry.data.tarih, en: true },
  }));
  return [...yazilar, ...cevirilar];
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props, params }) => {
  const png = await ogPng({
    dunya: props.dunya,
    baslik: props.baslik,
    bolumAdi: props.en ? 'Basketball' : BOLUM_ADLARI[params.bolum as 'sinema' | 'basketbol'],
    altBilgi: props.en ? tarihEn.format(props.tarih) : tarihYaz(props.tarih),
  });
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
