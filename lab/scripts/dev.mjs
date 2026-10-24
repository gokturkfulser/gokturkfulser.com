// pnpm lab:dev [slug]
//   slug verilirse yalnızca o app'in Vite dev sunucusu açılır (http://localhost:5173/<slug>/).
//   verilmezse tüm app'ler paralel açılır (Vite portları kendisi artırır; adresler çıktıda yazar).
import { SLUG_DESENI, pnpm, uygulamalariOku } from './ortak.mjs';

const slug = process.argv[2];
const uygulamalar = uygulamalariOku();

if (slug) {
  if (!SLUG_DESENI.test(slug) || !uygulamalar.some((u) => u.slug === slug)) {
    console.error(`"${slug}" adlı app yok. Mevcutlar: ${uygulamalar.map((u) => u.slug).join(', ') || '(hiç)'}`);
    process.exit(1);
  }
  process.exit(pnpm(['--filter', `lab-${slug}`, 'dev']).status ?? 1);
}

if (uygulamalar.length === 0) {
  console.log('Henüz app yok. Yeni app için: pnpm lab:new <slug>');
  process.exit(0);
}
process.exit(pnpm(['--parallel', '--filter', '"./lab/apps/*"', 'dev']).status ?? 1);
