import {Config} from '@remotion/cli/config';

/**
 * `projects/` sert de "public dir" : chaque dossier de projet y est servi tel
 * quel, donc `staticFile('mon-projet/media/plan-1.mp4')` fonctionne sans copier
 * les rushes ailleurs.
 */
Config.setPublicDir('./projects');

Config.setEntryPoint('./src/index.ts');
Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
Config.setCrf(21);
Config.setOverwriteOutput(true);

// Rendu GPU quand la machine le permet (Windows + carte dediee).
Config.setChromiumOpenGlRenderer('angle');

// Filet de securite : extraire une frame d'un rush lourd peut depasser les 30 s
// par defaut. Le vrai remede reste `npm run proxy`, ce delai evite juste que le
// rendu casse net au bout de 2 frames.
Config.setDelayRenderTimeoutInMilliseconds(120000);
