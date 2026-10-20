# CLAUDE.md

Règles permanentes de ce dépôt, lues par Claude Code à chaque session.

**Ce fichier t'appartient.** Il encode des choix de montage et de code qui
peuvent ne pas être les tiens. Modifie-le : c'est le moyen le plus direct de
changer la façon dont Claude travaille sur tes vidéos.

## Ce que fait cet outil

Un montage vidéo se décrit ici comme **un fichier JSON**, pas comme une suite de
manipulations. `projects/<slug>/plan.json` décrit les plans, les textes, les
sous-titres, les effets et le son ; Remotion le rend en 1080 × 1920.

Conséquence directe : **modifier un montage revient à éditer un fichier texte.**
Pas de timeline à la souris, pas d'export à refaire à la main. C'est ce qui rend
le montage automatisable.

## Où sont les choses

| Chemin | Contenu |
|---|---|
| `projects/<slug>/brief.md` | L'intention : hook, promesse, contraintes |
| `projects/<slug>/script.md` | Le texte à dire et les plans à filmer, avant tournage |
| `projects/<slug>/media/` | Les rushes originaux, **jamais modifiés** |
| `projects/<slug>/media/proxy/` | Versions allégées (`npm run proxy`) |
| `projects/<slug>/media.json` | Généré par `npm run ingest` : durées réelles |
| `projects/<slug>/captions.json` | Généré par `npm run transcribe` : mots et timings |
| `projects/<slug>/plan.json` | **Le montage** |
| `projects/_library/` | Assets partagés : `sfx/`, `music/`, `brand/` |
| `exports/<slug>.mp4` | Le rendu livré |
| `src/schema.ts` | La grammaire du plan, qui fait autorité |
| `src/components/` | Les composants Remotion |
| `docs/` | Référence, méthode, dépannage |

**Rien de généré ne sort de `projects/<slug>/` ou de `exports/`.**

Dans un plan, un chemin qui commence par `library/` pointe sur
`projects/_library/`. Tout le reste est relatif au dossier du projet.

## Pour écrire un script, quand il n'y a pas encore d'idée

Donne un thème et des axes, et le script s'écrit tout seul : suis la skill
[tiktok-script](.claude/skills/tiktok-script/SKILL.md). Elle propose **trois
angles**, tu en choisis un, elle écrit `projects/<slug>/script.md` : le texte à
dire bloc par bloc, et le plan à filmer en face de chacun. La grammaire du
fichier est dans [docs/SCRIPT.md](docs/SCRIPT.md).

`npm run script -- <slug>` compte les mots et dit lesquels ne tiendront pas dans
le temps annoncé. C'est le `validate` de l'étape d'écriture.

## Pour monter une vidéo

Suis la skill [tiktok-montage](.claude/skills/tiktok-montage/SKILL.md). La
méthode est détaillée dans [docs/MONTAGE.md](docs/MONTAGE.md), la grammaire du
plan dans [docs/PLAN.md](docs/PLAN.md).

## Les règles de travail

**Lis `media.json` avant d'écrire un plan.** Les durées inventées sont la
première cause d'échec.

**Place les coupes avec `npm run cuts`, jamais sur les bornes de mots de la
transcription.** Elles sont contiguës et dérivent de plusieurs centaines de
millisecondes. Toute borne de clip doit tomber dans un silence mesuré.

**Les sous-titres se transcrivent avec OpenAI, jamais avec Whisper local.**
`npm run transcribe -- <slug> --openai`, une transcription par rush :
`--audio media/proxy/<nom>.mp4 --out captions/<nom>.json`. Whisper local est
trop lent (une vingtaine de minutes pour deux minutes de rushes). La clé est
dans `.env`. La vérification d'un bloc isolé passe aussi par `--openai`.

**Un rush 4K, HEVC, HDR ou 60 fps passe par `npm run proxy`** avant d'être
monté, et le plan pointe sur `media/proxy/`. Sinon le rendu casse sur un délai
d'extraction de frame, et les couleurs sont fausses.

