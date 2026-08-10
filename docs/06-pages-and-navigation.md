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

Le shell frontend **n’utilise pas** de préfixe `/app`. Les routes authentifiées sont à la racine.

Structure cible (routes livrées en gras conceptuel via commentaires) :

```text
/
├── login
├── register
├── forgot-password
├── reset-password
├── verify-email                    # futur
├── invite/:invitationCode          # futur (codes publics — hors Shared 5.2)
│
├── profile                         # livré
├── planning                        # livré
├── exercises                       # livré
│   ├── new
│   └── :exerciseId
│       └── edit
│
├── programs                        # livré
│   ├── new
│   └── :programId
│       ├── edit
│       └── schedule
│
├── workouts                        # historique (jalon 3.6)
│   ├── active                      # séance interactive (jalons 3.4–3.5)
│   └── :workoutSessionId           # détail ; lecture seule si COMPLETED/CANCELLED
│
├── shared-workouts                 # Shared 5.1 + 5.2 livrés
│   ├── new                         # livré
│   ├── invitations                 # Shared 5.2 — invitations reçues
│   ├── join                        # futur (codes / liens publics)
│   └── :roomId                     # livré (lobby / active / terminal + invite UI)
│       ├── lobby                   # futur (alias possible)
│       ├── active                  # futur (alias possible)
│       └── summary                 # futur
│
├── progress                        # livré (4.3–4.5 + coaching sections)
│   ├── (overview = /progress)
│   └── exercises/:exerciseId
│
├── nutrition                       # phase 6 produit — futur
│   ├── today
│   ├── history
│   ├── foods
│   ├── recipes
│   └── body
│
├── coach                           # livré (Couche Coaching 5.4)
│   └── chat                        # livré (5.6)
│
├── notifications                   # futur
├── settings                        # partiel / futur
│   ├── account
│   ├── preferences
│   └── …
│
└── admin                           # futur
    ├── users
    └── exercises
```

> Routes coaching livrées : `/coach`, `/coach/chat`, `/progress/exercises/:exerciseId`.
> `/coach/proposals/:proposalId` reste **futur** (génération de programme) — hors Couche Coaching 5.1–5.6.
> « Phase 5 » / Shared (`shared-workouts`) = roadmap **Séances partagées** :
> **Shared 5.1 + 5.2 livrés** (`/shared-workouts`, `/new`, `/invitations`, `/:roomId`) ;
> join par code / lobby dédié / Socket.IO = jalons suivants.

## 4. Navigation mobile principale

La navigation mobile utilise une barre inférieure persistante hors séance active.

Proposition alignée sur la phase 3 livrée :

```text
Accueil | Planning | Historique | Records | Progression | Programmes | Exercices | Profil
```

Routes : `/`, `/planning`, `/workouts`, `/records`, `/progress`, `/coach`, `/programs`, `/exercises`, `/profile`.
Progression par exercice : `/progress/exercises/:exerciseId` (jalon 4.3 + sections coaching).
Chat Coach : `/coach/chat` (jalon 5.6).

### 4.1 Accueil / Planning

Accès au planning hebdomadaire, au programme courant et au démarrage d’une séance depuis un modèle.

### 4.2 Historique

Accès à `/workouts` (séances `COMPLETED` / `CANCELLED`).

### 4.3 Records et progression

Accès à `/records` (jalon 4.1) : records personnels **réels** courants calculés à la demande
(`MAX_WEIGHT`, `MAX_REPS`, `MAX_DURATION`, `MAX_DISTANCE`).

Dashboard global : `/progress` (jalon 4.4). Progression par exercice :
`/progress/exercises/:exerciseId` (jalon 4.3), avec section force estimée e1RM pour
`WEIGHT_REPS` (jalon 4.5).

### 4.4 Programmes et exercices

Accès aux programmes, modèles et catalogue d’exercices (`/programs`, `/exercises`). Le détail exercice affiche une section « Records personnels » et un lien vers la progression.

