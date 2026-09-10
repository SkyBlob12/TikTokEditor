/**
 * Verifie qu'un plan de montage est rendable AVANT de lancer le rendu.
 * C'est le garde-fou du pipeline : un plan ecrit par un modele passe ici
 * d'abord, et les erreurs sont formulees pour etre corrigees directement.
 *
 *   npm run validate -- mon-projet
 */
import fs from 'node:fs';
import path from 'node:path';
import {kindOf, probe, projectDir, readJson, requireSlug, resolveAsset} from './_shared.mjs';
import {planSchema} from '../src/schema.ts';
import {clampBottom, clampCenterY, estimateLines, insetsOf, maxWidthAt} from '../src/lib/safeZone.ts';

const slug = requireSlug('npm run validate -- <slug>');
const dir = projectDir(slug);

const errors = [];
const warnings = [];

const planFile = path.join(dir, 'plan.json');
if (!fs.existsSync(planFile)) {
  console.error(`Pas de plan.json dans projects/${slug}/`);
  process.exit(1);
}

let raw;
try {
  raw = readJson(planFile);
} catch (err) {
  console.error(`plan.json n'est pas du JSON valide : ${err.message}`);
  process.exit(1);
}

const parsed = planSchema.safeParse(raw);
if (!parsed.success) {
  for (const issue of parsed.error.issues) {
    errors.push(`${issue.path.join('.') || '(racine)'} : ${issue.message}`);
  }
  report();
}

const plan = parsed.data;

// Marges recouvertes par l'interface TikTok, en pixels de la composition.
const insets = insetsOf(plan.safeZone, plan.width, plan.height);

/** Taille de police effective d'un overlay, presets compris. */
const TAILLES = {hook: 96, cta: 62, sticker: 46, label: 40, plain: 58};
const tailleTexte = (overlay) => overlay.fontSize ?? TAILLES[overlay.preset];

// --- Durees reelles des sources -------------------------------------------

const mediaFile = path.join(dir, 'media.json');
const durations = new Map();

if (fs.existsSync(mediaFile)) {
  for (const item of readJson(mediaFile).items ?? []) {
    durations.set(item.src, item);
  }
}

const sourceInfo = async (src) => {
  if (durations.has(src)) return durations.get(src);
  const absolute = resolveAsset(slug, src);
  if (!fs.existsSync(absolute)) return null;
  try {
    const meta = await probe(absolute);
    const info = {src, kind: kindOf(src), ...meta};
    durations.set(src, info);
    return info;
  } catch {
    return null;
  }
};

const checkFile = (src, label) => {
  if (!src) return false;
  if (!fs.existsSync(resolveAsset(slug, src))) {
    const ou = String(src).startsWith('library/')
      ? `projects/_library/${String(src).slice(8)}`
      : `projects/${slug}/${src}`;
    errors.push(`${label} : fichier introuvable, ${ou}`);
    return false;
  }
  return true;
};

// --- Clips -----------------------------------------------------------------

if (!plan.clips.length) {
  warnings.push('Aucun clip : la video sera un fond uni.');
}

for (const [i, clip] of plan.clips.entries()) {
  const label = `clips[${i}]`;
  if (clip.kind === 'color') continue;
  if (!checkFile(clip.src, label)) continue;

  const detected = kindOf(clip.src);
  if (detected && detected !== clip.kind) {
    errors.push(`${label} : kind "${clip.kind}" mais ${clip.src} est un fichier ${detected}.`);
  }

  if (clip.kind === 'video') {
    const info = await sourceInfo(clip.src);
    if (info?.duration) {
      const needed = clip.trim + clip.duration * clip.speed;
      if (needed > info.duration + 0.05) {
        errors.push(
          `${label} : demande ${needed.toFixed(2)}s de "${clip.src}" qui n'en dure que ${info.duration.toFixed(2)}s ` +
            `(trim ${clip.trim} + duration ${clip.duration} x speed ${clip.speed}). ` +
            `Duree max possible ici : ${((info.duration - clip.trim) / clip.speed).toFixed(2)}s.`,
        );
      }
    }
  }
}

// --- Trous et recouvrements sur la timeline --------------------------------

