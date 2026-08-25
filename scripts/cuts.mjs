/**
 * Liste les endroits ou l'on peut couper sans manger un mot.
 *
 *   npm run cuts -- mon-projet
 *   npm run cuts -- mon-projet --around 12.05        point de coupe le plus proche
 *   npm run cuts -- mon-projet --min 0.3             silences d'au moins 300 ms
 *
 * Pourquoi cet outil : les bornes de mots d'une transcription sont contigues
 * (la fin d'un mot = le debut du suivant), donc elles ne disent PAS ou se
 * trouve le silence. Couper sur une borne de mot revient souvent a trancher la
 * derniere consonne. Ici on regarde le signal.
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {flag, kindOf, projectDir, readJson, requireSlug} from './_shared.mjs';

const slug = requireSlug('npm run cuts -- <slug> [--around <secondes>]');
const dir = projectDir(slug);

const MIN_SILENCE = Number(flag('min', 0.2));
const NOISE_DB = String(flag('noise', '-34'));

/** Le media qui porte la voix : --audio, sinon audio.voice, sinon le 1er clip. */
const resolveAudio = () => {
  const explicit = flag('audio');
  if (typeof explicit === 'string') return path.join(dir, explicit);

  const planFile = path.join(dir, 'plan.json');
  if (fs.existsSync(planFile)) {
    const plan = readJson(planFile);
    if (plan.audio?.voice) return path.join(dir, plan.audio.voice);
    if (plan.captions?.syncTo) return path.join(dir, plan.captions.syncTo);
    if (plan.clips?.[0]?.src) return path.join(dir, plan.clips[0].src);
  }

  const mediaDir = path.join(dir, 'media');
  const found = fs.existsSync(mediaDir)
    ? fs.readdirSync(mediaDir).find((f) => kindOf(f) === 'audio' || kindOf(f) === 'video')
    : null;
  return found ? path.join(mediaDir, found) : null;
};

const audioPath = resolveAudio();
if (!audioPath || !fs.existsSync(audioPath)) {
  console.error('Aucun media audio trouve. Precise-le : --audio media/rush.mp4');
  process.exit(1);
}

/** ffmpeg ecrit silencedetect sur stderr, meme quand tout va bien. */
const detect = () =>
  new Promise((resolve, reject) => {
    execFile(
      'ffmpeg',
      ['-hide_banner', '-nostats', '-i', audioPath,
       '-af', `silencedetect=noise=${NOISE_DB}dB:d=${MIN_SILENCE}`,
       '-f', 'null', '-'],
      {maxBuffer: 1024 * 1024 * 64},
      (err, _stdout, stderr) => (stderr ? resolve(stderr) : reject(err)),
    );
  });

const log = await detect();

const silences = [];
let pending = null;
for (const line of log.split('\n')) {
  const start = line.match(/silence_start:\s*(-?[\d.]+)/);
  if (start) pending = Number(start[1]);
  const end = line.match(/silence_end:\s*([\d.]+)/);
  if (end && pending !== null) {
    silences.push({start: Math.max(0, pending), end: Number(end[1])});
    pending = null;
  }
}

if (!silences.length) {
  console.log(`Aucun silence de ${MIN_SILENCE}s trouve (seuil ${NOISE_DB} dB).`);
  console.log('Essaie --min 0.15 ou --noise -28.');
  process.exit(0);
}

/** Le meilleur instant pour couper dans un silence : son milieu. */
const cutPoint = (s) => Math.round(((s.start + s.end) / 2) * 100) / 100;

const around = flag('around');
if (around !== undefined) {
  const target = Number(around);
  const sorted = [...silences].sort(
    (a, b) => Math.abs(cutPoint(a) - target) - Math.abs(cutPoint(b) - target),
  );

  console.log(`Point de coupe le plus proche de ${target}s :`);
  console.log('');
  for (const s of sorted.slice(0, 5)) {
    const point = cutPoint(s);
    const delta = point - target;
    console.log(
      `  ${String(point).padStart(7)}s   silence ${s.start.toFixed(2)} → ${s.end.toFixed(2)} ` +
        `(${((s.end - s.start) * 1000).toFixed(0)} ms)   ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}s`,
    );
  }
  process.exit(0);
}

console.log(
  `${silences.length} silences d'au moins ${MIN_SILENCE}s dans ${path.relative(dir, audioPath)} :`,
);
console.log('');
for (const s of silences) {
  console.log(
    `  couper a ${String(cutPoint(s)).padStart(7)}s   ` +
      `(silence ${s.start.toFixed(2)} → ${s.end.toFixed(2)}, ${((s.end - s.start) * 1000).toFixed(0)} ms)`,
  );
}
