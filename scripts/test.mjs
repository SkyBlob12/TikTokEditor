/**
 * Tests des fonctions qui décident du rendu.
 *
 *   npm test
 *
 * On ne teste pas le rendu lui-même (c'est le rôle de `npm run doctor --full`),
 * mais la logique pure qui a produit de vrais bugs : le recalage des
 * sous-titres sur un montage, le découpage en pages, la résolution des chemins.
 * Chaque cas ci-dessous correspond à un défaut rencontré en production.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyReplacements, paginate, remapWords} from '../src/lib/captions.ts';
import {
  SAFE_ZONE,
  clampBottom,
  clampCenterY,
  estimateLines,
  insetsOf,
  maxWidthAt,
  sideInset,
} from '../src/lib/safeZone.ts';
import {resolveAsset} from './_shared.mjs';
import {compterMots, lireScript, verifierScript} from './_script-md.mjs';

const mot = (text, startMs, endMs) => ({
  text,
  startMs,
  endMs,
  timestampMs: Math.round((startMs + endMs) / 2),
  confidence: null,
});

const clip = (start, duration, trim, speed = 1) => ({
  src: 'media/rush.mp4',
  start,
  duration,
  trim,
  speed,
});

// --- remapWords ------------------------------------------------------------

test('sans syncTo, la transcription est laissée telle quelle', () => {
  assert.equal(remapWords([mot('bonjour', 0, 500)], [clip(0, 10, 0)], undefined), null);
});

test('syncTo qui ne correspond à aucun clip laisse la transcription intacte', () => {
  assert.equal(remapWords([mot('bonjour', 0, 500)], [clip(0, 10, 0)], 'media/autre.mp4'), null);
});

test('un mot est replacé sur la timeline du montage', () => {
  // Le clip prend la source à partir de 20s et la pose à 0s.
  const [w] = remapWords([mot('bonjour', 21000, 21500)], [clip(0, 5, 20)], 'media/rush.mp4');
  assert.equal(w.startMs, 1000);
  assert.equal(w.endMs, 1500);
});

test('un segment rejoué deux fois affiche ses sous-titres deux fois', () => {
  // Cas réel : un passage remonté en hook, puis rejoué à sa place.
  const mots = remapWords(
    [mot('coder', 21000, 21500)],
    [clip(0, 5, 20), clip(5, 5, 20)],
    'media/rush.mp4',
  );
  assert.equal(mots.length, 2);
  assert.deepEqual(
    mots.map((m) => m.startMs),
    [1000, 6000],
  );
});

test('les mots hors du montage sont écartés', () => {
  const mots = remapWords(
    [mot('gardé', 21000, 21500), mot('coupé', 40000, 40500)],
    [clip(0, 5, 20)],
    'media/rush.mp4',
  );
  assert.deepEqual(
    mots.map((m) => m.text),
    ['gardé'],
  );
});

test("un mot à cheval sur la coupe n'est gardé que du côté où on l'entend", () => {
  // Bug rencontré : un « le » dont 20 % dépassait s'affichait en entier alors
  // qu'il était prononcé après la coupe.
  const clips = [clip(0, 5, 20)]; // source 20s -> 25s
  const debordeUnPeu = mot('le', 24900, 25400); // 20 % avant la coupe
  const bienDedans = mot('mot', 24000, 24400);

  const mots = remapWords([debordeUnPeu, bienDedans], clips, 'media/rush.mp4');
  assert.deepEqual(
    mots.map((m) => m.text),
    ['mot'],
  );
});

test('un mot de durée nulle est conservé', () => {
  // Certaines API rendent des mots sans durée mesurable. La règle de
  // recouvrement les jetait tous, et des mots disparaissaient des sous-titres.
  const mots = remapWords([mot('et', 21000, 21000)], [clip(0, 5, 20)], 'media/rush.mp4');
  assert.equal(mots.length, 1);
  assert.equal(mots[0].startMs, 1000);
});

test('la vitesse comprime les timings', () => {
  const [w] = remapWords([mot('vite', 22000, 22500)], [clip(0, 5, 20, 2)], 'media/rush.mp4');
  assert.equal(w.startMs, 1000); // (22 - 20) / 2 = 1s
});

test('chaque mot sait de quel plan il vient', () => {
  const mots = remapWords(
    [mot('a', 21000, 21200), mot('b', 31000, 31200)],
    [clip(0, 5, 20), clip(5, 5, 30)],
    'media/rush.mp4',
  );
  assert.deepEqual(
    mots.map((m) => m.clip),
    [0, 1],
  );
});

// --- paginate --------------------------------------------------------------

test('une page ne dépasse pas le nombre de mots demandé', () => {
  const mots = [
    mot('un', 0, 200),
    mot('deux', 200, 400),
    mot('trois', 400, 600),
    mot('quatre', 600, 800),
  ];
  const pages = paginate(mots, {wordsPerPage: 3});
  assert.deepEqual(
    pages.map((p) => p.tokens.length),
    [3, 1],
  );
});

test('une page ne peut jamais enjamber une coupe', () => {
  // Bug rencontré : un mot d'après la coupe s'affichait avant elle.
  const mots = [
    {...mot('avant', 0, 200), clip: 0},
    {...mot('apres', 200, 400), clip: 1},
    {...mot('suite', 400, 600), clip: 1},
  ];
  const pages = paginate(mots, {wordsPerPage: 3});
  assert.equal(pages.length, 2);
  assert.deepEqual(pages[0].tokens.map((t) => t.text), ['avant']);
  assert.deepEqual(pages[1].tokens.map((t) => t.text), ['apres', 'suite']);
});

test('un silence coupe la page', () => {
  const mots = [mot('un', 0, 200), mot('deux', 2000, 2200)];
  const pages = paginate(mots, {wordsPerPage: 5});
  assert.equal(pages.length, 2);
});

test('une fin de phrase coupe la page', () => {
  const mots = [mot('fini.', 0, 200), mot('suite', 210, 400)];
  const pages = paginate(mots, {wordsPerPage: 5});
  assert.equal(pages.length, 2);
});

test('les mots vides sont ignorés', () => {
  const pages = paginate([mot('  ', 0, 100), mot('vrai', 100, 300)], {wordsPerPage: 3});
  assert.equal(pages.length, 1);
  assert.deepEqual(pages[0].tokens.map((t) => t.text), ['vrai']);
});

test('le décalage global déplace toute la page', () => {
  const pages = paginate([mot('un', 1000, 1200)], {wordsPerPage: 3, offsetMs: 120});
  assert.equal(pages[0].startMs, 1120);
});

test('une page ne déborde pas sur la suivante', () => {
  const pages = paginate([mot('un', 0, 200), mot('deux', 900, 1100)], {wordsPerPage: 1});
  assert.ok(pages[0].endMs <= pages[1].startMs);
});

// --- résolution des chemins ------------------------------------------------

test('un chemin de projet reste dans le projet', () => {
  const p = resolveAsset('mon-projet', 'media/rush.mp4');
  assert.ok(p.includes('mon-projet'));
  assert.ok(!p.includes('_library'));
});

test('un chemin library pointe sur la bibliothèque partagée', () => {
  const p = resolveAsset('mon-projet', 'library/sfx/whoosh.wav');
  assert.ok(p.includes('_library'));
  assert.ok(!p.includes('mon-projet'));
});

test('un slash initial ne change rien', () => {
  assert.equal(
    resolveAsset('p', '/media/a.mp4'),
    resolveAsset('p', 'media/a.mp4'),
  );
});

// --- zone sure -------------------------------------------------------------

const insets = insetsOf(SAFE_ZONE, 1080, 1920);

test('les marges de la zone sure sont celles de la maquette TikTok', () => {
  assert.deepEqual(insets, {top: 130, bottom: 320, left: 60, right: 120});
});

test('la marge latérale est symétrique, donc la plus grande des deux', () => {
  assert.equal(sideInset(insets), 120);
});

test('un bloc centré ne peut pas passer sous la colonne de boutons', () => {
  // 1080 - 2 x 120 : la colonne de droite dicte la largeur d'un bloc centré.
  assert.equal(maxWidthAt(540, insets, 1080), 840);
});

test('un bloc décalé à gauche est borné par le bord gauche', () => {
  assert.equal(maxWidthAt(200, insets, 1080), 280);
});

test('un sous-titre trop bas remonte au ras de la légende', () => {
  // y = 0.90 avec une ligne de 85 px : le bord bas tomberait à 1770 px.
  assert.equal(clampBottom(0.9 * 1920 + 42.5, 85, insets, 1920), 1600);
});

test('un sous-titre dans la zone sure ne bouge pas', () => {
  const bas = 0.72 * 1920 + 42.5;
  assert.equal(clampBottom(bas, 85, insets, 1920), bas);
});

test('un overlay posé sous la légende remonte de sa demi-hauteur', () => {
  assert.equal(clampCenterY(1800, 100, insets, 1920), 1500);
});

test("un overlay plus haut que la zone sure est centré dedans, pas coupé", () => {
  assert.equal(clampCenterY(200, 1000, insets, 1920), 865);
});

test('un texte court tient sur une ligne', () => {
  assert.equal(estimateLines('COMME CA', 96, 840, true), 1);
});

test('un texte long est estimé sur plusieurs lignes', () => {
  assert.ok(estimateLines('A'.repeat(60), 96, 840, true) >= 4);
});

test('un retour à la ligne explicite compte comme une ligne', () => {
  assert.equal(estimateLines('un\ndeux', 58, 840), 2);
});

// --- corrections de lexique ------------------------------------------------

test('une correction remplace le mot, casse ignorée', () => {
  const [w] = applyReplacements([mot('odissey', 0, 500)], {Odissey: 'Odyssa'});
  assert.equal(w.text, 'Odyssa');
});

test('la ponctuation finale survit à la correction', () => {
  // paginate coupe une page sur un point : le perdre collerait deux phrases.
  const [w] = applyReplacements([mot('odissey.', 0, 500)], {odissey: 'Odyssa'});
  assert.equal(w.text, 'Odyssa.');
});

test('une clé en deux mots fusionne deux mots consécutifs', () => {
  // Whisper ecrit "on boarding" : aucun mot seul ne peut etre corrige.
  const out = applyReplacements(
    [mot('des', 0, 200), mot('on', 200, 400), mot('boarding', 400, 900)],
    {'on boarding': 'onboarding'},
  );
  assert.equal(out.length, 2);
  assert.equal(out[1].text, 'onboarding');
  assert.equal(out[1].startMs, 200);
  assert.equal(out[1].endMs, 900);
});

test('un mot isolé de la clé multiple reste intact', () => {
  const out = applyReplacements([mot('on', 0, 200), mot('voit', 200, 400)], {
    'on boarding': 'onboarding',
  });
  assert.deepEqual(out.map((w) => w.text), ['on', 'voit']);
});

test('une valeur en plusieurs mots redevient plusieurs mots', () => {
  // "si j'ai toujours envie" entendu pour "si je suis toujours en vie".
  const out = applyReplacements(
    [mot('si', 0, 100), mot("j'ai", 100, 300), mot('envie.', 300, 700)],
    {"j'ai": 'je suis', envie: 'en vie'},
  );
  assert.deepEqual(out.map((w) => w.text), ['si', 'je', 'suis', 'en', 'vie.']);
  assert.equal(out[1].startMs, 100);
  assert.equal(out[2].endMs, 300);
  assert.equal(out[3].startMs, 300);
  assert.equal(out[4].endMs, 700);
});

test('sans corrections, la liste est rendue telle quelle', () => {
  const mots = [mot('bonjour', 0, 500)];
  assert.equal(applyReplacements(mots, undefined), mots);
});

// --- script.md -------------------------------------------------------------

const SCRIPT = `# demo

Theme : un theme
Duree cible : 6 s

## Hook (0 - 2)

DIRE : Six mots pile dans ce hook.
FILMER : plan serre visage
TEXTE : SIX MOTS

## 1. Le corps (2 - 6)

DIRE : Treize mots ici, ce qui laisse
DIRE : de la marge pour respirer un peu.
FILMER : plan large
TEXTE : -
`;

const BAVARD = `## Hook (0 - 2)

DIRE : ${'mot '.repeat(30)}
FILMER : plan serre
`;

const TROUE = `## Hook (0 - 2)

DIRE : six mots pile dans ce hook
FILMER : plan serre

## Fin (3 - 5)

DIRE : six mots pile dans ce bloc
FILMER : plan large
`;

test('un nombre en chiffres compte pour ce qu il se prononce', () => {
  // "900" se dit "neuf cents" : le compter pour un mot raccourcirait le script.
  assert.equal(compterMots('900 euros'), 3);
  assert.equal(compterMots('3 jours'), 2);
});

test('la ponctuation seule ne compte pas comme un mot', () => {
  assert.equal(compterMots('un , deux ...'), 2);
});

test('les bornes d un bloc se lisent avec une virgule décimale', () => {
  const {blocs} = lireScript('## Hook (0 - 1,4)');
  assert.equal(blocs[0].start, 0);
  assert.equal(blocs[0].end, 1.4);
  assert.equal(blocs[0].titre, 'Hook');
});

test('deux lignes DIRE se cumulent dans le même bloc', () => {
  const {blocs} = lireScript(SCRIPT);
  assert.equal(blocs[1].dire.length, 2);
  assert.equal(blocs[1].mots, 13);
});

test('une valeur "-" vaut rien plutôt que du texte vide', () => {
  const {blocs} = lireScript(SCRIPT);
  assert.deepEqual(blocs[1].texte, []);
});

test("l'en-tête est lu jusqu'au premier bloc", () => {
  const {meta} = lireScript(SCRIPT);
  assert.equal(meta['duree cible'], '6 s');
  assert.equal(meta.theme, 'un theme');
});

test('un script tenable ne déclenche aucun avertissement', () => {
  assert.deepEqual(verifierScript(lireScript(SCRIPT)), []);
});

test('un bloc trop bavard dit combien de mots couper', () => {
  // 30 mots dans 2 secondes : injouable, quel que soit le débit.
  const [premier] = verifierScript(lireScript(BAVARD));
  assert.match(premier, /Coupe environ 2[0-9] mots/);
});

test('un trou entre deux blocs est signalé, comme dans un plan', () => {
  assert.ok(verifierScript(lireScript(TROUE)).some((a) => /trou de 1s/.test(a)));
});

test('un script sans bloc lisible le dit au lieu de passer', () => {
  assert.match(verifierScript(lireScript('juste du texte'))[0], /Aucun bloc/);
});
