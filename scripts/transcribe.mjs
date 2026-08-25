/**
 * Produit projects/<slug>/captions.json : la transcription mot a mot qui
 * alimente les sous-titres karaoke et le ducking de la musique.
 *
 * Trois sources possibles :
 *   npm run transcribe -- mon-projet                  Whisper.cpp local (gratuit, hors ligne)
 *   npm run transcribe -- mon-projet --openai         API OpenAI (rapide, ~0.006 $/min)
 *   npm run transcribe -- mon-projet --srt sous.srt   Import d'un .srt existant
 *
 * Options : --audio media/voix.mp3   --model medium   --lang fr
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {parseSrt} from '@remotion/captions';
import {execFileAsync, flag, kindOf, projectDir, readJson, requireSlug, writeJson} from './_shared.mjs';

const slug = requireSlug('npm run transcribe -- <slug> [--openai|--srt fichier.srt]');
const dir = projectDir(slug);

const MODEL = String(flag('model', 'medium'));
const LANG = String(flag('lang', 'fr'));
const WHISPER_VERSION = String(flag('whisper-version', '1.5.5'));

/** Trouve l'audio a transcrire : --audio, sinon audio.voice du plan, sinon le 1er media de media/. */
const resolveAudio = () => {
  const explicit = flag('audio');
  if (typeof explicit === 'string') return path.join(dir, explicit);

  const planFile = path.join(dir, 'plan.json');
  if (fs.existsSync(planFile)) {
    const plan = readJson(planFile);
    if (plan.audio?.voice) return path.join(dir, plan.audio.voice);
  }

  const mediaDir = path.join(dir, 'media');
  if (fs.existsSync(mediaDir)) {
    const found = fs
      .readdirSync(mediaDir)
      .find((f) => kindOf(f) === 'audio' || kindOf(f) === 'video');
    if (found) return path.join(mediaDir, found);
  }
  return null;
};

const save = (captions) => {
  writeJson(path.join(dir, 'captions.json'), {
    project: slug,
    language: LANG,
    generatedAt: new Date().toISOString(),
    captions,
  });
  const seconds = captions.length ? Math.round(captions[captions.length - 1].endMs / 1000) : 0;
  console.log('');
  console.log(`${captions.length} mots, ${seconds}s.`);
  console.log(`Ecrit : projects/${slug}/captions.json`);
};

// --- Source 1 : import d'un .srt -------------------------------------------

const srtFile = flag('srt');
if (typeof srtFile === 'string') {
  const absolute = path.isAbsolute(srtFile) ? srtFile : path.join(dir, srtFile);
  const {captions: lines} = parseSrt({input: fs.readFileSync(absolute, 'utf8')});

  // Un .srt donne des lignes, pas des mots : on repartit le temps proportionnellement.
  const words = lines.flatMap((line) => {
    const tokens = line.text.split(/\s+/).filter(Boolean);
    const span = Math.max(1, line.endMs - line.startMs);
    const total = tokens.reduce((sum, t) => sum + t.length, 0) || 1;
    let cursor = line.startMs;
    return tokens.map((token) => {
      const share = (token.length / total) * span;
      const startMs = Math.round(cursor);
      cursor += share;
      return {
        text: token,
        startMs,
        endMs: Math.round(cursor),
        timestampMs: Math.round(startMs + share / 2),
        confidence: null,
      };
    });
  });

  console.log(`Importe depuis ${path.basename(absolute)} (timings estimes par mot).`);
  save(words);
  process.exit(0);
}

// --- Preparation de l'audio ------------------------------------------------

const audioPath = resolveAudio();
if (!audioPath || !fs.existsSync(audioPath)) {
  console.error('Aucun fichier audio trouve. Precise-le : --audio media/voix.mp3');
  process.exit(1);
}
console.log(`Audio : ${path.relative(dir, audioPath)}`);

// --- Source 2 : API OpenAI -------------------------------------------------

