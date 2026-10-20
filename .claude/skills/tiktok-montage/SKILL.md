---
name: tiktok-montage
description: Monter une video TikTok verticale a partir de rushes, en ecrivant un plan de montage plan.json rendu par Remotion. A utiliser des que l utilisateur demande de monter, remonter, recadrer, sous-titrer ou raccourcir une video pour TikTok, Reels ou Shorts dans ce projet.
---

# Monter une video TikTok

Tu ecris un **plan de montage** (`projects/<slug>/plan.json`). Remotion le rend.
Tu ne touches jamais aux fichiers video directement.

> Cette procedure est un fichier du depot, pas une regle gravee. Les seuils de
> montage plus bas viennent d'erreurs constatees a l'usage : ils sont a ajuster
> selon le format et le style de celui qui s'en sert.

## La procedure, dans l'ordre

### 1. Connaitre le materiau

```bash
npm run ingest -- <slug>
```

Puis **lis `projects/<slug>/media.json`**. Il donne pour chaque fichier : duree
reelle, dimensions, orientation, presence d'audio.

**Tu n'inventes jamais une duree.** Un `trim` + `duration x speed` qui depasse
la duree du fichier fait echouer la validation.

### 1 bis. Alleger les rushes lourds

Si `media.json` montre un rush au-dela de 1080x1920, en HEVC, ou a plus de
30 fps (typique d'une video de telephone) :

```bash
npm run proxy -- <slug>
```

Puis **pointe les clips sur `media/proxy/<nom>.mp4`**, pas sur l'original.

Sans ca le rendu casse : Remotion n'arrive pas a extraire une frame de 4K HEVC
dans le delai imparti. Ce n'est pas une perte de qualite, le proxy est deja a
la resolution de livraison.

### 2. Les sous-titres, si la video parle

```bash
npm run transcribe -- <slug> --openai   # ~0,006 $/min, la cle est dans .env
npm run transcribe -- <slug> --openai --audio media/proxy/<nom>.mp4 --out captions/<nom>.json
```

**Toujours `--openai`, jamais Whisper local** : consigne de l'utilisateur,
Whisper local prend une vingtaine de minutes pour deux minutes de rushes. Une
transcription par rush quand le montage en melange plusieurs. La verification
d'un bloc isole passe aussi par `--openai`.

Ca ecrit `captions.json`. Lis-le : c'est la verite du timing. Les mots te disent
ou sont les phrases, donc ou couper.

### 3. Ecrire le plan

S'il existe un `projects/<slug>/script.md` (ecrit par la skill
[tiktok-script](../tiktok-script/SKILL.md) avant le tournage), lis-le d'abord :
ses lignes `TEXTE` sont les overlays voulus, ses bornes de blocs donnent le
rythme vise, et ses lignes `DIRE` disent ce que la transcription devrait
contenir, donc comment orthographier les noms propres. Ce sont des intentions,
pas des timings : les vraies bornes viennent de `npm run cuts`.

Ecris `projects/<slug>/plan.json`. La grammaire complete et commentee est dans
[docs/PLAN.md](../../../docs/PLAN.md), et le schema qui fait autorite dans
[src/schema.ts](../../../src/schema.ts).

Les chemins commencant par `library/` pointent sur `projects/_library/`
(bruitages, musiques, logos partages). Tout le reste est relatif au projet.

Structure minimale :

```json
{
  "title": "...",
  "fps": 30, "width": 1080, "height": 1920,
  "clips": [
    {"src": "media/a.mp4", "start": 0, "duration": 2.4, "trim": 3.0,
     "zoom": {"from": 1.0, "to": 1.1}}
  ],
  "overlays": [
    {"type": "text", "text": "...", "preset": "hook",
     "start": 0.2, "duration": 2.0, "position": {"x": 0.5, "y": 0.26}}
  ],
  "captions": {"file": "captions.json", "enabled": true, "style": "karaoke"},
  "audio": {"music": "media/music.mp3", "musicVolume": 0.12, "duck": true}
}
```

