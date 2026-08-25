# Bruitages

Depose ici tes fichiers son ponctuels (`.mp3`, `.wav`, `.m4a`). Ils sont
partages entre tous tes projets et se referencent avec le prefixe `library/` :

```json
"sfx": [
  {"src": "library/sfx/whoosh.mp3", "at": 25.29, "volume": 0.5},
  {"src": "library/sfx/pop.mp3",    "at": 4.10,  "volume": 0.45}
]
```

`at` est l'instant sur la **timeline finale**, pas dans le rush.

`npm run sfx` liste ce que contient ce dossier et mesure, pour chaque fichier,
le delai avant qu'il frappe. Un son doit etre declenche a
`instant vise - ce delai`, sinon son impact arrive en retard.

## Ce qui sert vraiment sur ce format

| Son | Ou le poser | Volume typique |
|---|---|---|
| whoosh | sur une coupe, au moment exact du changement de plan | 0.4 - 0.6 |
| pop / click | a l'apparition d'un sticker ou d'un compteur | 0.4 - 0.5 |
| ding / chime | sur un chiffre qui tombe | 0.5 |
| riser | 0.5 a 1 s AVANT une revelation, pas dessus | 0.3 - 0.4 |
| impact / boom | sur un mot fort, avec un `pulse` au meme instant | 0.5 |

## Regles

- **Volume entre 0.3 et 0.6.** Un bruitage plus fort que la voix sonne amateur.
- **Trois ou quatre maximum** sur une video d'une minute. Au-dela ca devient
  une machine a sous.
- **Sur la coupe, pas apres.** Un whoosh en retard de 3 frames s'entend.
- Si l'attaque du fichier est molle, `trim` permet d'entrer directement dedans.

## Ou en trouver

Cherche des banques en CC0 ou domaine public. Attention : « royalty-free » ne
veut pas dire libre de droits. Voir [../LICENCES.md](../LICENCES.md).
