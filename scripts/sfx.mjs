/**
 * Explore la bibliotheque de bruitages partagee (projects/_library/sfx/).
 *
 *   npm run sfx                       liste tout
 *   npm run sfx -- whoosh             filtre sur un mot
 *
 * Les fichiers se referencent directement dans un plan, sans copie :
 *   {"src": "library/sfx/Fast Whoosh.wav", "at": 25.10, "volume": 0.45}
 *
 * Pour chaque son, on affiche sa duree et surtout **l'instant ou il frappe** :
 * un whoosh monte avant d'exploser. Declenche pile sur la coupe, son impact
 * arrive en retard. La colonne « attaque » dit de combien il faut l'avancer.
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {LIBRARY_DIR, kindOf, probe} from './_shared.mjs';

const LIBRARY = path.join(LIBRARY_DIR, 'sfx');

if (!fs.existsSync(LIBRARY)) {
  console.error(`Aucune banque de bruitages. Cree le dossier : ${LIBRARY}`);
  process.exit(1);
}

const filtre = (process.argv[2] ?? '').toLowerCase();

const files = fs
  .readdirSync(LIBRARY)
  .filter((f) => kindOf(f) === 'audio')
  .filter((f) => !filtre || f.toLowerCase().includes(filtre))
  .sort();

if (!files.length) {
  console.error(`Aucun fichier audio dans ${LIBRARY}`);
  process.exit(1);
}

// --- Mesure de l'attaque ---------------------------------------------------

/**
 * Instant ou le son devient franchement audible, en secondes.
 *
 * On demande a ffmpeg les zones sous -14 dB : la premiere qui se termine
 * marque le debut de la partie forte.
 */
const attaque = (file) =>
  new Promise((resolve) => {
    execFile(
      'ffmpeg',
      ['-hide_banner', '-nostats', '-i', file,
       '-af', 'silencedetect=noise=-14dB:d=0.02', '-f', 'null', '-'],
      {maxBuffer: 1024 * 1024 * 8},
      (_err, _stdout, stderr) => {
        const log = stderr ?? '';
        const debutSilence = log.match(/silence_start:\s*(-?[\d.]+)/);
        const finSilence = log.match(/silence_end:\s*([\d.]+)/);
        // Un silence qui commence a 0 signifie que le son monte : la fin de ce
        // silence est l'attaque. Sinon le son frappe des la premiere frame.
        if (debutSilence && Number(debutSilence[1]) <= 0.02 && finSilence) {
          resolve(Number(finSilence[1]));
        } else {
          resolve(0);
        }
      },
    );
  });

// --- Listing ---------------------------------------------------------------

console.log(
  `${files.length} bruitage(s) dans projects/_library/sfx/` +
    (filtre ? ` correspondant a « ${filtre} »` : ''),
);
console.log('');
console.log('  nom                              duree   attaque');
console.log('  ' + '-'.repeat(56));

for (const nom of files) {
  const complet = path.join(LIBRARY, nom);
  const meta = await probe(complet).catch(() => null);
  if (!meta) continue;
  const a = await attaque(complet);

  console.log(
    '  ' +
      nom.padEnd(33) +
      `${meta.duration.toFixed(2)}s`.padStart(6) +
      `${a > 0.02 ? `+${a.toFixed(2)}s` : 'directe'}`.padStart(10),
  );
}

console.log('');
console.log('« attaque » = delai avant que le son frappe. Pour caler un impact sur');
console.log('une coupe a T, declenche le son a T moins cette valeur :');
console.log('');
console.log('  {"src": "library/sfx/Fast Whoosh.wav", "at": 25.10, "volume": 0.45}');
