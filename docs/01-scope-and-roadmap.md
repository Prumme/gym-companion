# Périmètre et roadmap

## 1. Objectif de ce document

Ce document définit :

- les fonctionnalités prévues ;
- l’ordre recommandé de développement ;
- le contenu de chaque version ;
- les dépendances entre les modules ;
- les fonctionnalités volontairement repoussées ;
- les critères permettant de considérer une phase comme terminée.

L’objectif est d’éviter de développer toutes les idées simultanément et de conserver une application utilisable à la fin de chaque phase.

## 2. Principes de planification

### 2.0 Nomenclature — Couche Coaching vs Phase produit

Deux axes de numérotation coexistent volontairement ; ils ne doivent **pas** être confondus :

| Libellé | Signification |
|---------|----------------|
| **Couche Coaching — jalons techniques 5.1 → 5.6** | Moteurs déterministes + Coach + IA explicative + chat READ ONLY, livrés **sous la Phase 4** produit (records / stats / progression / coaching). |
| **Roadmap produit Phase 5 — Séances partagées** | Collaboration multi-utilisateurs (salles, invitations, Socket.IO). **En cours** — Shared 5.1 + 5.2 livrés (salle REST, invitations email / leave). |

Un tag ou un libellé du type `phase-5.6-complete` / « jalon 5.6 livré » signifie uniquement que la **couche coaching** est clôturée — **pas** que la roadmap « Séances partagées » est terminée.

### 2.1 Chaque phase doit être utilisable

Une phase ne doit pas uniquement produire des fondations techniques.

Elle doit se terminer par un parcours utilisateur fonctionnel et testable.

### 2.2 La fiabilité précède l’intelligence

Les données d’entraînement doivent être correctement enregistrées avant d’ajouter des analyses avancées ou une intelligence artificielle.

L’IA dépend de données fiables, structurées et suffisamment nombreuses.

### 2.3 La collaboration ne dépend pas de l’IA

La rotation des machines et la synchronisation des séances partagées doivent reposer sur une logique déterministe.

L’application doit pouvoir organiser une séance partagée même si le service IA est indisponible.

### 2.4 Le mobile est prioritaire

Chaque phase doit être testée sur téléphone avant d’être considérée comme terminée.

### 2.5 Le hors ligne est progressif

La première version ne cherche pas à rendre toute l’application utilisable hors ligne.

Le mode hors ligne est d’abord limité à la consultation de données récentes et à la poursuite d’une séance individuelle déjà chargée.

## 3. Phase 0 — Fondations techniques

> Statut : **terminée**.

### 3.1 Objectif

Créer une base stable permettant de développer les modules métier sans devoir restructurer le projet à chaque nouvelle fonctionnalité.

### 3.2 Fonctionnalités incluses

#### Monorepo

- Configuration de pnpm workspaces.
- Configuration de Turborepo.
- Création de `apps/web`.
- Création de `apps/api`.
- Création de `packages/shared`.
- Création de `packages/validation`.
- Création de `packages/config`.

#### Frontend

- React avec TypeScript.
- Vite.
- React Router.
- Tailwind CSS.
- shadcn/ui.
- Lucide React.
- TanStack Query.
- Zustand.
- React Hook Form.
- Zod.
- Layout mobile-first.
- Gestion globale des erreurs.
- Pages d’erreur.
- États de chargement.
- Thème clair et sombre facultatif.

#### Backend

- NestJS.
- Prisma.
- PostgreSQL.
- Configuration des variables d’environnement.
- Documentation OpenAPI.
- Health check.
- Gestion centralisée des erreurs.
- Journalisation structurée.

#### Authentification

- Création de compte.
- Connexion.
- Déconnexion.
- Renouvellement de session.
- Hachage du mot de passe.
- Protection des routes.
- Réinitialisation du mot de passe.
- Vérification d’adresse email facultative pour la première itération.

#### Profil

- Nom affiché.
- Fuseau horaire.
- Unité de poids.
- Unité de distance.
- Objectif principal.
- Niveau d’expérience.

#### PWA

- Manifeste.
- Icônes.
- Service worker.
- Installation.
- Page hors ligne minimale.
- Détection d’une nouvelle version.

