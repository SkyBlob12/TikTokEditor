/**
 * Transcode les rushes lourds en versions montables.
 *
 *   npm run proxy -- mon-projet
 *
 * Pourquoi : un rush de telephone est souvent en 4K HEVC 60 fps. Remotion doit
 * extraire chaque frame une par une, en parallele, en demandant au decodeur de
 * chercher a un instant precis. Sur du HEVC 4K, une seule extraction depasse
 * facilement les 28 s de delai autorise, et le rendu casse.
 *
 * On genere donc une fois pour toutes une version H.264 aux dimensions de
 * livraison (1080x1920 max, 30 fps). Ce n'est pas une degradation : c'est
 * exactement la resolution de sortie. Le rush original n'est jamais touche.
 *
 * Les proxys atterrissent dans media/proxy/. Relance `npm run ingest` ensuite.
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileAsync, ffmpegAvailable, kindOf, probe, projectDir, requireSlug, flag} from './_shared.mjs';

const slug = requireSlug('npm run proxy -- <slug>');
const dir = projectDir(slug);
const mediaDir = path.join(dir, 'media');
const proxyDir = path.join(mediaDir, 'proxy');

const TARGET_WIDTH = Number(flag('width', 1080));
const TARGET_HEIGHT = Number(flag('height', 1920));
const TARGET_FPS = Number(flag('fps', 30));
const CRF = Number(flag('crf', 20));

if (!(await ffmpegAvailable())) {
  console.error('ffmpeg est introuvable. Installe FFmpeg : winget install Gyan.FFmpeg');
  process.exit(1);
}

/**
 * Le rush est-il en HDR ?
 *
 * Un iPhone filme en Dolby Vision / HLG : 10 bits, BT.2020, courbe HLG
 * (arib-std-b67) ou PQ (smpte2084). Convertir ca en 8 bits sans tone mapping
 * donne une image delavee aux tons chair verdatres — techniquement valide,
 * visuellement faux.
 */
const isHDR = (meta) =>
  ['arib-std-b67', 'smpte2084'].includes(meta.colorTransfer ?? '') ||
  ['bt2020', 'bt2020-10', 'bt2020-12'].includes(meta.colorPrimaries ?? '') ||
  (meta.pixFmt ?? '').includes('10le');

/**
 * Ramene le HDR en SDR BT.709 : linearisation, tone mapping Hable, retour en
 * BT.709. C'est la chaine de reference ffmpeg pour cette conversion.
 */
const TONEMAP =
  'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,' +
  'tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p';

/** Un rush a besoin d'un proxy s'il est plus lourd que ce que le rendu demande. */
const needsProxy = (meta) =>
  meta.width > TARGET_WIDTH ||
  meta.height > TARGET_HEIGHT ||
  (meta.fps ?? 0) > TARGET_FPS + 1 ||
  ['hevc', 'h265', 'prores', 'vp9', 'av1'].includes(meta.codec ?? '') ||
  isHDR(meta);

const files = fs.existsSync(mediaDir)
  ? fs
      .readdirSync(mediaDir, {withFileTypes: true})
      .filter((e) => e.isFile() && kindOf(e.name) === 'video')
      .map((e) => e.name)
  : [];

if (!files.length) {
  console.error(`Aucune video dans projects/${slug}/media/`);
  process.exit(1);
}

fs.mkdirSync(proxyDir, {recursive: true});

let made = 0;

for (const file of files) {
  const input = path.join(mediaDir, file);
  const meta = await probe(input);

  if (!needsProxy(meta)) {
    console.log(`  ${file} — deja montable (${meta.width}x${meta.height}, ${meta.codec}), ignore.`);
    continue;
  }

  const output = path.join(proxyDir, `${path.parse(file).name}.mp4`);
  if (fs.existsSync(output) && !flag('force')) {
    console.log(`  ${file} — proxy deja present, ignore (--force pour refaire).`);
    continue;
  }

  // On reduit sans jamais agrandir, et on garde de quoi couvrir le cadre de
  // sortie : le facteur retenu est celui qui remplit la plus contrainte des
  // deux dimensions.
  const factor = Math.min(1, Math.max(TARGET_WIDTH / meta.width, TARGET_HEIGHT / meta.height));
  const width = Math.round((meta.width * factor) / 2) * 2;
  const height = Math.round((meta.height * factor) / 2) * 2;
  const fps = Math.min(meta.fps ?? TARGET_FPS, TARGET_FPS);

  const hdr = isHDR(meta);
  console.log(
    `  ${file} — ${meta.width}x${meta.height} ${meta.codec} ${meta.fps ?? '?'}fps` +
      (hdr ? ` HDR (${meta.colorTransfer}/${meta.colorPrimaries})` : '') +
      ` → ${width}x${height} h264 ${fps}fps${hdr ? ' SDR bt709' : ''}`,
  );

  const started = Date.now();
  await execFileAsync(
    'ffmpeg',
    [
      '-y', '-i', input,
      '-map', '0:v:0', '-map', '0:a:0?',
      '-vf', hdr ? `scale=${width}:${height},${TONEMAP}` : `scale=${width}:${height}`,
      '-r', String(fps),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(CRF),
      '-pix_fmt', 'yuv420p',
      // Sans ces tags, le fichier reste annonce comme BT.2020 et tout lecteur
      // le reinterprete de travers.
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
      '-movflags', '+faststart',
      '-c:a', 'aac', '-b:a', '192k',
      output,
    ],
    {maxBuffer: 1024 * 1024 * 16},
  );

  const sizeMb = Math.round((fs.statSync(output).size / 1024 / 1024) * 10) / 10;
  const sourceMb = Math.round((fs.statSync(input).size / 1024 / 1024) * 10) / 10;
  console.log(
    `    ${sourceMb} Mo → ${sizeMb} Mo en ${Math.round((Date.now() - started) / 1000)}s`,
  );
  made++;
}

console.log('');
if (made) {
  console.log(`${made} proxy genere(s) dans projects/${slug}/media/proxy/`);
  console.log('Dans le plan, pointe les clips sur "media/proxy/<nom>.mp4".');
  console.log(`Puis : npm run ingest -- ${slug}`);
} else {
  console.log('Rien a faire.');
}
