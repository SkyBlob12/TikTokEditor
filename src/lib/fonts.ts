import {loadFont as loadMontserrat} from '@remotion/google-fonts/Montserrat';
import {loadFont as loadAnton} from '@remotion/google-fonts/Anton';
import {loadFont as loadBebas} from '@remotion/google-fonts/BebasNeue';

const montserrat = loadMontserrat('normal', {weights: ['800', '900']});
const anton = loadAnton();
const bebas = loadBebas();

export type FontName = 'montserrat' | 'anton' | 'bebas';

/** Famille CSS + graisse a utiliser pour chaque police disponible. */
export const FONTS: Record<FontName, {fontFamily: string; fontWeight: number}> = {
  montserrat: {fontFamily: montserrat.fontFamily, fontWeight: 900},
  anton: {fontFamily: anton.fontFamily, fontWeight: 400},
  bebas: {fontFamily: bebas.fontFamily, fontWeight: 400},
};
