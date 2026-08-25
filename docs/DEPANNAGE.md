# Dépannage

**Premier réflexe :**

```bash
npm run doctor
```

Il contrôle les prérequis et annonce chaque problème avec sa correction.
`npm run doctor -- --full` ajoute un rendu de bout en bout.

---

## Installation

### `ffprobe est introuvable`

FFmpeg n'est pas dans le PATH.

```bash
winget install Gyan.FFmpeg      # Windows
brew install ffmpeg             # macOS
sudo apt install ffmpeg         # Debian / Ubuntu
```

**Rouvre le terminal** après l'installation.

### Remotion se plaint d'une version de `zod`

Remotion impose une version exacte de zod. Le message donne celle attendue :

```bash
npx remotion versions          # voir ce qui ne colle pas
npm install zod@<version>      # sans accent circonflexe, version figée
```

---

## Rendu

### `A delayRender() ... was called but not cleared after 28000ms`

Le rush est trop lourd à décoder frame par frame. C'est le cas normal d'une
vidéo de téléphone : 4K, HEVC, 60 fps.

```bash
npm run proxy -- mon-projet
```

Puis pointer les clips du plan sur `media/proxy/<nom>.mp4`. Le délai est déjà
porté à 120 s dans `remotion.config.ts`, mais le proxy reste le vrai remède.

`npm run ingest` signale les rushes concernés avant que le problème arrive.

### `demande X s de "clip.mp4" qui n'en dure que Y`

`trim + duration × speed` dépasse la durée du fichier. La validation donne la
durée maximale possible pour ce clip.

### Un rendu échoue puis réussit à l'identique

Vu deux fois : un rendu lancé juste après un autre peut échouer au démarrage du
navigateur. Relancer suffit. Éviter d'enchaîner deux rendus en parallèle.

### Le rendu est lent

Pour itérer, ne rends pas en pleine qualité :

```bash
npm run render -- mon-projet --draft                  2,7x plus rapide
npm run render -- mon-projet --draft --from 20 --to 35
```

Pour le rendu final :

```bash
npm run render -- mon-projet --concurrency 4
```

Par défaut, la moitié des cœurs. Le rendu décode chaque frame du rush : un proxy
léger accélère plus que n'importe quel réglage.

### Le fichier de sortie est énorme

`--crf 21` est le défaut, calibré pour TikTok qui ré-encode de toute façon.
Descendre à 18 triple le poids pour une différence invisible après upload.

```bash
npm run render -- mon-projet --crf 23
```

---

## Image

### Les couleurs sont délavées, les tons chair verdâtres

Le rush est en HDR, Dolby Vision ou HLG, ce que filme un iPhone récent. Une
conversion sans tone mapping donne une image techniquement valide et
visuellement fausse.

```bash
npm run proxy -- mon-projet --force
```

Le proxy détecte le HDR et applique un vrai tone mapping vers SDR BT.709. Pour
vérifier :

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=color_transfer,color_primaries \
  -of default=nw=1 projects/mon-projet/media/proxy/rush.mp4
```

Doit répondre `bt709` sur les deux lignes.

### L'image bouge alors que la caméra était fixe

Un `zoom` avec `from` différent de `to` fait dériver le cadrage. Mettre les deux
à la même valeur.

### Les coupes ressemblent à des bugs

Trois causes possibles, souvent cumulées :

- trop de coupes (une toutes les 3 s sur un plan fixe) ;
- un cadrage différent à chaque plan au lieu d'alterner entre deux valeurs ;
- des coupes placées au milieu d'un mot. Voir `npm run cuts`.

---

## Son

### On n'entend pas la fin d'un mot avant une coupe

La coupe tombe dans la parole. Les bornes de mots d'une transcription ne disent
pas où est le silence.

```bash
npm run cuts -- mon-projet --around 12.05
```

Si aucun silence n'apparaît près de la cible, c'est que la phrase enchaîne : il
ne faut pas couper là.

### Un bruitage arrive en retard

Le son a une attaque : il monte avant de frapper. `npm run sfx` mesure ce délai.
Déclencher le son à `instant visé − attaque`.

### Un bruitage couvre la voix

`volume` entre 0.3 et 0.6. Sans musique de fond, les bruitages ressortent
davantage : viser bas.

---

## Sous-titres

### Ils sont décalés après un remontage

`captions.syncTo` n'est pas renseigné. Les timings sont ceux du fichier source,
pas de la timeline finale.

```json
"captions": {"syncTo": "media/proxy/rush.mp4"}
```

La validation prévient dans les deux sens : `syncTo` qui ne pointe sur aucun
clip, ou clips coupés sans `syncTo`.

### Ils sont légèrement en avance ou en retard partout

```json
"captions": {"offset": 0.12}
```

En secondes, positif pour retarder.

### Ils sont décalés par endroits seulement

C'est l'alignement du modèle de transcription qui dérive localement. Un `offset`
global n'y peut rien. Deux solutions :

```bash
npm run transcribe -- mon-projet --model large-v3   # local, plus lent
npm run transcribe -- mon-projet --openai           # API, mieux aligné
```

Pour mesurer objectivement la qualité d'alignement, comparer combien de mots
commencent à l'intérieur d'un silence détecté par `npm run cuts`.

### Un nom propre est mal orthographié

Le modèle l'écrit au son.

```json
"captions": {"replace": {"Odissey": "Odyssey"}}
```

La correction s'applique au rendu, donc elle survit à une re-transcription.

### Un mot s'affiche alors qu'on ne l'entend pas encore

Il chevauche une coupe. Le moteur n'affiche un mot que si 60 % de sa durée tombe
dans le plan, si le cas persiste, la borne du clip tombe en plein milieu du mot.
Voir `npm run cuts`.

---

## Transcription

### `Expand-Archive : Impossible de trouver un paramètre positionnel`

Whisper.cpp s'installe via PowerShell sans quoter ses chemins. Corrigé : le
script bascule sur un répertoire de travail sans espace. Si l'erreur revient,
c'est que `%TEMP%` contient un espace ; le script se rabat alors sur
`C:\remotion-whisper-tmp`.

### La transcription est très lente

`medium` tourne sur CPU : compter à peu près la durée de la vidéo.

```bash
npm run transcribe -- mon-projet --model small    # deux fois plus rapide
npm run transcribe -- mon-projet --openai         # quelques secondes
```

Le modèle n'est téléchargé qu'une fois, dans `~/.remotion-whisper`.

### `OPENAI_API_KEY absent de l'environnement`

Copier `.env.example` vers `.env` et y mettre la clé, ou l'exporter dans le
terminal.

---

## Studio

### Le Studio n'affiche pas mes modifications de `plan.json`

Le plan est lu au chargement de la composition. Cliquer sur rafraîchir dans le
Studio.

### Le Studio ouvre le mauvais projet

```bash
npm run studio -- --props='{"project":"mon-projet"}'
```
