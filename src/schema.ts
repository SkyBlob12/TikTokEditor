import {z} from 'zod';

/**
 * Le plan de montage.
 *
 * Toutes les durees et positions sont en SECONDES (pas en frames) : c'est ce
 * format qui est ecrit a la main ou par Claude. La conversion en frames se fait
 * au rendu, dans les composants.
 *
 * Les chemins (`src`) sont relatifs au dossier du projet :
 *   projects/mon-projet/media/plan-1.mp4  ->  "media/plan-1.mp4"
 */

export const positionSchema = z.object({
  /** 0 = bord gauche, 1 = bord droit. 0.5 = centre. */
  x: z.number().min(-0.5).max(1.5).default(0.5),
  /** 0 = haut, 1 = bas. TikTok : garder entre 0.12 et 0.80 (UI par-dessus). */
  y: z.number().min(-0.5).max(1.5).default(0.5),
});

export const animationSchema = z.enum([
  'none',
  'fade',
  'pop',
  'slide-up',
  'slide-down',
  'slide-left',
  'slide-right',
  'zoom-punch',
  'whip',
]);

export const transitionSchema = z.object({
  type: animationSchema.default('fade'),
  /** Duree de la transition en secondes. 0.15 - 0.4 pour du TikTok. */
  duration: z.number().min(0).max(3).default(0.25),
});

export const clipSchema = z.object({
  /** Chemin relatif au dossier du projet. */
  src: z.string(),
  kind: z.enum(['video', 'image', 'color']).default('video'),
  /** Debut sur la timeline finale, en secondes. */
  start: z.number().min(0),
  /** Duree affichee sur la timeline finale, en secondes. */
  duration: z.number().min(0.05),
  /** Point d'entree DANS le fichier source, en secondes. */
  trim: z.number().min(0).default(0),
  /** 1 = vitesse normale, 2 = deux fois plus rapide. */
  speed: z.number().min(0.1).max(8).default(1),
  /** Volume du son du clip lui-meme. 0 par defaut (la voix off prime). */
  volume: z.number().min(0).max(1).default(0),
  fit: z.enum(['cover', 'contain']).default('cover'),
  /** Couleur de fond (utile en `contain` ou en kind:'color'). */
  color: z.string().default('#000000'),
  /** Ken Burns : zoom de `from` vers `to` sur la duree du clip. */
  zoom: z
    .object({from: z.number().default(1), to: z.number().default(1.08)})
    .optional(),
  /** Decalage horizontal / vertical en fraction de l'ecran (parallaxe, recadrage). */
  offset: z.object({x: z.number().default(0), y: z.number().default(0)}).optional(),
  rotate: z.number().default(0),
  /** Comment ce clip apparait. Se joue sur son propre debut. */
  transitionIn: transitionSchema.optional(),
  /** Miroir horizontal (utile quand on reutilise deux fois le meme rush). */
  flip: z.boolean().default(false),
  /** Filtre CSS libre, ex: "saturate(1.2) contrast(1.05)". */
  filter: z.string().optional(),
});

export const overlaySchema = z.object({
  type: z.enum(['text', 'image', 'counter']).default('text'),
  /** Pour type:'text'. */
  text: z.string().optional(),
  /** Pour type:'counter' : valeur de depart, generalement 0. */
  from: z.number().default(0),
  /** Pour type:'counter' : valeur d'arrivee. */
  to: z.number().optional(),
  /** Temps que met le compteur a monter, en secondes. Le reste du temps il reste affiche. */
  countDuration: z.number().min(0.1).max(10).default(1.2),
  /** Texte colle avant le nombre, ex: "+". */
  prefix: z.string().default(''),
  /** Texte colle apres le nombre, ex: " utilisateurs". */
  suffix: z.string().default(''),
  /** Pour type:'image', chemin relatif au projet. */
  src: z.string().optional(),
  start: z.number().min(0),
  duration: z.number().min(0.05),
  /** Style pret a l'emploi. */
  preset: z
    .enum(['hook', 'cta', 'sticker', 'label', 'plain'])
    .default('plain'),
  position: positionSchema.default({x: 0.5, y: 0.3}),
  /** Taille de police en px (base 1080x1920). Ignoré pour les images. */
  fontSize: z.number().min(8).max(400).optional(),
  /** Largeur de l'image en fraction de l'ecran (type:'image'). */
  width: z.number().min(0.02).max(2).default(0.5),
  color: z.string().optional(),
  background: z.string().optional(),
  font: z.enum(['montserrat', 'anton', 'bebas']).optional(),
  animationIn: animationSchema.default('pop'),
  animationOut: animationSchema.default('fade'),
  rotate: z.number().default(0),
});

export const effectSchema = z.object({
  /**
   * `shake` secoue l'image, `pulse` lui donne un coup de zoom bref,
   * `flash` pose un eclair de couleur par-dessus.
   */
  type: z.enum(['shake', 'pulse', 'flash']),
  start: z.number().min(0),
  duration: z.number().min(0.05).max(3).default(0.3),
  /** 0 = imperceptible, 1 = maximum. Au-dela de 0.6 ca devient voyant. */
  intensity: z.number().min(0).max(1).default(0.4),
  /** Couleur du flash. */
  color: z.string().default('#FFFFFF'),
});