#### Infrastructure

- Docker Compose local.
- Base PostgreSQL locale.
- Reverse proxy prévu pour la production.
- Pipeline de lint.
- Typecheck.
- Tests.
- Build.

### 3.3 Hors périmètre

- Exercices.
- Séances.
- Programmes.
- Nutrition.
- WebSocket métier.
- IA.
- Notifications push métier.

### 3.4 Critères de validation

La phase est terminée lorsque :

- un utilisateur peut créer un compte ;
- il peut se connecter et se déconnecter ;
- sa session peut être renouvelée ;
- il peut modifier son profil ;
- les routes privées sont protégées ;
- l’application peut être installée comme PWA ;
- le frontend et le backend sont déployables ;
- le lint, le typecheck, les tests et le build fonctionnent ;
- aucun secret n’est présent dans le dépôt.

## 4. Phase 1 — Catalogue d’exercices

> Statut : **terminée**.

### 4.1 Objectif

Créer les fondations métier du suivi d’entraînement.

### 4.2 Fonctionnalités incluses

- Catalogue d’exercices système.
- Recherche d’exercice.
- Filtres par groupe musculaire.
- Filtres par équipement.
- Filtres par type de mesure.
- Fiche détaillée d’un exercice.
- Création d’un exercice personnalisé.
- Modification d’un exercice personnalisé.
- Archivage d’un exercice personnalisé.
- Gestion des équipements personnels.
- Définition des incréments de charge.
- Définition du temps de repos par défaut.

### 4.3 Données principales

- nom ;
- groupe musculaire principal ;
- groupes secondaires ;
- type d’équipement ;
- type de mesure ;
- instructions ;
- temps de repos ;
- visibilité système ou utilisateur.

### 4.4 Hors périmètre

- Vidéos hébergées par l’application.
- Catalogue communautaire.
- Commentaires.
- Notation des exercices.
- Reconnaissance automatique des machines.

### 4.5 Critères de validation

La phase est terminée lorsque :

- l’utilisateur peut rechercher un exercice ;
- il peut consulter ses informations ;
- il peut créer son propre exercice ;
- il peut archiver un exercice sans supprimer les futurs historiques associés ;
- les exercices système restent protégés contre les modifications utilisateur.

## 5. Phase 2 — Programmes et modèles de séance

> Statut : **terminée**.

### 5.1 Objectif

Permettre à l’utilisateur de préparer ses entraînements avant de se rendre à la salle.

### 5.2 Fonctionnalités incluses

- Création d’un programme.
- Modification d’un programme.
- Duplication d’un programme.
- Archivage d’un programme.
- Activation d’un programme.
- Création de séances modèles.
- Association de séances à un programme.
- Ajout d’exercices à une séance modèle.
- Réorganisation des exercices.
- Définition des séries.
- Définition des plages de répétitions.
- Définition des temps de repos.
- Définition d’une charge cible facultative.
- Définition d’une intensité facultative.
- Notes par exercice.
- Estimation simple de durée.

### 5.3 Hors périmètre

- Génération IA.
- Planification complexe sur plusieurs mois.
- Périodisation automatique.
- Partage public de programmes.
- Achat ou vente de programmes.

### 5.4 Critères de validation

La phase est terminée lorsque :

- l’utilisateur peut créer un programme comportant plusieurs séances ;
- chaque séance peut contenir plusieurs exercices ordonnés ;
- les objectifs de séries et répétitions peuvent être enregistrés ;
- un programme peut être activé ;
- une modification du modèle ne modifie pas les séances historiques.

## 6. Phase 3 — Séances individuelles

> Statut : **terminée**.

### 6.1 Objectif

Permettre à l’utilisateur d’exécuter et d’enregistrer une séance complète depuis son téléphone, avec résilience réseau et consultation de l’historique en lecture seule.

### 6.2 Fonctionnalités livrées (jalons 3.1–3.6)

#### Démarrage et snapshot

