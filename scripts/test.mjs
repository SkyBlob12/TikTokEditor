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
import {paginate, remapWords} from '../src/lib/captions.ts';
import {resolveAsset} from './_shared.mjs';

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
