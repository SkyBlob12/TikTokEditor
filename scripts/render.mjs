/**
 * Rend un projet en MP4 vertical pret a publier.
 *
 *   npm run render -- mon-projet
 *   npm run render -- mon-projet --draft            demi-resolution, pour juger vite
 *   npm run render -- mon-projet --from 20 --to 35  seulement ce passage
 *   npm run render -- mon-projet --out final.mp4 --crf 23 --concurrency 4
 *
 * Le rendu est precede d'une validation : un plan invalide n'atteint jamais
 * le moteur de rendu.
 *
 * `--draft` divise la resolution par deux et relache la compression. On ne juge
 * pas la qualite d'image dessus, on juge le montage : le rythme, les coupes, la
 * synchro des sous-titres. C'est ce qu'on regarde vingt fois avant le rendu
 * final, qu'on ne lance qu'une seule.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {EXPORTS_DIR, PROJECTS_DIR, ROOT, flag, projectDir, requireSlug} from './_shared.mjs';

const slug = requireSlug('npm run render -- <slug>');

// 1. Validation
const check = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'validate.mjs'), slug], {
  stdio: 'inherit',
});
if (check.status !== 0) process.exit(check.status ?? 1);

// 2. Bundle
console.log('Compilation du projet Remotion...');
const serveUrl = await bundle({
  entryPoint: path.join(ROOT, 'src', 'index.ts'),
  publicDir: PROJECTS_DIR,
  onProgress: (p) => process.stdout.write(`\r  ${p}%   `),
});
console.log('');

// 3. Composition (calculateMetadata lit plan.json et fixe duree / dimensions)
const brouillon = Boolean(flag('draft'));
const inputProps = {project: slug, fpsOverride: brouillon ? Number(flag('draft-fps', 15)) : null};
const composition = await selectComposition({serveUrl, id: 'TikTok', inputProps});

const echelle = brouillon ? 0.5 : 1;

// --from / --to en secondes, converties en frames.
const enFrames = (valeur, defaut) =>
  valeur === undefined ? defaut : Math.round(Number(valeur) * composition.fps);
const premiere = Math.max(0, enFrames(flag('from'), 0));
const derniere = Math.min(
  composition.durationInFrames - 1,
  enFrames(flag('to'), composition.durationInFrames - 1),
);
const partiel = premiere > 0 || derniere < composition.durationInFrames - 1;

if (partiel && premiere >= derniere) {
  console.error(`--from (${premiere}) doit preceder --to (${derniere}).`);
  process.exit(1);
}

const nbFrames = derniere - premiere + 1;
console.log(
  `Rendu : ${Math.round(composition.width * echelle)}x${Math.round(composition.height * echelle)} ` +
    `@ ${composition.fps}fps — ${(nbFrames / composition.fps).toFixed(1)}s (${nbFrames} frames)` +
    (brouillon ? '  [brouillon]' : '') +
    (partiel ? `  [de ${(premiere / composition.fps).toFixed(1)}s a ${(derniere / composition.fps).toFixed(1)}s]` : ''),
);

// 4. Rendu
fs.mkdirSync(EXPORTS_DIR, {recursive: true});
const outPath = flag('out')
  ? path.resolve(String(flag('out')))
  : path.join(EXPORTS_DIR, `${slug}${brouillon ? '.brouillon' : ''}.mp4`);

const started = Date.now();
let lastShown = -1;

await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  outputLocation: outPath,
  inputProps,
  crf: Number(flag('crf', brouillon ? 30 : 21)),
  scale: echelle,
  frameRange: partiel ? [premiere, derniere] : undefined,
  jpegQuality: brouillon ? 60 : 80,
  timeoutInMilliseconds: 120000,
  concurrency: flag('concurrency') ? Number(flag('concurrency')) : null,
  overwrite: true,
  onProgress: ({progress}) => {
    const pct = Math.round(progress * 100);
    if (pct !== lastShown) {
      lastShown = pct;
      process.stdout.write(`\r  ${pct}%   `);
    }
  },
});

const sizeMb = Math.round((fs.statSync(outPath).size / 1024 / 1024) * 10) / 10;
console.log('');
console.log(`Termine en ${Math.round((Date.now() - started) / 1000)}s — ${sizeMb} Mo`);
console.log(outPath);

// Le plan est archive a cote du rendu livrable, pour savoir d'ou vient un
// fichier. Un brouillon ou un extrait ne se livre pas : pas de copie.
if (!brouillon && !partiel) {
  fs.copyFileSync(path.join(projectDir(slug), 'plan.json'), outPath.replace(/\.mp4$/, '.plan.json'));
} else {
  console.log(brouillon ? 'Brouillon : ne pas publier.' : 'Extrait partiel : ne pas publier.');
}