- Lancer une séance depuis un modèle (création immédiate en `ACTIVE`).
- Snapshot immuable du programme, du modèle, des exercices, des cibles et des repos.
- Une seule séance `ACTIVE` ou `PAUSED` par utilisateur.
- Reprendre une séance active ou en pause (lecture via `GET /workouts/active`).

#### Pendant la séance

- Interface complète de séance active (`/workouts/active`).
- Navigation entre exercices.
- Afficher l’exercice et les séries courantes.
- Enregistrer les résultats réels (charge, répétitions, durée, distance selon le type de mesure).
- Statuts de série : `PENDING`, `COMPLETED`, `PARTIAL`, `FAILED`, `SKIPPED`.
- Enregistrer RIR ou RPE (selon le profil).
- Distinguer `status = FAILED` et `reachedFailure`.
- Ajouter une note de série.
- Versionnement optimiste (`expectedVersion`) et idempotence (`clientCommandId`).
- Mettre en pause et reprendre.
- Minuterie de repos locale (non synchronisée serveur).

#### Fin de séance et historique

- Terminer la séance (`COMPLETED`) ou l’annuler (`CANCELLED`) en conservant le snapshot et les résultats déjà saisis.
- Séries `PENDING` conservées (jamais transformées en ignorées automatiquement).
- Résumé simple de progression des séries (compteurs), sans volume officiel ni records.
- Historique paginé (`GET /workouts`, page `/workouts`) : séances `COMPLETED` / `CANCELLED`.
- Détail historique en lecture seule (`/workouts/:workoutSessionId`).

#### Mode hors ligne (jalon 3.5)

- Snapshot local IndexedDB de la séance active.
- File de commandes hors ligne (`UPDATE_WORKOUT_SET`, pause/reprise/fin/annulation).
- Synchronisation séquentielle à la reprise du réseau (application ouverte).
- Résolution explicite des conflits de version.
- Cloisonnement des données locales par utilisateur et nettoyage à la déconnexion.
- La création de séance reste en ligne.

### 6.3 Backlog futur (hors phase 3 livrée)

Ces éléments restent explicitement hors livraison de la phase 3 :

- séance vide (sans modèle) ;
- démarrage de séance hors ligne ;
- affichage / copie de la dernière performance ;
- modification des cibles pendant la séance ;
- ajout ou suppression d’exercices pendant la séance ;
- ajout ou suppression de séries pendant la séance ;
- réordonnancement du snapshot ;
- remplacement d’exercice en séance ;
- copie ou duplication d’une séance ;
- durée active nette (historique complet des pauses) ;
- volume officiel, records, statistiques, progression, graphiques ;
- export des données d’entraînement ;
- WebSocket / Background Sync garanti ;
- séance collaborative, nutrition, coach IA.

### 6.4 Hors périmètre produit (inchangé)

- Séance collaborative (phase 5).
- Coaching vidéo.
- Détection automatique des répétitions.
- Intégration montre connectée.
- Recommandation IA en direct.

### 6.5 Critères de validation

La phase 3 est terminée lorsque :

- une séance peut être démarrée depuis un modèle et effectuée depuis un téléphone ;
- le snapshot reste lisible après modification des sources ;
- une série peut être enregistrée rapidement avec le bon statut ;
- pause / reprise / fin / annulation fonctionnent avec versionnement ;
- une coupure réseau courte ne provoque pas de perte silencieuse des commandes en file ;
- les conflits de version sont détectés et résolus explicitement ;
- une séance terminée ou annulée apparaît dans l’historique en lecture seule.

## 7. Phase 4 — Records, statistiques, progression et coaching

> Statut : **terminée**.
>
> Jalons livrés : **4.1 → 4.5** (records, métriques, progression, dashboard, e1RM)
> et **Couche Coaching 5.1 → 5.6** (recommandations, décisions, plateau, Coach déterministe,
> explication IA, chat READ ONLY).
>
> La phase **produit** suivante est la **Phase 5 — Séances partagées** (**en cours**, Shared 5.1 + 5.2 livrés).
> Voir §2.0 pour la nomenclature.  
> La liste et le détail historique de base sont déjà livrés en phase 3 (jalon 3.6).  
> La phase 4 transforme ces données en records, statistiques et visualisation.

