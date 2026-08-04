# Pages et navigation

## 1. Objectif de ce document

Ce document décrit :

- les routes principales ;
- la structure de navigation ;
- la responsabilité de chaque page ;
- les actions principales ;
- les informations affichées ;
- les états particuliers ;
- les différences entre mobile et desktop.

Il ne définit pas précisément les couleurs, espacements ou composants visuels. Ces éléments sont décrits dans `docs/07-ui-ux-guidelines.md`.

## 2. Principes de navigation

### 2.1 Mobile-first

La navigation principale est conçue en priorité pour un téléphone.

Les fonctionnalités utilisées pendant une séance doivent être accessibles rapidement et ne doivent pas dépendre d’un menu complexe.

### 2.2 Navigation stable

L’application doit conserver une structure prévisible.

Les sections principales ne doivent pas changer de position selon le contexte, sauf pendant une séance active où une interface spécialisée peut remplacer temporairement la navigation habituelle.

### 2.3 Profondeur limitée

Les actions fréquentes doivent être accessibles en trois interactions au maximum depuis la navigation principale.

### 2.4 Retour sécurisé

Le bouton de retour ne doit pas provoquer la perte d’un formulaire ou d’une séance sans avertissement.

### 2.5 URLs explicites

Les pages importantes doivent posséder une route stable pouvant être :

- mise en favori ;
- partagée lorsqu’elle n’est pas privée ;
- restaurée après actualisation ;
- ouverte directement depuis une notification.

## 3. Structure générale des routes

Structure proposée :

```text
/
├── login
├── register
├── forgot-password
├── reset-password
├── verify-email
├── invite/:invitationCode
│
└── app
    ├── dashboard
    ├── today
    ├── exercises
    │   ├── new
    │   └── :exerciseId
    │       ├── overview
    │       ├── history
    │       └── edit
    │
    ├── programs
    │   ├── new
    │   └── :programId
    │       ├── overview
    │       ├── edit
    │       └── workouts
    │           ├── new
    │           └── :templateId
    │               └── edit
    │
    ├── workouts
    │   ├── new
    │   ├── active
    │   ├── history
    │   └── :workoutSessionId
    │
    ├── shared-workouts
    │   ├── new
    │   ├── join
    │   └── :roomId
    │       ├── lobby
    │       ├── active
    │       └── summary
    │
    ├── progress
    │   ├── overview
    │   └── exercises/:exerciseId
    │
    ├── nutrition
    │   ├── today
    │   ├── history
    │   ├── foods
    │   │   ├── new
    │   │   └── :foodId
    │   ├── recipes
    │   │   ├── new
    │   │   └── :recipeId
    │   ├── saved-meals
    │   ├── goals
    │   └── body
    │
    ├── coach
    │   ├── new-program
    │   ├── new-workout
    │   ├── progress-analysis
    │   └── proposals/:proposalId
    │
    ├── notifications
    ├── profile
    ├── settings
    │   ├── account
    │   ├── preferences
    │   ├── notifications
    │   ├── privacy
    │   ├── data
    │   └── sessions
    │
    └── admin
        ├── users
        └── exercises
```

Cette structure est une cible. Les routes des phases futures ne doivent pas nécessairement être créées dès le lancement.

## 4. Navigation mobile principale

La navigation mobile utilise une barre inférieure persistante hors séance active.

Proposition initiale :

```text
Aujourd’hui | Programmes | Ajouter | Progression | Profil
```

### 4.1 Aujourd’hui

Accès au tableau de bord opérationnel :

- séance prévue ;
- séance active ;
- résumé nutritionnel ;
- invitations ;
- rappels utiles.

### 4.2 Programmes

Accès aux programmes, séances modèles et catalogue d’exercices.

### 4.3 Ajouter

Bouton d’action central ouvrant un menu contextuel :

