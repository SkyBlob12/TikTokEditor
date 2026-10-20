# Référence du plan de montage

`projects/<slug>/plan.json` décrit entièrement une vidéo. C'est le seul fichier
à modifier pour changer un montage.

**Deux règles valables partout :**

- Toutes les durées et positions sont en **secondes**, jamais en frames.
- Les chemins sont relatifs au dossier du projet (`media/rush.mp4`), sauf s'ils
  commencent par `library/`, qui pointe sur la bibliothèque partagée
  (`library/sfx/Hit 1.mp3`).

La source de vérité reste [`src/schema.ts`](../src/schema.ts), qui valide chaque
champ et documente les valeurs acceptées.

---

## Squelette

```json
{
  "title": "Ma vidéo",
  "fps": 30,
  "width": 1080,
  "height": 1920,
  "background": "#000000",
  "duration": 51.08,

  "clips": [],
  "overlays": [],
  "effects": [],
  "sfx": [],
  "captions": {},
  "audio": {},
  "progressBar": {},
  "safeZone": {}
}
```

`duration` force la durée totale. Sans elle, elle est calculée sur le dernier
élément.

---

## `clips` : les plans

```json
{
  "src": "media/proxy/rush.mp4",
  "start": 5.65,
  "duration": 12.05,
  "trim": 0,
  "speed": 1,
  "volume": 1,
  "fit": "cover",
  "zoom": {"from": 1.0, "to": 1.0},
  "transitionIn": {"type": "fade", "duration": 0.3}
}
```

| Champ | Rôle |
|---|---|
| `start` | position sur la timeline **finale** |
| `duration` | durée affichée |
| `trim` | point d'entrée **dans le fichier source** |
| `speed` | 1 = normal, 2 = deux fois plus rapide |
| `volume` | son du clip lui-même. `0` par défaut : mettre `1` pour un talking head |
| `fit` | `cover` (remplit) ou `contain` (letterbox) |
| `zoom` | Ken Burns. `from` égal à `to` fige le cadrage |
| `offset` | décalage `{x, y}` en fraction d'écran, pour recadrer |
| `flip` | miroir horizontal |
| `filter` | filtre CSS libre, ex. `"saturate(1.15)"` |
| `transitionIn` | comment le plan apparaît |
| `kind` | `video` (défaut), `image`, ou `color` |

**Le piège à connaître :** `trim + duration × speed` ne doit jamais dépasser la
durée du fichier source. `npm run validate` le vérifie et donne la durée
maximale possible.

### Transitions

`fade`, `whip`, `zoom-punch`, `slide-left`, `slide-right`, `slide-up`,
`slide-down`, `pop`, `none`.

Sur un plan fixe, **le cut sec est la transition la plus efficace**. Deux ou
trois transitions animées maximum sur une vidéo d'une minute.

---

## `overlays` : textes, images, compteurs

### Texte

```json
{
  "type": "text",
  "text": "CODER = 20%\nDU BOULOT",
  "preset": "hook",
  "start": 0.15,
  "duration": 2.9,
  "position": {"x": 0.5, "y": 0.2},
  "fontSize": 74,
  "animationIn": "pop",
  "animationOut": "fade"
}
```

| Preset | Usage | `y` typique |
|---|---|---|
| `hook` | l'accroche, gros texte contour noir | 0.20 |
| `sticker` | commentaire, réaction, chiffre | 0.21 |
| `label` | contexte discret (lieu, date, prix) | 0.16 |
| `cta` | appel à l'action, pastille blanche | 0.31 |
| `plain` | texte libre | libre |

