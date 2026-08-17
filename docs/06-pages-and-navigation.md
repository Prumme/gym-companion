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
├── share/:token                    # preview publique + import (auth)
├── verify-email                    # futur
├── invite/:invitationCode          # futur (lien public Shared — hors V1)
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
├── shared-workouts                 # Shared 5.1 → 5.4 livrés
│   ├── new                         # livré
│   └── :roomId                     # livré (lobby + code owner + Ma séance 5.4 + présence 5.3)
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
> **Shared 5.1 → 5.4 livrés** (`/shared-workouts`, `/new`, `/:roomId`
> avec code d’accès owner, join-by-code sheet, présence Socket.IO + section Ma séance) ;
> rotation / sync séries = **Shared 5.5+**.

## 4. Navigation mobile principale

La navigation mobile utilise une barre inférieure persistante hors séance active.

**Règle stricte :** exactement **4** emplacements — 3 destinations métier + « Plus ».
Aucun scroll horizontal.

```text
Accueil | Entraînement | Progression | Plus
```

| Item | Route hub | Domaine (routes conservées) |
|------|-----------|-----------------------------|
| Accueil | `/` | Accueil |
| Entraînement | `/training` | `/planning`, `/programs`, `/workouts` |
| Progression | `/progress` | `/progress/overview`, `/records`, `/progress/exercises/:id` |
| Plus (sheet) | — | `/exercises`, `/shared-workouts`, `/coach`, `/profile` |

Les deep links historiques restent valides. Pendant `/workouts/active` : **mode focus** (barre masquée).

### 4.1 Accueil / Entraînement

Hub Entraînement (`/training`) → Planning, Programmes, Historique.
Accueil : programme courant ou empty state (créer / choisir un programme).

### 4.2 Historique

Accès via hub Entraînement → `/workouts` (séances `COMPLETED` / `CANCELLED`).

### 4.3 Records et progression

Hub Progression (`/progress`) = vue d’ensemble (UX-4). Records (`/records`).
`/progress/overview` est un alias de la même page.
Records n’est **pas** une destination bottom-nav indépendante.

Dashboard : `/progress` (jalon 4.4 / UX-4). Progression par exercice :
`/progress/exercises/:exerciseId` (jalon 4.3), avec section force estimée e1RM pour
`WEIGHT_REPS` (jalon 4.5).

### 4.4 Programmes et exercices

Programmes via hub Entraînement (`/programs`). Exercices via menu Plus (`/exercises`).

### 4.5 Progression (livrée)

Routes et navigation livrées en phase 4 :

#### `/records`

- records personnels réels (`MAX_WEIGHT`, `MAX_REPS`, `MAX_DURATION`, `MAX_DISTANCE`) ;
- hero « Dernier record battu » si données ;
- lignes compactes groupées par exercice ;
- navigation vers `/progress/exercises/:id`.

#### `/progress` (vue d’ensemble)

- résumé activité + performances (entrée bottom nav) ;
- chips de période + métrique compacte ;
- tuiles, graphique, records récents, tops exercices ;
- lien vers `/records`.

#### `/progress/overview`

Alias de `/progress` (rétrocompatibilité).

#### `/progress/exercises/:exerciseId`

- progression temporelle par exercice ;
- métriques compatibles avec le type de mesure ;
- graphique + liste accessible des points ;
- mêmes presets de période que le dashboard (`?period=all` = tout l’historique) ;
- section **Force estimée** (e1RM Epley V1) pour `WEIGHT_REPS` ;
- section **Analyse de progression** / plateau (5.3) ;
- section **Coach** (5.4) — synthèse déterministe + actions de navigation ;
- explication IA à la demande (5.5) — distincte du résumé déterministe, uniquement si `ai.available`.

#### `/coach` (jalon 5.4 + UX-8)

Synthèse Coach déterministe (overview sans appel LLM) :

- lignes denses « À surveiller » (pas de cards) ;
- liens vers `/progress/exercises/:id` ;
- section séparée « Poser une question » (IA soft-disable).

Les explications IA se génèrent uniquement depuis le détail exercice, jamais en masse sur `/coach`.

#### `/coach/chat` (jalon 5.6 + UX-8)

Chat multi-tour read-only :

- suggestions initiales ;
- messages USER / ASSISTANT (pas de bulles ChatGPT) ;
- données consultées (labels humains) ;
- composer compact + safe-area ;
- offline / busy / rate-limit → messages humains.

### 4.6 Profil

Accès via menu **Plus** → `/profile`, avec confirmation si des commandes hors ligne
sont en attente.

