# Le script, quand il n'y a pas encore d'idée

Ce document décrit `projects/<slug>/script.md` : le fichier qui existe **avant
les rushes**. Il dit ce qu'il faut raconter et ce qu'il faut filmer. Le montage,
lui, est décrit dans [PLAN.md](PLAN.md) et [MONTAGE.md](MONTAGE.md).

La méthode d'écriture est dans
[la skill tiktok-script](../.claude/skills/tiktok-script/SKILL.md).

```
theme + axes  →  3 angles  →  script.md  →  tournage  →  ingest  →  plan.json
```

---

## Pourquoi un fichier de plus

Un script écrit hors tournage ment sur sa durée. Trente mots ne tiennent pas
dans cinq secondes, et on ne s'en aperçoit qu'une fois la caméra allumée, ou
pire, au montage, quand il faut couper une idée sur deux.

`npm run script -- <slug>` compte les mots, les convertit en secondes de parole
et les confronte aux bornes annoncées. C'est le même principe que
`npm run validate` sur un plan : vérifier avant de payer.

---

## La forme

```markdown
# lisbonne-budget

Theme : trois jours à Lisbonne à moins de 200 euros
Axes : transport, logement, où manger
Duree cible : 24 s
Ton : direct, première personne

## Hook (0 - 2)

DIRE : Lisbonne, trois jours, 180 euros.
FILMER : plan serré visage, rue en pente derrière, regard caméra
TEXTE : 180 EUROS, 3 JOURS

## 1. Le transport (2 - 8)

DIRE : Le tram 28 coûte 3 euros, le taxi pour le même trajet en coûte 12.
FILMER : intérieur du tram 28, plan à hauteur d'épaule

## CTA (20 - 24)

DIRE : Enregistre, tu en auras besoin avant ton prochain week-end.
FILMER : plan serré visage, sourire
```

**L'en-tête** : des lignes `Clé : valeur` avant le premier bloc. Seule
`Duree cible` est lue par l'outil, le reste sert à la relecture.

**Un bloc** : un titre `##` suivi de ses bornes en secondes, `(début - fin)`.
Point ou virgule décimale, les deux se lisent.

**Les lignes d'un bloc**, dans n'importe quel ordre :

| Étiquette | Rôle | Lu par l'outil |
|---|---|---|
| `DIRE` | le texte prononcé, mot pour mot | oui, c'est ce qui est chronométré |
| `FILMER` | le plan à tourner | oui, sort en liste de tournage |
| `TEXTE` | ce qui s'incruste à l'écran | oui, listé à part |
| `SON` | une intention sonore | affiché seulement |

Une étiquette peut se répéter dans un bloc. Une valeur `-` vaut « rien ici ».
Tout le reste est du commentaire libre : l'outil l'ignore.

---

## Ce que la commande vérifie

```bash
npm run script -- lisbonne-budget
npm run script -- lisbonne-budget --debit 2.6   # parole plus posée
npm run script -- lisbonne-budget --json        # pour enchaîner sur le plan
```

- **Le texte tient dans le bloc.** Au-delà de 15 % de dépassement, la commande
  dit combien de mots couper. En dessous de 55 % de remplissage, elle signale le
  vide : soit il manque du texte, soit le bloc est trop long.
- **Les blocs s'enchaînent.** Un trou ou un chevauchement est signalé, comme
  pour les clips d'un plan.
- **Le hook démarre à 0 et dure moins de 2 s.**
- **Le total colle à la durée cible**, à 10 % près.
- **Chaque bloc a une ligne `FILMER`**, sinon rien ne dira quoi tourner.

---

## Le débit

Par défaut **3 mots par seconde**, soit 180 mots par minute : le rythme d'une
prise de parole tonique en vertical. Une diction posée tourne plutôt à 2,5.
`--debit 2.5` recalcule tout.

Un nombre écrit en chiffres compte pour plusieurs mots, parce qu'il se prononce
en plusieurs mots : `900` vaut deux mots, comme « neuf cents ». Sans ça, un
script plein de chiffres paraîtrait deux fois plus court qu'il ne l'est.

---

## Après le tournage

Les rushes vont dans `projects/<slug>/media/`, et le script rend trois services
au montage :

1. Les lignes `TEXTE` deviennent des overlays de `plan.json`.
2. Les bornes des blocs donnent le rythme visé, à recaler sur les silences réels
   mesurés par `npm run cuts`.
3. Les lignes `DIRE` disent ce que la transcription **devrait** contenir : elles
   servent à corriger les noms propres écrits au son par Whisper
   (`captions.replace`).

Les bornes du script ne sont pas celles du montage. Ce sont des intentions ;
`npm run cuts` donne les vraies.

---

## Un squelette sans Claude

```bash
npm run script -- lisbonne-budget --init --theme "..." --axes "..." --duree 24
```

Écrit un `script.md` vide à remplir à la main.
