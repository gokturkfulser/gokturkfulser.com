const tarihBicimi = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Istanbul',
});

export const tarihYaz = (tarih: Date) => tarihBicimi.format(tarih);

/** <time datetime="..."> için ISO tarih (YYYY-AA-GG). */
export const tarihIso = (tarih: Date) => tarih.toISOString().slice(0, 10);

/** Yarım puanlı değeri virgüllü gösterir: 3.5 → "3,5". */
export const puanYaz = (puan: number) => puan.toLocaleString('tr-TR');

const ayYilBicimi = new Intl.DateTimeFormat('tr-TR', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Özgeçmiş dönemi: "YYYY" ya da "YYYY-AA" → "2020 – 2024" / "Eyl 2020 – şimdi" (bitiş yoksa süren kayıt). */
export const donemYaz = (baslangic: string, bitis?: string) => {
  const bicim = (d: string) => (d.length === 4 ? d : ayYilBicimi.format(new Date(`${d}-01T00:00:00Z`)));
  return `${bicim(baslangic)} – ${bitis ? bicim(bitis) : 'şimdi'}`;
};