## 5. Navigation desktop

À partir de `md` (~768px) : **sidebar compacte** (pas de bottom nav étirée).
Même configuration que le mobile (`nav-config.ts`).

```text
Gym Companion
Accueil
Entraînement
Progression
----------
Plus
  Entraînement — Exercices, Séances partagées
  Coaching — Coach
  Compte — Profil
```

Sections futures :

- Nutrition ;
- Join shared par code / lien public (hors Shared 5.2) ;
- Paramètres (page dédiée absente — ne pas inventer dans Plus) ;
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
- code d’accès nécessitant une connexion pour rejoindre.

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

- salle partagée en attente de join ;
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
- codes d’accès / salles partagées ;
- raccourcis.

La page ne doit pas devenir une accumulation de cartes sans hiérarchie.

## 12. Liste des exercices

### Route

```text
/exercises
```

### Contenu (UX-7)

- header compact + CTA `+ Créer` ;
- recherche sticky (debounce URL) ;
- filtres en bottom sheet + chips actives ;
- liste dense (lignes, pas cards) ;
- empty state compact ;
- infinite query « Charger plus ».

### Filtres

- groupe musculaire ;
- équipement ;
- type de mesure ;
- source ;
- favoris ;
- archivés, uniquement sur demande.

### Ligne d’exercice

- nom (prioritaire) ;
- muscle · équipement ;
- type de mesure ;
- badge Personnel si `USER` (pas de badge SYSTEM) ;
- favori actionnable ;
- archivé si applicable.

## 13. Détail d’un exercice

### Route

```text
/exercises/:exerciseId
```

### Sections (UX-7)

- header + favori ; résumé muscle · équipement · mesure · repos ;
- instructions repliables ;
- équipement ;
- préférences (édition en sheet, reset secondaire) ;
- progression → `/progress/exercises/:id` ;
- records ;
- gestion (edit/archive) si permissions.

### Actions

