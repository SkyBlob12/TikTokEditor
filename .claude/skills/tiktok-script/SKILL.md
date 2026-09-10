---
name: tiktok-script
description: Ecrire le script d une video verticale a partir d un theme et d axes, quand il n y a encore ni rush ni idee. Propose trois angles, puis ecrit le texte a dire et les plans a filmer dans projects/<slug>/script.md. A utiliser des que l utilisateur demande une idee de video, un script, un scenario, un storyboard, ou dit qu il n a pas d idee.
---

# Ecrire un script TikTok

Cette skill s'arrete ou commence [tiktok-montage](../tiktok-montage/SKILL.md) :
elle produit **ce qu'il faut dire et ce qu'il faut filmer**, pas un montage. Il
n'y a pas encore de rush, donc rien a couper.

Sortie : `projects/<slug>/script.md`, verifie par `npm run script -- <slug>`.

> Comme le reste du depot, ces regles sont un fichier. Le debit de parole, la
> longueur du hook, le nombre de blocs : a ajuster au format de celui qui parle.

## 1. Ce qu'il faut avant d'ecrire

Deux choses suffisent : **un theme** et **des axes** (les angles a couvrir).

Le reste a des valeurs par defaut, ne bloque pas dessus :

| | Defaut |
|---|---|
| Duree cible | 25 s |
| Ton | direct, premiere personne |
| Moyens de tournage | un telephone, une personne seule, pas de drone ni de studio |

Si l'utilisateur ne donne qu'un theme, **tu proposes les axes toi-meme** dans
les trois angles de l'etape 2. Tu ne lui demandes pas de remplir un formulaire.

## 2. Trois angles, avant tout script

Tu n'ecris jamais trois scripts complets : deux partiraient a la poubelle.
Tu proposes **trois angles en trois lignes chacun**, et tu attends le choix.

```
A. Le contre-pied : "le dev, c'est 20% du boulot"
   Pour qui : celui qui code seul et croit que le produit suffit
   Preuve a montrer : le graphe d'installs plat pendant trois mois

B. Le chiffre : "400 utilisateurs en 6 mois, voila le vrai graphe"
   ...

C. L'erreur : "ce que j'aurais du faire des le premier jour"
   ...
```

Trois angles **vraiment differents** : trois formulations du meme angle ne sont
pas un choix. Un contre-pied, un chiffre, une erreur, une comparaison, un
avant/apres, une demonstration : pioche dans des familles distinctes.

L'utilisateur repond A, B ou C, ou melange. Alors seulement tu ecris le script.

## 3. Ecrire le script

Cree le projet s'il n'existe pas (`npm run new -- <slug>`), puis ecris
`projects/<slug>/script.md`. La grammaire complete est dans
[docs/SCRIPT.md](../../../docs/SCRIPT.md).

```markdown
# lisbonne-budget

Theme : trois jours a Lisbonne a moins de 200 euros
Axes : transport, logement, ou manger
Duree cible : 24 s
Ton : direct, premiere personne

## Hook (0 - 2)

DIRE : Lisbonne, trois jours, 180 euros.
FILMER : plan serre visage, rue en pente derriere, regard camera
TEXTE : 180 EUROS, 3 JOURS

## 1. Le transport (2 - 8)

DIRE : Le tram 28 coute 3 euros, le taxi pour le meme trajet en coute 12.
FILMER : interieur du tram 28, plan a hauteur d'epaule
```

- **`DIRE`** : le texte prononce, mot pour mot. C'est lui qu'on chronometre.
- **`FILMER`** : le plan a tourner. Une phrase, tournable au telephone.
- **`TEXTE`** (facultatif) : ce qui s'incruste a l'ecran a ce moment.
- **`SON`** (facultatif) : une intention sonore.

Les bornes sont en secondes et **s'enchainent sans trou** : un bloc finit ou le
suivant commence, exactement comme les clips d'un plan de montage.

## 4. Verifier

```bash
npm run script -- <slug>
```

Il compte les mots, les convertit en secondes de parole et les confronte aux
bornes. **Tu corriges jusqu'a "Script tenable".** Un bloc de 6 s qui contient
25 mots ne se tournera pas : la personne parlera trop vite ou depassera.

Puis tu affiches la liste des plans a filmer, telle que la sort la commande.

## 5. Passer au montage

Une fois les rushes tournes et deposes dans `projects/<slug>/media/` :
`npm run ingest`, puis la skill [tiktok-montage](../tiktok-montage/SKILL.md).
Le script rend alors trois services : les lignes `TEXTE` deviennent des
overlays, les bornes des blocs donnent le rythme vise, et les lignes `DIRE`
disent ce que la transcription devrait contenir.

Recopie l'angle retenu et la duree cible dans `brief.md` : c'est lui que relit
le montage.

---

## Les regles d'ecriture

**Trois mots par seconde.** Un bloc de 5 s tient 15 mots, pas 30. C'est la
contrainte qui decide de tout le reste : elle interdit les subordonnees, les
"du coup", les "je vais vous expliquer que".

**Le hook annonce le resultat, pas le sujet.** "Comment j'ai economise sur mon
voyage" est un titre de chapitre. "Lisbonne, trois jours, 180 euros" est un
hook. Il tient en une phrase et **dans les deux premieres secondes**.

**Une idee par bloc.** Deux idees dans un bloc, c'est deux blocs.

**Du concret.** Un chiffre, un prix, un lieu, une heure. Un script generique se
reconnait a ses phrases qui marcheraient pour n'importe quel sujet.

**Tu n'inventes pas les chiffres.** Un prix, une date, une statistique que
l'utilisateur n'a pas donnee s'ecrit `[a completer : prix du billet]` et tu le
signales a la fin. Un chiffre invente se retrouve incruste a l'ecran, dit face
camera, et personne ne se souvient qu'il venait de toi.

**Chaque `FILMER` est tournable** par une personne seule avec un telephone, dans
un lieu que l'utilisateur a mentionne. Pas de drone, pas de deuxieme camera, pas
de figurant, sauf s'il en a parle.

**Le CTA est le dernier bloc, jamais avant**, et seulement si l'utilisateur en
veut un.

**Le script est ecrit dans la langue de l'utilisateur.**

## Ce que tu ne fais pas

- Tu n'ecris pas les trois angles en entier avant qu'un soit choisi.
- Tu ne mets pas d'emoji dans une ligne `TEXTE` : elle sera incrustee.
- Tu n'ecris pas de tiret cadratin.
- Tu ne remplis pas `plan.json` a cette etape : il n'y a pas de rush.
- Tu ne livres pas un script sans avoir lance `npm run script`.