const ordered = [...plan.clips].sort((a, b) => a.start - b.start);
if (ordered.length && ordered[0].start > 0.02) {
  warnings.push(`Ecran noir de ${ordered[0].start.toFixed(2)}s au debut (premier clip a ${ordered[0].start}s).`);
}
for (let i = 1; i < ordered.length; i++) {
  const previousEnd = ordered[i - 1].start + ordered[i - 1].duration;
  const gap = ordered[i].start - previousEnd;
  if (gap > 0.02) {
    warnings.push(`Ecran noir de ${gap.toFixed(2)}s a ${previousEnd.toFixed(2)}s (entre deux clips).`);
  }
}

// --- Overlays --------------------------------------------------------------

for (const [i, overlay] of plan.overlays.entries()) {
  const label = `overlays[${i}]`;
  if (overlay.type === 'image') {
    if (!overlay.src) errors.push(`${label} : type "image" sans src.`);
    else checkFile(overlay.src, label);
  } else if (overlay.type === 'counter') {
    if (overlay.to === undefined) {
      errors.push(`${label} : type "counter" sans valeur d'arrivee (champ "to").`);
    }
    if (overlay.countDuration > overlay.duration) {
      warnings.push(
        `${label} : le compteur met ${overlay.countDuration}s a monter mais n'est affiche ` +
          `que ${overlay.duration}s, il n'atteindra jamais sa valeur.`,
      );
    }
  } else if (!overlay.text) {
    errors.push(`${label} : type "text" sans texte.`);
  }
  // La zone sure est appliquee au rendu : ici on previent quand elle va
  // deplacer quelque chose, pour que ce soit corrige dans le plan plutot que
  // subi a l'export.
  const largeur = maxWidthAt(overlay.position.x * plan.width, insets, plan.width);
  if (largeur <= 0) {
    warnings.push(
      `${label} : x=${overlay.position.x} met le bloc entierement hors de la zone sure. ` +
        `Garde x entre ${(insets.left / plan.width).toFixed(2)} et ` +
        `${(1 - insets.right / plan.width).toFixed(2)}.`,
    );
  }

  const demiHauteur =
    overlay.type === 'image'
      ? 0
      : (estimateLines(String(overlay.text ?? ''), tailleTexte(overlay), Math.max(1, largeur)) *
          tailleTexte(overlay) *
          1.12) /
        2;
  const yRendu = clampCenterY(overlay.position.y * plan.height, demiHauteur, insets, plan.height) /
    plan.height;
  if (Math.abs(yRendu - overlay.position.y) > 0.005) {
    warnings.push(
      `${label} : y=${overlay.position.y} sort de la zone sure TikTok, le rendu le ramene a ` +
        `${yRendu.toFixed(2)}. Corrige la valeur dans le plan.`,
    );
  }
}

// --- Effets et bruitages ---------------------------------------------------

for (const [i, sound] of plan.sfx.entries()) {
  checkFile(sound.src, `sfx[${i}]`);
}

// --- Audio et sous-titres --------------------------------------------------

if (plan.audio?.voice) checkFile(plan.audio.voice, 'audio.voice');
if (plan.audio?.music) checkFile(plan.audio.music, 'audio.music');