- démarrer une séance libre ;
- créer une séance partagée ;
- ajouter un repas ;
- enregistrer le poids ;
- créer un exercice ;
- créer un programme.

Le menu ne doit afficher que les fonctionnalités disponibles dans la phase courante.

### 4.4 Progression

Accès à :

- historique ;
- statistiques ;
- records ;
- graphiques ;
- évolution du poids.

### 4.5 Profil

Accès aux préférences, paramètres, notifications, données et sessions.

## 5. Navigation desktop

Sur desktop, la navigation principale peut utiliser une barre latérale.

Sections proposées :

- Aujourd’hui ;
- Exercices ;
- Programmes ;
- Séances ;
- Progression ;
- Nutrition ;
- Séances partagées ;
- Coach IA ;
- Paramètres.

La navigation desktop peut afficher davantage d’informations, mais les routes et concepts doivent rester identiques à la version mobile.

## 6. Layout public

Les pages publiques utilisent un layout distinct.

### Pages concernées

- connexion ;
- inscription ;
- mot de passe oublié ;
- réinitialisation ;
- vérification d’email ;
- invitation nécessitant une connexion.

### Contenu du layout

- logo ;
- nom de l’application ;
- formulaire principal ;
- lien vers l’autre action d’authentification ;
- conditions et confidentialité ;
- messages d’erreur ;
- état de connexion au serveur.

## 7. Page de connexion

### Route

```text
/login
```

### Objectif

Permettre à un utilisateur existant d’accéder à l’application.

### Contenu

- adresse email ;
- mot de passe ;
- option d’affichage du mot de passe ;
- bouton de connexion ;
- lien mot de passe oublié ;
- lien inscription.

### États

- formulaire initial ;
- chargement ;
- identifiants invalides ;
- compte désactivé ;
- réseau indisponible ;
- session créée.

### Règle

Une erreur d’authentification ne doit pas révéler précisément si l’adresse email existe.

## 8. Page d’inscription

### Route

```text
/register
```

### Contenu

- email ;
- mot de passe ;
- confirmation ;
- acceptation des conditions ;
- bouton de création ;
- lien vers la connexion.

### États

- validation en temps réel ;
- soumission ;
- email déjà utilisé ;
- erreur serveur ;
- succès.

## 9. Configuration initiale

### Route proposée

```text
/app/onboarding
```

### Étapes

1. Identité et timezone.
2. Unités.
3. Objectif sportif.
4. Niveau.
5. Informations facultatives.
6. Résumé.

### Règles

- progression visible ;
- possibilité de revenir en arrière ;
- données facultatives clairement identifiées ;
- possibilité de terminer rapidement ;
- pas de questionnaire médical.

## 10. Page Aujourd’hui

### Route

```text
/app/today
```

### Objectif

Donner immédiatement les actions utiles pour la journée.

### Sections possibles

#### Séance active

Affichée en priorité lorsqu’une séance est en cours.

Contenu :

- nom ;
- heure de début ;
- progression ;
- exercice actuel ;
- bouton Reprendre.

#### Prochaine séance

- nom de la séance ;
- programme ;
- durée estimée ;
- exercices principaux ;
- bouton Démarrer ;
- bouton Modifier ou choisir une autre séance.

#### Séance partagée

- invitation en attente ;
- salle programmée ;
- participants ;
- bouton Rejoindre.

#### Nutrition

- calories consommées ;
- objectif ;
- protéines ;
- accès rapide à Ajouter un repas.

#### Résumé rapide

- dernière séance ;
- record récent ;
- poids récent ;
- série de régularité facultative.

### État vide

Lorsqu’aucune donnée n’existe, la page doit proposer une seule prochaine action claire :

```text
Créer mon premier programme
```

ou :

```text
Démarrer une séance libre
```

## 11. Tableau de bord

### Route

```text
/app/dashboard
```

La page Aujourd’hui peut servir de tableau de bord principal. Une route distincte reste possible pour une vue plus analytique.

