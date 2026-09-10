import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

const execFileAsync = promisify(execFile);

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PROJECTS_DIR = path.join(ROOT, 'projects');
export const EXPORTS_DIR = path.join(ROOT, 'exports');
/** Assets partages entre projets : bruitages, musiques, logos. */
export const LIBRARY_DIR = path.join(PROJECTS_DIR, '_library');

/**
 * Charge .env a la racine, s'il existe.
 *
 * La documentation dit de mettre OPENAI_API_KEY dans .env, mais les scripts
 * lisent process.env : sans ce chargement, une cle presente dans le fichier
 * reste invisible et la transcription --openai echoue en disant qu'elle est
 * absente. Aucune dependance, process.loadEnvFile est natif.
 */
try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
  // Pas de .env, ou Node trop ancien : tout fonctionne sans, en local.
}

export const projectDir = (slug) => path.join(PROJECTS_DIR, slug);

/**
 * Resout un chemin de plan vers un fichier sur le disque.
 * `library/...` pointe sur la bibliotheque partagee, tout le reste sur le projet.
 */
export const resolveAsset = (slug, src) => {
  const clean = String(src).replace(/^\.?\//, '');
  return clean.startsWith('library/')
    ? path.join(LIBRARY_DIR, clean.slice('library/'.length))
    : path.join(projectDir(slug), clean);
};

/** Les dossiers commencant par _ ne sont pas des projets. */
export const listProjects = () =>
  fs.existsSync(PROJECTS_DIR)
    ? fs
        .readdirSync(PROJECTS_DIR, {withFileTypes: true})
        .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
        .map((e) => e.name)
    : [];

/** Recupere le slug depuis argv, avec un message clair si absent. */
export const requireSlug = (usage) => {
  const slug = process.argv[2];
  if (!slug || slug.startsWith('--')) {
    console.error(`Usage : ${usage}`);
    const existing = listProjects();
    if (existing.length) console.error(`Projets existants : ${existing.join(', ')}`);
    process.exit(1);
  }
  if (!fs.existsSync(projectDir(slug))) {
    console.error(`Le projet "${slug}" n'existe pas. Cree-le : npm run new ${slug}`);
    process.exit(1);
  }
  return slug;
};

/** Lit un flag `--nom=valeur` ou `--nom valeur`. */
export const flag = (name, fallback = undefined) => {
  const args = process.argv.slice(2);
  const withEquals = args.find((a) => a.startsWith(`--${name}=`));
  if (withEquals) return withEquals.split('=').slice(1).join('=');
  const i = args.indexOf(`--${name}`);
  if (i !== -1) {
    const next = args[i + 1];
    return next && !next.startsWith('--') ? next : true;
  }
  return fallback;
};

export const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

export const writeJson = (file, data) => {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
};

export const VIDEO_EXT = ['.mp4', '.mov', '.webm', '.mkv', '.m4v', '.avi'];
export const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
export const AUDIO_EXT = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];

export const kindOf = (file) => {
  const ext = path.extname(file).toLowerCase();
  if (VIDEO_EXT.includes(ext)) return 'video';
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (AUDIO_EXT.includes(ext)) return 'audio';
  return null;
};

/** Metadonnees d'un fichier media via ffprobe. */
export const probe = async (file) => {
  const {stdout} = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    file,
  ], {maxBuffer: 1024 * 1024 * 16});

  const data = JSON.parse(stdout);
  const video = data.streams.find((s) => s.codec_type === 'video');
  const audio = data.streams.find((s) => s.codec_type === 'audio');
  const duration = Number(data.format?.duration ?? video?.duration ?? audio?.duration ?? 0);

  let fps = null;
  if (video?.r_frame_rate && video.r_frame_rate !== '0/0') {
    const [num, den] = video.r_frame_rate.split('/').map(Number);
    if (den) fps = Math.round((num / den) * 1000) / 1000;
  }

  // Rotation : une video filmee au telephone peut etre stockee en paysage.
  const rotation = Number(
    video?.side_data_list?.find((s) => s.rotation !== undefined)?.rotation ?? video?.tags?.rotate ?? 0,
  );
  const swapped = Math.abs(rotation) === 90 || Math.abs(rotation) === 270;

  return {
    duration: Math.round(duration * 1000) / 1000,
    width: video ? (swapped ? video.height : video.width) : null,
    height: video ? (swapped ? video.width : video.height) : null,
    fps,
    hasAudio: Boolean(audio),
    codec: video?.codec_name ?? audio?.codec_name ?? null,
    colorTransfer: video?.color_transfer ?? null,
    colorPrimaries: video?.color_primaries ?? null,
    pixFmt: video?.pix_fmt ?? null,
  };
};

export const ffmpegAvailable = async () => {
  try {
    await execFileAsync('ffprobe', ['-version']);
    return true;
  } catch {
    return false;
  }
};

export {execFileAsync};
