/** Build a self-contained, local-only research distribution. */
import { build } from 'esbuild';
import { mkdirSync, existsSync, cpSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
const dest = process.argv[2] && resolve(process.argv[2]);
if (!dest || existsSync(dest)) throw Error('Supply a NEW release directory; existing releases are not overwritten.');
const root = process.cwd();
mkdirSync(dest, {recursive:true});
for (const name of ['forecast','analyze']) {
  await build({entryPoints:[`scripts/research/${name}.ts`],outfile:join(dest,`${name}.cjs`),bundle:true,platform:'node',target:'node20',format:'cjs'});
}
for (const name of ['src/lib/pk','src/lib/researchValidation','scripts/research','docs/study-release','src/lib/manualHoursTimestamp.ts','src/lib/formatNumber.ts','package-lock.json']) {
  mkdirSync(dirname(join(dest,name)),{recursive:true});
  cpSync(join(root,name),join(dest,name),{recursive:true,filter:(p)=>!p.includes('node_modules')});
}
writeFileSync(join(dest,'README.md'),`# Vancomyzer local research preparation package\n\nNode.js 20 or later is required. Tested with ${process.version}. No dependency installation or network connection is needed to run the bundled commands. Run from this directory so the source manifest can be verified.\n\n\`\`\`\nnode forecast.cjs docs/study-release/synthetic-input.json demo-run\nnode analyze.cjs demo-run docs/study-release/synthetic-outcomes.json demo-analysis.json\n\`\`\`\n\nDemo records are fabricated. Read docs/study-release/README.md for exclusions, governance requirements and pending independent review. This is not a clinically validated or institution-authorized release. Keep outcomes separate until predictions are locked. Never upload patient records to a public calculator for this study.\n\nSHA256SUMS.json records the packaged files. Verify against a separately archived copy. Hashes alone are not signatures or access control.\n`);
function files(dir) {return readdirSync(dir).sort().flatMap(n=>{const p=join(dir,n);return statSync(p).isDirectory()?files(p):[p];});}
const sums=Object.fromEntries(files(dest).map(p=>[relative(dest,p),createHash('sha256').update(readFileSync(p)).digest('hex')]));
writeFileSync(join(dest,'SHA256SUMS.json'),JSON.stringify(sums,null,2)+'\n');
console.log(JSON.stringify({status:'packaged',files:Object.keys(sums).length}));
