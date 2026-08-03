# Règles UI et UX

## 1. Objectif de ce document

Ce document définit les principes visuels et comportementaux de Gym Companion.

L’objectif n’est pas de figer une maquette complète, mais de garantir une expérience :

- cohérente ;
- rapide ;
- mobile-first ;
- accessible ;
- adaptée à une utilisation en salle ;
- lisible dans des conditions variées ;
- rassurante lors des problèmes réseau.

## 2. Identité du produit

Gym Companion doit transmettre :

- énergie ;
- progression ;
- précision ;
- simplicité ;
- fiabilité ;
- collaboration.

L’interface ne doit pas ressembler à un logiciel médical ni à un jeu excessivement gamifié.

Le produit peut être motivant sans devenir agressif ou culpabilisant.

## 3. Direction visuelle

### 3.1 Style général

- interface moderne ;
- cartes sobres ;
- hiérarchie typographique nette ;
- peu d’ombres lourdes ;
- bordures discrètes ;
- animations courtes ;
- informations principales très lisibles ;
- actions critiques clairement différenciées.

### 3.2 Couleurs

La palette exacte sera définie dans le thème Tailwind.

Rôles recommandés :

- couleur principale : actions et sélection ;
- vert : réussite ou synchronisation confirmée ;
- orange : attention, attente ou série partielle ;
- rouge : erreur, suppression ou danger ;
- bleu : information ou état partagé ;
- gris : éléments secondaires ou désactivés.

### 3.3 Règle d’accessibilité

Une couleur ne doit jamais être le seul indicateur d’un état.

Exemple :

```text
Icône + libellé + couleur
```

et non :

```text
Couleur seule
```

## 4. Thème clair et sombre

Le thème sombre est pertinent pour une utilisation en salle.

L’application doit prendre en charge :

- thème système ;
- thème clair ;
- thème sombre.

Les deux thèmes doivent respecter les mêmes règles de contraste.

Le thème sombre ne doit pas utiliser un noir absolu sur toutes les surfaces. Des niveaux de surface permettent de conserver la hiérarchie.

## 5. Typographie

### 5.1 Police

Utiliser une police sans-serif lisible et disponible sans dépendance complexe.

### 5.2 Hiérarchie

Niveaux recommandés :

- titre de page ;
- titre de section ;
- titre de carte ;
- valeur principale ;
- texte courant ;
- texte secondaire ;
- libellé technique.

### 5.3 Valeurs importantes

Les valeurs utilisées pendant une séance doivent être particulièrement visibles :

- charge ;
- répétitions ;
- temps restant ;
- numéro de série ;
- station ;
- objectif.

### 5.4 Nombres tabulaires

Les chronomètres et séries de valeurs peuvent utiliser des chiffres tabulaires afin d’éviter les changements de largeur.

## 6. Grille et espacements

Utiliser une échelle cohérente d’espacement.

Recommandations :

- marges latérales mobiles confortables ;
- espacement réduit dans les écrans de séance ;
- espacement plus généreux dans les pages d’analyse ;
- contenu principal limité en largeur sur desktop ;
- aucune information essentielle collée aux bords de l’écran.

## 7. Zones tactiles

Les actions principales doivent posséder une zone tactile confortable.

Les icônes seules doivent être placées dans un bouton suffisamment grand.

Les actions proches ne doivent pas provoquer facilement une erreur de sélection.

Exemples sensibles :

- terminer une séance ;
- supprimer une série ;
- quitter une salle ;
- modifier la charge ;
- passer à l’exercice suivant.

## 8. Navigation mobile

### 8.1 Barre inférieure

La barre inférieure doit rester :

- visible hors séance active ;
- facilement compréhensible ;
- limitée à cinq destinations ;
- compatible avec les safe areas du téléphone.

### 8.2 Action centrale

Le bouton central peut ouvrir les actions de création.

Il doit avoir un libellé accessible et ne pas dépendre uniquement de l’icône `+`.

### 8.3 Navigation pendant une séance

Pendant une séance, la barre principale peut être remplacée par une navigation dédiée :

- exercice précédent ;
- liste de séance ;
- exercice suivant ;
- chronomètre ;
- terminer.

L’utilisateur doit pouvoir revenir à l’application sans perdre la séance.

## 9. Boutons

### 9.1 Variantes

Variantes recommandées :

- `primary` ;
- `secondary` ;
- `outline` ;
- `ghost` ;
- `destructive` ;
- `success`, uniquement si réellement nécessaire.

### 9.2 Action principale

Une page ne doit généralement contenir qu’une action principale visuellement dominante.

### 9.3 Actions destructrices

Les actions destructrices doivent :

- utiliser une formulation explicite ;
- demander confirmation lorsque la conséquence est importante ;
- ne pas être placées trop près de l’action principale ;
- expliquer ce qui sera supprimé.