if (plan.captions?.enabled) {
  // Une seule transcription (file + syncTo), ou une par prise (sources) :
  // le controle est le meme, on l'applique a chaque source declaree.
  const sources = plan.captions.sources?.length
    ? plan.captions.sources
    : [{file: plan.captions.file, syncTo: plan.captions.syncTo}];

  for (const source of sources) {
    const captionsPath = path.join(dir, source.file);
    if (!fs.existsSync(captionsPath)) {
      warnings.push(
        `captions.enabled mais ${source.file} est absent — pas de sous-titres. ` +
          `Lance : npm run transcribe -- ${slug}`,
      );
    } else {
      const data = readJson(captionsPath);
      const words = Array.isArray(data) ? data : (data.captions ?? []);
      if (!words.length) warnings.push(`${source.file} ne contient aucun mot.`);
    }
    if (source.syncTo && !plan.clips.some((c) => c.src === source.syncTo)) {
      warnings.push(
        `captions.syncTo pointe sur "${source.syncTo}", qui n'est utilise par aucun clip. ` +
          'Les sous-titres garderont les timings du fichier source.',
      );
    }
  }

  // Un rush dont on entend la voix mais qui n'a pas de transcription declaree
  // passera sans sous-titres, et ca ne se voit qu'au rendu.
  if (plan.captions.sources?.length) {
    const declares = new Set(plan.captions.sources.map((s) => s.syncTo));
    const parlants = new Set(
      plan.clips.filter((c) => c.volume > 0 && kindOf(c.src) === 'video').map((c) => c.src),
    );
    for (const src of parlants) {
      if (!declares.has(src)) {
        warnings.push(
          `Aucune transcription pour "${src}", dont le son est audible : ces extraits ` +
            'seront muets en sous-titres. Ajoute-le a captions.sources.',
        );
      }
    }
  }

  // On ne previent que si la voix vient vraisemblablement des clips eux-memes,
  // c'est-a-dire s'ils ont du son. Sinon la transcription est independante du
  // remontage et n'a rien a recaler.
  const voixDansLesClips = plan.clips.some((c) => c.volume > 0);
  const recale = sources.some((s) => s.syncTo);
  if (!recale && voixDansLesClips && plan.clips.some((c) => c.trim > 0 || c.speed !== 1)) {
    warnings.push(
      'Des clips sont coupes ou acceleres mais captions.syncTo est absent : les ' +
        'sous-titres suivront les timings du fichier source, donc seront desynchronises.',
    );
  }
  const ligne = plan.captions.fontSize * 1.15;
  const basRendu = clampBottom(
    plan.captions.y * plan.height + ligne / 2,
    ligne,
    insets,
    plan.height,
  );
  const yRendu = (basRendu - ligne / 2) / plan.height;
  if (Math.abs(yRendu - plan.captions.y) > 0.005) {
    warnings.push(
      `captions.y=${plan.captions.y} passe sous la zone sure TikTok (legende, boutons), ` +
        `le rendu remonte les sous-titres a ${yRendu.toFixed(2)} : ` +
        `c'est le maximum a fontSize ${plan.captions.fontSize}.`,
    );
  }
}

// --- Duree totale ----------------------------------------------------------

const ends = [
  ...plan.clips.map((c) => c.start + c.duration),
  ...plan.overlays.map((o) => o.start + o.duration),
];
const total = plan.duration ?? (ends.length ? Math.max(...ends) : 0);

for (const [i, effect] of plan.effects.entries()) {
  if (total && effect.start > total) {
    warnings.push(`effects[${i}] : demarre a ${effect.start}s, apres la fin de la video (${total.toFixed(1)}s).`);
  }
  if (effect.intensity > 0.6) {
    warnings.push(
      `effects[${i}] : intensite ${effect.intensity}. Au-dela de 0.6 l'effet se voit ` +
        `au lieu de se sentir, et se lit comme un bug.`,
    );
  }
}

for (const [i, sound] of plan.sfx.entries()) {
  if (total && sound.at > total) {
    warnings.push(`sfx[${i}] : declenche a ${sound.at}s, apres la fin de la video (${total.toFixed(1)}s).`);
  }
}

if (total > 0 && total < 3) warnings.push(`Video de ${total.toFixed(1)}s : trop courte pour TikTok.`);
if (total > 180) warnings.push(`Video de ${Math.round(total)}s : au-dela de 3 min, la retention s'effondre.`);

// --- Rapport ---------------------------------------------------------------

function report() {
  console.log('');
  for (const w of warnings) console.log(`  ! ${w}`);
  for (const e of errors) console.log(`  x ${e}`);
  console.log('');

  if (errors.length) {
    console.log(`${errors.length} erreur(s) — le rendu echouerait. Corrige projects/${slug}/plan.json.`);
    process.exit(1);
  }
  console.log(
    `Plan valide : ${plan?.clips.length ?? 0} clips, ${plan?.overlays.length ?? 0} overlays, ` +
      `${total.toFixed(1)}s${warnings.length ? ` — ${warnings.length} avertissement(s)` : ''}.`,
  );
  process.exit(0);
}

report();
