import {staticFile} from 'remotion';
import {planSchema, type Plan, type Word} from '../schema';

/**
 * Le dossier `projects/` sert de public dir (voir remotion.config.ts).
 *
 * Deux formes de chemin :
 *  - `media/rush.mp4`        -> le dossier du projet courant
 *  - `library/sfx/hit.wav`   -> la bibliotheque partagee, projects/_library/
 *
 * La bibliotheque evite de dupliquer bruitages, musiques et logos dans chaque
 * projet, tout en restant servie par Remotion puisqu'elle vit sous `projects/`.
 */
export const asset = (project: string, relativePath: string): string => {
  const clean = relativePath.replace(/^\.?\//, '');
  if (clean.startsWith('library/')) {
    return staticFile(`_library/${clean.slice('library/'.length)}`);
  }
  return staticFile(`${project}/${clean}`);
};

const fetchJson = async (url: string): Promise<unknown> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Impossible de lire ${url} (HTTP ${res.status})`);
  }
  return res.json();
};

/** Charge et valide `projects/<slug>/plan.json`. */
export const loadPlan = async (project: string): Promise<Plan> => {
  const raw = await fetchJson(asset(project, 'plan.json'));
  const parsed = planSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(racine)'} : ${i.message}`)
      .join('\n');
    throw new Error(`plan.json invalide pour "${project}" :\n${issues}`);
  }
  return parsed.data;
};

/** Charge la transcription mot a mot. Retourne [] si le fichier n'existe pas. */
export const loadWords = async (project: string, file: string): Promise<Word[]> => {
  try {
    const raw = (await fetchJson(asset(project, file))) as {captions?: Word[]} | Word[];
    const words = Array.isArray(raw) ? raw : (raw.captions ?? []);
    return words.filter((w) => typeof w?.text === 'string');
  } catch {
    return [];
  }
};

/** Duree totale du montage, en frames, pour une cadence donnee. */
export const planDurationInFrames = (plan: Plan, fps: number = plan.fps): number => {
  if (plan.duration) return Math.round(plan.duration * fps);

  const ends = [
    ...plan.clips.map((c) => c.start + c.duration),
    ...plan.overlays.map((o) => o.start + o.duration),
  ];
  const last = ends.length ? Math.max(...ends) : 5;
  return Math.max(1, Math.round(last * fps));
};
