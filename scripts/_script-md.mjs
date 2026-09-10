/**
 * Lecture de `projects/<slug>/script.md` : le texte a dire et les plans a
 * filmer, avant qu'il existe le moindre rush.
 *
 * Pourquoi un parseur plutot qu'un JSON de plus : un script s'ecrit et se
 * relit a voix haute. On garde du Markdown lisible, et on n'en extrait que ce
 * qui se verifie : les bornes de chaque bloc, et le nombre de mots dedans.
 *
 * La logique vit ici, separee du CLI, parce qu'elle est testee (npm test).
 */

/** Debit de parole vise sur un format court, en mots par seconde. */
export const DEBIT_DEFAUT = 3;

const nombre = (s) => Number(String(s).replace(',', '.'));

/** Les secondes s'ecrivent avec une virgule, comme partout ailleurs ici. */
export const sec = (n) => `${Number(n).toFixed(1).replace('.', ',')}s`;

/** Un bloc : `## Titre (0,0 - 1,4)`. Les bornes sont en secondes. */
const ENTETE = /^##\s+(.*?)(?:\s*\(\s*([\d.,]+)\s*(?:->|-|a)\s*([\d.,]+)\s*s?\s*\))?\s*$/;

/** Les lignes qu'on sait lire dans un bloc. Le reste est du commentaire. */
const ETIQUETTES = {DIRE: 'dire', FILMER: 'filmer', TEXTE: 'texte', SON: 'son'};
const LIGNE = /^\s*(DIRE|FILMER|TEXTE|SON)\s*:\s*(.*)$/i;

/** Meta de l'entete : `Duree cible : 24 s`, avant le premier bloc. */
const META = /^\s*([A-Za-zÀ-ÿ ]+?)\s*:\s*(.+)$/;

const cle = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');

/**
 * Compte les mots tels qu'ils se prononcent. Un nombre ecrit en chiffres se dit
 * en plusieurs mots ("400" = "quatre cents"), sinon un script plein de chiffres
 * parait deux fois plus court qu'il ne l'est.
 */
export const compterMots = (texte) =>
  String(texte)
    .split(/\s+/)
    .filter((t) => /[\p{L}\p{N}]/u.test(t))
    .reduce((n, token) => {
      const chiffres = token.replace(/\D/g, '');
      if (chiffres.length >= 2 && chiffres.length === token.replace(/[^\p{L}\p{N}]/gu, '').length) {
        return n + Math.max(1, Math.ceil(chiffres.length / 2));
      }
      return n + 1;
    }, 0);

/** Duree de parole estimee, en secondes. */
export const estimerDuree = (texte, debit = DEBIT_DEFAUT) =>
  Math.round((compterMots(texte) / debit) * 100) / 100;

/**
 * Transforme un script.md en {meta, blocs}. Ne juge rien : la verification est
 * le role de verifierScript().
 */
export const lireScript = (markdown) => {
  const lignes = String(markdown).split(/\r?\n/);
  const meta = {};
  const blocs = [];
  let bloc = null;
  let dansEntete = true;

  for (const ligne of lignes) {
    if (ligne.startsWith('# ') || !ligne.trim()) continue;

    const entete = ligne.match(ENTETE);
    if (entete && ligne.startsWith('##')) {
      dansEntete = false;
      bloc = {
        titre: entete[1].trim(),
        start: entete[2] === undefined ? null : nombre(entete[2]),
        end: entete[3] === undefined ? null : nombre(entete[3]),
        dire: [],
        filmer: [],
        texte: [],
        son: [],
      };
      blocs.push(bloc);
      continue;
    }

    const champ = ligne.match(LIGNE);
    if (champ && bloc) {
      const valeur = champ[2].trim();
      if (valeur && valeur !== '-') bloc[ETIQUETTES[champ[1].toUpperCase()]].push(valeur);
      continue;
    }

    if (dansEntete) {
      const m = ligne.match(META);
      if (m) meta[cle(m[1])] = m[2].trim();
    }
  }

  for (const b of blocs) {
    b.duree = b.start === null || b.end === null ? null : Math.round((b.end - b.start) * 100) / 100;
    b.parle = b.dire.join(' ');
    b.mots = compterMots(b.parle);
  }

  return {meta, blocs};
};