### 7.1 Objectif

Transformer les données enregistrées en informations utiles (records, progression, graphiques).

### 7.2 Fonctionnalités incluses

- Historique enrichi par exercice.
- Évolution de la charge.
- Évolution des répétitions.
- Volume par séance.
- Volume par exercice.
- Estimation du 1RM.
- Records personnels.
- Comparaison entre périodes.
- Graphiques.
- Filtres avancés (exercice, performance).
- Export des données d’entraînement.
- Durée active nette (si le modèle d’historique des pauses est enrichi).

### 7.3 Records initiaux

**Livré en 4.1 (calcul à la demande, sans matérialisation) :**

- charge maximale (`MAX_WEIGHT`) ;
- répétitions maximales (`MAX_REPS`) ;
- meilleure durée (`MAX_DURATION`) ;
- meilleure distance (`MAX_DISTANCE`).

**Livré en 4.2 (métriques de séance, calcul à la demande) :**

- compteurs de séries / exercices ;
- répétitions totales ;
- volume externe `kg × reps` (`WEIGHT_REPS`) ;
- distinction volume total vs volume de travail (hors warmup) ;
- durée / distance enregistrées ;
- durée écoulée brute ;
- exposition sur détail `COMPLETED` et résumé historique.

**Livré en 4.3 (progression temporelle par exercice, calcul à la demande) :**

- série temporelle par exercice (`sourceExerciseId`) ;
- métriques adaptées au `measurementTypeSnapshot` ;
- plages `from`/`to` locales + presets UI ;
- résumé début / fin / meilleure valeur + variation ;
- graphique simple + liste accessible ;
- page `/progress/exercises/:exerciseId` ;
- lecture des snapshots historiques même si l’exercice catalogue a changé.

**Livré en 4.4 (dashboard global, calcul à la demande) :**

- page `/progress` + entrée de navigation « Progression » ;
- totaux / fréquence / timeline (DAY ≤45 j, WEEK ≤9 mois, MONTH au-delà) ;
- buckets vides inclus ;
- comparaison période précédente (plages bornées) ;
- records récents dans la période (4.1) ;
- top exercices (`sourceExerciseId`) ;
- endpoint `GET /api/v1/progress/overview`.

**Livré en 4.5 (1RM estimé / force, calcul à la demande) :**

- e1RM Epley V1 pour `WEIGHT_REPS` uniquement ;
- séries `COMPLETED`, hors warmup, 1–12 reps, charge > 0 ;
- RIR/RPE non intégrés à la formule ;
- meilleure estimation par séance + série temporelle ;
- endpoint `GET /api/v1/progress/exercises/:exerciseId/strength` ;
- section « Force estimée » sur `/progress/exercises/:exerciseId` ;
- estimation clairement distincte des records réels (`MAX_WEIGHT`).

**Restent hors 4.1–4.5 :**

- volume maximal sur une série ;
- volume maximal sur une séance (record) ;
- autres formules e1RM / 1RM ajusté RIR-RPE ;
- moyennes mobiles / plateaux / fatigue / coaching ;
- comparaison avancée multi-périodes ;
- score propriétaire / gamification.

**Livré en jalon 5.1 (recommandations déterministes de charge, lecture seule) :**

- moteur déterministe (aucune IA) pour `WEIGHT_REPS` uniquement ;
- contexte `WorkoutTemplateExercise` (pas seulement `Exercise`) ;
- fenêtre de 3 séances `COMPLETED` éligibles max ;
- warmups exclus ; séries `WORKING` comme base ;
- actions `INCREASE` / `HOLD` / `DECREASE` / `INSUFFICIENT_DATA` / `REVIEW` ;
- diminution conservatrice (≥ 2 séances consécutives sous-performantes) ;
- incrément système par défaut 2,5 kg (`SYSTEM_DEFAULT`) — pas encore de préférence utilisateur d’incrément en base ;
- endpoint `GET /api/v1/coaching/workout-template-exercises/:id/load-recommendation` ;
- carte suggestion sur le détail programme — **aucune application automatique**.

**Restent hors 5.1 :** application au programme (5.2+), plateaux, fatigue, périodisation, appels IA.