### 9.4 Chargement

Lorsqu’un bouton déclenche une opération :

- il affiche un état de chargement ;
- il bloque les doubles soumissions ;
- son libellé reste compréhensible ;
- l’interface ne doit pas sembler figée.

## 10. Icônes

Utiliser Lucide React.

Les icônes doivent :

- soutenir un libellé ;
- rester cohérentes ;
- ne pas remplacer du texte important ;
- disposer d’un label accessible lorsqu’elles sont seules.

Une même action doit utiliser la même icône dans toute l’application.

## 11. Cartes

Les cartes sont utilisées pour regrouper :

- une séance ;
- un exercice ;
- un programme ;
- un résumé ;
- une invitation ;
- une mesure.

Une carte ne doit pas contenir trop d’actions concurrentes.

Sur mobile, éviter les cartes imbriquées profondément.

## 12. Listes

Les listes longues doivent permettre :

- recherche ;
- filtrage ;
- états de chargement ;
- pagination ou chargement progressif ;
- état vide ;
- accès clair au détail.

Les informations secondaires ne doivent pas rendre chaque ligne trop haute.

## 13. Formulaires

### 13.1 Principes

- libellé toujours visible ;
- exemple ou unité lorsque nécessaire ;
- validation proche du champ ;
- message d’erreur concret ;
- clavier mobile adapté au type de donnée ;
- valeurs préremplies lorsque possible ;
- sauvegarde de brouillon pour les formulaires longs.

### 13.2 Saisie numérique

Les champs de charge, répétitions et temps doivent :

- ouvrir un clavier numérique approprié ;
- accepter les décimales lorsque nécessaire ;
- afficher l’unité ;
- proposer des incréments rapides ;
- empêcher les valeurs manifestement invalides.

### 13.3 Incréments rapides

Exemple pour une charge :

```text
-5 | -2,5 | 60 kg | +2,5 | +5
```

Les valeurs exactes dépendent de l’équipement et des unités.

### 13.4 Formulaires longs

Pour les programmes et recettes, utiliser :

- sections ;
- navigation par étapes ;
- résumé final ;
- avertissement avant abandon.

## 14. Bottom sheets, drawers et modales

### Bottom sheet

À privilégier sur mobile pour :

- choisir un statut ;
- afficher la liste de séance ;
- ajouter une série ;
- choisir un exercice ;
- afficher des actions secondaires.

### Drawer

Adapté aux filtres et paramètres rapides.

### Modale

À réserver aux confirmations courtes.

Une modale ne doit pas contenir un formulaire complexe ou une page entière.

## 15. Page de séance active

La page de séance active est l’écran le plus important du produit.

### 15.1 Priorités visuelles

Ordre recommandé :

1. exercice actuel ;
2. série actuelle ;
3. charge ;
4. cible de répétitions ;
5. action de validation ;
6. chronomètre ;
7. progression générale ;
8. actions secondaires.

### 15.2 Saisie rapide

La charge précédente et la cible doivent être préremplies lorsque possible.

L’utilisateur doit pouvoir valider une série avec peu d’interactions.

### 15.3 Action de validation

Le bouton principal peut utiliser un libellé explicite :

```text
Valider la série
```

Après validation :

- retour visuel immédiat ;
- lancement du repos ;
- passage clair à la suite ;
- possibilité d’annuler brièvement une erreur.

### 15.4 Statut d’une série

Le statut peut être proposé après saisie ou déduit provisoirement de la cible.

L’utilisateur garde toujours la possibilité de le modifier.

### 15.5 Échec

L’action « Échec » ne doit pas être mise en scène comme une faute.

Libellés préférables :

- série partielle ;
- cible non atteinte ;
- série interrompue.

### 15.6 Écran actif

L’application peut demander à maintenir l’écran actif pendant une séance, avec consentement et uniquement lorsque la plateforme le permet.

## 16. Chronomètre

### 16.1 Affichage

Le temps restant doit être très lisible.

### 16.2 États

- actif ;
- en pause ;
- terminé ;
- arrière-plan ;
- notification indisponible.

### 16.3 Actions

- pause ;
- reprise ;
- ajouter 15 ou 30 secondes ;
- retirer du temps ;
- terminer.

### 16.4 Fin du repos

Utiliser plusieurs signaux possibles :

- changement visuel ;
- vibration, si disponible et autorisée ;
- son facultatif ;
- notification.

L’utilisateur doit pouvoir désactiver chaque signal.

## 17. Séance partagée

### 17.1 Information principale

Chaque participant doit voir en priorité :

```text
Où aller ?
Quel exercice ?
Quelle charge ?
Combien de répétitions ?
```

### 17.2 Station actuelle

La station actuelle doit être représentée par une carte dominante.

### 17.3 Prochaine station

