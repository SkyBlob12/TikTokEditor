/**
 * Verifie un script avant de le tourner.
 *
 *   npm run script -- mon-projet
 *   npm run script -- mon-projet --init --theme "..." --axes "..." --duree 24
 *   npm run script -- mon-projet --debit 2.6      parole plus posee
 *   npm run script -- mon-projet --json           pour enchainer sur le plan
 *
 * Pourquoi cet outil : un script ecrit hors tournage ment sur sa duree. Trente
 * mots ne tiennent pas dans cinq secondes, et on ne s'en apercoit qu'une fois
 * la camera allumee. Ici on compte les mots et on les confronte aux bornes
 * annoncees, comme `validate` confronte un plan a la duree des rushes.
 */
import fs from 'node:fs';
import path from 'node:path';
import {flag, projectDir, requireSlug} from './_shared.mjs';
import {DEBIT_DEFAUT, dureeCible, estimerDuree, lireScript, sec, verifierScript} from './_script-md.mjs';

const slug = requireSlug('npm run script -- <slug> [--init] [--debit 3] [--json]');
const dir = projectDir(slug);
const fichier = path.join(dir, 'script.md');
const debit = Number(flag('debit', DEBIT_DEFAUT)) || DEBIT_DEFAUT;

// --- Squelette -------------------------------------------------------------

if (flag('init')) {
  if (fs.existsSync(fichier) && !flag('force')) {
    console.error(`projects/${slug}/script.md existe deja. --force pour l'ecraser.`);
    process.exit(1);
  }
  const theme = flag('theme', '(le sujet de la video)');
  const axes = flag('axes', '(les angles a couvrir, separes par des virgules)');
  const duree = Number(flag('duree', 25));

  fs.writeFileSync(
    fichier,
    `# ${slug}\n\n` +
      `Theme : ${theme}\n` +
      `Axes : ${axes}\n` +
      `Duree cible : ${duree} s\n` +
      `Ton : \n\n` +
      `## Hook (0 - 1,5)\n\n` +
      `DIRE : \nFILMER : \nTEXTE : \n\n` +
      `## 1. (1,5 - 6)\n\n` +
      `DIRE : \nFILMER : \n\n` +
      `## CTA (${String(duree - 3).replace('.', ',')} - ${String(duree).replace('.', ',')})\n\n` +
      `DIRE : \nFILMER : \n`,
    'utf8',
  );
  console.log(`Squelette ecrit : projects/${slug}/script.md`);
  console.log('Remplis-le, ou demande le script a Claude : "ecris le script de ' + slug + '".');
  process.exit(0);
}

if (!fs.existsSync(fichier)) {
  console.error(`Pas de script.md dans projects/${slug}/`);
  console.error('');
  console.error("Demande le script a Claude (theme + axes), ou pars d'un squelette :");
  console.error(`  npm run script -- ${slug} --init --theme "..." --axes "..." --duree 25`);
  process.exit(1);
}

// --- Lecture ---------------------------------------------------------------

const script = lireScript(fs.readFileSync(fichier, 'utf8'));
const {meta, blocs} = script;

if (flag('json')) {
  console.log(JSON.stringify({...script, debit}, null, 2));
  process.exit(0);
}

if (!blocs.length) {
  console.error('Aucun bloc lisible. Un bloc s\'ecrit :');
  console.error('');
  console.error('  ## Hook (0 - 1,5)');
  console.error('');
  console.error('  DIRE : le texte prononce');
  console.error('  FILMER : le plan a tourner');
  process.exit(1);
}

const total = blocs[blocs.length - 1].end ?? 0;
const mots = blocs.reduce((n, b) => n + b.mots, 0);
const cible = dureeCible(meta);
const s = sec;
/** Une borne de bloc, affichee comme elle s'ecrit dans le fichier. */
const borne = (n) => (n === null ? '?' : String(n).replace('.', ','));

console.log('');
console.log(
  `projects/${slug}/script.md : ${blocs.length} blocs, ${s(total)}` +
    `${cible ? ` (cible ${cible}s)` : ''}, ${mots} mots soit ${s(mots / debit)} ` +
    `de parole a ${debit} mots/s.`,
);
console.log('');

const largeur = Math.max(...blocs.map((b) => b.titre.length));
for (const b of blocs) {
  const parle = estimerDuree(b.parle, debit);
  const marge = b.duree === null ? null : Math.round((b.duree - parle) * 10) / 10;
  const etat =
    b.duree === null
      ? 'bornes manquantes'
      : marge < 0
        ? `${s(-marge)} de trop`
        : `${s(marge)} de marge`;
  console.log(
    `  ${b.titre.padEnd(largeur)}  ` +
      `${borne(b.start).padStart(5)} > ${borne(b.end).padEnd(5)}  ` +
      `${String(b.mots).padStart(3)} mots  ${s(parle).padStart(6)}   ${etat}`,
  );
}

const avertissements = verifierScript(script, debit);
if (avertissements.length) {
  console.log('');
  for (const a of avertissements) console.log(`  ! ${a}`);
}

// --- Le tournage -----------------------------------------------------------

const plans = blocs.flatMap((b) => b.filmer.map((f) => ({titre: b.titre, f})));
if (plans.length) {
  console.log('');
  console.log(`A filmer (${plans.length} plans), a deposer dans projects/${slug}/media/ :`);
  console.log('');
  for (const p of plans) console.log(`  [ ] ${p.titre} : ${p.f}`);
}

const textes = blocs.flatMap((b) => b.texte);
if (textes.length) {
  console.log('');
  console.log(`Textes a incruster (${textes.length}) :`);
  console.log('');
  for (const t of textes) console.log(`  ${t}`);
}

console.log('');
console.log(
  avertissements.length
    ? `${avertissements.length} point(s) a corriger dans script.md avant de tourner.`
    : 'Script tenable. Tourne les plans, puis : npm run ingest -- ' + slug,
);