**Livré en jalon 5.2 (décision et application des recommandations de charge) :**

- décision utilisateur explicite `ACCEPTED` / `ADJUSTED` / `IGNORED` ;
- fingerprint déterministe + staleness `409 LOAD_RECOMMENDATION_STALE` ;
- application atomique limitée à `targetWeightKg` des séries `WORKING` concernées ;
- `HOLD` accepté = conserver la charge + décision tracée (sans mutation numérique) ;
- `REVIEW` / `INSUFFICIENT_DATA` : non applicables via coaching (ignorer ou masquer) ;
- historique `LoadRecommendationDecision` + endpoint liste cursor ;
- idempotence `ownerUserId + clientCommandId` ;
- séances `ACTIVE` / `COMPLETED` / `CANCELLED` : snapshots inchangés ; futures séances = nouvelle cible ;
- UI : Appliquer / Choisir une autre charge / Ignorer + « Décisions récentes » ;
- **aucune** application automatique, aucune IA, aucune commande IndexedDB.

**Restent hors 5.2 :** plateaux (5.3), deload, fatigue, readiness, rep range, séries, prompts / OpenAI, auto-apply.

**Livré en jalon 5.3 (détection déterministe de stagnation / plateau) :**

- signal descriptif `NONE` / `WATCH` / `PLATEAU` / `INSUFFICIENT_DATA` / `REVIEW` ;
- `WEIGHT_REPS` uniquement ; historique max **6** séances `COMPLETED`, min **3** pour un signal ;
- contexte `Exercise` + `sourceExerciseId` + équipement stable (comme 4.x / 5.1) ;
- métriques : charge max, reps, e1RM Epley V1, volume secondaire, misses, effort optionnel ;
- tolérances : `E1RM_PROGRESS_TOLERANCE_PERCENT = 1`, `LOAD_PROGRESS_TOLERANCE_KG = 1` ;
- endpoint `GET /api/v1/coaching/exercises/:exerciseId/plateau-analysis` ;
- UI section « Analyse de progression » — **aucune** recommandation corrective ;
- résultat **dérivé** (aucune table plateau / stagnation).

**Restent hors 5.3 :** deload, changement d’exercice / rep range / volume, fatigue, readiness, IA, notifications.

**Livré en jalon 5.4 (Coach déterministe explicatif) :**

- composition des moteurs existants (progression, force, load reco, plateau, décisions) ;
- statut UI `NO_DATA` / `BUILDING_HISTORY` / `PROGRESSING` / `STABLE` / `WATCH` / `PLATEAU` / `REVIEW` ;
- headlines / notices / actions déterministes (pas de LLM) ;
- endpoints `GET /api/v1/coaching/exercises/:id/summary` et `GET /api/v1/coaching/overview` ;
- page `/coach` + section Coach sur `/progress/exercises/:id` ;
- overview limité (récence 90 j, max 5 items, priorité REVIEW/PLATEAU/WATCH/PROGRESSING) ;
- **aucune** table Coach, aucune prescription, aucune IA.

**Restent hors 5.4 :** chat, streaming, prompts OpenAI, génération de séance/programme, deload auto, nutrition.

**Livré en jalon 5.5 (Coach IA explicatif) :**

- couche LLM **explicative uniquement** au-dessus de `ExerciseCoachSummary` 5.4 ;
- endpoint `POST /api/v1/coaching/exercises/:id/explanation` (génération à la demande) ;
- payload LLM versionné `AI_COACH_EXPLANATION_V1` + prompt `AI_COACH_PROMPT_V1` ;
- sortie structurée validée Zod (`title` / `summary` / `keyPoints` / `caution`) ;
- feature flag `AI_COACH_ENABLED` + `ai.available` via `GET /api/v1/me` ;
- fallback déterministe si IA désactivée / erreur / timeout ;
- **aucune** mutation métier, **aucun** chat, **aucune** persistance du texte généré.

**Restent hors 5.5 :** chat multi-tour, mémoire conversationnelle, function calling, génération de programme/séance, RAG, embeddings, WebSocket.