export const sfxSchema = z.object({
  /** Chemin relatif au projet, ex: "media/sfx/whoosh.mp3". */
  src: z.string(),
  /** Instant du declenchement sur la timeline finale, en secondes. */
  at: z.number().min(0),
  volume: z.number().min(0).max(2).default(0.7),
  /** Point d'entree dans le fichier son, si son attaque est molle. */
  trim: z.number().min(0).default(0),
  /** Coupe le son au bout de N secondes. Sinon il joue jusqu'au bout. */
  duration: z.number().min(0.05).optional(),
});

export const captionsSchema = z.object({
  /** Fichier de transcription genere par `npm run transcribe`. */
  file: z.string().default('captions.json'),
  enabled: z.boolean().default(true),
  style: z.enum(['karaoke', 'boxed', 'clean', 'punch']).default('karaoke'),
  font: z.enum(['montserrat', 'anton', 'bebas']).default('montserrat'),
  fontSize: z.number().min(20).max(200).default(74),
  /** Position verticale, 0 = haut, 1 = bas. 0.72 = zone sure TikTok. */
  y: z.number().min(0).max(1).default(0.72),
  color: z.string().default('#FFFFFF'),
  /** Couleur du mot en cours (styles karaoke / punch). */
  highlight: z.string().default('#FFE100'),
  /** Nombre de mots max affiches en meme temps. */
  wordsPerPage: z.number().min(1).max(12).default(3),
  uppercase: z.boolean().default(true),
  /** Decalage global des sous-titres en secondes (+ = plus tard). */
  offset: z.number().default(0),
  /**
   * `src` du media sur lequel la transcription a ete faite.
   *
   * A renseigner des que ce media est remonte (coupe, reordonne, accelere) :
   * les timings de captions.json sont ceux du fichier source, pas ceux de la
   * timeline finale. Chaque mot est alors replace sur chaque extrait qui le
   * contient — un segment rejoue deux fois voit ses sous-titres joues deux fois.
   *
   * Laisser vide quand la voix est un fichier audio joue en entier.
   */
  syncTo: z.string().optional(),
  /**
   * Corrections de transcription, appliquees au rendu.
   *
   * Un modele de transcription ecrit les noms propres au son : « Odissey » pour
   * « Odyssey ». Corriger ici plutot que dans captions.json, qui est regenere a
   * chaque transcription. La comparaison ignore la casse et la ponctuation.
   */
  replace: z.record(z.string(), z.string()).optional(),
});

export const audioSchema = z.object({
  /** Voix off / audio principal. */
  voice: z.string().optional(),
  voiceVolume: z.number().min(0).max(2).default(1),
  music: z.string().optional(),
  musicVolume: z.number().min(0).max(2).default(0.12),
  /** Point d'entree dans le fichier musique, en secondes. */
  musicTrim: z.number().min(0).default(0),
  /** Fondu de sortie de la musique, en secondes. */
  musicFadeOut: z.number().min(0).default(0.8),
  /** Baisse la musique quand la voix parle. */
  duck: z.boolean().default(true),
});

export const planSchema = z.object({
  title: z.string().default('Sans titre'),
  fps: z.number().min(1).max(120).default(30),
  width: z.number().default(1080),
  height: z.number().default(1920),
  background: z.string().default('#000000'),
  /** Force la duree totale en secondes. Sinon calculee sur le dernier element. */
  duration: z.number().optional(),
  clips: z.array(clipSchema).default([]),
  overlays: z.array(overlaySchema).default([]),
  /** Effets ponctuels sur l'image. A poser sur les coupes ou les mots forts. */
  effects: z.array(effectSchema).default([]),
  /** Bruitages. Les fichiers vivent dans media/sfx/. */
  sfx: z.array(sfxSchema).default([]),
  captions: captionsSchema.optional(),
  audio: audioSchema.optional(),
  /** Barre de progression fine en bas de l'ecran (retention). */
  progressBar: z
    .object({
      enabled: z.boolean().default(false),
      color: z.string().default('#FFFFFF'),
      height: z.number().default(6),
    })
    .optional(),
});

export type Plan = z.infer<typeof planSchema>;
export type Clip = z.infer<typeof clipSchema>;
export type Overlay = z.infer<typeof overlaySchema>;
export type CaptionsConfig = z.infer<typeof captionsSchema>;
export type AudioConfig = z.infer<typeof audioSchema>;
export type Transition = z.infer<typeof transitionSchema>;
export type Effect = z.infer<typeof effectSchema>;
export type Sfx = z.infer<typeof sfxSchema>;
export type AnimationName = z.infer<typeof animationSchema>;

/** Un mot transcrit, au format @remotion/captions. */
export type Word = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number | null;
  confidence: number | null;
};