/** Duree cible declaree dans l'entete, en secondes, ou null. */
export const dureeCible = (meta) => {
  const brut = meta['duree cible'] ?? meta['duree'] ?? null;
  if (!brut) return null;
  const m = String(brut).match(/([\d.,]+)/);
  return m ? nombre(m[1]) : null;
};

/**
 * Les erreurs qu'un script generé fait vraiment : des blocs qui ne s'enchainent
 * pas, et surtout du texte qu'on ne peut pas dire dans le temps imparti.
 */
export const verifierScript = ({meta, blocs}, debit = DEBIT_DEFAUT) => {
  const avertissements = [];
  const nom = (b, i) => `Bloc ${i + 1} "${b.titre}"`;

  if (!blocs.length) return ['Aucun bloc "## Titre (debut - fin)" trouve.'];

  for (const [i, b] of blocs.entries()) {
    if (b.start === null || b.end === null) {
      avertissements.push(`${nom(b, i)} : pas de bornes. Ecris "## ${b.titre} (0 - 2,5)".`);
      continue;
    }
    if (b.duree <= 0) {
      avertissements.push(`${nom(b, i)} : dure ${sec(b.duree)}. La fin doit suivre le debut.`);
    }

    const parle = estimerDuree(b.parle, debit);
    if (b.mots && b.duree > 0) {
      if (parle > b.duree * 1.15) {
        const trop = Math.ceil((parle - b.duree) * debit);
        avertissements.push(
          `${nom(b, i)} : ${b.mots} mots, soit ${sec(parle)} a dire pour ` +
            `${sec(b.duree)} de bloc. Coupe environ ${trop} mots.`,
        );
      } else if (parle < b.duree * 0.55) {
        avertissements.push(
          `${nom(b, i)} : ${sec(parle)} de parole dans ${sec(b.duree)}. ` +
            `Soit tu ajoutes du texte, soit tu raccourcis le bloc.`,
        );
      }
    }

    if (!b.dire.length && !b.filmer.length) {
      avertissements.push(`${nom(b, i)} : ni DIRE ni FILMER, il ne decrit rien.`);
    } else if (!b.filmer.length) {
      avertissements.push(`${nom(b, i)} : pas de ligne FILMER, tu ne sauras pas quoi tourner.`);
    }

    const suivant = blocs[i + 1];
    if (suivant && suivant.start !== null && b.end !== null) {
      const trou = Math.round((suivant.start - b.end) * 100) / 100;
      if (trou !== 0) {
        avertissements.push(
          `${nom(b, i)} finit a ${b.end}s et le suivant demarre a ${suivant.start}s ` +
            `(${trou > 0 ? 'trou' : 'chevauchement'} de ${Math.abs(trou)}s).`,
        );
      }
    }
  }

  const premier = blocs[0];
  if (premier.start !== null && premier.start > 0.4) {
    avertissements.push(`Le script demarre a ${premier.start}s. Le hook commence a 0.`);
  }
  if (premier.duree !== null && premier.duree > 2) {
    avertissements.push(
      `Le hook dure ${sec(premier.duree)}. Au-dela de 2s l'audience est deja partie.`,
    );
  }

  const dernier = blocs[blocs.length - 1];
  const total = dernier.end ?? 0;
  const cible = dureeCible(meta);
  if (cible && Math.abs(total - cible) > Math.max(1, cible * 0.1)) {
    avertissements.push(
      `Le script fait ${sec(total)} pour une cible de ${cible}s.`,
    );
  }
  if (total > 60) {
    avertissements.push(`${Math.round(total)}s de script : au-dela de 60s la retention decroche.`);
  }

  const cadratin = blocs.some((b) => [...b.dire, ...b.texte].some((l) => l.includes('\u2014')));
  if (cadratin) avertissements.push('Tiret cadratin dans le texte. Convention du depot : virgule ou point.');

  return avertissements;
};
