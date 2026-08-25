/**
 * Cree un nouveau projet de montage.
 *   npm run new -- mon-projet
 */
import fs from 'node:fs';
import path from 'node:path';
import {PROJECTS_DIR, projectDir, writeJson} from './_shared.mjs';

const slug = process.argv[2];

if (!slug || !/^[a-z0-9][a-z0-9._-]*$/i.test(slug)) {
  console.error('Usage : npm run new -- <slug>   (lettres, chiffres, - et _)');
  process.exit(1);
}

const dir = projectDir(slug);
if (fs.existsSync(dir)) {
  console.error(`Le projet "${slug}" existe deja : ${dir}`);
  process.exit(1);
}

fs.mkdirSync(path.join(dir, 'media'), {recursive: true});

writeJson(path.join(dir, 'plan.json'), {
  title: slug,
  fps: 30,
  width: 1080,
  height: 1920,
  background: '#000000',
  clips: [],
  overlays: [],
  captions: {
    file: 'captions.json',
    enabled: true,
    style: 'karaoke',
    font: 'montserrat',
    fontSize: 74,
    y: 0.72,
    color: '#FFFFFF',
    highlight: '#FFE100',
    wordsPerPage: 3,
    uppercase: true,
    offset: 0,
  },
  audio: {
    voiceVolume: 1,
    musicVolume: 0.12,
    musicTrim: 0,
    musicFadeOut: 0.8,
    duck: true,
  },
});

fs.writeFileSync(
  path.join(dir, 'brief.md'),
  `# ${slug}\n\n## Objectif\n\n(Ce que la video doit faire : hook, promesse, CTA.)\n\n## Rushes disponibles\n\n(Deposer les fichiers dans media/, puis : npm run ingest -- ${slug})\n\n## Contraintes\n\n- Duree cible :\n- Ton :\n- Interdits :\n`,
  'utf8',
);

console.log(`Projet cree : projects/${slug}`);
console.log('');
console.log('Etapes suivantes :');
console.log(`  1. Depose tes rushes dans projects/${slug}/media/`);
console.log(`  2. npm run ingest -- ${slug}`);
console.log(`  3. npm run proxy -- ${slug}          (si rush 4K / HEVC / HDR)`);
console.log(`  4. npm run transcribe -- ${slug}     (si la video parle)`);
console.log(`  5. npm run cuts -- ${slug}           (ou couper proprement)`);
console.log(`  6. Remplis brief.md, puis demande le montage a Claude`);
console.log(`  7. npm run render -- ${slug}         -> exports/${slug}.mp4`);
