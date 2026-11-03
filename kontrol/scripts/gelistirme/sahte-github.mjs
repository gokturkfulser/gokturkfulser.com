// Yerel geliştirme için SAHTE GitHub contents API sunucusu. Gerçek GitHub'a hiçbir istek atılmaz; veriler site/src/content/top10'un geçici bir kopyasıdır
// (kontrol/.gelistirme-depo/, repoya girmez). Gerçek davranışa uyar: GET dosya (base64 + blob sha), GET dizin, PUT (sha uyuşmazsa 409), Authorization zorunlu.
// Kullanım: node scripts/gelistirme/sahte-github.mjs [port=8799] [--sifirla]
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const kok = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const depo = join(kok, '.gelistirme-depo');
const kaynak = resolve(kok, '../site/src/content/top10');
const port = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 8799);
if (process.argv.includes('--sifirla')) rmSync(depo, { recursive: true, force: true });
if (!existsSync(depo)) {
  mkdirSync(join(depo, 'site/src/content'), { recursive: true });
  cpSync(kaynak, join(depo, 'site/src/content/top10'), { recursive: true });
}

const blobSha = (buf) => createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest('hex');
const yanit = (res, durum, nesne) => {
  res.writeHead(durum, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(nesne));
};

createServer((istek, res) => {
  const url = new URL(istek.url, `http://127.0.0.1:${port}`);
  if (!/^Bearer \S+$/.test(istek.headers.authorization ?? '')) return yanit(res, 401, { message: 'Requires authentication' });
  const m = /^\/repos\/([^/]+)\/([^/]+)\/contents\/(.+)$/.exec(url.pathname);
  if (!m) return yanit(res, 404, { message: 'Not Found' });
  const yol = m[3].split('/').map(decodeURIComponent).join('/');
  const dosya = resolve(depo, yol);
  if (!dosya.startsWith(depo)) return yanit(res, 400, { message: 'bad path' });
  if (istek.method === 'GET') {
    if (!existsSync(dosya)) return yanit(res, 404, { message: 'Not Found' });
    if (statSync(dosya).isDirectory()) {
      return yanit(res, 200, readdirSync(dosya, { withFileTypes: true }).map((d) => ({ name: d.name, path: `${yol}/${d.name}`, type: d.isDirectory() ? 'dir' : 'file', sha: d.isDirectory() ? 'agac' : blobSha(readFileSync(join(dosya, d.name))) })));
    }
    const buf = readFileSync(dosya);
    return yanit(res, 200, { type: 'file', name: yol.split('/').pop(), path: yol, sha: blobSha(buf), size: buf.length, encoding: 'base64', content: buf.toString('base64').replace(/(.{60})/g, '$1\n') });
  }
  if (istek.method === 'PUT') {
    const parcalar = [];
    istek.on('data', (c) => parcalar.push(c));
    istek.on('end', () => {
      const g = JSON.parse(Buffer.concat(parcalar).toString('utf8'));
      if (!existsSync(dosya)) return yanit(res, 404, { message: 'Not Found' });
      const mevcutSha = blobSha(readFileSync(dosya));
      if (g.sha !== mevcutSha) return yanit(res, 409, { message: `${yol} does not match ${mevcutSha}` });
      const icerik = Buffer.from(g.content, 'base64');
      writeFileSync(dosya, icerik);
      console.log(`[sahte-github] commit: "${g.message}" (${g.branch}) ${yol}`);
      return yanit(res, 200, { content: { sha: blobSha(icerik), path: yol }, commit: { message: g.message } });
    });
    return;
  }
  yanit(res, 405, { message: 'Method Not Allowed' });
}).listen(port, '127.0.0.1', () => console.log(`[sahte-github] http://127.0.0.1:${port} (veri: ${depo})`));
