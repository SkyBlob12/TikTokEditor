/**
 * Analyse les fichiers de projects/<slug>/media/ et ecrit media.json.
 * C'est ce fichier que Claude lit pour ecrire un plan de montage valide :
 * il donne les durees reelles, donc les `trim` et `duration` possibles.
 *
 *   npm run ingest -- mon-projet
 */
import fs from 'node:fs';
import path from 'node:path';
import {ffmpegAvailable, kindOf, probe, projectDir, requireSlug, writeJson} from './_shared.mjs';

const slug = requireSlug('npm run ingest -- <slug>');
const dir = projectDir(slug);
const mediaDir = path.join(dir, 'media');

if (!(await ffmpegAvailable())) {
  console.error('ffprobe est introuvable. Installe FFmpeg : winget install Gyan.FFmpeg');
  process.exit(1);
}

if (!fs.existsSync(mediaDir)) {
  console.error(`Aucun dossier media/ dans projects/${slug}/`);
  process.exit(1);
}

/** Parcourt media/ recursivement. */
const walk = (dirPath, prefix = '') =>
  fs.readdirSync(dirPath, {withFileTypes: true}).flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return walk(path.join(dirPath, entry.name), rel);
    return kindOf(entry.name) ? [rel] : [];
  });

const files = walk(mediaDir);

if (!files.length) {
  console.error(`Aucun media dans projects/${slug}/media/`);
  process.exit(1);
}

const items = [];
for (const rel of files) {
  const absolute = path.join(mediaDir, rel);
  try {
    const meta = await probe(absolute);
    items.push({
      src: `media/${rel}`,
      kind: kindOf(rel),
      ...meta,
      orientation:
        meta.width && meta.height ? (meta.height >= meta.width ? 'portrait' : 'paysage') : null,
      sizeMb: Math.round((fs.statSync(absolute).size / 1024 / 1024) * 10) / 10,
    });
    console.log(
      `  ${rel.padEnd(38)} ${String(meta.duration).padStart(7)}s  ${meta.width ?? '-'}x${meta.height ?? '-'}  ${meta.hasAudio ? 'audio' : 'muet'}`,
    );
  } catch (err) {
    console.warn(`  ${rel} — illisible : ${err.message.split('\n')[0]}`);
  }
}

const totalVideo = items
  .filter((i) => i.kind === 'video')
  .reduce((sum, i) => sum + i.duration, 0);

writeJson(path.join(dir, 'media.json'), {
  project: slug,
  scannedAt: new Date().toISOString(),
  totalVideoDuration: Math.round(totalVideo * 100) / 100,
  items,
});

console.log('');
console.log(`${items.length} media, ${Math.round(totalVideo)}s de rushes video.`);
console.log(`Ecrit : projects/${slug}/media.json`);

// Un rush trop lourd fait echouer le rendu sur un delai d'extraction de frame.
// Autant le dire ici plutot que 20 minutes plus tard.
const heavy = items.filter(
  (i) =>
    i.kind === 'video' &&
    !i.src.startsWith('media/proxy/') &&
    (i.width > 1080 ||
      i.height > 1920 ||
      (i.fps ?? 0) > 31 ||
      ['hevc', 'h265', 'prores', 'vp9', 'av1'].includes(i.codec ?? '')),
);

if (heavy.length) {
  const hasProxy = (src) =>
    items.some((i) => i.src === `media/proxy/${path.parse(src).name}.mp4`);
  const missing = heavy.filter((i) => !hasProxy(i.src));

  console.log('');
  for (const item of heavy) {
    console.log(
      `  ! ${item.src} — ${item.width}x${item.height} ${item.codec} ${item.fps ?? '?'}fps` +
        (hasProxy(item.src) ? ' (proxy present)' : ' : trop lourd pour un rendu direct'),
    );
  }
  if (missing.length) {
    console.log('');
    console.log(`  Lance : npm run proxy -- ${slug}`);
    console.log('  Puis pointe les clips du plan sur media/proxy/.');
  }
}
