# CLAUDE.md — TikTokEditor

Règles permanentes de ce projet.

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

**Un rush 4K, HEVC, HDR ou 60 fps passe par `npm run proxy`** avant d'être
monté, et le plan pointe sur `media/proxy/`. Sinon le rendu casse sur un délai
d'extraction de frame, et les couleurs sont fausses.

**`npm run validate -- <slug>` avant d'annoncer quoi que ce soit.** Un plan non
valide n'est pas un montage.

**Vérifie le contenu d'un bloc en le transcrivant isolément**, plutôt que de le
déduire des timings.

**Un nouveau style visuel se code dans `src/components/`, pas dans le plan.** Le
plan décrit *quoi*, les composants décrivent *comment*. Si une demande ne peut
pas s'exprimer dans le schéma actuel, étends `src/schema.ts` et le composant
concerné, puis documente le champ dans `docs/PLAN.md`.

**Le format est figé : 1080 × 1920, 30 fps, H.264.** Pas de variante sans
demande explicite.

**Pas de tiret cadratin**, ni dans les textes incrustés ni dans les fichiers
écrits.

## Vérifier un rendu

Extraire des frames plutôt qu'ouvrir la vidéo :

```bash
ffmpeg -y -ss 1.2 -i exports/demo.mp4 -frames:v 1 -vf scale=405:-1 frame.png
```

Regarder au moins la première seconde (le hook), un plan du milieu, et la fin
(le CTA). Avant un rendu long, `npx remotion still` sur quelques frames coûte
quelques secondes au lieu de plusieurs minutes.
