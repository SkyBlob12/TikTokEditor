/**
 * Verifie que la machine peut faire tourner l'outil.
 *
 *   npm run doctor            controles rapides
 *   npm run doctor -- --full  + un vrai rendu de bout en bout (~1 min)
 *
 * A lancer en premier sur une machine neuve : chaque probleme est annonce avec
 * la commande qui le corrige, plutot que de surgir au milieu d'un rendu.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EXPORTS_DIR, LIBRARY_DIR, PROJECTS_DIR, ROOT, execFileAsync, flag, listProjects} from './_shared.mjs';

const controles = [];

const ok = (nom, detail) => controles.push({etat: 'ok', nom, detail});
const alerte = (nom, detail, remede) => controles.push({etat: 'alerte', nom, detail, remede});
const echec = (nom, detail, remede) => controles.push({etat: 'echec', nom, detail, remede});

// --- Node -----------------------------------------------------------------

const majeure = Number(process.versions.node.split('.')[0]);
if (majeure >= 20) {
  ok('Node', `v${process.versions.node}`);
} else {
  echec('Node', `v${process.versions.node}, il en faut 20 ou plus`, 'https://nodejs.org');
}

// --- FFmpeg ---------------------------------------------------------------

for (const binaire of ['ffmpeg', 'ffprobe']) {
  try {
    const {stdout} = await execFileAsync(binaire, ['-version']);
    ok(binaire, stdout.split('\n')[0].replace(/ Copyright.*/, '').trim());
  } catch {
    echec(
      binaire,
      'introuvable dans le PATH',
      process.platform === 'win32'
        ? 'winget install Gyan.FFmpeg, puis rouvrir le terminal'
        : process.platform === 'darwin'
          ? 'brew install ffmpeg'
          : 'sudo apt install ffmpeg',
    );
  }
}

// zscale sert au tone mapping HDR. Absent des builds ffmpeg minimalistes.
try {
  const {stdout} = await execFileAsync('ffmpeg', ['-hide_banner', '-filters'], {
    maxBuffer: 1024 * 1024 * 8,
  });
  if (stdout.includes('zscale')) {
    ok('tone mapping HDR', 'filtre zscale disponible');
  } else {
    alerte(
      'tone mapping HDR',
      "le filtre zscale manque : les rushes HDR d'iPhone auront des couleurs fausses",
      'installer un build ffmpeg complet (Gyan full build sur Windows)',
    );
  }
} catch {
  // Deja signale par le controle ffmpeg.
}

// --- Dependances ----------------------------------------------------------

if (fs.existsSync(path.join(ROOT, 'node_modules', 'remotion'))) {
  const version = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'node_modules', 'remotion', 'package.json'), 'utf8'),
  ).version;
  ok('Remotion', `v${version}`);
} else {
  echec('Remotion', 'dependances non installees', 'npm install');
}

// --- Navigateur de rendu --------------------------------------------------

// Remotion depose le navigateur dans node_modules/.remotion/.
const navigateur = path.join(ROOT, 'node_modules', '.remotion', 'chrome-headless-shell');
if (fs.existsSync(navigateur)) {
  ok('Chrome Headless', 'installe');
} else {
  alerte(
    'Chrome Headless',
    'absent : environ 113 Mo seront telecharges au premier rendu',
    'aucune action, le telechargement est automatique',
  );
}

// --- Transcription --------------------------------------------------------

const whisper = path.join(os.homedir(), '.remotion-whisper');
if (fs.existsSync(whisper)) {
  const modeles = fs.readdirSync(whisper).filter((f) => f.startsWith('ggml-'));
  ok(
    'Whisper local',
    modeles.length ? `modeles : ${modeles.map((m) => m.replace(/^ggml-|\.bin$/g, '')).join(', ')}` : 'installe, aucun modele',
  );
} else {
  alerte(
    'Whisper local',
    'absent : environ 1,5 Go seront telecharges a la premiere transcription',
    'aucune action, ou utiliser --openai',
  );
}

if (process.env.OPENAI_API_KEY) {
  ok('OPENAI_API_KEY', 'presente (option --openai disponible)');
} else if (fs.existsSync(path.join(ROOT, '.env'))) {
  const contenu = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const renseignee = /^OPENAI_API_KEY=.+/m.test(contenu);
  if (renseignee) {
    ok('OPENAI_API_KEY', 'presente dans .env');
  } else {
    alerte('OPENAI_API_KEY', 'vide dans .env', 'optionnelle : ameliore l alignement des sous-titres');
  }
} else {
  alerte(
    'OPENAI_API_KEY',
    'absente',
    'optionnelle. Copier .env.example vers .env pour la renseigner',
  );
}

// --- Arborescence ---------------------------------------------------------