### 4.5 Progression (livrée)

Routes et navigation livrées en phase 4 :

#### `/records`

- records personnels réels (`MAX_WEIGHT`, `MAX_REPS`, `MAX_DURATION`, `MAX_DISTANCE`) ;
- contexte (charge/reps, équipement snapshot) ;
- liens vers séance et exercice.

#### `/progress`

- dashboard global ;
- filtres de période (30 j / 3 mois / 6 mois / 1 an / **Tout** via `?period=all` / personnalisé) ;
- défaut sans paramètres : **3 mois** ;
- totaux, fréquence, timeline (DAY/WEEK/MONTH) ;
- records récents de la période ;
- exercices les plus pratiqués → `/progress/exercises/:id`.

#### `/progress/exercises/:exerciseId`

- progression temporelle par exercice ;
- métriques compatibles avec le type de mesure ;
- graphique + liste accessible des points ;
- mêmes presets de période que le dashboard (`?period=all` = tout l’historique) ;
- section **Force estimée** (e1RM Epley V1) pour `WEIGHT_REPS` ;
- section **Analyse de progression** / plateau (5.3) ;
- section **Coach** (5.4) — synthèse déterministe + actions de navigation ;
- explication IA à la demande (5.5) — distincte du résumé déterministe, uniquement si `ai.available`.

#### `/coach` (jalon 5.4 + 5.5)

Synthèse Coach déterministe (overview sans appel LLM) :

- titre + courte explication ;
- cartes d’attention (REVIEW / PLATEAU / WATCH / PROGRESSING) ;
- liens vers `/progress/exercises/:id`.

Les explications IA se génèrent uniquement depuis le détail exercice, jamais en masse sur `/coach`.

#### `/coach/chat` (jalon 5.6)

Chat multi-tour :

- liste des conversations ;
- messages USER / ASSISTANT ;
- références cliquables (exercice / progression / séance) ;
- suggestions de suivi ;
- offline → action désactivée.

### 4.6 Profil

Accès au profil et à la déconnexion (`/profile`), avec confirmation si des commandes hors ligne sont en attente.

## 5. Navigation desktop

Sur desktop, la navigation principale peut utiliser une barre latérale ou la même barre que le mobile.

Sections livrées :

- Accueil ;
- Planning ;
- Historique (`/workouts`) ;
- Records (`/records`) ;
- Progression (`/progress`, `/progress/exercises/:exerciseId`) ;
- Coach (`/coach`) ;
- Séances partagées (`/shared-workouts`, `/shared-workouts/invitations`) — Shared 5.1 + 5.2 ;
- Programmes ;
- Exercices ;
- Profil.

Sections futures :

