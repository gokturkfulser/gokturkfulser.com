// Workers Builds için build sarmalayıcısı.
// Cloudflare dokümanı production ve preview build değişkenlerinin ayrı tutulduğunu belirtmiyor;
// bu yüzden SHOW_DRAFTS daldan türetilir: main dışındaki her dal taslakları gösterir.
// WORKERS_CI_BRANCH Workers Builds tarafından enjekte edilir; yerelde tanımsızdır ve ortam olduğu gibi kalır.
import { spawnSync } from 'node:child_process';

const dal = process.env.WORKERS_CI_BRANCH;
const env = { ...process.env };
if (dal) env.SHOW_DRAFTS = dal === 'main' ? 'false' : 'true';
console.log(`workers-build: dal=${dal ?? '(yerel)'} SHOW_DRAFTS=${env.SHOW_DRAFTS ?? '(varsayılan)'}`);

const sonuc = spawnSync('pnpm', ['run', 'build'], { stdio: 'inherit', env, shell: true });
process.exit(sonuc.status ?? 1);