`position` est en fraction d'écran : `0.5` = centre. **Reste entre 0.15 et
0.78 en vertical** : au-delà, l'interface TikTok recouvre le texte, et le rendu
ramène le bloc dans la [zone sûre](#safezone--les-marges-de-linterface). La
validation signale chaque overlay déplacé.

### Image

```json
{
  "type": "image",
  "src": "library/brand/logo.png",
  "start": 46.88,
  "duration": 4.2,
  "position": {"x": 0.5, "y": 0.18},
  "width": 0.3,
  "background": "#FFFFFF"
}
```

`width` est en fraction de la largeur d'écran. `background` pose l'image sur une
pastille arrondie : indispensable pour un logo monochrome, qui disparaîtrait
sinon sur un fond de la même valeur.

### Compteur animé

```json
{
  "type": "counter",
  "from": 0,
  "to": 400,
  "prefix": "+",
  "suffix": " utilisateurs",
  "countDuration": 1.1,
  "preset": "sticker",
  "start": 4.31,
  "duration": 3.2,
  "position": {"x": 0.6, "y": 0.21},
  "rotate": -5
}
```

Le compteur monte vite puis freine. **Cale `start` pour qu'il atteigne sa valeur
au moment exact où le chiffre est prononcé** :

```
start = instant du mot − countDuration
```

Une fois `countDuration` écoulée, il reste affiché à sa valeur finale jusqu'à la
fin de `duration`.

### Animations

`fade`, `pop`, `slide-up`, `slide-down`, `slide-left`, `slide-right`,
`zoom-punch`, `whip`, `none`.

---

## `effects` : effets de plan

```json
[
  {"type": "pulse", "start": 5.41, "duration": 0.28, "intensity": 0.35},
  {"type": "shake", "start": 25.29, "duration": 0.28, "intensity": 0.3},
  {"type": "flash", "start": 37.74, "duration": 0.12, "intensity": 0.2, "color": "#FFFFFF"}
]
```

| Type | Effet |
|---|---|
| `pulse` | coup de zoom bref |
| `shake` | secousse de l'image |
| `flash` | éclair de couleur par-dessus |

**`intensity` reste sous 0.45.** Sur un plan fixe, un effet qui se voit se lit
comme un bug. À `1`, la secousse ferait 14 px sur 1080 de large et le zoom 4 %.
La validation avertit au-delà de 0.6.

Un effet se pose sur une coupe ou sur un mot fort, jamais « pour faire joli ».

---

## `sfx` : bruitages

```json
[
  {"src": "library/sfx/Fast Whoosh.wav", "at": 25.10, "volume": 0.45, "duration": 1.0}
]
```

| Champ | Rôle |
|---|---|
| `at` | déclenchement sur la timeline **finale** |
| `volume` | 0.3 à 0.6. Un bruitage plus fort que la voix sonne amateur |
| `trim` | point d'entrée dans le fichier son |
| `duration` | coupe le son au bout de N secondes |

**Le décalage d'attaque.** Un whoosh monte avant d'exploser. Déclenché pile sur
la coupe, son impact arrive en retard et s'entend. `npm run sfx` mesure l'attaque
de chaque fichier :

```
  Fast Whoosh.wav        0.80s    +0.19s
```

Pour frapper sur une coupe à 25.29 s, on déclenche à `25.29 − 0.19 = 25.10`.

Trois ou quatre bruitages maximum sur une vidéo d'une minute.

---

## `captions` : les sous-titres

```json
{
  "file": "captions.json",
  "enabled": true,
  "style": "karaoke",
  "font": "montserrat",
  "fontSize": 74,
  "y": 0.72,
  "color": "#FFFFFF",
  "highlight": "#FFE100",
  "wordsPerPage": 3,
  "uppercase": true,
  "offset": 0,
  "syncTo": "media/proxy/rush.mp4",
  "replace": {"Odissey": "Odyssey"}
}
```

| Style | Rendu |
|---|---|
| `karaoke` | contour noir épais, mot actif en couleur |
| `boxed` | fond noir, mot actif surligné |
| `clean` | blanc sobre, sans surbrillance |
| `punch` | mot actif agrandi |

Polices : `montserrat` (900), `anton`, `bebas`.

**`syncTo` est le champ qui compte.** `captions.json` porte les timings du
fichier source. Dès qu'on remonte ce fichier, ils sont faux. `syncTo` désigne le
média transcrit : chaque mot est alors reprojeté sur chaque extrait qui le
contient, donc un segment rejoué en hook voit ses sous-titres joués deux fois.

À laisser vide quand la voix est un `audio.voice` joué en entier.

**`sources` remplace `file` et `syncTo` quand la voix vient de plusieurs
prises.** Un montage face caméra enchaîne souvent des extraits de rushes
différents : chacun a sa transcription, avec ses propres timings, et il n'existe
aucune timeline commune à recaler. On les déclare une par une, et chaque groupe
de mots est reprojeté sur les extraits de *son* fichier.

```json
"captions": {
  "sources": [
    {"file": "captions/prise-1.json", "syncTo": "media/proxy/prise-1.mp4"},
    {"file": "captions/prise-2.json", "syncTo": "media/proxy/prise-2.mp4"}
  ]
}
```

Une transcription par prise s'obtient avec l'option `--out` :

```bash
npm run transcribe -- <slug> --openai --audio media/proxy/prise-1.mp4 --out captions/prise-1.json
```

`npm run validate` signale un rush dont on entend la voix mais qui n'a pas de
transcription déclarée : ses extraits passeraient sans sous-titres.

**`replace`** corrige les noms propres écrits au son par le modèle de
transcription. La correction s'applique au rendu, donc elle survit à une
re-transcription. La comparaison ignore la casse et la ponctuation.

Une clé en **plusieurs mots** fusionne les mots consécutifs correspondants en un
seul. C'est le seul moyen de réparer un mot composé que le modèle a coupé en
deux, cas fréquent sur le vocabulaire technique :

```json
"replace": {"on boarding": "onboarding", "Odissey": "Odyssa"}
```

À l'inverse, une **valeur** en plusieurs mots redonne plusieurs mots karaoké :
la durée du groupe remplacé se partage entre eux au prorata de leur longueur.
C'est ce qui corrige une phrase mal entendue sans qu'elle s'allume d'un bloc :

```json
"replace": {"si j'ai toujours envie": "si je suis toujours en vie"}
```

**`y` positionne la dernière ligne, pas le centre du bloc.** Les sous-titres
sont ancrés par le bas : une page qui passe sur deux lignes monte, au lieu de
descendre sous la légende TikTok. Ce bord bas ne franchit jamais la
[zone sûre](#safezone--les-marges-de-linterface), quelle que soit la valeur
écrite ici.

---

## `audio` : voix et musique

```json
{
  "voice": "media/voix.mp3",
  "voiceVolume": 1,
  "music": "library/music/fond.mp3",
  "musicVolume": 0.12,
  "musicTrim": 0,
  "musicFadeOut": 0.8,
  "duck": true
}
```

`duck: true` baisse automatiquement la musique quand la voix parle, en se basant
sur les timings de `captions.json`.

`musicVolume` entre 0.08 et 0.15 avec une voix off, jusqu'à 0.35 sans.

**Quand la voix vient des clips eux-mêmes** (talking head), on ne renseigne pas
`audio.voice` : on met `volume: 1` sur les clips.

---

## `progressBar`

```json
{"enabled": true, "color": "#FFFFFF", "height": 6}
```

Barre fine qui se remplit sur la durée. Signal de rétention : le spectateur
voit qu'il approche de la fin.

Elle se pose sur le bord bas de la zone sûre, pas sur le bord de l'image : tout
en bas, la barre de navigation de l'application la recouvre entièrement.

---

## `safeZone` : les marges de l'interface

```json
{"top": 130, "bottom": 320, "left": 60, "right": 120}
```

TikTok pose son interface **par-dessus** la vidéo : la barre
« Abonnements | Pour toi » en haut, la colonne like / commentaire / partage à
droite, la légende et le nom de compte en bas. Ce qui est rendu dessous existe
dans le fichier mais reste invisible dans l'application.

Ces marges sont en pixels, sur la base 1080 × 1920. Elles sont appliquées **au
rendu** : sous-titres et overlays sont ramenés à l'intérieur, et leur largeur
maximale en découle. Un bloc centré ne dépasse donc jamais 840 px de large
(1080 moins deux fois 120, la marge de la colonne de boutons, prise des deux
côtés pour que le texte reste centré).

Ce champ n'existe que pour changer de plateforme, Reels et Shorts n'ayant pas
les mêmes marges. Sur TikTok, on n'y touche pas.

Pour voir ces repères sur un montage :

```bash
npm run studio -- --props='{"project":"mon-projet","safeZoneGuide":true}'
```

Le trait plein est la zone sûre, le pointillé la marge latérale réellement
appliquée aux sous-titres. Ne jamais laisser `safeZoneGuide` à `true` dans un
rendu livré.