- Nutrition ;
- Join shared par code / lien public (hors Shared 5.2) ;
- Coach IA (génération programme) ;
- Paramètres avancés.

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
/onboarding
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
/today
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
/dashboard
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
/exercises
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
/exercises/:exerciseId
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
/exercises/new
/exercises/:exerciseId/edit
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
/programs
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
/programs/:programId
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
/programs/new
/programs/:programId/edit
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
/programs/:programId/workouts/new
/programs/:programId/workouts/:templateId/edit
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
/workouts/new?templateId=:templateId
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
/workouts/active
```

### Objectif

Être l’écran principal interactif utilisé pendant l’entraînement (jalons 3.4–3.5).

### Mode d’affichage

Interface dédiée ; la barre de navigation principale peut rester visible ou être secondaire selon le layout.

### En-tête

- nom de séance ;
- statut (`ACTIVE` / `PAUSED`) ;
- progression globale des séries ;
- état réseau / synchronisation ;
- actions pause, reprise, terminer, annuler (selon permissions serveur).

### Exercice courant

- nom snapshot ;
- équipement snapshot ;
- type de mesure ;
- notes snapshot ;
- navigation précédent / suivant (`?exerciseId=`).

### Saisie de série

- cibles (lecture seule) ;
- résultats réels ;
- RIR/RPE ;
- indication d’échec musculaire ;
- statut ;
- validation / ignore / échec.

### Chronomètre de repos (local)

- temps restant ;
- pause / reprise ;
- +15 s / −15 s ;
- restauration via `localStorage` sur le même navigateur ;
- aucune mutation API.

### États particuliers

- hors ligne ;
- synchronisation en attente ;
- conflit de version ;
- session expirée ;
- séance terminée ailleurs.

### Hors périmètre de cette page (phase 3)

- ajout / suppression / réordonnancement d’exercices ou de séries ;
- modification des cibles ;
- dernière performance / copie de charges ;
- volume officiel ou records.

## 21. Liste compacte de la séance active

Une bottom sheet ou page secondaire permet de voir :

- tous les exercices ;
- séries réalisées ;
- séries restantes ;
- exercice courant ;
- exercices ignorés ;
- progression globale.

L’utilisateur peut sélectionner directement un exercice.

## 22. Détail d’une séance

### Route

```text
/workouts/:workoutSessionId
```

### Rôle (phase 3)

- si la séance est `ACTIVE` ou `PAUSED` : redirection vers `/workouts/active` ;
- si la séance est `COMPLETED` ou `CANCELLED` : détail historique en **lecture seule**.

### Contenu (lecture seule)

- nom snapshot ;
- statut ;
- date locale, début, fin ou annulation ;
- durée écoulée (si calculable ; pas une durée d’effort nette) ;
- programme / modèle snapshot ;
- notes et motif d’annulation ;
- résumé des compteurs de séries ;
- exercices et séries (cibles, résultats, statuts, RIR/RPE, échec musculaire).

### Hors périmètre actuel

- volume officiel ;
- records ;
- comparaison avec une séance précédente ;
- correction des performances ;
- duplication ;
- partage.

## 23. Historique des séances

### Route

```text
/workouts
```

### Contenu (jalon 3.6)

- liste chronologique des séances `COMPLETED` / `CANCELLED` ;
- filtres statut + plage de dates (synchronisés dans l’URL) ;
- pagination « Charger plus » ;
- cartes avec résumé de séries (noms snapshotés) ;
- lien vers le détail `/workouts/:workoutSessionId` (filtres conservés au retour) ;
- badge local « En attente de synchronisation » pour une fin/annulation hors ligne non confirmée.

### Hors périmètre actuel

- calendrier ;
- recherche plein texte ;
- duplication ou relance d’une ancienne séance ;
- modification / suppression définitive ;
- route concurrente `/history/workouts` (non utilisée).

## 23bis. Records personnels (jalon 4.1)

Route livrée :

```text
/records
```

- titre « Records personnels » ;
- liste des records courants groupés par exercice ;
- type, valeur, contexte, date, équipement si disponible ;
- liens vers la séance source et l’exercice ;
- état vide avec actions vers programmes / historique ;
- bandeau si fin de séance locale non encore synchronisée (sans annoncer de record officiel) ;
- section miroir sur `/exercises/:exerciseId` avec action « Voir ma progression ».

### Hors périmètre 4.1

- graphiques de tendance ;
- 1RM estimé ;
- volume ;
- table `PersonalRecord` matérialisée.

## 24. Vue globale de progression (jalon 4.4)

### Route livrée

```text
/progress
```

Entrée de navigation principale « Progression ».

### Contenu

1. titre + sélecteur de période (30 j / 3 mois / 6 mois / 1 an / tout / personnalisé) ;
   - défaut sans query : 3 mois ;
   - **Tout** : `?period=all` (pas de `from`/`to` ; distinct d’une URL vide) ;
2. indicateurs clés (séances, séries, volume, et conditionnellement reps / durée / distance) ;
3. fréquence (`X séances sur Y jours actifs`, moyenne / semaine si calculable) ;
4. graphique principal (une métrique à la fois, Recharts) ;
5. records récents de la période ;
6. exercices les plus pratiqués → lien `/progress/exercises/:id`.

Descriptif uniquement — pas de recommandation automatique.

### Hors périmètre 4.4

- coaching / fatigue / plateaux / objectifs ;
- calories / volume musculaire ;
- comparaison entre utilisateurs ;
- statistiques persistées.

## 25. Progression d’un exercice (jalon 4.3)

### Route livrée

```text
/progress/exercises/:exerciseId
```

Accès depuis `/exercises/:exerciseId` → « Voir ma progression ».

### Contenu

- exercice (nom catalogue actuel, y compris archivé) ;
- sélecteur de métrique (`availableMetrics` serveur) ;
- période (30 j / 3 mois / 6 mois / 1 an / tout / personnalisé) ;
  - défaut sans query : 3 mois ;
  - **Tout** : `?period=all` (historique complet ; `from`/`to` absents côté API) ;
  - presets datés : `from`/`to` locaux dans l’URL ;
- résumé (dernière, meilleure, variation début→fin, nombre de séances) ;
- graphique ligne (Recharts) — jamais seule représentation ;
- liste accessible des points avec lien « Voir la séance » ;
- section force estimée (4.5) pour `WEIGHT_REPS`, même période URL.

### Source de vérité

Séances `COMPLETED` + snapshots (`WorkoutSessionExercise` / `WorkoutSet`).
Regroupement par `sourceExerciseId` (jamais par nom). Warmups exclus de
`MAX_WEIGHT` / `MAX_REPS` / `WORKING_EXTERNAL_VOLUME`, inclus dans les totaux.
Pas de 1RM dans le contrat 4.3 (voir section Force estimée 4.5), pas de recommandations, pas de métriques persistées.

### Hors périmètre 4.3

- pace / vitesse ;
- heatmap ;
- comparaison entre utilisateurs.

> Le dashboard global `/progress` est livré en 4.4.
> La section « Force estimée » (e1RM Epley V1) est livrée en 4.5 sur la même page.

## 25bis. Force estimée (jalon 4.5)

Sur `/progress/exercises/:exerciseId` pour les exercices `WEIGHT_REPS` :

- e1RM actuel / meilleure estimation / variation ;
- formule Epley V1 (1–12 reps, hors warmup, séries `COMPLETED`) ;
- graphique dédié « 1RM estimé » + liste accessible ;
- distinction claire vs charge maximale réelle (`MAX_WEIGHT`) ;
- même période URL que la progression 4.3 (`?period=all` inclus) ;
- endpoint `GET /api/v1/progress/exercises/:exerciseId/strength`.

Hors scope 4.5 : autres formules, 1RM RIR/RPE, recommandations, matérialisation, mélange dans `/records`.

## 26. Création d’une séance partagée

### Route

```text
/shared-workouts/new
```

> **Shared 5.1 (livré)** — formulaire minimal (nom optionnel).  
> Sélection de modèle, équipements et capacité = jalons ultérieurs.
> Invitation par email = Shared 5.2 (depuis le détail salle).

### Shared 5.1 — étapes

1. Saisir un nom de salle (ou laisser le défaut serveur).
2. Créer la salle.
3. Naviguer vers `/shared-workouts/:roomId`.
4. *(Shared 5.2)* Inviter des comptes par email depuis le détail.

### Cible produit (ultérieur)

1. Choisir une séance.
2. Définir les équipements disponibles.
3. Définir les options de salle.
4. Créer la salle.
5. Partager un code / lien public (hors Shared 5.2).

### Informations Shared 5.1

- nom (1–80, trim ; défaut « Séance partagée »).

### Liste

```text
/shared-workouts
```

Affiche les salles dont l’utilisateur est **membre actif** (filtre `status`, pagination cursor).
État vide + CTA « Créer une salle ». Lien vers `/shared-workouts/invitations`.

### Lobby / détail unifié Shared 5.1 + 5.2

```text
/shared-workouts/:roomId
```

Selon `status` : préparation (LOBBY), en cours (ACTIVE), terminée / annulée (read-only).
Actions owner : renommer (LOBBY/ACTIVE), démarrer, terminer, annuler ;
inviter par email + lister / annuler les `PENDING` (LOBBY/ACTIVE).
Actions MEMBER actif : quitter la salle (LOBBY/ACTIVE).
Membres affichés = memberships actifs uniquement (`leftAt IS NULL`).

### Invitations reçues (Shared 5.2)

```text
/shared-workouts/invitations
```

Liste des invitations reçues (filtre `status`, cursor). Actions : accepter / refuser
les `PENDING`. Acceptation → membership `MEMBER` puis navigation vers la salle.

## 27. Rejoindre une séance partagée

> **Shared 5.2 livré** via invitations email (`/shared-workouts/invitations`).
> Les routes ci-dessous (codes / liens publics) restent **futures**.

### Routes futures (codes)

```text
/invite/:invitationCode
/shared-workouts/join
```

### Contenu (cible codes)

- informations de la salle ;
- hôte ;
- participants ;
- séance ;
- validité de l’invitation ;
- bouton Rejoindre.

### États (cible codes)

- invitation valide ;
- expirée ;
- révoquée ;
- salle complète ;
- salle terminée ;
- connexion requise ;
- déjà membre.

## 28. Lobby d’une séance partagée

> En Shared 5.1 / 5.2 le lobby est unifié sur `/shared-workouts/:roomId`
> (invite email + leave). Route dédiée / présence / codes = jalons suivants.

### Route

```text
/shared-workouts/:roomId/lobby
```

### Contenu (cible)

- hôte ;
- participants ;
- statuts de présence ;
- équipements ;
- séance ;
- rotation proposée ;
- code d’invitation (futur) ;
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
/shared-workouts/:roomId/active
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
/shared-workouts/:roomId/summary
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
/nutrition/today
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
/nutrition/history
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
/nutrition/foods
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
/nutrition/foods/new
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
/nutrition/recipes
/nutrition/recipes/new
/nutrition/recipes/:recipeId
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
/nutrition/body
```