- modifier / archiver / restaurer si permissions ;
- ouvrir la progression.

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
/programs/:programId?templateId=:templateId   # éditeur focused d’une séance
```

### Contenu

- header compact (retour, nom, badge Actif/Archivé, menu `…`) ;
- liste des séances (nom, nb exercices / séries) — pas le détail inline de toutes les séances ;
- activation / archivage en sections secondaires ;
- lien Planning conservé dans le menu.

Tap sur une séance → éditeur focused (`templateId`). Voir aussi `docs/07-ui-ux-guidelines.md` § Program Builder.

### Actions

- activer ;
- modifier les informations ;
- archiver / restaurer ;
- ajouter une séance ;
- **partager** (lien temporaire 1 h) ;
- démarrer une séance (depuis l’éditeur).

Dans l’éditeur focused d’une séance : **Partager la séance**.

## 16bis. Page de partage (`/share/:token`)

### Route

```text
/share/:token
```

Accessible hors `ProtectedRoute` (preview publique). Import nécessite authentification ; redirection login avec conservation du path.

### Contenu

- titre ressource (programme ou séance) — **sans** auteur ;
- résumé séances / exercices / sets ;
- CTA import ;
- états expiré / invalide.

### Routes

```text
/programs/new
/programs/:programId/edit
```

### Structure

1. Informations générales (nom, objectif, description facultative).
2. Sur le détail : liste des séances puis éditeur focused.

### Contraintes

- alerte avant sortie avec modifications non enregistrées ;
- réorganisation via menus contextuels (pas de flèches permanentes) ;
- suppression avec confirmation.

## 18. Éditeur de séance modèle

### Routes

```text
/programs/:programId?templateId=:templateId
```

(Anciennes routes `/workouts/new` et `/workouts/:templateId/edit` sous programme : non utilisées par le builder UX-3 ; l’édition passe par le query param ci-dessus.)

### Contenu

- header (retour programme, nom séance, compteurs, menu `…`) ;
- sections exercices compactes ;
- `TargetSetRow` pour les séries cibles ;
- recommandation de charge en ligne compacte ;
- bottom sheet pour ajouter / modifier une série.

### Actions

- ajouter un exercice (catalogue existant) ;
- réordonner exercice / série via menu ;
- modifier / supprimer avec confirmation ;
- démarrer la séance.

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

### Contenu (lecture seule, UX-5)

- header résumé (nom · date · durée · programme/modèle · statut) — pas de dump `Label : valeur` ;
- synthèse compacte (compteurs non nuls + barre de progression) ;
- liste d’exercices compacte → séries read-only (`WorkoutSetCard`) ;
- métadonnées secondaires (timestamps, notes, motif) dans une section « Détails » repliable.

### Hors périmètre actuel

- volume « inventé » hors `metrics` existantes ;
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

### Contenu (UX-5)

- header « Historique / Tes séances passées » ;
- filtres compacts : chips statut + sheet période (`status`, `from`, `to` URL) ;
- timeline groupée (Aujourd’hui / Hier / mois) en lignes compactes ;
- pagination « Charger plus » ;
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

1. titre + lien Records + chips de période (1 mois / 3 mois / 6 mois / 1 an / tout / perso.) ;
   - défaut sans query : 3 mois ;
   - **Tout** : `?period=all` (pas de `from`/`to` ; distinct d’une URL vide) ;
2. métrique du graphique (select compact) ;
3. tuiles de synthèse (séances, séries, volume, exercices… + deltas si dispo) ;
4. fréquence (`X séances sur Y jours actifs`) ;
5. graphique principal (titre métrique + valeur récente + Recharts) ;
6. records récents (lignes compactes) ;
7. exercices les plus pratiqués → lien `/progress/exercises/:id`.

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
> Code d’accès auto-généré à la création (Shared 5.2).

### Shared 5.1 — étapes

1. Saisir un nom de salle (ou laisser le défaut serveur).
2. Créer la salle.
3. Naviguer vers `/shared-workouts/:roomId`.
4. *(Shared 5.2)* Copier / partager le code d’accès depuis le détail (owner).

### Cible produit (ultérieur)

1. Choisir une séance.
2. Définir les équipements disponibles.
3. Définir les options de salle.
4. Créer la salle.
5. Partager un lien public `/invite/:code` (hors V1).

### Informations Shared 5.1

- nom (1–80, trim ; défaut « Séance partagée »).

### Liste

```text
/shared-workouts
```

Affiche les salles dont l’utilisateur est **membre actif** (filtre `status`, pagination cursor).
UX-6 : header + CTA « Créer une salle » et sheet « Rejoindre avec un code » ;
salles en lignes compactes ; empty state avec un seul CTA « Créer une salle ».

### Lobby / détail unifié Shared 5.1 → 5.4 (UX-6)

```text
/shared-workouts/:roomId
```

Selon `status` : préparation (LOBBY), en cours (ACTIVE), terminée / annulée (read-only).
Header compact + menu `…` selon rôle.
Actions owner : renommer (LOBBY/ACTIVE), démarrer, terminer, annuler ;
afficher / copier / rotater le code d’accès (LOBBY/ACTIVE).
Actions MEMBER actif : quitter la salle (LOBBY/ACTIVE).
Membres affichés = memberships actifs uniquement (`leftAt IS NULL`).
Bottom nav globale **conservée** (pas de focus mode room).

**Présence (Shared 5.3)** — même route, pas de `/lobby` dédié :
hook `useSharedWorkoutRoomRealtime` ; ●/○ + libellés texte
« En ligne » / « Hors ligne » / « Présence inconnue ».
Pas de jargon « Temps réel connecté ». Si socket en erreur : bandeau + Actualiser (REST).
`room:changed` → invalidation TanStack Query (refetch REST).

**Ma séance (Shared 5.4)** — section Toi / Ta séance :
attach / create + lien vers `/workouts/:id` (Active Workout UX-2).

**Progression live (Shared 5.5)** — lignes participants privacy-safe (`ACTIVE` / terminal) :

- exercice courant (nom) + `X / Y séries` + % + barre ;
- **aucune** perf détaillée (poids / reps / RIR / RPE / notes / PR).

La sélection d’exercice dans `/workouts/active` synchronise l’exercice courant
serveur (online, room ACTIVE) via `PUT .../current-exercise` — **sans** transformer
l’écran workout en lobby partagé. Aucune nouvelle page obligatoire.

**Équipements (Shared 5.6 / UX-6)** — section Matériel sur room ACTIVE :

- labels humains : Disponible / Utiliser · Utilisée par X · file ordonnée ·
  Rejoindre / Quitter la file · Tu l’utilises / Libérer ;
- pas d’IDs ni `requestedAt` ;
- erreur `SHARED_EQUIPMENT_STILL_USING` → « Libère d’abord… » + CTA Libérer ;
- warnings leave / complete si occupation active.

- LOBBY : message indiquant que le rattachement sera possible après le lancement ;
- ACTIVE : GET `my-workout-session` ; rattacher une séance `ACTIVE`/`PAUSED`
  existante, ou créer depuis un template du programme actif ; lien « Ouvrir ma
  séance » vers `/workouts/:id` ou `/workouts/active` ;
- COMPLETED / CANCELLED : lecture du lien éventuel + ouverture en détail ;
- résumé `memberWorkout` visible par membre (statut / nom / Shared 5.5 :
  exercice courant + compteurs) ; **pas** d’ID ni de perfs des autres ;
- attach / create **online-only** (message connexion si offline) ;
- `MEMBER_WORKOUT_CHANGED` / Shared 5.5 progress events → refetch détail + « ma séance ».

## 27. Rejoindre une séance partagée

> **Shared 5.2 livré** — sheet « Rejoindre avec un code » depuis `/shared-workouts`
> (utilisateur authentifié). Pas de page `/shared-workouts/invitations`.

### Parcours livré

1. Ouvrir `/shared-workouts`.
2. Ouvrir la sheet « Rejoindre avec un code ».
3. Saisir le code (`XXX-XXX`, tiret optionnel).
4. Confirmer → `POST /api/v1/shared-workouts/join`.
5. Navigation vers `/shared-workouts/:roomId` en cas de succès.

### États UI

- code valide → lobby ;
- code invalide / salle terminée → « Code invalide ou expiré. » ;
- déjà membre → détail salle (idempotent) ;
- connexion requise (JWT).

### Route publique future (hors V1)

```text
/invite/:invitationCode
```

Permettrait de pré-remplir le code avant authentification ; non livré en V1.

## 28. Lobby d’une séance partagée

> En Shared 5.1–5.4 le lobby est unifié sur `/shared-workouts/:roomId`
> (code d’accès owner + join-by-code + leave + présence Socket.IO + Ma séance).
> Route dédiée `/lobby` / rotation = **Shared 5.5+**.

### Route (cible — alias optionnel)

```text
/shared-workouts/:roomId/lobby
```

### Contenu livré sur `/:roomId` (Shared 5.1–5.4)

- hôte / membres actifs ;
- libellés de présence en ligne (Shared 5.3) ;
- code d’accès owner : copier / rotater (Shared 5.2) ;
- leave (Shared 5.2) ;
- lifecycle owner (Shared 5.1) ;
- section **Ma séance** : attach / create + résumé `memberWorkout` (Shared 5.4).

### Contenu cible (Shared 5.5+)

- équipements ;
- séance / plans ;
- rotation proposée ;
- durée cible ;
- statuts participant enrichis (ready, station, etc.).

### Actions de l’hôte

- partager le code ;
- rotater le code ;
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

- overview déterministe en lignes denses (REVIEW / PLATEAU / WATCH / …) ;
- CTA IA secondaire « Demander au Coach IA » (soft-disable) ;
- **aucune** génération IA en masse au chargement.

### Contenu `/coach/chat`

- conversations persistées (liste compacte) ;
- messages USER / ASSISTANT ;
- outils lecture seule côté serveur ;
- offline / busy / rate-limit : envoi impossible ou message humain.

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

- codes d’accès / salles partagées ;
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

### Contenu (UX-7)

- identité (nom affiché, email) ;
- préférences en lecture (fuseau, unités, objectif, niveau, effort) ;
- **Modifier** → formulaire groupé ;
- déconnexion secondaire (confirm si offline pending) ;
- pas de page Paramètres / password / 2FA tant qu’absents produit.

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
- lien public `/invite/:code` (futur, hors V1).

### Routes authentifiées

Routes à la racine du shell (sans préfixe `/app`), par exemple `/planning`, `/programs`, `/exercises`, `/workouts`, `/workouts/active`, `/profile`.

### Routes administratives

Routes sous `/admin` avec rôle adapté.

### Séance partagée

L’utilisateur doit être **membre actif** de la salle. Pour rejoindre : sheet
« Rejoindre avec un code » sur `/shared-workouts` (authentification requise).

## 44. Gestion des redirections

Après connexion, l’utilisateur doit revenir vers l’action initialement demandée lorsque cela est sûr.

Exemple :

```text
code d’accès → connexion → join → lobby de la séance
```

Une route invalide ou interdite ne doit pas créer de boucle de redirection.

## 45. Développement par phase

Les routes doivent être ajoutées uniquement lorsque la phase correspondante est développée.

Les pages futures ne doivent pas être remplies de fonctionnalités factices.

Une page marquée « bientôt disponible » peut être utilisée ponctuellement, mais elle ne doit pas encombrer la navigation principale.