La prochaine station peut être affichée de manière secondaire pour permettre l’anticipation.

### 17.4 Présence des participants

Utiliser des statuts explicites :

- prêt ;
- en exercice ;
- en repos ;
- en attente ;
- déconnecté ;
- terminé.

### 17.5 Confidentialité

Ne pas afficher les données détaillées d’un participant à tous les autres sans règle explicite.

La présence et la station peuvent être partagées. Les charges et performances peuvent rester privées par défaut.

### 17.6 Changement de rotation

Un changement doit produire :

- un message visible ;
- une animation légère ;
- une nouvelle station clairement identifiée ;
- une notification éventuelle.

## 18. États réseau

### 18.1 En ligne

Aucun indicateur permanent n’est nécessaire lorsque tout fonctionne normalement.

### 18.2 Hors ligne

Afficher un bandeau discret mais visible :

```text
Mode hors ligne — les changements seront synchronisés
```

### 18.3 Synchronisation

États possibles :

- synchronisé ;
- synchronisation en cours ;
- en attente ;
- échec ;
- conflit.

### 18.4 Séance partagée déconnectée

Afficher clairement :

```text
Connexion perdue — la séance du groupe n’est plus synchronisée
```

Le client ne doit pas simuler les changements des autres participants.

## 19. Gestion des erreurs

### 19.1 Messages

Un message d’erreur doit expliquer :

- ce qui s’est passé ;
- ce que l’utilisateur peut faire ;
- si ses données sont conservées.

Exemple :

```text
La série n’a pas encore été synchronisée. Elle reste enregistrée sur ce téléphone et sera renvoyée lorsque la connexion reviendra.
```

### 19.2 Erreurs techniques

Ne pas afficher directement :

- stack trace ;
- nom de table ;
- message Prisma ;
- détails de token ;
- identifiant interne inutile.

### 19.3 Récupération

Proposer selon le cas :

- réessayer ;
- actualiser ;
- revenir ;
- conserver localement ;
- contacter le support ;
- consulter le conflit.

## 20. Notifications internes

Utiliser des toasts pour :

- confirmation simple ;
- erreur non bloquante ;
- action annulable ;
- sauvegarde réussie.

Ne pas utiliser un toast comme seul moyen de communiquer une information importante.

Les erreurs de formulaire doivent rester visibles près du champ.

## 21. États vides

Un état vide doit :

- expliquer pourquoi la page est vide ;
- proposer une prochaine action ;
- éviter les illustrations excessives ;
- ne pas afficher plusieurs boutons concurrents.

Exemple :

```text
Tu n’as encore créé aucun programme.

Crée un programme pour préparer tes prochaines séances, ou démarre directement une séance libre.
```

## 22. Skeletons et chargement

Utiliser des skeletons lorsque la structure de la page est connue.

Utiliser un spinner pour une action locale ou courte.

Ne pas bloquer toute l’application lorsqu’une seule section se charge.

## 23. Feedback optimiste

Le feedback optimiste peut être utilisé lorsque l’action est facilement annulable.

Exemples :

- favori ;
- réorganisation locale ;
- ajout temporaire ;
- lecture d’une notification.

Pour une série ou une action partagée critique :

- afficher immédiatement l’action ;
- conserver un statut en attente ;
- attendre la confirmation serveur avant de la considérer comme définitive.

## 24. Animations

### 24.1 Durée

Les animations doivent rester courtes et fonctionnelles.

### 24.2 Usages utiles

- changement de station ;
- validation de série ;
- ouverture d’une bottom sheet ;
- progression ;
- apparition d’une erreur.

### 24.3 À éviter

- animations longues ;
- confettis systématiques ;
- mouvements gênant la saisie ;
- transitions retardant l’accès à l’information.

### 24.4 Réduction des mouvements

Respecter `prefers-reduced-motion`.

## 25. Graphiques

### 25.1 Objectif

Chaque graphique doit répondre à une question.

Exemples :

- ma charge progresse-t-elle ?
- mon volume augmente-t-il ?
- combien de fois ai-je réalisé cet exercice ?
- mon poids évolue-t-il sur plusieurs semaines ?

### 25.2 Mobile

- limiter le nombre de séries affichées ;
- utiliser des filtres ;
- permettre un détail au toucher ;
- éviter les légendes trop longues ;
- afficher une alternative textuelle.

### 25.3 Estimations

Une courbe estimée doit être différenciée d’une mesure réelle.

## 26. Nutrition

### 26.1 Présentation des calories

Ne pas présenter les calories comme un score moral.

Éviter les formulations comme :

```text
Mauvaise journée
```

Préférer :

```text
Objectif dépassé de 180 kcal
```

### 26.2 Dépense sportive

Afficher la dépense séparément et comme estimation.

### 26.3 Macros