### Contenu

- poids récent ;
- tendance ;
- graphique ;
- liste des mesures ;
- bouton Ajouter.

### Règle

Une variation journalière ne doit pas être présentée comme une tendance significative.

## 37. Coach (Couche Coaching livrée)

> `/coach` et `/coach/chat` sont **livrés** (jalons techniques 5.4 / 5.6).
> La génération de programme / `/coach/proposals/:proposalId` reste **hors scope** actuel.

### Routes livrées

```text
/coach
/coach/chat
/progress/exercises/:exerciseId   # sections Coach + plateau + explication IA
```

### Contenu `/coach`

- overview déterministe (REVIEW / PLATEAU / WATCH / PROGRESSING) ;
- lien « Discuter avec le Coach » → `/coach/chat` ;
- **aucune** génération IA en masse au chargement.

### Contenu `/coach/chat`

- conversations persistées ;
- messages USER / ASSISTANT ;
- outils lecture seule côté serveur ;
- offline : envoi impossible.

### Page de proposition (futur — hors 5.1–5.6)

```text
/coach/proposals/:proposalId
```

Contenu futur :

- résultat structuré ;
- explication ;
- hypothèses ;
- avertissements ;
- données utilisées ;
- boutons accepter, modifier ou refuser.

## 38. Notifications

### Route

```text
/notifications
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
/profile
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
/settings/account
/settings/preferences
/settings/notifications
/settings/privacy
/settings/data
/settings/sessions
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

Routes à la racine du shell (sans préfixe `/app`), par exemple `/planning`, `/programs`, `/exercises`, `/workouts`, `/workouts/active`, `/profile`.

### Routes administratives

Routes sous `/admin` avec rôle adapté.

### Séance partagée

L’utilisateur doit être **membre actif** de la salle, ou accéder aux invitations
reçues (`/shared-workouts/invitations`) pour accept / decline.

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
