/**
 * Fabrique un projet de demonstration complet, a partir de rien.
 *
 *   npm run demo          genere le projet
 *   npm run demo -- --go  genere puis rend la video
 *
 * Tout est produit par ffmpeg : images, musique, bruitages. Aucun fichier
 * binaire n'est donc versionne, et n'importe qui peut voir ce que l'outil
 * produit juste apres un `npm install`.
 *
 * Le montage obtenu utilise a peu pres tout le moteur : coupes, Ken Burns,
 * transitions, sous-titres karaoke, compteur anime, effets de plan, bruitages,
 * musique avec ducking. C'est la vitrine, et accessoirement un test de
 * non-regression a l'oeil.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {PROJECTS_DIR, ROOT, execFileAsync, ffmpegAvailable, flag, writeJson} from './_shared.mjs';

if (!(await ffmpegAvailable())) {
  console.error('ffmpeg est introuvable. Lance d abord : npm run doctor');
  process.exit(1);
}

const slug = 'demo';
const dir = path.join(PROJECTS_DIR, slug);
const media = path.join(dir, 'media');

fs.rmSync(dir, {recursive: true, force: true});
fs.mkdirSync(media, {recursive: true});

const ffmpeg = (args) => execFileAsync('ffmpeg', ['-y', '-v', 'error', ...args]);

console.log('Generation des rushes...');

// Trois fonds animes, pour avoir de quoi couper.
const fonds = [
  ['plan-1.mp4', '0x1B4965', '0x62B6CB', 0.03],
  ['plan-2.mp4', '0xE07A5F', '0xF2CC8F', 0.05],
  ['plan-3.mp4', '0x2A9D8F', '0xE9C46A', 0.04],
];

for (const [nom, c0, c1, vitesse] of fonds) {
  await ffmpeg([
    '-f', 'lavfi',
    '-i', `gradients=s=1080x1920:c0=${c0}:c1=${c1}:x0=200:y0=300:x1=900:y1=1600:d=8:speed=${vitesse},format=yuv420p`,
    '-t', '8', '-r', '30',
    path.join(media, nom),
  ]);
  console.log(`  ${nom}`);
}

console.log('Generation du son...');

// Nappe musicale : deux quintes, volontairement discretes.
await ffmpeg([
  '-f', 'lavfi', '-i', 'sine=frequency=196:duration=18,volume=0.5',
  '-f', 'lavfi', '-i', 'sine=frequency=294:duration=18,volume=0.3',
  '-filter_complex', '[0][1]amix=inputs=2,aformat=channel_layouts=stereo',
  '-t', '18', path.join(media, 'musique.mp3'),
]);
console.log('  musique.mp3');

// Whoosh : du bruit filtre dont la bande monte puis retombe.
await ffmpeg([
  '-f', 'lavfi', '-i', 'anoisesrc=d=0.6:c=pink:a=0.6',
  '-af', 'highpass=f=300,lowpass=f=6000,volume=0.9,afade=t=in:st=0:d=0.25,afade=t=out:st=0.3:d=0.3',
  '-t', '0.6', path.join(media, 'whoosh.mp3'),
]);
console.log('  whoosh.mp3');

// Impact : une basse breve avec une decroissance nette.
await ffmpeg([
  '-f', 'lavfi', '-i', 'sine=frequency=70:duration=0.9',
  '-af', 'volume=1.4,afade=t=out:st=0.03:d=0.85',
  '-t', '0.9', path.join(media, 'impact.mp3'),
]);
console.log('  impact.mp3');

// --- La transcription -------------------------------------------------------

// Timings fictifs mais realistes : c'est ce qu'un vrai `npm run transcribe`
// produirait, au format attendu par le moteur.
const phrases = [
  [0.40, "Un montage vidéo, c'est un fichier texte."],
  [3.30, 'On décrit les plans, les textes, le son.'],
  [6.60, 'Remotion le rend en 1080 par 1920.'],
  [9.80, 'Et Claude écrit le fichier pour toi.'],
];

const captions = [];
for (const [debut, texte] of phrases) {
  const mots = texte.split(' ');
  const parMot = 0.33;
  mots.forEach((mot, i) => {
    const startMs = Math.round((debut + i * parMot) * 1000);
    captions.push({
      text: mot,
      startMs,
      endMs: startMs + Math.round(parMot * 1000) - 40,
      timestampMs: startMs + Math.round((parMot * 1000) / 2),
      confidence: null,
    });
  });
}

writeJson(path.join(dir, 'captions.json'), {
  project: slug,
  language: 'fr',
  generatedAt: new Date().toISOString(),
  note: 'Timings fictifs : la demo n a pas de voix off reelle.',
  captions,
});

// --- Le plan ----------------------------------------------------------------

writeJson(path.join(dir, 'plan.json'), {
  title: 'Demo',
  fps: 30,
  width: 1080,
  height: 1920,
  background: '#000000',
  duration: 13.2,

  clips: [
    {src: 'media/plan-1.mp4', start: 0, duration: 3.3, trim: 0,
     zoom: {from: 1.0, to: 1.08}},
    {src: 'media/plan-2.mp4', start: 3.3, duration: 3.3, trim: 1.0,
     zoom: {from: 1.08, to: 1.0},
     transitionIn: {type: 'whip', duration: 0.22}},
    {src: 'media/plan-3.mp4', start: 6.6, duration: 3.2, trim: 0.5,
     zoom: {from: 1.0, to: 1.06},
     transitionIn: {type: 'fade', duration: 0.25}},
    {src: 'media/plan-1.mp4', start: 9.8, duration: 3.4, trim: 4.0,
     flip: true, zoom: {from: 1.05, to: 1.05},
     transitionIn: {type: 'zoom-punch', duration: 0.2}},
  ],

  overlays: [
    {type: 'text', text: 'UN MONTAGE\nEN JSON', preset: 'hook',
     start: 0.2, duration: 2.8, position: {x: 0.5, y: 0.22}, fontSize: 78,
     animationIn: 'pop', animationOut: 'fade'},

    {type: 'text', text: 'zéro timeline', preset: 'sticker',
     start: 3.6, duration: 2.4, position: {x: 0.62, y: 0.38}, rotate: -5,
     animationIn: 'pop', animationOut: 'fade'},

    {type: 'counter', from: 0, to: 1920, suffix: ' px de haut',
     countDuration: 1.1, preset: 'sticker',
     start: 6.9, duration: 2.6, position: {x: 0.4, y: 0.38}, rotate: 4,
     animationIn: 'pop', animationOut: 'fade'},

    {type: 'text', text: 'github.com/…/TikTokEditor', preset: 'cta',
     start: 10.4, duration: 2.8, position: {x: 0.5, y: 0.5}, fontSize: 44,
     animationIn: 'slide-up', animationOut: 'fade'},
  ],

  effects: [
    {type: 'pulse', start: 3.3, duration: 0.3, intensity: 0.4},
    {type: 'shake', start: 6.6, duration: 0.28, intensity: 0.3},
    {type: 'pulse', start: 8.0, duration: 0.28, intensity: 0.35},
    {type: 'flash', start: 9.8, duration: 0.12, intensity: 0.2},
  ],

  sfx: [
    {src: 'media/whoosh.mp3', at: 3.15, volume: 0.4},
    {src: 'media/impact.mp3', at: 6.58, volume: 0.35, duration: 0.9},
    {src: 'media/whoosh.mp3', at: 9.65, volume: 0.4},
  ],

  captions: {
    file: 'captions.json', enabled: true, style: 'karaoke',
    font: 'montserrat', fontSize: 72, y: 0.72,
    color: '#FFFFFF', highlight: '#FFE100',
    wordsPerPage: 3, uppercase: true, offset: 0,
  },

  audio: {
    music: 'media/musique.mp3', musicVolume: 0.3, musicTrim: 0,
    musicFadeOut: 1.0, voiceVolume: 1, duck: false,
  },

  progressBar: {enabled: true, color: '#FFFFFF', height: 6},
});

fs.writeFileSync(
  path.join(dir, 'brief.md'),
  '# demo\n\nProjet genere par `npm run demo`. Il sert de vitrine et de test a\n' +
    "l'oeil : coupes, Ken Burns, transitions, sous-titres karaoke, compteur\n" +
    "anime, effets, bruitages, musique.\n\n" +
    'Modifie `plan.json` et relance `npm run render -- demo` pour voir l effet.\n',
  'utf8',
);

console.log('');
console.log('Projet demo pret : projects/demo/');

if (flag('go')) {
  console.log('');
  const rendu = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'render.mjs'), slug], {
    stdio: 'inherit',
  });
  process.exit(rendu.status ?? 0);
}

console.log('');
console.log('Pour le voir :');
console.log('  npm run render -- demo          rendu complet');
console.log('  npm run render -- demo --draft  rendu rapide');
console.log("  npm run studio -- --props='{\"project\":\"demo\"}'");