### Widgets possibles

- séances de la semaine ;
- temps total d’entraînement ;
- volume ;
- records ;
- évolution récente ;
- objectif nutritionnel ;
- poids ;
- invitations ;
- raccourcis.

La page ne doit pas devenir une accumulation de cartes sans hiérarchie.

## 12. Liste des exercices

### Route

```text
/app/exercises
```

### Contenu

- barre de recherche ;
- filtres ;
- favoris ;
- exercices récents ;
- liste des résultats ;
- bouton Nouvel exercice.

### Filtres

- groupe musculaire ;
- équipement ;
- type de mesure ;
- source ;
- favoris ;
- archivés, uniquement sur demande.

### Carte d’exercice

- nom ;
- muscle principal ;
- équipement ;
- indicateur personnel ou système ;
- dernière performance facultative ;
- favori.

## 13. Détail d’un exercice

### Route

```text
/app/exercises/:exerciseId
```

### Onglets ou sections

#### Vue générale

- nom ;
- muscles ;
- équipement ;
- instructions ;
- temps de repos ;
- préférences personnelles.

#### Historique

- dernières performances ;
- charge ;
- répétitions ;
- dates ;
- séances sources.

#### Progression

- records ;
- graphique ;
- 1RM estimé ;
- volume ;
- comparaison.

#### Paramètres personnels

- équipement préféré ;
- repos par défaut ;
- notes ;
- favori ;
- exclusion.

### Actions

- ajouter à une séance ;
- ajouter à un programme ;
- modifier si personnel ;
- archiver si personnel.

## 14. Création ou modification d’exercice

### Routes

```text
/app/exercises/new
/app/exercises/:exerciseId/edit
```

### Sections

- identité ;
- muscles ;
- équipement ;
- type de mesure ;
- paramètres par défaut ;
- instructions.

### Règle mobile

Le formulaire peut être découpé en sections repliables, mais ne doit pas masquer les erreurs.

## 15. Liste des programmes

### Route

```text
/app/programs
```

### Sections

- programme actif ;
- programmes personnels ;
- brouillons ;
- archivés, sur demande ;
- bouton Nouveau programme.

### Carte de programme

- nom ;
- objectif ;
- nombre de séances ;
- statut ;
- dernière utilisation ;
- bouton d’action.

## 16. Détail d’un programme

### Route

```text
/app/programs/:programId
```

### Contenu

- nom ;
- objectif ;
- description ;
- statut ;
- séances du programme ;
- fréquence ou organisation facultative ;
- date de modification.

### Actions

- activer ;
- modifier ;
- dupliquer ;
- archiver ;
- démarrer une séance ;
- demander une adaptation IA, phase future.

## 17. Éditeur de programme

### Routes

```text
/app/programs/new
/app/programs/:programId/edit
```

### Structure

1. Informations générales.
2. Liste des séances.
3. Édition d’une séance.
4. Résumé.
5. Enregistrement.

### Contraintes

- sauvegarde de brouillon ;
- alerte avant sortie avec modifications non enregistrées ;
- réorganisation tactile ;
- duplication de séance ;
- suppression avec confirmation.

## 18. Éditeur de séance modèle

### Routes

```text
/app/programs/:programId/workouts/new
/app/programs/:programId/workouts/:templateId/edit
```

### Contenu

- nom ;
- description ;
- liste ordonnée d’exercices ;
- nombre de séries ;
- cibles ;
- repos ;
- notes ;
- estimation de durée.

### Actions

- ajouter un exercice ;
- dupliquer un exercice ;
- réordonner ;
- modifier les séries ;
- supprimer ;
- enregistrer.

## 19. Prévisualisation avant séance

### Route proposée

```text
/app/workouts/new?templateId=:templateId
```

### Objectif

Permettre de vérifier et adapter la séance avant son démarrage.

### Contenu

