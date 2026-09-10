/**
 * La zone sure TikTok.
 *
 * L'application pose son interface PAR-DESSUS la video : la barre
 * « Abonnements | Pour toi » en haut, la colonne like / commentaire / partage a
 * droite, la legende et le nom de compte en bas. Tout ce qui est rendu sous ces
 * elements existe dans le fichier mais reste invisible dans l'app.
 *
 * Les marges ci-dessous sont celles de la maquette officielle, en pixels sur
 * une base 1080 x 1920 :
 *
 *   haut    130 px   barre d'onglets
 *   bas     320 px   legende, @compte, titre du son
 *   gauche   60 px   marge laterale
 *   droite  120 px   colonne des boutons d'action
 *
 * Ces valeurs sont surchargeables par plan (`safeZone` dans plan.json), par
 * exemple pour un montage destine a Reels ou a Shorts.
 */

export type Insets = {top: number; bottom: number; left: number; right: number};

export const SAFE_ZONE: Insets = {top: 130, bottom: 320, left: 60, right: 120};

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1920;

/** Les marges mises a l'echelle de la composition. */
export const insetsOf = (zone: Insets, width: number, height: number): Insets => ({
  top: (zone.top / BASE_HEIGHT) * height,
  bottom: (zone.bottom / BASE_HEIGHT) * height,
  left: (zone.left / BASE_WIDTH) * width,
  right: (zone.right / BASE_WIDTH) * width,
});

/**
 * Marge laterale symetrique.
 *
 * Un bloc centre (sous-titres, texte) ne peut pas utiliser 60 px a gauche et
 * 120 px a droite sans se decaler visuellement du centre de l'image. On prend
 * donc la plus grande des deux, des deux cotes : le bloc reste centre ET dans
 * zone sure.
 */
export const sideInset = (i: Insets): number => Math.max(i.left, i.right);

/** Largeur maximale d'un bloc centre en `xPx` qui ne sort pas de la zone sure. */
export const maxWidthAt = (xPx: number, i: Insets, width: number): number =>
  Math.max(0, 2 * Math.min(xPx - i.left, width - i.right - xPx));

/**
 * Ramene le centre vertical d'un bloc dans la zone sure.
 *
 * `halfHeight` est la demi-hauteur connue du bloc : un texte plus haut que la
 * zone sure ne peut pas y tenir, on le centre alors dans la zone.
 */
export const clampCenterY = (
  yPx: number,
  halfHeight: number,
  i: Insets,
  height: number,
): number => {
  const min = i.top + halfHeight;
  const max = height - i.bottom - halfHeight;
  if (min > max) return (i.top + (height - i.bottom)) / 2;
  return Math.min(Math.max(yPx, min), max);
};

/**
 * Ramene le bord BAS d'un bloc dans la zone sure.
 *
 * Les sous-titres sont ancres par le bas : les lignes supplementaires montent
 * au lieu de descendre, donc seul le bord bas peut deborder. `minHeight` est la
 * hauteur d'une ligne, ce qui evite de coller le bloc au bord haut.
 */
export const clampBottom = (
  bottomPx: number,
  minHeight: number,
  i: Insets,
  height: number,
): number => {
  const floor = height - i.bottom;
  const ceiling = i.top + minHeight;
  if (ceiling > floor) return floor;
  return Math.min(Math.max(bottomPx, ceiling), floor);
};

/**
 * Nombre de lignes qu'occupera un texte, estime.
 *
 * On ne peut pas mesurer le texte pendant le rendu sans retarder la frame. Une
 * estimation suffit : elle ne sert qu'a savoir si un bloc risque de sortir de
 * la zone sure, et la marge d'erreur joue du bon cote (une ligne de trop remonte
 * legerement le bloc, ce qui ne casse rien).
 */
export const estimateLines = (
  text: string,
  fontSize: number,
  maxWidth: number,
  uppercase = false,
): number => {
  const charWidth = fontSize * (uppercase ? 0.62 : 0.55);
  const perLine = Math.max(1, Math.floor(maxWidth / charWidth));
  return text
    .split('\n')
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.trim().length / perLine)), 0);
};
