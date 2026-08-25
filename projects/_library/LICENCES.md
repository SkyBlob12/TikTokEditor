# Licences des fichiers de la bibliotheque

**A remplir avant toute distribution.**

Les fichiers de `sfx/`, `music/` et `brand/` ne sont pas couverts par la licence
du code. Ils viennent de banques tierces dont les conditions varient : certaines
autorisent l'usage commercial, d'autres non ; certaines interdisent la
redistribution du fichier lui-meme, meme quand l'usage dans une video est
autorise.

`.gitignore` exclut deja leur contenu du depot. C'est volontaire : **ne pas
redistribuer ces fichiers avec l'outil** tant que leur licence n'a pas ete
verifiee un par un.

## A documenter

| Dossier | Source | Licence | Usage commercial | Redistribution |
|---|---|---|---|---|
| `sfx/` | | | | |
| `music/` | | | | |
| `brand/` | proprietaire | | | non |

## Si tu vends l'outil

Trois options, par ordre de simplicite :

1. **Livrer sans les fichiers.** L'acheteur apporte sa propre banque.
   `npm run doctor` lui signale que la bibliotheque est vide.
2. **Livrer des fichiers CC0** uniquement, dont la redistribution est libre.
3. **Verifier chaque licence** et documenter le tableau ci-dessus.

L'option 1 est la seule qui ne demande aucune verification.
