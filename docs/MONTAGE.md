# La méthode de montage

Ce document n'explique pas les champs du plan, c'est le rôle de
[PLAN.md](PLAN.md). Il explique **les décisions** : où couper, quoi garder, quoi
jeter.

Ce sont les règles que Claude applique par défaut. Elles viennent de montages
ratés puis corrigés, sur un format précis : la prise de parole face caméra en
vertical. Adapte-les à ton style plutôt que de les suivre aveuglément, en
modifiant [la skill](../.claude/skills/tiktok-montage/SKILL.md) et
[CLAUDE.md](../CLAUDE.md).

---

## L'ordre des opérations

```
1. ingest      connaître les rushes (durées réelles, format)
2. proxy       alléger ce qui est trop lourd à décoder
3. transcribe  obtenir le texte mot à mot
4. cuts        savoir où sont les silences
5. plan.json   écrire le montage
6. validate    vérifier avant de payer le rendu
7. render      produire le MP4
```

Chaque étape sert la suivante. On ne saute pas `cuts` avant d'écrire un plan :
c'est la seule source fiable pour placer une coupe.

---

## Où couper

**Les bornes de mots d'une transcription ne disent pas où couper.** Elles sont
contiguës (la fin d'un mot est le début du suivant) et le modèle les fait
dériver de plusieurs centaines de millisecondes. Couper dessus tranche la
dernière syllabe, ou laisse une seconde de vide.

```bash
npm run cuts -- mon-projet --around 12.05
```

**Toute borne de clip tombe au milieu d'un silence détecté.** Si `cuts` ne montre
aucun silence là où on voulait couper, c'est que la phrase enchaîne : il ne faut
pas couper là.

Avant de livrer, on vérifie ce que contient vraiment chaque bloc en le
transcrivant isolément, plutôt que de déduire son contenu des timings.

---

## Ce qu'on coupe

Par ordre de rentabilité, sur un vlog ou une prise face caméra :

1. **Les répétitions.** Quelqu'un qui parle sans script redit deux fois la même
   idée à deux minutes d'intervalle. C'est le gisement le plus large.
2. **Les hésitations.** « du coup c'est que », « là je me suis rendu compte » :
   du remplissage qui coûte de la rétention.
3. **Les énumérations.** « quelques refontes, quelques améliorations, quelques
   corrections » : trois items qui disent la même chose.
4. **Le début.** Les remerciements et le contexte appartiennent à YouTube. Sur
   TikTok, ils font partir l'audience.

---

## Le hook

**Le hook tient dans la première seconde.** Ce n'est presque jamais le début du
rush : c'est la phrase la plus forte, prise n'importe où, remontée en tête.

Quand on remonte un segment en hook, il faut renseigner `captions.syncTo` : sans
ça les sous-titres partent en vrac, puisque leurs timings sont ceux du fichier
source. Voir [PLAN.md](PLAN.md#captions--les-sous-titres).

Un segment peut apparaître deux fois, en hook puis à sa place, sans que ça
choque, à condition que ce soit assumé. En revanche, **deux passages qui disent
la même chose coup sur coup** sont un doublon : on en garde un.

---

## Le mouvement

**Pas de Ken Burns sur un plan fixe.** Un zoom qui dérive pendant qu'une personne
parle face caméra donne le mal de mer. `zoom` avec `from` égal à `to` fige le
cadrage.

Le cadrage ne change **qu'aux coupes**, en alternant entre deux valeurs
seulement (par exemple 1.00 et 1.09). Une règle constante se lit comme un montage
à deux caméras. Une valeur différente à chaque plan se lit comme un bug.

Le cut sec est la transition la plus efficace. Deux ou trois transitions animées
maximum sur une minute.

---

## Les effets

`pulse`, `shake`, `flash`. **`intensity` jamais au-dessus de 0.45.**

Un effet se pose sur une coupe ou sur un mot fort. Jamais « pour faire joli » :
sur un plan fixe, un effet qui se voit se lit comme un défaut de lecture.

---

## Les bruitages

**Décaler de l'attaque.** Un whoosh monte avant d'exploser. `npm run sfx` mesure
ce délai pour chaque fichier. Un son qui doit frapper à `T` se déclenche à
`T − attaque`.

Volume entre 0.3 et 0.6. Trois ou quatre sons maximum sur une minute. Au-delà,
ça devient une machine à sous.

Un bruitage se pose sur un moment **déjà marqué visuellement** : une coupe, un
compteur qui arrive, un effet. Un son seul, sans image qui le justifie, s'entend
comme une erreur.

---

## Les sous-titres

**Trois mots à la fois**, pas plus. Au-delà, on lit au lieu de regarder.

**Zone sûre : `y` entre 0.12 et 0.80.** En dessous de 0.80, la légende et les
boutons TikTok recouvrent tout. Les sous-titres vivent à `0.72`.

Une page de sous-titres **ne doit jamais enjamber une coupe**, le moteur s'en
charge, à condition que `syncTo` soit renseigné.

Vérifier l'orthographe des noms propres : un modèle de transcription les écrit au
son. `captions.replace` les corrige au rendu.

---

## Le son

`musicVolume` entre 0.08 et 0.15 quand il y a une voix, avec `duck: true`.
Jusqu'à 0.35 sans voix.

Sans musique de fond, **les bruitages ressortent davantage** : baisser leur
volume en conséquence.

---

## La durée

Il n'y a pas de règle absolue, mais un ordre de grandeur : au-delà de 60 s sur
un format parlé, la rétention décroche. La question n'est pas « qu'est-ce que je
peux garder » mais « qu'est-ce qui ne sert à rien ».

---

## Ce qu'on ne fait pas

- Changer le format : toujours 1080 × 1920, 30 fps.
- Mettre des emoji dans les sous-titres incrustés.
- Placer du texte sous `y: 0.82`.
- Livrer un rendu sans avoir lancé `npm run validate`.
- Modifier les fichiers de `media/` : ce sont les rushes originaux.