Les protéines, glucides et lipides peuvent utiliser :

- valeur consommée ;
- objectif ;
- barre de progression ;
- pourcentage.

La couleur seule ne doit pas indiquer un dépassement.

### 26.4 Copie rapide

L’ajout alimentaire doit proposer :

- récents ;
- favoris ;
- repas sauvegardés ;
- copie d’hier.

## 27. Progression et motivation

### 27.1 Records

Un record peut être valorisé avec :

- icône ;
- message ;
- comparaison ;
- animation légère.

### 27.2 Pas de culpabilisation

Une baisse de performance doit être présentée de manière neutre.

Exemple :

```text
Performance inférieure à la dernière séance
```

et non :

```text
Tu as régressé
```

### 27.3 Contexte

Lorsque pertinent, rappeler que les performances peuvent varier selon :

- fatigue ;
- exercice précédent ;
- équipement ;
- temps de repos ;
- conditions de séance.

## 28. Coach IA

### 28.1 Positionnement

L’interface doit clairement présenter les résultats comme des propositions.

Utiliser des termes comme :

- proposition ;
- suggestion ;
- hypothèse ;
- adaptation recommandée.

### 28.2 Confirmation

Une proposition IA doit proposer :

- accepter ;
- modifier ;
- refuser.

### 28.3 Explication

Afficher :

- données principales utilisées ;
- hypothèses ;
- raisons ;
- avertissements ;
- éléments non pris en compte.

### 28.4 Chargement

La génération peut prendre du temps.

Afficher un état clair sans bloquer toute l’application.

### 28.5 Erreur

En cas d’échec, proposer :

- réessayer ;
- modifier la demande ;
- créer manuellement.

## 29. Confidentialité

### 29.1 Données partagées

Avant une séance partagée, préciser quelles informations seront visibles :

- nom affiché ;
- présence ;
- station ;
- statut ;
- performances selon les paramètres.

### 29.2 Consentement IA

Avant une requête IA, afficher les catégories de données utilisées.

### 29.3 Écran verrouillé

Les notifications doivent rester discrètes par défaut.

## 30. Accessibilité

### 30.1 Standards

Viser au minimum WCAG 2.2 niveau AA pour les parcours principaux.

### 30.2 Navigation clavier

Toutes les actions principales doivent être accessibles au clavier.

### 30.3 Focus

- focus visible ;
- ordre logique ;
- retour du focus après fermeture d’une modale ;
- pas de piège clavier.

### 30.4 Lecteurs d’écran

- titres structurés ;
- labels de formulaire ;
- descriptions des icônes ;
- annonces pour les mises à jour importantes ;
- statut du chronomètre accessible sans annonce chaque seconde.

### 30.5 Contraste

Les textes et éléments interactifs doivent conserver un contraste suffisant.

### 30.6 Taille de texte

L’interface doit rester fonctionnelle avec un agrandissement du texte.

## 31. Responsive desktop

Le desktop permet :

- vues en colonnes ;
- historique plus dense ;
- comparaison de graphiques ;
- édition de programme plus confortable ;
- barre latérale.

Il ne doit pas introduire des fonctionnalités incompatibles avec la version mobile sans justification.

## 32. Composants shadcn/ui envisagés

Composants probables :

- Button ;
- Card ;
- Input ;
- Form ;
- Select ;
- Command ;
- Dialog ;
- AlertDialog ;
- Drawer ;
- Sheet ;
- Tabs ;
- Badge ;
- Progress ;
- DropdownMenu ;
- Tooltip ;
- Toast ou Sonner ;
- Skeleton ;
- Calendar ;
- Popover ;
- Switch ;
- Checkbox ;
- RadioGroup ;
- Slider ;
- Table, principalement desktop.

Les composants doivent être adaptés au besoin métier plutôt qu’utilisés tels quels sans réflexion.

## 33. Design tokens

Le thème doit centraliser :

- couleurs ;
- rayons ;
- ombres ;
- espacements ;
- hauteurs de contrôle ;
- typographie ;
- durées d’animation ;
- niveaux de surface ;
- statuts métier.

Exemples de tokens métier :

```text
status-success
status-partial
status-failed
status-skipped
status-pending
status-offline
status-conflict
```

## 34. Critères de validation UX

Une fonctionnalité mobile est considérée comme exploitable lorsque :

- l’action principale est immédiatement identifiable ;
- aucune donnée essentielle n’est coupée ;
- les zones tactiles sont confortables ;
- le clavier ne masque pas l’action de validation ;
- les erreurs sont compréhensibles ;
- l’état réseau est clair ;
- la navigation arrière ne fait pas perdre de données ;
- l’interface reste utilisable en thème sombre ;
- les actions principales sont accessibles sans précision excessive ;
- les technologies d’assistance peuvent identifier les contrôles.
