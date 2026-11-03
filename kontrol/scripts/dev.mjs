// Yerel geliştirme: varlıkları üretir, sahte GitHub sunucusunu ve `wrangler dev`i birlikte başlatır (Windows + PowerShell uyumlu).
// Gerçek GitHub/Access kullanılmaz: .dev.vars (bkz. .dev.vars.example) geliştirme bayrağını ve sahte GitHub adresini verir.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const kok = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!existsSync(join(kok, '.dev.vars'))) {
  copyFileSync(join(kok, '.dev.vars.example'), join(kok, '.dev.vars'));
  console.log('kontrol: .dev.vars.example → .dev.vars kopyalandı (repoya girmez).');
}
const v = spawnSync(process.execPath, [join(kok, 'scripts/varliklar.mjs')], { stdio: 'inherit' });
if (v.status !== 0) process.exit(v.status ?? 1);
const sahte = spawn(process.execPath, [join(kok, 'scripts/gelistirme/sahte-github.mjs')], { stdio: 'inherit' });
const wrangler = spawn('pnpm', ['exec', 'wrangler', 'dev', '--port', '8787'], { cwd: kok, stdio: 'inherit', shell: true });
const kapat = () => {
  sahte.kill();
  wrangler.kill();
};
process.on('SIGINT', kapat);
wrangler.on('exit', (kod) => {
  sahte.kill();
  process.exit(kod ?? 0);
});