Tout est en **secondes**. Les `src` sont relatifs au dossier du projet.

### 3 bis. Recaler les sous-titres si tu remontes la voix

`captions.json` porte les timings du **fichier source**. Des que tu coupes,
reordonnes ou accelere ce fichier, ces timings ne veulent plus rien dire sur la
timeline finale.

Quand la voix vient des clips eux-memes (talking head, vlog), ajoute :

```json
"captions": {"syncTo": "media/proxy/rush.mp4", ...}
```

Chaque mot est alors replace sur chaque extrait qui le contient. Un segment
rejoue deux fois voit ses sous-titres joues deux fois, c'est ce qui rend
possible un hook pris au milieu de la video.

**Ne mets pas `syncTo`** quand la voix est un fichier audio joue en entier
(`audio.voice`) : la transcription est deja sur la bonne timeline.

La validation te previent dans les deux cas si tu te trompes.

### 3 ter. Placer les coupes sur le SIGNAL, pas sur la transcription

```bash
npm run cuts -- <slug>                 liste les silences
npm run cuts -- <slug> --around 12.05  point de coupe le plus proche
```

**Les bornes de mots d'une transcription ne disent pas ou couper.** Elles sont
contigues (la fin d'un mot = le debut du suivant) et le modele les fait deriver
de plusieurs centaines de millisecondes. Couper dessus donne exactement ce que
l'oreille rejette : une derniere syllabe tranchee, ou un long silence mort avant
le plan suivant.

Regle : **toute borne de clip tombe au milieu d'un silence detecte.** Si
`npm run cuts` ne montre aucun silence la ou tu voulais couper, c'est que la
phrase enchaine, et il ne faut pas couper la.

Et avant de livrer, verifie ce que contient vraiment chaque bloc : transcris le
segment isole plutot que de deduire son contenu des timings.

### 4. Valider, toujours, avant de dire que c'est fait

```bash
npm run validate -- <slug>
```

Zero erreur, sinon tu corriges le plan. Les avertissements (ecran noir, zone
masquee par l'UI TikTok) se corrigent aussi, sauf raison explicite.

### 5. Rendre

```bash
npm run render -- <slug> --draft   # 540x960, 15 fps, quelques dizaines de secondes
npm run render -- <slug>           # la version livrable
```

Sort dans `exports/<slug>.brouillon.mp4`, puis `exports/<slug>.mp4`.

**Toute version intermediaire se rend en `--draft`.** On y juge le montage, pas
l'image : rythme, coupes, synchro des sous-titres. Le rendu pleine resolution ne
se lance qu'une fois, sur la version validee : en 60 fps il coute jusqu'a vingt
minutes.

Avant un rendu long, controle la mise en page sur quelques images fixes :
`npx remotion still TikTok sortie.png --frame=<n> --props='{"project":"<slug>"}'`.
Quelques secondes au lieu de plusieurs minutes. Ajoute `"safeZoneGuide":true`
aux props pour voir ou l'interface TikTok mord sur l'image.

---

## Les regles de montage qui ne se negocient pas

**Le hook tient dans la premiere seconde.** Premier clip = le plan le plus fort
du lot, pas une intro. Un overlay `preset: "hook"` demarre a `0.1`–`0.3` s.

**On coupe toutes les 1,5 a 3 secondes.** Un plan qui dure 5 s sans mouvement
perd l'audience. Si un rush est long et bon, decoupe-le en deux clips avec des
`trim` differents plutot que de laisser tourner.

**Chaque clip bouge.** Un `zoom` (Ken Burns) de 1.0 vers 1.08–1.15, ou l'inverse.
Alterne le sens d'un plan a l'autre : ca evite l'effet de derive.

**Pas de mouvement sur un plan fixe.** Le Ken Burns sur un talking head donne
le mal de mer. `zoom` avec `from` egal a `to` fige le cadrage. Le cadrage ne
change qu'AUX coupes, en alternant entre deux valeurs seulement : une regle
constante se lit comme un montage a deux cameras, une valeur differente a chaque
plan se lit comme un bug.

**Pas de trou noir.** `clips[n].start + duration` doit egaler
`clips[n+1].start`. La validation le signale.

**Zone sure verticale : y entre 0.15 et 0.78.** Plus bas, la legende et les
boutons TikTok recouvrent tout. Les sous-titres vivent a `y: 0.72`.

Le rendu ramene dans la zone sure ce qui en sort, et `npm run validate` le
signale. Un avertissement « sort de la zone sure » n'est pas cosmetique : il dit
que le plan et l'image ne disent plus la meme chose. Tu corriges la valeur dans
le plan, tu ne comptes pas sur le rattrapage. Les marges sont dans
`plan.safeZone`, a ne changer que pour une autre plateforme.

**Trois mots de sous-titre a la fois**, pas plus (`wordsPerPage: 3`). Au-dela on
lit au lieu de regarder.

**La musique reste sous la voix** : `musicVolume` entre `0.08` et `0.15`, et
`duck: true`. Si pas de voix off, on peut monter a `0.35`.

**Le CTA arrive a la fin, jamais avant**, et seulement si le brief le demande.

## Les transitions

`transitionIn` se joue au debut d'un clip. Doses :

| Type | Quand |
|---|---|
| `fade` 0.2–0.3 s | changement de lieu, respiration |
| `whip` 0.15–0.25 s | enchainement rapide, meme scene |
| `zoom-punch` 0.15–0.2 s | accent sur un mot fort |
| `slide-left` / `slide-right` | avant/apres, comparaison |
| aucune | par defaut, **le cut sec est la transition la plus efficace** |

Pas plus de deux ou trois transitions animees dans une video de 15 s.

## Les presets d'overlay

| Preset | Usage | Position typique |
|---|---|---|
| `hook` | l'accroche, gros texte contour noir | `y: 0.24` |
| `sticker` | commentaire, reaction, note manuscrite | `y: 0.40`, `rotate: -6` |
| `label` | contexte discret (lieu, date, prix) | `y: 0.16` |
| `cta` | appel a l'action final | `y: 0.50` |
| `plain` | texte libre | libre |

## Bruitages, effets, compteurs

**Bruitages** : `npm run sfx` liste la bibliotheque partagee
(`projects/_library/sfx/`) et donne l'**attaque** de chaque son. Un son se
declenche a `instant vise - attaque`, sinon son impact arrive en retard. On les
reference directement : `"src": "library/sfx/Fast Whoosh.wav"`.
Trois ou quatre maximum, volume entre 0.3 et 0.6.

**Effets** : `pulse`, `shake`, `flash`. `intensity` **jamais au-dessus de
0.45**. On les pose sur les coupes et sur les mots forts, pas ailleurs.

**Compteur** : `type: "counter"` pour un chiffre annonce a l'oral. Il doit
atteindre sa valeur pile quand le chiffre est prononce :
`start = instant du mot - countDuration`.

Chacun de ces trois elements doit avoir une raison d'etre la. Un effet pose
« pour faire joli » se voit, et se lit comme un bug.

## Ce que tu ne fais pas

- Tu ne changes pas le format : toujours 1080x1920, 60 fps a l'export final,
  meme quand les rushes sont en 30 fps.
- Tu n'ajoutes pas d'emoji dans les sous-titres burn-in.
- Tu n'ecris pas de tiret cadratin, ni dans un texte incruste ni ailleurs.
- Tu ne mets pas de texte sous `y: 0.78`.
- Tu ne livres pas un rendu sans avoir lance `npm run validate`.
- Tu ne modifies pas les fichiers de `media/` : ce sont les rushes originaux.

## Quand quelque chose manque

S'il manque une musique, un rush, ou une transcription : dis-le et propose le
plan sans. Un plan qui rend, meme incomplet, vaut mieux qu'une question qui
bloque. Le champ `background` et `kind: "color"` permettent de tenir une place
en attendant le rush manquant.