**`npm run validate -- <slug>` avant d'annoncer quoi que ce soit.** Un plan non
valide n'est pas un montage.

**Toute version intermédiaire se rend en brouillon.**
`npm run render -- <slug> --draft` sort un 540 × 960 à 15 fps en quelques
dizaines de secondes, là où le rendu livrable prend jusqu'à vingt minutes en
60 fps. On y juge le montage : rythme, coupes, synchro des sous-titres,
placement des textes. Le rendu pleine résolution ne se lance qu'une fois, sur la
version validée. **Le brouillon m'est livré** (chemin du fichier et frames
contrôlées) dès que le plan passe `validate`, avant toute autre étape : c'est
moi qui valide le montage, pas un rendu final lancé d'office.

**Vérifie le contenu d'un bloc en le transcrivant isolément**, plutôt que de le
déduire des timings.

**N'invente jamais un chiffre dans un script.** Un prix, une date, une
statistique que je n'ai pas donnée s'écrit `[à compléter : ...]` et se signale.
Un chiffre inventé finit incrusté à l'écran et dit face caméra.

**Un nouveau style visuel se code dans `src/components/`, pas dans le plan.** Le
plan décrit *quoi*, les composants décrivent *comment*. Si une demande ne peut
pas s'exprimer dans le schéma actuel, étends `src/schema.ts` et le composant
concerné, puis documente le champ dans `docs/PLAN.md`.

**Le format est figé : 1080 × 1920, H.264, 60 fps pour l'export final.**
`plan.fps` vaut 60, même quand les rushes sont en 30 fps. Le proxy garde la
cadence des rushes (`npm run proxy -- <slug> --fps 60`) : un rush en 30 fps
reste en 30, Remotion double ses images au rendu. Le brouillon, lui, reste en
15 fps. Pas d'autre variante sans demande explicite.

**Tout texte reste dans la zone sûre**, que l'interface TikTok recouvre : 130 px
en haut, 320 px en bas, 60 px à gauche, 120 px à droite (la colonne de boutons).
Le rendu y ramène ce qui dépasse et `npm run validate` le signale, mais un
avertissement veut dire que le plan ment sur ce qu'on verra : la valeur se
corrige dans le plan. Pour voir les repères :
`npm run studio -- --props='{"project":"<slug>","safeZoneGuide":true}'`.

**Pas de barre de progression.** `progressBar` reste absent des plans : je n'en
veux pas sur mes vidéos.

**Une image incrustée ne recouvre jamais le visage.** Affiche, capture, trace
Strava : elle se pose au-dessus de la tête (sur un plan face caméra, `y` entre
0.08 et 0.31 environ) ou sur le côté, quitte à réduire sa largeur. Elle peut
mordre sur les cheveux, pas sur les yeux ni la bouche. Se vérifie sur un
`npx remotion still` avant le rendu. Une image détourée (fond transparent, comme
une trace Strava) se pose telle quelle, sans `background` : sur une carte
blanche, la trace ne se voit plus.

**Une capture s'incruste en entier.** Un sticker Strava porte distance,
dénivelé, temps, trace et logo, en texte blanc sur fond transparent : sur un
aperçu à fond blanc, on ne voit que la trace. On l'inspecte sur fond sombre, et
un recadrage se calcule sur la transparence, jamais sur la couleur. Un chiffre
dit à l'oral qui contredit la capture ne s'affiche pas à côté d'elle.

**Pas de tiret cadratin** (,), ni dans les textes incrustés ni dans les fichiers
écrits. Convention de ce dépôt : une virgule, un point ou deux-points font le
travail. Change-la si elle ne te convient pas, ce fichier est à toi.

## Vérifier un rendu

Extraire des frames plutôt qu'ouvrir la vidéo :

```bash
ffmpeg -y -ss 1.2 -i exports/demo.mp4 -frames:v 1 -vf scale=405:-1 frame.png
```

Regarder au moins la première seconde (le hook), un plan du milieu, et la fin
(le CTA). Avant un rendu long, `npx remotion still` sur quelques frames coûte
quelques secondes au lieu de plusieurs minutes.