- exercices ;
- séries ;
- charge suggérée ;
- dernière performance ;
- durée estimée ;
- équipement ;
- restrictions ou avertissements.

### Actions

- démarrer ;
- modifier temporairement ;
- annuler ;
- créer une séance partagée.

## 20. Page de séance individuelle active

### Route

```text
/app/workouts/active
```

### Objectif

Être l’écran principal utilisé pendant l’entraînement.

### Mode d’affichage

Cette page peut utiliser un layout plein écran sans navigation mobile habituelle.

### En-tête

- nom de séance ;
- durée écoulée ;
- état réseau ;
- état de synchronisation ;
- menu secondaire ;
- bouton terminer.

### Carte de l’exercice courant

- nom ;
- équipement ;
- dernière performance ;
- cible ;
- notes ;
- progression dans les séries.

### Saisie de série

- charge ;
- répétitions ou durée ;
- RIR/RPE ;
- indication d’échec ;
- statut ;
- bouton de validation.

### Navigation dans la séance

- exercice précédent ;
- exercice suivant ;
- liste complète ;
- ajout d’exercice ;
- remplacement ;
- réorganisation.

### Chronomètre

- temps restant ;
- pause ;
- ajout ou retrait de temps ;
- terminer le repos.

### États particuliers

- hors ligne ;
- synchronisation en attente ;
- conflit ;
- session expirée ;
- séance terminée ailleurs.

## 21. Liste compacte de la séance active

Une bottom sheet ou page secondaire permet de voir :

- tous les exercices ;
- séries réalisées ;
- séries restantes ;
- exercice courant ;
- exercices ignorés ;
- progression globale.

L’utilisateur peut sélectionner directement un exercice.

## 22. Résumé de séance

### Route

```text
/app/workouts/:workoutSessionId
```

### Contenu

- nom ;
- date ;
- durée ;
- statut ;
- exercices ;
- séries ;
- volume ;
- records ;
- notes ;
- comparaison avec la dernière séance.

### Actions

- ajouter une note ;
- corriger une donnée selon les droits ;
- dupliquer comme modèle ;
- partager un résumé non sensible, phase future.

## 23. Historique des séances

### Route

```text
/workouts
```

(Doc historique `/app/workouts/history` : le shell frontend n’utilise pas le préfixe `/app`.)

### Contenu (jalon 3.6)

- liste chronologique des séances `COMPLETED` / `CANCELLED` ;
- filtres statut + plage de dates (URL) ;
- pagination « Charger plus » ;
- cartes avec résumé de séries ;
- détail lecture seule `/workouts/:workoutSessionId` ;
- badge local « En attente de synchronisation » pour une fin/annulation hors ligne non confirmée.

### Hors périmètre actuel

- calendrier ;
- recherche plein texte ;
- records / progression / graphiques ;
- duplication ou relance d’une ancienne séance ;
- modification / suppression définitive.

## 24. Vue globale de progression

### Route

```text
/app/progress/overview
```

### Contenu

- fréquence d’entraînement ;
- durée totale ;
- volume ;
- records récents ;
- exercices les plus pratiqués ;
- évolution par période ;
- poids, si disponible.

### Règle

Les graphiques doivent répondre à une question précise. Ils ne doivent pas être ajoutés uniquement pour décorer.

## 25. Progression d’un exercice

### Route

```text
/app/progress/exercises/:exerciseId
```

### Contenu

- exercice ;
- équipement sélectionné ;
- période ;
- charge maximale ;
- 1RM estimé ;
- volume ;
- répétitions ;
- records ;
- graphique ;
- liste des meilleures séries.

### Filtres

- équipement ;
- période ;
- séries de travail uniquement ;
- inclure ou exclure l’échauffement.

## 26. Création d’une séance partagée

### Route

```text
/app/shared-workouts/new
```

### Étapes

