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