**Livré en jalon 5.6 (chat Coach multi-tour, outils lecture seule) :**

- conversations persistées + messages USER/ASSISTANT ;
- outils allowlistés `get_*` uniquement (summary, progress, strength, records, workouts) ;
- boucle tool calling bornée (`AI_COACH_MAX_TOOL_CALLS_PER_TURN = 4`) ;
- endpoints conversations / messages / archive ;
- route `/coach/chat` + lien depuis `/coach` et progression exercice ;
- **aucune** mutation métier via outils.

**Restent hors 5.6 :** outils d’écriture, application de reco depuis le chat, génération de programme, mémoire longue durée, RAG, web, nutrition, WebSocket.

### 7.4 Hors périmètre

- Analyse prédictive complexe.
- Comparaison publique entre utilisateurs.
- Classements.
- Score global universel.
- Prescription automatique face à une stagnation (hors signal descriptif 5.3).

### 7.5 Critères de validation

La phase est terminée lorsque :

- l’utilisateur peut visualiser sa progression sur un exercice ;
- les estimations (ex. 1RM) sont identifiées comme telles ;
- les records reposent sur des règles déterministes ;
- les graphiques et volumes officiels sont cohérents avec les snapshots de séance ;
- les graphiques sont utilisables sur mobile ;
- la Couche Coaching 5.1 → 5.6 est livrée (recommandations, décisions, plateau, Coach, IA explicative, chat READ ONLY).

## 8. Phase 5 — Séances partagées

> Statut : **en cours**.
>
> Ne pas confondre avec la Couche Coaching (jalons techniques 5.1 → 5.6), déjà livrée sous la Phase 4.
>
> Jalons Shared :
>
> | Jalon | Contenu | Statut |
> |-------|---------|--------|
> | **Shared 5.1** | Fondations salle (`SharedWorkoutRoom` / membership / lifecycle REST) | **Livré** |
> | **Shared 5.2** | Invitations email / accept-decline / leave | **Livré** |
> | Shared 5.3 | Présence temps réel / Socket.IO | Non commencé |
> | Shared 5.4+ | Coordination séances membres, rotation, etc. | Non commencé |

### 8.0 Shared 5.1 — Fondations des salles (livré)

Conteneur de coordination privé, **indépendant** d’une `WorkoutSession` individuelle.

Livré :

- modèles `SharedWorkoutRoom`, `SharedWorkoutRoomMember`, `SharedWorkoutRoomLifecycleCommand` ;
- statuts `LOBBY` → `ACTIVE` → `COMPLETED`, et `LOBBY`/`ACTIVE` → `CANCELLED` ;
- création transactionnelle (room + membership `OWNER`) ;
- liste (membership actif), détail, rename (LOBBY/ACTIVE), start / complete / cancel ;
- API `/api/v1/shared-workouts` ; UI `/shared-workouts`, `/new`, `/:roomId` ;
- JWT, IDOR 404 neutre, owner-only mutations, idempotence `clientCommandId` ;
- **pas** de Socket.IO, présence, ni lien auto `WorkoutSession`.

### 8.0bis Shared 5.2 — Invitations et leave (livré)

Adhésion multi-membres via invitation **par email exact** (compte existant `ACTIVE`).
Pas de username / handle ; normalisation email = trim + lowercase (comme auth).

Livré :

- modèle `SharedWorkoutRoomInvitation` (`PENDING` / `ACCEPTED` / `DECLINED` / `CANCELLED`) ;
- `SharedWorkoutRoomMember.leftAt` — membership actif = `leftAt IS NULL` ;
- index unique partiel : une seule invitation `PENDING` par `(roomId, inviteeUserId)` ;
- owner : invite, liste invitations salle, cancel `PENDING` ;
- invitee : liste reçues, accept, decline ;
- MEMBER actif : leave (soft) ; OWNER ne peut pas leave ;
- accept sur ex-membre → rejoin (`leftAt = null`) ;
- `COMPLETED` / `CANCEL` room → annulation auto des `PENDING` ; `START` ne les annule pas ;
- anti-énumération : utilisateur inconnu / inactif → `SHARED_WORKOUT_INVITATION_CANNOT_CREATE` ;
- API sous `/api/v1/shared-workouts` + `/api/v1/shared-workout-invitations` ;
- UI `/shared-workouts/invitations`, invite sur détail salle, leave pour MEMBER ;
- REST uniquement, NetworkOnly ; **pas** de code / lien public, **pas** de Socket.IO,
  **pas** de `WorkoutSession` auto.