if (flag('openai')) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.error('OPENAI_API_KEY absent de l environnement.');
    process.exit(1);
  }

  // L'API plafonne a 25 Mo. On n'envoie jamais le rush : on extrait une piste
  // audio compressee, ce qui suffit largement a la transcription.
  const mp3Path = path.join(os.tmpdir(), `tiktok-editor-${slug}.mp3`);
  console.log('Extraction de la piste audio...');
  await execFileAsync('ffmpeg', [
    '-y', '-i', audioPath,
    '-vn', '-ar', '16000', '-ac', '1', '-b:a', '64k',
    mp3Path,
  ]);

  const sizeMb = fs.statSync(mp3Path).size / 1024 / 1024;
  if (sizeMb > 24) {
    console.error(`Audio de ${sizeMb.toFixed(1)} Mo : au-dela de la limite de 25 Mo de l'API.`);
    console.error('Decoupe le rush, ou passe par Whisper local (sans --openai).');
    process.exit(1);
  }
  console.log(`  ${sizeMb.toFixed(1)} Mo a envoyer.`);

  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(mp3Path)]), `${slug}.mp3`);
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  form.append('language', LANG);

  console.log('Transcription via OpenAI...');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {Authorization: `Bearer ${key}`},
    body: form,
  });

  if (!res.ok) {
    console.error(`OpenAI a repondu ${res.status} : ${await res.text()}`);
    process.exit(1);
  }

  const data = await res.json();
  fs.rmSync(mp3Path, {force: true});

  /**
   * L'API rend les mots sans ponctuation, donc les elisions arrivent coupees :
   * « c » puis « est », « l » puis « application ». Affiches tels quels en
   * sous-titres, ca donne « C EST ». On les recolle.
   */
  const ELISIONS = new Set([
    'c', 'd', 'j', 'l', 'm', 'n', 's', 't', 'qu',
    'jusqu', 'lorsqu', 'puisqu', 'quelqu', 'aujourd',
  ]);
  /** Un symbole se colle au mot precedent : « 20 » + « % » = « 20% ». */
  const SUFFIXES = new Set(['%', '€', '$', '°']);

  const recolle = (mots) => {
    const out = [];
    for (const mot of mots) {
      const texte = mot.word;
      const precedent = out[out.length - 1];

      if (precedent && SUFFIXES.has(texte.trim())) {
        precedent.word += texte.trim();
        precedent.end = mot.end;
        continue;
      }
      if (precedent && ELISIONS.has(precedent.word.toLowerCase()) && mot.start - precedent.end < 0.2) {
        precedent.word += `'${texte}`;
        precedent.end = mot.end;
        continue;
      }
      // L'API renvoie des jetons vides pour la ponctuation qu'elle a retiree.
      if (!texte.trim()) continue;
      out.push({word: texte, start: mot.start, end: mot.end});
    }
    return out;
  };

  save(
    recolle(data.words ?? []).map((w) => ({
      text: w.word,
      startMs: Math.round(w.start * 1000),
      endMs: Math.round(w.end * 1000),
      timestampMs: Math.round(((w.start + w.end) / 2) * 1000),
      confidence: null,
    })),
  );
  process.exit(0);
}

// --- Source 3 : Whisper.cpp local (defaut) ---------------------------------

const {downloadWhisperModel, installWhisperCpp, transcribe, toCaptions} = await import(
  '@remotion/install-whisper-cpp'
);

/**
 * Whisper.cpp doit tourner depuis un repertoire SANS ESPACE.
 *
 * Deux raisons, toutes deux dans @remotion/install-whisper-cpp :
 *  - l'installation Windows lance `Expand-Archive -Force <zip> <dest>` via
 *    PowerShell sans quoter les chemins, et depose le zip dans process.cwd() ;
 *    un espace ("Dev Perso") coupe la commande en deux ;
 *  - la transcription cree un dossier tmp/ dans process.cwd(), qui n'a rien a
 *    faire dans le projet.
 *
 * On bascule donc le cwd sur un repertoire de travail propre le temps de
 * l'operation, et on le restaure ensuite.
 */
const makeScratchDir = () => {
  const candidates = [
    path.join(os.tmpdir(), 'tiktok-editor-whisper'),
    path.join(path.parse(process.cwd()).root, 'remotion-whisper-tmp'),
  ];
  for (const candidate of candidates) {
    if (/\s/.test(candidate)) continue;
    try {
      fs.mkdirSync(candidate, {recursive: true});
      return candidate;
    } catch {
      // On essaie le candidat suivant.
    }
  }
  return null;
};

const scratch = makeScratchDir();
if (!scratch) {
  console.error('Aucun repertoire de travail sans espace disponible pour Whisper.');
  console.error(`Replie-toi sur : npm run transcribe -- ${slug} --openai`);
  process.exit(1);
}

// whisper.cpp n'accepte que du WAV 16 kHz mono.
const wavPath = path.join(scratch, `${slug}.wav`);
console.log('Conversion en WAV 16 kHz mono...');
await execFileAsync('ffmpeg', [
  '-y', '-i', audioPath,
  '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le',
  wavPath,
]);

const whisperPath = path.join(os.homedir(), '.remotion-whisper');
const previousCwd = process.cwd();
process.chdir(scratch);

try {
  console.log(`Whisper.cpp ${WHISPER_VERSION}, modele ${MODEL} (telecharge a la premiere utilisation).`);
  await installWhisperCpp({to: whisperPath, version: WHISPER_VERSION, printOutput: true});
  await downloadWhisperModel({model: MODEL, folder: whisperPath, printOutput: true});

  console.log('Transcription...');
  const result = await transcribe({
    inputPath: wavPath,
    whisperPath,
    whisperCppVersion: WHISPER_VERSION,
    model: MODEL,
    modelFolder: whisperPath,
    tokenLevelTimestamps: true,
    language: LANG,
    splitOnWord: true,
    printOutput: false,
    onProgress: (p) => process.stdout.write(`\r  ${Math.round(p * 100)}%   `),
  });

  const {captions} = toCaptions({whisperCppOutput: result});
  save(captions.filter((c) => c.text.trim().length > 0));
} finally {
  process.chdir(previousCwd);
  fs.rmSync(wavPath, {force: true});
  fs.rmSync(path.join(scratch, 'tmp'), {recursive: true, force: true});
}
