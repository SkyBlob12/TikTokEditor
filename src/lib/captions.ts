import type {Word} from '../schema';

export type Token = {text: string; fromMs: number; toMs: number};

/** Un mot, plus l'extrait d'ou il vient une fois le montage applique. */
export type TimedWord = Word & {clip?: number};
export type Page = {startMs: number; endMs: number; tokens: Token[]};

const SENTENCE_END = /[.!?…]$/;

/**
 * Regroupe les mots en "pages" de sous-titres.
 *
 * On coupe quand : la page est pleine, il y a un silence, ou la phrase se
 * termine. C'est plus previsible qu'un regroupement purement temporel — et
 * previsible, c'est ce qu'on veut quand un modele ecrit le plan.
 */
export const paginate = (
  words: TimedWord[],
  {
    wordsPerPage,
    silenceMs = 350,
    offsetMs = 0,
  }: {wordsPerPage: number; silenceMs?: number; offsetMs?: number},
): Page[] => {
  const pages: Page[] = [];
  let current: Token[] = [];
  let currentClip: number | undefined;

  const flush = () => {
    if (!current.length) return;
    pages.push({
      startMs: current[0].fromMs,
      endMs: current[current.length - 1].toMs,
      tokens: current,
    });
    current = [];
  };

  for (const word of words) {
    const text = word.text.trim();
    if (!text) continue;

    const token: Token = {
      text,
      fromMs: word.startMs + offsetMs,
      toMs: Math.max(word.endMs, word.startMs + 80) + offsetMs,
    };

    // Une page ne doit jamais enjamber un cut : sinon on affiche des mots qui
    // ne seront prononces qu'apres le plan suivant, et le sous-titre a l'air
    // d'avoir de l'avance sur l'image.
    if (current.length && word.clip !== currentClip) {
      flush();
    }

    const previous = current[current.length - 1];
    if (previous && token.fromMs - previous.toMs > silenceMs) {
      flush();
    }

    currentClip = word.clip;
    current.push(token);

    if (current.length >= wordsPerPage || SENTENCE_END.test(text)) {
      flush();
    }
  }

  flush();

  // Une page reste affichee jusqu'a la suivante (evite les trous d'une frame).
  return pages.map((page, i) => {
    const next = pages[i + 1];
    const naturalEnd = page.endMs + 220;
    return {
      ...page,
      endMs: next ? Math.min(naturalEnd, next.startMs) : naturalEnd,
    };
  });
};

const PONCTUATION_FINALE = /[.,!?;:…]+$/u;
const nu = (texte: string) => texte.trim().replace(PONCTUATION_FINALE, '').toLowerCase();

/**
 * Applique les corrections de lexique du plan (`captions.replace`).
 *
 * Une cle en plusieurs mots ("on boarding") fusionne les mots consecutifs
 * correspondants en un seul : un modele de transcription coupe regulierement un
 * mot compose, et il n'existe alors aucun mot unique a corriger. La comparaison
 * ignore la casse et la ponctuation, mais la ponctuation finale est conservee :
 * c'est elle qui dit a paginate ou se termine une phrase.
 */
export const applyReplacements = (
  words: TimedWord[],
  replace: Record<string, string> | undefined,
): TimedWord[] => {
  if (!replace) return words;

  // Les cles les plus longues d'abord : "on boarding" avant "boarding".
  const entries = Object.entries(replace)
    .map(([cle, valeur]) => ({tokens: cle.trim().split(/\s+/).map(nu), valeur}))
    .filter((e) => e.tokens.length > 0 && e.tokens[0] !== '')
    .sort((a, b) => b.tokens.length - a.tokens.length);

  const out: TimedWord[] = [];
  for (let i = 0; i < words.length; i += 1) {
    const match = entries.find((e) =>
      e.tokens.every((token, j) => words[i + j] && nu(words[i + j].text) === token),
    );
    if (!match) {
      out.push(words[i]);
      continue;
    }
    const dernier = words[i + match.tokens.length - 1];
    const finale = dernier.text.trim().match(PONCTUATION_FINALE)?.[0] ?? '';
    out.push({
      ...words[i],
      text: match.valeur + finale,
      endMs: dernier.endMs,
      timestampMs: dernier.timestampMs,
    });
    i += match.tokens.length - 1;
  }
  return out;
};

/**
 * Replace les mots de la transcription sur la timeline du montage.
 *
 * captions.json porte les timings du FICHIER SOURCE. Des qu'on coupe, reordonne
 * ou accelere ce fichier, ces timings ne veulent plus rien dire sur la timeline
 * finale. On projette donc chaque mot sur chaque extrait qui le contient :
 * un segment rejoue deux fois (un hook repris plus loin) voit naturellement ses
 * sous-titres apparaitre deux fois.
 *
 * Un mot n'est rattache a un extrait que si on l'y entend VRAIMENT : il faut
 * qu'au moins 60 % de sa duree tombe dans l'extrait. Sinon un mot dont la
 * premiere syllabe depasse a peine dans le plan precedent s'affiche en entier
 * alors qu'on ne l'entend pas encore.
 *
 * Retourne null si aucun extrait ne correspond a `syncTo` : dans ce cas la
 * transcription est deja sur la bonne timeline, on n'y touche pas.
 */
export const remapWords = (
  words: Word[],
  clips: {src: string; start: number; duration: number; trim: number; speed: number}[],
  syncTo: string | undefined,
): TimedWord[] | null => {
  if (!syncTo) return null;

  // On garde l'index du clip DANS LE PLAN, pas dans les extraits filtres :
  // c'est lui qui empeche une page de sous-titres d'enjamber une coupe, y
  // compris quand deux prises differentes se suivent.
  const windows = clips
    .map((clip, index) => ({clip, index}))
    .filter(({clip}) => clip.src === syncTo);
  if (!windows.length) return null;

  const out: TimedWord[] = [];

  for (const {clip, index} of windows) {
    const sourceStart = clip.trim * 1000;
    const sourceEnd = (clip.trim + clip.duration * clip.speed) * 1000;
    const timelineStart = clip.start * 1000;

    const toTimeline = (ms: number) =>
      timelineStart + (Math.min(Math.max(ms, sourceStart), sourceEnd) - sourceStart) / clip.speed;

    const MIN_OVERLAP = 0.6;

    for (const word of words) {
      const span = word.endMs - word.startMs;

      if (span <= 0) {
        // Certains modeles rendent des mots de duree nulle. Il n'y a rien a
        // recouvrir : on teste simplement si l'instant tombe dans l'extrait.
        if (word.startMs < sourceStart || word.startMs >= sourceEnd) continue;
      } else {
        const overlap =
          Math.min(word.endMs, sourceEnd) - Math.max(word.startMs, sourceStart);
        if (overlap / span < MIN_OVERLAP) continue;
      }

      out.push({
        ...word,
        clip: index,
        startMs: Math.round(toTimeline(word.startMs)),
        endMs: Math.round(toTimeline(word.endMs)),
        timestampMs: word.timestampMs === null ? null : Math.round(toTimeline(word.timestampMs)),
      });
    }
  }

  return out.sort((a, b) => a.startMs - b.startMs);
};