1. Choisir une séance.
2. Définir les équipements disponibles.
3. Définir les options de salle.
4. Créer la salle.
5. Partager l’invitation.

### Informations

- nom ;
- modèle ;
- capacité ;
- durée cible ;
- équipements ;
- expiration du code.

## 27. Rejoindre une séance partagée

### Routes

```text
/invite/:invitationCode
/app/shared-workouts/join
```

### Contenu

- informations de la salle ;
- hôte ;
- participants ;
- séance ;
- validité de l’invitation ;
- bouton Rejoindre.

### États

- invitation valide ;
- expirée ;
- révoquée ;
- salle complète ;
- salle terminée ;
- connexion requise ;
- déjà membre.

## 28. Lobby d’une séance partagée

### Route

```text
/app/shared-workouts/:roomId/lobby
```

### Contenu

- hôte ;
- participants ;
- statuts de présence ;
- équipements ;
- séance ;
- rotation proposée ;
- code d’invitation ;
- durée cible.

### Actions de l’hôte

- partager ;
- révoquer le code ;
- retirer un participant ;
- modifier les équipements ;
- recalculer la rotation ;
- démarrer.

### Actions des participants

- confirmer prêt ;
- déclarer une restriction ;
- consulter leur plan ;
- quitter.

## 29. Séance partagée active

### Route

```text
/app/shared-workouts/:roomId/active
```

### Objectif

Afficher uniquement les informations nécessaires au participant connecté.

### En-tête

- statut de connexion ;
- durée ;
- participants ;
- version ou synchronisation en cas de problème ;
- bouton menu.

### Station actuelle

- exercice ;
- machine ;
- charge personnelle ;
- cible personnelle ;
- série courante ;
- repos ;
- prochain passage.

### État du groupe

Vue secondaire :

- participant ;
- station ;
- statut ;
- progression ;
- attente éventuelle.

### Actions participant

- enregistrer sa série ;
- indiquer une pause ;
- signaler un problème ;
- consulter la rotation ;
- terminer sa partie.

### Actions hôte

- réaffecter une station ;
- mettre la salle en pause ;
- retirer une station ;
- gérer un participant ;
- terminer la séance.

## 30. Résumé de séance partagée

### Route

```text
/app/shared-workouts/:roomId/summary
```

### Contenu individuel

- performances personnelles ;
- records ;
- durée ;
- exercices ;
- charges ;
- notes.

### Contenu partagé

- durée totale ;
- participants ;
- séries réalisées ;
- rotation ;
- éventuels temps d’attente.

Les performances privées d’un autre participant ne sont affichées que s’il a choisi de les partager.

## 31. Nutrition du jour

### Route

```text
/app/nutrition/today
```

### Contenu

- date ;
- objectif calorique ;
- calories consommées ;
- protéines ;
- glucides ;
- lipides ;
- dépense sportive estimée séparée ;
- repas de la journée.

### Actions

- ajouter un aliment ;
- ajouter un repas enregistré ;
- copier un repas ;
- modifier les objectifs ;
- changer la date.

## 32. Journal nutritionnel

### Route

```text
/app/nutrition/history
```

### Contenu

- calendrier ;
- moyenne ;
- jours récents ;
- objectifs historiques ;
- filtres ;
- tendances.

## 33. Catalogue alimentaire

### Route

```text
/app/nutrition/foods
```

### Contenu

- recherche ;
- récents ;
- favoris ;
- aliments personnels ;
- bouton Nouvel aliment.

## 34. Création d’un aliment

### Route

```text
/app/nutrition/foods/new
```

### Contenu

- nom ;
- marque ;
- quantité de référence ;
- unité ;
- calories ;
- protéines ;
- glucides ;
- lipides ;
- fibres ;
- sel ;
- source facultative.

## 35. Recettes

### Routes

```text
/app/nutrition/recipes
/app/nutrition/recipes/new
/app/nutrition/recipes/:recipeId
```

### Contenu