for (const [nom, chemin] of [
  ['projects/', PROJECTS_DIR],
  ['exports/', EXPORTS_DIR],
  ['bibliotheque', LIBRARY_DIR],
]) {
  if (fs.existsSync(chemin)) ok(nom, 'present');
  else alerte(nom, 'absent', `mkdir "${chemin}"`);
}

const bruitages = fs.existsSync(path.join(LIBRARY_DIR, 'sfx'))
  ? fs.readdirSync(path.join(LIBRARY_DIR, 'sfx')).filter((f) => /\.(mp3|wav|m4a|ogg|aac|flac)$/i.test(f))
  : [];
if (bruitages.length) ok('bruitages', `${bruitages.length} fichiers`);
else alerte('bruitages', 'bibliotheque vide', 'deposer des fichiers dans projects/_library/sfx/');

const projets = listProjects();
ok('projets', projets.length ? projets.join(', ') : 'aucun (npm run new -- mon-projet)');

// --- Espace disque --------------------------------------------------------

try {
  const {bavail, bsize} = fs.statfsSync(ROOT);
  const libreGo = (bavail * bsize) / 1024 ** 3;
  if (libreGo > 10) ok('espace disque', `${libreGo.toFixed(0)} Go libres`);
  else alerte('espace disque', `${libreGo.toFixed(1)} Go libres`, 'proxys et rendus peuvent en demander plusieurs');
} catch {
  // statfs n'existe pas partout, ce n'est pas bloquant.
}

// --- Rapport --------------------------------------------------------------

const symbole = {ok: '  ok  ', alerte: ' note ', echec: 'ECHEC '};

console.log('');
for (const c of controles) {
  console.log(`${symbole[c.etat]} ${c.nom.padEnd(20)} ${c.detail}`);
  if (c.remede) console.log(`${' '.repeat(8)}${' '.repeat(20)} → ${c.remede}`);
}

const echecs = controles.filter((c) => c.etat === 'echec');
const alertes = controles.filter((c) => c.etat === 'alerte');

console.log('');
if (echecs.length) {
  console.log(`${echecs.length} probleme(s) bloquant(s). Corrige-les avant de monter quoi que ce soit.`);
} else {
  console.log(`Tout est en place${alertes.length ? ` (${alertes.length} remarque(s) non bloquante(s))` : ''}.`);
}

// --- Auto-test de bout en bout -------------------------------------------

if (!flag('full')) {
  if (!echecs.length) {
    console.log('Pour un vrai rendu de controle : npm run doctor -- --full');
  }
  process.exit(echecs.length ? 1 : 0);
}

if (echecs.length) process.exit(1);

console.log('');
console.log('Auto-test : generation d un rush, montage minimal, rendu.');

const slug = '_autotest';
const dir = path.join(PROJECTS_DIR, slug);
fs.rmSync(dir, {recursive: true, force: true});
fs.mkdirSync(path.join(dir, 'media'), {recursive: true});

try {
  await execFileAsync('ffmpeg', [
    '-y', '-v', 'error',
    '-f', 'lavfi', '-i', 'testsrc2=s=1080x1920:d=2:r=30',
    '-t', '2', '-r', '30', '-pix_fmt', 'yuv420p',
    path.join(dir, 'media', 'test.mp4'),
  ]);

  fs.writeFileSync(
    path.join(dir, 'plan.json'),
    JSON.stringify(
      {
        title: 'auto-test',
        fps: 30, width: 1080, height: 1920, duration: 1,
        clips: [{src: 'media/test.mp4', start: 0, duration: 1, trim: 0}],
        overlays: [
          {type: 'text', text: 'OK', preset: 'hook', start: 0, duration: 1,
           position: {x: 0.5, y: 0.4}},
        ],
      },
      null, 2,
    ),
    'utf8',
  );

  const {bundle} = await import('@remotion/bundler');
  const {renderMedia, selectComposition} = await import('@remotion/renderer');

  process.stdout.write('  compilation... ');
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, 'src', 'index.ts'),
    publicDir: PROJECTS_DIR,
  });
  console.log('ok');

  const inputProps = {project: slug};
  const composition = await selectComposition({serveUrl, id: 'TikTok', inputProps});

  const sortie = path.join(os.tmpdir(), 'tiktok-editor-autotest.mp4');
  process.stdout.write('  rendu......... ');
  await renderMedia({
    composition, serveUrl, codec: 'h264',
    outputLocation: sortie, inputProps, crf: 28, overwrite: true,
    timeoutInMilliseconds: 120000,
  });

  const mo = fs.statSync(sortie).size / 1024 / 1024;
  console.log(`ok (${mo.toFixed(1)} Mo)`);
  fs.rmSync(sortie, {force: true});

  console.log('');
  console.log('La chaine complete fonctionne sur cette machine.');
} catch (err) {
  console.log('');
  console.error(`Auto-test en echec : ${err.message.split('\n')[0]}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(dir, {recursive: true, force: true});
}