### 8.1 Objectif

Permettre à plusieurs utilisateurs de réaliser une même séance en organisant leur rotation sur les équipements.

### 8.2 Fonctionnalités incluses

#### Création d’une salle

- Création d’une séance partagée. *(Shared 5.1)*
- Sélection d’un modèle. *(ultérieur)*
- Séance libre. *(ultérieur)*
- Invitation par email (compte existant). *(Shared 5.2)*
- Acceptation / refus / annulation d’invitation. *(Shared 5.2)*
- Quitter une salle (MEMBER) / rejoindre via nouvelle invitation. *(Shared 5.2)*
- Code / lien d’invitation publics, expiration. *(ultérieur — hors Shared 5.2)*
- Liste des participants. *(Shared 5.1 : owner ; Shared 5.2 : multi-membres actifs)*

#### Préparation

- Confirmation de présence.
- Sélection des équipements disponibles.
- Sélection des exercices compatibles.
- Récupération des charges personnelles.
- Définition d’une durée cible facultative.
- Calcul d’une rotation initiale.
- Possibilité de modifier la rotation.

#### Temps réel

- Connexion Socket.IO authentifiée.
- Rooms.
- Présence.
- Changement d’état.
- Série terminée.
- Série échouée.
- Changement de station.
- Chronomètre.
- Accusés de réception.
- Versions d’état.
- Reconnexion.
- Snapshot complet.

#### Fin de séance

- Résumé partagé.
- Résumé individuel.
- Persistance dans l’historique de chaque participant.
- Conservation des performances individuelles.

### 8.3 Contraintes initiales

- De deux à cinq participants.
- Salle privée.
- Pas de découverte publique.
- Un hôte.
- Chaque participant modifie ses propres performances.
- La connexion réseau est obligatoire pour le temps réel.

### 8.4 Hors périmètre

- Chat complet.
- Appel audio.
- Vidéo.
- Groupes publics.
- Recherche de partenaires.
- Gestion d’une salle commerciale.
- Réservation de machines réelles.

### 8.5 Critères de validation

La phase est terminée lorsque :

- plusieurs utilisateurs peuvent rejoindre une salle ;
- chacun voit sa charge et sa cible ;
- la rotation est synchronisée ;
- les séries sont persistées ;
- une reconnexion renvoie un état cohérent ;
- un événement envoyé deux fois ne crée pas deux séries ;
- la fin de séance produit un historique pour chaque participant.

## 9. Phase 6 — Nutrition

### 9.1 Objectif

Réunir dans la même application le suivi de l’entraînement et des apports alimentaires.

### 9.2 Fonctionnalités incluses

- Objectif calorique.
- Objectifs de protéines.
- Objectifs de glucides.
- Objectifs de lipides.
- Journal quotidien.
- Aliments personnalisés.
- Portions.
- Repas.
- Repas favoris.
- Recettes simples.
- Copie d’un repas précédent.
- Résumé quotidien.
- Résumé hebdomadaire.
- Mesures de poids.
- Tendance de poids.
- Dépense sportive estimée séparée.
- Export des données nutritionnelles.

### 9.3 Positionnement de la dépense sportive

L’application ne doit pas soustraire automatiquement la totalité des calories sportives de l’objectif alimentaire.

Elle doit afficher séparément :

- objectif alimentaire ;
- apports ;
- dépense sportive estimée ;
- écart par rapport à l’objectif ;
- balance énergétique estimée facultative.

### 9.4 Hors périmètre

- Diagnostic nutritionnel.
- Plan alimentaire médical.
- Reconnaissance photo.
- Scan de ticket de caisse.
- Base commerciale obligatoire.
- Commande de nourriture.
- Recommandation de complément alimentaire.

### 9.5 Critères de validation