- nom ;
- ingrédients ;
- quantités ;
- portions ;
- valeurs calculées ;
- instructions facultatives.

## 36. Mesures corporelles

### Route

```text
/app/nutrition/body
```

### Contenu

- poids récent ;
- tendance ;
- graphique ;
- liste des mesures ;
- bouton Ajouter.

### Règle

Une variation journalière ne doit pas être présentée comme une tendance significative.

## 37. Coach IA

### Route

```text
/app/coach
```

### Entrées possibles

- créer un programme ;
- créer une séance ;
- analyser une progression ;
- proposer une adaptation ;
- proposer une alternative.

### Page de proposition

```text
/app/coach/proposals/:proposalId
```

Contenu :

- résultat structuré ;
- explication ;
- hypothèses ;
- avertissements ;
- données utilisées ;
- boutons accepter, modifier ou refuser.

## 38. Notifications

### Route

```text
/app/notifications
```

### Contenu

- invitations ;
- rappels ;
- changements importants ;
- sécurité du compte ;
- état lu ou non lu.

Cette page ne remplace pas les notifications système.

## 39. Profil

### Route

```text
/app/profile
```

### Contenu

- nom ;
- objectif ;
- niveau ;
- unités ;
- statistiques synthétiques ;
- accès aux paramètres.

## 40. Paramètres

### Routes

```text
/app/settings/account
/app/settings/preferences
/app/settings/notifications
/app/settings/privacy
/app/settings/data
/app/settings/sessions
```

### Compte

- email ;
- mot de passe ;
- vérification ;
- suppression.

### Préférences

- unités ;
- timezone ;
- RIR/RPE ;
- thème ;
- comportement des chronomètres.

### Notifications

- permission ;
- abonnements ;
- catégories ;
- horaires silencieux.

### Confidentialité

- données utilisées ;
- consentements IA ;
- visibilité partagée.

### Données

- export ;
- import futur ;
- suppression ;
- historique des exports.

### Sessions

- appareils connectés ;
- dernière activité ;
- révocation.

## 41. Administration

Les pages administratives ne doivent pas apparaître pour un utilisateur standard.

### Utilisateurs

- recherche ;
- statut ;
- désactivation ;
- historique administratif limité.

### Catalogue

- création d’exercice système ;
- modification ;
- archivage ;
- gestion des groupes musculaires ;
- gestion des équipements.

## 42. Pages d’erreur

### 401 — Session requise

Proposer une reconnexion et conserver la destination initiale.

### 403 — Accès interdit

Expliquer que l’utilisateur ne possède pas les droits.

### 404 — Ressource introuvable

Proposer un retour vers la section concernée.

### 409 — Conflit

Afficher les données locales et serveur lorsque nécessaire.

### 500 — Erreur interne

Afficher un message neutre et un identifiant de suivi facultatif.

### Hors ligne

Expliquer quelles fonctions restent disponibles.

## 43. Protection des routes

### Routes publiques

- login ;
- register ;
- mot de passe oublié ;
- réinitialisation ;
- vérification ;
- invitation avant authentification.

### Routes authentifiées

Toutes les routes sous `/app`.

### Routes administratives

Routes sous `/app/admin` avec rôle adapté.

### Séance partagée

L’utilisateur doit être membre de la salle ou posséder une invitation valide.

## 44. Gestion des redirections

Après connexion, l’utilisateur doit revenir vers l’action initialement demandée lorsque cela est sûr.

Exemple :

```text
invitation → connexion → lobby de la séance
```

Une route invalide ou interdite ne doit pas créer de boucle de redirection.

## 45. Développement par phase

Les routes doivent être ajoutées uniquement lorsque la phase correspondante est développée.

Les pages futures ne doivent pas être remplies de fonctionnalités factices.

Une page marquée « bientôt disponible » peut être utilisée ponctuellement, mais elle ne doit pas encombrer la navigation principale.
