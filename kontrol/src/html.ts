// HTML üretimi için küçük yardımcılar. Tüm dinamik değerler `esc` ile kaçırılır; satır içi betik ve stil yoktur (CSP: default-src 'self').
export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Güvenli HTML parçası işareti: `h` şablon etiketi bunları kaçırmaz. */
export class Ham {
  constructor(readonly deger: string) {}
  toString() {
    return this.deger;
  }
}

/** Şablon etiketi: yerleştirilen değerler kaçırılır, `Ham` ve Ham dizileri olduğu gibi girer. */
export function h(parcalar: TemplateStringsArray, ...degerler: unknown[]): Ham {
  let s = parcalar[0]!;
  degerler.forEach((d, i) => {
    const metin = Array.isArray(d) ? d.map((x) => (x instanceof Ham ? x.deger : esc(x))).join('') : d instanceof Ham ? d.deger : esc(d);
    s += metin + parcalar[i + 1]!;
  });
  return new Ham(s);
}

export const birlestir = (liste: readonly (Ham | string)[]): Ham => new Ham(liste.map((x) => (x instanceof Ham ? x.deger : esc(x))).join(''));