La phase est terminée lorsque :

- un utilisateur peut enregistrer une journée alimentaire ;
- les calories et macros sont calculées ;
- les portions peuvent être modifiées ;
- les valeurs utilisateur restent identifiées ;
- le poids peut être suivi sur plusieurs semaines ;
- la dépense sportive est clairement présentée comme une estimation.

## 10. Phase 7 — Notifications

### 10.1 Objectif

Rappeler les actions utiles sans rendre l’application intrusive.

### 10.2 Fonctionnalités incluses

- Demande de permission contextuelle.
- Rappel de séance planifiée.
- Notification de fin de repos.
- Invitation à une séance.
- Début imminent d’une séance partagée.
- Changement de station.
- Rappel alimentaire facultatif.
- Préférences par catégorie.
- Horaires silencieux.
- Désactivation globale.
- Gestion des abonnements push.

### 10.3 Hors périmètre

- Notifications marketing.
- Relances culpabilisantes.
- Messages non sollicités.
- Publicité.

### 10.4 Critères de validation

La phase est terminée lorsque :

- aucune notification n’est envoyée sans consentement ;
- chaque catégorie peut être désactivée ;
- les horaires silencieux sont respectés ;
- un abonnement expiré peut être nettoyé ;
- les notifications ne révèlent pas inutilement de données sensibles.

## 11. Phase 8 — Coach IA

### 11.1 Objectif

Ajouter une assistance personnalisée construite au-dessus de données fiables.

### 11.2 Fonctionnalités incluses

- Questionnaire de création de programme.
- Proposition de programme.
- Proposition de séance.
- Analyse de progression.
- Suggestion de charge.
- Suggestion de diminution de charge.
- Suggestion de semaine plus légère.
- Proposition d’exercice alternatif.
- Explication des choix.
- Validation structurée.
- Confirmation avant enregistrement.
- Limitation du nombre de requêtes.

### 11.3 Données utilisées

Selon la demande et avec consentement :

- objectif ;
- niveau ;
- fréquence ;
- durée disponible ;
- équipement ;
- restrictions déclarées ;
- historique récent ;
- performances ;
- préférences ;
- exercices refusés.

### 11.4 Hors périmètre

- Diagnostic médical.
- Analyse de blessure.
- Rééducation.
- Recommandation de médicaments.
- Recommandation de produits dopants.
- Modification automatique des programmes.
- Chat illimité.
- Analyse en permanence sans demande utilisateur.

### 11.5 Critères de validation

La phase est terminée lorsque :

- les réponses IA utilisent un format structuré ;
- les objets sont validés côté serveur ;
- une réponse invalide n’est pas persistée ;
- l’utilisateur doit confirmer la proposition ;
- les recommandations expliquent leurs hypothèses ;
- l’indisponibilité de l’IA ne bloque pas les fonctions principales.

## 12. Phase 9 — Améliorations futures

Fonctionnalités envisageables après validation des usages principaux :

- intégration Apple Health ;
- intégration Health Connect ;
- intégration calendrier ;
- widgets d’écran d’accueil ;
- synchronisation avec des montres ;
- import de programmes ;
- partage privé de programmes ;
- bibliothèque communautaire modérée ;
- mode coach ;
- gestion de groupes permanents ;
- exercices avec vidéo ;
- import depuis d’autres applications ;
- application native si une limite PWA le justifie.

## 13. Priorités transversales

À chaque phase, l’ordre de priorité est :

1. intégrité des données ;
2. sécurité ;
3. expérience mobile ;
4. fiabilité réseau ;
5. accessibilité ;
6. simplicité ;
7. performance ;
8. esthétique ;
9. nouvelles fonctionnalités.

## 14. Gestion des nouvelles idées

Toute nouvelle fonctionnalité doit être classée comme :

- nécessaire au périmètre actuel ;
- amélioration mineure compatible ;
- fonctionnalité d’une phase future ;
- expérimentation ;
- hors vision.

Une fonctionnalité ne doit pas être ajoutée uniquement parce qu’elle est techniquement intéressante.

Elle doit répondre à un problème utilisateur identifiable.
