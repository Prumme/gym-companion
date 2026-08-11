# Stratégie de tests

## 1. Objectif de ce document

Ce document définit la stratégie de tests de Gym Companion.

Il précise :

- les niveaux de tests ;
- les responsabilités de chaque type de test ;
- les outils envisagés ;
- les domaines prioritaires ;
- les scénarios critiques ;
- la gestion des données de test ;
- les exigences de couverture ;
- les règles de non-régression ;
- les vérifications avant déploiement.

L’objectif n’est pas d’obtenir un pourcentage de couverture artificiellement élevé.

L’objectif est de protéger :

- les données utilisateur ;
- les règles métier ;
- les séances actives ;
- la synchronisation hors ligne ;
- les séances partagées ;
- l’authentification ;
- les calculs ;
- les migrations ;
- les intégrations externes.

## 2. Principes généraux

### 2.1 Tester les comportements

Les tests doivent vérifier des comportements observables.

Ils ne doivent pas dépendre excessivement de l’organisation interne du code.

Un refactoring sans changement de comportement ne devrait pas imposer la réécriture de la majorité des tests.

### 2.2 Priorité au métier

Les règles métier importantes doivent être testées sans dépendre :

- d’un navigateur ;
- d’une vraie base ;
- d’un fournisseur IA ;
- d’un service de notification ;
- d’un serveur externe.

### 2.3 Tests déterministes

Un test doit produire le même résultat à chaque exécution.

Éviter :

- les dates réelles non contrôlées ;
- les valeurs aléatoires non fixées ;
- les appels réseau réels ;
- les délais arbitraires ;
- les dépendances à l’ordre d’exécution ;
- les données partagées entre tests.

### 2.4 Les tests ne doivent pas masquer les erreurs

Il est interdit de :

- supprimer un test pour faire passer la suite ;
- augmenter arbitrairement un timeout sans analyser la cause ;
- ignorer une erreur TypeScript ;
- désactiver une assertion importante ;
- rendre un test conditionnel à l’environnement sans justification.

### 2.5 Pyramide de tests

La majorité des tests doit être composée de :

1. tests unitaires ;
2. tests d’intégration ;
3. tests end-to-end ciblés.

Les tests end-to-end sont plus coûteux et ne doivent pas être la seule protection du métier.

## 3. Niveaux de tests

### 3.1 Tests statiques

Ils incluent :

- TypeScript ;
- ESLint ;
- Prettier ;
- validation du schéma Prisma ;
- validation des imports ;
- vérification des dépendances ;
- compilation.

### 3.2 Tests unitaires

Ils testent une fonction, une règle ou un service métier isolé.

Exemples :

- arrondi de charge ;
- estimation de 1RM ;
- calcul du volume ;
- calcul nutritionnel ;
- validation d’une série ;
- progression ;
- génération d’une rotation ;
- permissions ;
- conversion d’unité.

### 3.3 Tests d’intégration

Ils testent la collaboration entre plusieurs composants réels.

Exemples :

- service NestJS avec repository Prisma ;
- transaction ;
- contrôleur HTTP ;
- authentification ;
- gateway Socket.IO ;
- IndexedDB ;
- service worker ;
- base PostgreSQL de test.

### 3.4 Tests de contrat

Ils vérifient la cohérence entre :

- frontend et backend ;
- schémas partagés ;
- API et documentation ;
- événements WebSocket ;
- fournisseur IA simulé.

### 3.5 Tests de composants

Ils vérifient le comportement d’un composant React avec ses interactions principales.

### 3.6 Tests end-to-end

Ils reproduisent un parcours réel dans un navigateur.

### 3.7 Tests de performance

Ils vérifient :

- temps de réponse ;
- volume de données ;
- nombre de connexions ;
- calcul de rotation ;
- chargement mobile ;
- synchronisation.

### 3.8 Tests de sécurité

Ils couvrent :

- authentification ;
- autorisations ;
- accès horizontal ;
- rate limiting ;
- validation ;
- secrets ;
- join codes ;
- WebSocket.

### 3.9 Tests manuels exploratoires

Ils sont utiles pour :

- expérience mobile ;
- ergonomie en salle ;
- PWA ;
- notifications ;
- thèmes ;
- accessibilité ;
- conditions réseau réelles.

Ils ne remplacent pas les tests automatiques.

## 4. Outils envisagés

### Frontend

- Vitest ;
- Testing Library ;
- Mock Service Worker ;
- Playwright ;
- fake timers ;
- outils de test IndexedDB ;
- axe ou équivalent pour certains contrôles d’accessibilité.

### Backend

- Vitest ou Jest selon la configuration retenue ;
- Supertest ;
- NestJS testing utilities ;
- PostgreSQL de test ;
- Testcontainers facultatif ;
- client Socket.IO pour les tests d’intégration.

### Monorepo

- Turborepo ;
- scripts pnpm ;
- cache CI ;
- rapports de couverture.

Le choix exact entre Jest et Vitest côté backend doit rester cohérent dans le projet.

## 5. Organisation des tests

### Tests proches du code

Exemple :

```text
src/
├── one-rep-max-estimator.ts
└── one-rep-max-estimator.test.ts
```

Cette approche convient aux tests unitaires.

### Dossiers dédiés

Exemple :

```text
apps/api/test/
├── integration/
├── e2e/
├── fixtures/
└── helpers/
```

### Frontend

```text
apps/web/src/
├── features/
│   └── workouts/
│       ├── components/
│       ├── pages/
│       └── tests/
│
└── test/
    ├── setup.ts
    ├── mocks/
    └── helpers/
```

## 6. Conventions de nommage

Les noms de tests doivent décrire le comportement.

Exemple :

```text
should reject a completed set when repetitions are missing
```

ou en français si l’équipe préfère :

```text
doit refuser une série terminée sans répétition
```

La langue choisie doit rester cohérente.

Structure recommandée :

```text
Given
When
Then
```

Exemple :

```ts
describe("WeightRoundingPolicy", () => {
  it("returns the lower available weight when two values are equally close", () => {
    // Given
    // When
    // Then
  });
});
```

## 7. Données de test

### 7.1 Fixtures

Créer des factories explicites.

Exemples :

```ts
createTestUser();
createTestExercise();
createTestWorkout();
createTestWorkoutSet();
createTestSharedRoom();
```

### 7.2 Valeurs par défaut

Les factories possèdent des valeurs par défaut valides et permettent des overrides.

```ts
const workout = createTestWorkout({
  status: "ACTIVE",
});
```

### 7.3 Pas de dépendance implicite

Un test ne doit pas dépendre d’une fixture globale modifiée par un autre test.

### 7.4 Utilisateurs distincts

Les tests d’autorisation doivent utiliser plusieurs utilisateurs explicites :

```text
userA
userB
host
participant
admin
```

### 7.5 Dates contrôlées

Utiliser une horloge injectée ou des fake timers.

Ne pas utiliser directement la date actuelle dans une règle métier sans abstraction.

## 8. Base de données de test

### 8.1 Base séparée

Les tests utilisent une base dédiée.

Ils ne doivent jamais utiliser la base de développement ou de production.

### 8.2 Isolation

Approches possibles :

- transaction annulée après chaque test ;
- nettoyage ciblé ;
- schéma PostgreSQL par suite ;
- conteneur éphémère.

### 8.3 Migrations

Les tests d’intégration doivent utiliser les migrations réelles.

Ils ne doivent pas créer un schéma différent manuellement.

### 8.4 Seed

Un seed minimal est utilisé pour :

- groupes musculaires ;
- types d’équipement ;
- exercices système nécessaires.

Le seed doit rester déterministe.

## 9. Tests statiques

Chaque package doit exposer lorsque pertinent :

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

À la racine :

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Turborepo orchestre les commandes.

## 10. Tests unitaires du domaine entraînement

### 10.1 Validation d’une série

Cas à tester :

- série poids-répétitions valide ;
- charge absente ;
- répétitions absentes ;
- répétitions négatives ;
- durée incompatible ;
- statut ignoré ;
- série d’échauffement ;
- RIR hors borne ;
- RPE hors borne ;
- série à l’échec.

### 10.2 Volume

Cas :

- série valide ;
- plusieurs séries ;
- série ignorée ;
- série annulée ;
- série sans charge ;
- échauffement inclus ou exclu ;
- décimales.

### 10.3 Estimation du 1RM

Cas :

- charge valide ;
- répétition unique ;
- plage maximale de répétitions ;
- zéro répétition ;
- charge négative ;
- série ignorée ;
- formule versionnée ;
- arrondi ;
- valeurs extrêmes.

### 10.4 Records

Cas :

- premier record ;
- nouveau record ;
- valeur identique ;
- correction supprimant un record ;
- record par équipement ;
- record estimé ;
- échauffement exclu selon règle.

### 10.5 Progression de charge

Cas :

- toutes les séries réussies ;
- cible haute atteinte ;
- RIR suffisant ;
- RPE élevé ;
- série partielle ;
- plusieurs échecs ;
- données insuffisantes ;
- équipement avec incrément ;
- équipement avec liste de charges.

## 11. Tests unitaires de rotation

Le moteur de rotation est un domaine prioritaire.

### Cas simples

- deux participants, deux stations ;
- trois participants, trois stations ;
- plus de participants que de stations ;
- plus de stations que de participants.

### Occupation

- une station de capacité 1 ;
- station de capacité 2 ;
- station désactivée ;
- station déjà occupée.

### Progression

- participant ayant terminé ;
- participant en attente ;
- participant en pause ;
- participant déconnecté ;
- participant ajouté tardivement.

### Contraintes

- exercice exclu ;
- équipement incompatible ;
- ordre d’exercice ;
- station obligatoire ;
- équipement préféré.

### Stabilité

- même entrée, même résultat ;
- changement minimal après modification ;
- version d’algorithme ;
- absence de double affectation.

### Erreurs

- aucune station compatible ;
- participant sans plan ;
- station inconnue ;
- données incohérentes.

## 12. Tests unitaires nutritionnels

Tester :

- calcul proportionnel d’une portion ;
- recette ;
- nombre de portions ;
- arrondis ;
- objectif actif selon la date ;
- changement d’objectif ;
- total quotidien ;
- macros manquantes ;
- dépense sportive séparée ;
- tendance de poids.

## 13. Tests unitaires d’autorisations

Tester les politiques :

- propriétaire ;
- non-propriétaire ;
- administrateur ;
- membre d’une salle ;
- non-membre ;
- hôte ;
- participant ;
- participant retiré ;
- compte désactivé.

Les contrôles d’autorisation doivent être testés séparément de l’interface.

## 14. Tests backend d’intégration

### 14.1 Authentification

- inscription ;
- email dupliqué ;
- connexion ;
- mauvais mot de passe ;
- compte désactivé ;
- refresh ;
- rotation du refresh token ;
- réutilisation d’un token ;
- logout ;
- logout global ;
- reset password.

### 14.2 Programmes

- création ;
- lecture ;
- modification ;
- duplication ;
- activation ;
- archivage ;
- accès étranger ;
- snapshot de séance.

### 14.3 Séances

- création depuis modèle ;
- séance libre ;
- séance active unique ;
- ajout de série ;
- commande dupliquée ;
- fin ;
- annulation ;
- historique ;
- transaction.

### 14.4 Nutrition

- objectif ;
- aliment ;
- portion ;
- recette ;
- entrée ;
- journée ;
- accès étranger.

### 14.5 Export

- création ;
- propriété ;
- expiration ;
- téléchargement ;
- suppression du fichier.

## 15. Tests API

Chaque endpoint critique doit couvrir :

- succès ;
- validation ;
- absence d’authentification ;
- accès interdit ;
- ressource absente ;
- conflit ;
- idempotence ;
- rate limit lorsque pertinent.

Les tests doivent vérifier :

- statut HTTP ;
- code d’erreur ;
- structure ;
- absence de champs sensibles ;
- effets en base.

## 16. Tests WebSocket

### 16.0 Shared 5.3 / 5.4 (présence + invalidation — livré)

Tester :

- gateway auth : token valide / absent / invalide / expiré / compte désactivé ;
- `room:subscribe` membre actif LOBBY/ACTIVE → ack + `presence:snapshot` ;
- non-membre / salle inexistante / terminale → `ROOM_NOT_ACCESSIBLE` ;
- multi-onglets : 2e socket même user → pas de 2e `presence:joined` ;
  dernier socket fermé → `presence:left` ;
- leave REST → `MEMBER_LEFT` + eviction sockets + `presence:left` ;
- join via code → `MEMBER_JOINED` ; présence online seulement après subscribe ;
- rename / start / complete / cancel → `room:changed` **après** commit ;
- attach / create / lifecycle workout lié → `MEMBER_WORKOUT_CHANGED` **après**
  commit (Shared 5.4) ;
- complete / cancel → clear présence + refuse nouveau subscribe ;
- payload invalidation minimal (`roomId`, `reason`) ;
- frontend : invalidation Query sur `room:changed` ; libellés présence ;
- hors ligne : pas de file socket ;
- **pas** de sync séries / rotation / snapshot workout.

### 16.1 Connexion

- token valide ;
- token absent ;
- token invalide ;
- token expiré ;
- compte désactivé.

### 16.2 Room

- membre autorisé ;
- utilisateur non membre ;
- salle inexistante ;
- salle terminée ;
- participant retiré.

### 16.3 Commandes *(cible Shared 5.5+)*

- commande valide ;
- mauvaise version ;
- commande dupliquée ;
- payload invalide ;
- action d’un autre utilisateur ;
- action hôte par participant ;
- acknowledgement.

### 16.4 Diffusion

Vérifier que :

- les membres reçoivent l’événement ;
- les non-membres ne le reçoivent pas ;
- les données privées ne sont envoyées qu’au bon utilisateur.

### 16.5 Reconnexion

- déconnexion ;
- délai de grâce *(Shared 5.5+)* ;
- reconnexion ;
- re-subscribe + snapshot présence *(Shared 5.3)* ;
- refetch REST « ma séance » *(Shared 5.4)* ;
- snapshot workout *(Shared 5.5+)* ;
- commande en attente *(Shared 5.5+)* ;
- commande déjà appliquée *(Shared 5.5+)*.

### 16.6 Redémarrage

- état persistant ;
- reconnexion des clients ;
- reconstruction des timers ;
- conservation des versions.

## 17. Tests frontend de composants

### 17.1 Formulaires

Tester :

- validation ;
- erreurs ;
- chargement ;
- succès ;
- valeurs initiales ;
- unités ;
- clavier ou champs numériques ;
- double soumission.

### 17.2 Séance active

Tester :

- affichage de la cible ;
- saisie ;
- validation ;
- série partielle ;
- échec ;
- repos ;
- navigation ;
- mode hors ligne ;
- statut de synchronisation.

### 17.3 Séance partagée

#### Shared 5.1 (fondations REST — livré)

Tester :

- création room + membership OWNER transactionnelle ;
- échec membership → aucune room orpheline ;
- liste membership (MEMBER fixture visible en lecture) ;
- IDOR : non-membre → 404 sur GET/PATCH/lifecycle ;
- owner-only : MEMBER → read OK, mutations 403 ;
- lifecycle LOBBY→ACTIVE→COMPLETED ; LOBBY/ACTIVE→CANCELLED ;
- refus transitions invalides / états terminaux ;
- timestamps ; concurrence complete vs cancel ;
- idempotence `clientCommandId` ;
- aucune `WorkoutSession` créée/modifiée ;
- UI liste / création / lobby ; offline message ; pas de Socket.IO.

#### Shared 5.2 (codes d’accès / leave — livré)

Tester :

- création salle → `joinCode` généré (format affiché `XXX-XXX`, stockage normalisé) ;
- join avec code (casse / tiret optionnels) → membership `MEMBER` ;
- join idempotent si déjà membre actif ;
- code inconnu / salle `COMPLETED` / `CANCELLED` → `SHARED_WORKOUT_JOIN_CODE_INVALID` (message neutre) ;
- rejoin après leave via même code → `leftAt = null` ;
- rotate owner → nouveau code ; ancien code refusé ;
- rotate / join refusés en salle terminale ;
- rate limit ~10/min sur `POST /join` ;
- détail : `joinCode` visible owner `LOBBY`/`ACTIVE` uniquement ; null pour les autres ;
- leave MEMBER → `leftAt` ; OWNER → `SHARED_WORKOUT_ROOM_OWNER_CANNOT_LEAVE` ;
- leave répété idempotent ; leave en salle terminale refusé ;
- listes / détail n’exposent que membres actifs ;
- UI sheet join-by-code, section code owner sur détail, leave MEMBER ;
- NetworkOnly / message connexion ; pas de Socket.IO ; pas de `WorkoutSession` auto.

#### Shared 5.3 (présence Socket.IO + invalidation — livré)

Tester :

- auth gateway JWT (handshake) ;
- subscribe / unsubscribe Zod ; multi-onglets présence ;
- leave REST → eviction + `presence:left` ;
- accept → `MEMBER_JOINED` sans présence online tant que pas de subscribe ;
- mutations REST → `room:changed` après commit ;
- salle terminale : clear présence + refuse subscribe ;
- UI libellés En ligne / Hors ligne / Présence inconnue ;
- offline : présence indisponible, pas de file d’événements ;
- **pas** de sync séries / rotation / snapshot workout.

#### Shared 5.4 (séance individuelle rattachée — livré)

Tester :

- GET `my-workout-session` (lié / non lié / `activeWorkoutElsewhere`) ;
- attach séance `ACTIVE`/`PAUSED` du viewer sur salle `ACTIVE` ;
- attach idempotent (même ID) ; conflit si autre séance déjà liée ;
- attach refusé : salle non ACTIVE, statut non attachable, séance déjà liée
  ailleurs, séance d’un autre user → 404 `WORKOUT_NOT_FOUND` (IDOR) ;
- create depuis template + association **atomique** (échec association →
  aucune séance orpheline ; rollback transaction) ;
- create conflit si membership déjà liée / séance active existante ;
- détail salle : `memberWorkout` résumé ; `myWorkoutSessionId` viewer only ;
- **indépendance** : complete/cancel room ne termine pas la séance ;
  complete/cancel séance ne change pas le statut room ;
- lifecycle séance liée → `MEMBER_WORKOUT_CHANGED` ;
- pas de cross-write / pas d’exposition d’ID des autres ;
- UI section Ma séance ; attach/create online-only ;
- **pas** de sync séries / rotation.

#### Shared 5.5 (exercice courant + progression live — livré)

Tester :

- helpers `isProcessedSetStatus` / compteurs (tous statuts sets ; SKIPPED ;
  warmup inclus ; exercice sans set ; safe ratio) ;
- PUT current-exercise : ownership, cross-session, cross-user, idempotence,
  null, room LOBBY/COMPLETED/CANCELLED refus, workout COMPLETED/CANCELLED refus,
  member left refus ;
- détail salle : nom snapshot + compteurs ; **aucune** clé perf dans le JSON ;
- GET context by-workout-session : owner OK ; autre user 404 ; non lié
  `linked=false` ;
- realtime : `MEMBER_CURRENT_EXERCISE_CHANGED` ; `MEMBER_WORKOUT_PROGRESS_CHANGED`
  sur PENDING→processed ; **pas** d’event si reps changent sans processed ;
- room terminale / leave : plus de broadcast progress ;
- offline : sync set → event progress après commit serveur ;
- UI cartes membres (ACTIVE/PAUSED/COMPLETED) ; sync sélection depuis
  `/workouts/active` (online only) ; coalescing refetch progress.

#### Shared 5.6 (coordination équipements — livré)

Tester :

- unique USING (course request) ;
- FIFO release/promotion ;
- cancel waiting ; cancel vs promotion race ;
- current exercise USING refuse / WAITING auto-cancel ;
- leave / workout terminal / room terminal cleanup ;
- socket disconnect ≠ release ;
- forged equipmentId rejeté ; outsider 404 ;
- privacy DTO ; realtime EQUIPMENT_COORDINATION_CHANGED ;
- UI section Équipements + warnings leave/complete.

#### Cible produit (Shared 5.7+)

Tester :

- station ;
- charge personnelle ;
- commandes workout Socket.IO / versions / ACK ;
- déconnexion / grâce / snapshot workout ;
- changement de rotation ;
- restrictions de rôle ;
- lien public `/invite/:code` (si retenu).

### 17.4 Nutrition

Tester :

- calcul visible ;
- ajout ;
- modification de portion ;
- résumé ;
- dépense séparée.

## 18. Mock Service Worker

MSW est recommandé pour simuler l’API dans les tests frontend.

Les handlers doivent refléter les contrats réels.

Exemples :

```text
GET /api/v1/me
GET /api/v1/exercises
POST /api/v1/workouts
POST /api/v1/sync/commands
```

Les mocks ne doivent pas devenir une API différente de la vraie.

## 19. Tests de contrat partagés

Les schémas partagés doivent vérifier les exemples de :

- requêtes ;
- réponses ;
- erreurs ;
- événements Socket.IO ;
- acknowledgements ;
- propositions IA.

Une modification de contrat doit provoquer un échec dans les packages dépendants.

## 20. Tests PWA et hors ligne

### 20.1 IndexedDB

Tester :

- création de base ;
- migration ;
- insertion ;
- lecture ;
- suppression ;
- changement de compte ;
- corruption simulée ;
- quota simulé.

### 20.2 File de commandes

Tester :

- ordre ;
- retry ;
- confirmation ;
- rejet ;
- conflit ;
- commande dupliquée ;
- consolidation ;
- dépendance entre commandes.

### 20.3 Fermeture

Scénario :

1. démarrer une séance ;
2. enregistrer hors ligne ;
3. recharger ;
4. récupérer l’état ;
5. synchroniser.

### 20.4 Service worker

Tester :

- installation ;
- activation ;
- cache du shell ;
- navigation hors ligne ;
- mise à jour ;
- suppression des anciens caches.

### 20.5 Chronomètre

Tester avec fake timers :

- arrière-plan ;
- retour ;
- temps expiré ;
- pause ;
- reprise ;
- changement d’heure de l’appareil si possible.

## 21. Tests IA / Couche Coaching

Les tests automatiques utilisent un **fournisseur simulé** (`fake`) — jamais une clé de production.

### 21.1 Déterminisme (5.1–5.4)

- actions load reco / plateau / CoachSummary stables pour les mêmes fixtures ;
- aucune mutation via overview ou summary ;
- overview compose la load reco (REVIEW peut remonter).

### 21.2 Provider fake (5.5 / 5.6)

- réponse valide / invalide / timeout / rate limit / disabled ;
- payload minimisé (pas d’email, JWT, ownerUserId inutile).

### 21.3 Tool registry read-only (5.6)

- allowlist `get_*` uniquement ;
- assertion anti-mutation sur les noms ;
- exécuteur réel : services lecture seule + `ownerUserId` JWT.

### 21.4 IDOR tool

- `get_workout_detail(UUID-A)` avec user B → aucune donnée A ;
- même principe pour progress / strength / coach summary.

### 21.5 Prompt injection

- messages « ignore instructions / SQL / update_program / données autre user » ;
- nom d’exercice hostiles reste une donnée ;
- permissions = registry (inchangé).

### 21.6 Idempotence et concurrence chat

- même `clientCommandId` + même contenu → replay ;
- même `clientCommandId` + contenu différent → `AI_COACH_MESSAGE_COMMAND_CONFLICT` ;
- génération concurrente → `AI_COACH_CONVERSATION_BUSY` (lock process-local).

### 21.7 Limites

- max tool calls / tour ;
- fenêtre d’historique ;
- follow-ups mutationnels filtrés.

### 21.8 Offline

- chat non envoyable ;
- pas de queue IndexedDB IA ;
- endpoints coaching NetworkOnly.

### 21.9 Propositions structurées (jalon 8, livré — `apps/api/test/ai-coach-proposal.test.ts`)

Registre d’outils lecture seule étendu (§21.3) : `search_exercises`, `get_active_program`,
`get_program_detail` couverts par les mêmes assertions anti-mutation et IDOR (§21.4) que les
outils 5.6.

**Réponse valide :**

- schéma correct (`coachStructuredResponseSchema`, Structured Outputs strict) ;
- exercices existants et accessibles (`search_exercises` uniquement) ;
- cibles de séries cohérentes avec le type de mesure ;
- `AiCoachProposal` `PENDING` persistée et renvoyée dans la réponse du message.

**Réponse invalide (business) :**

- JSON invalide / champ absent / enum inconnu → rejeté par la validation Zod avant toute logique
  métier (`ai-coach-structured.test.ts`) ;
- exercice inexistant, archivé ou appartenant à un autre utilisateur ;
- équipement inactif ou incompatible ;
- cible de série hors limites (`validateWorkoutTemplateSetTargets`) ;
- dans tous ces cas : **aucune** `AiCoachProposal` persistée, réponse renvoyée en `discussion`
  avec message d’erreur clair (le tour de chat ne plante jamais).

**Sécurité :**

- diagnostic ; traitement ; substance ; restriction ignorée ; instruction dangereuse ; prompt
  injection dans une note ou dans un nom d’exercice ;
- `exerciseId` inventé par le modèle → jamais accepté (seule source valide : `search_exercises`).

**Cycle de vie (livré) :**

- génération (`PENDING`) ;
- acceptation (`ACCEPTED`, création transactionnelle programme/séance) ;
- double acceptation → idempotent, aucune ressource dupliquée ;
- refus (`DISMISSED`) → acceptation ultérieure refusée ;
- exercice devenu obsolète avant acceptation → `INVALID`, `400 AI_COACH_PROPOSAL_STALE`, aucune
  création partielle ;
- séance sans `programId` fourni à l’acceptation → `400` explicite (`WorkoutTemplate` doit
  toujours appartenir à un `Program`).

## 22. Tests end-to-end prioritaires

## 22.1 Authentification

1. créer un compte ;
2. terminer l’onboarding ;
3. se déconnecter ;
4. se reconnecter ;
5. réinitialiser le mot de passe.

## 22.2 Première séance

1. créer un exercice ;
2. créer un programme ;
3. créer une séance modèle ;
4. démarrer ;
5. enregistrer plusieurs séries ;
6. terminer ;
7. consulter l’historique ;
8. consulter le record.

## 22.3 Hors ligne

1. démarrer une séance ;
2. couper le réseau ;
3. enregistrer ;
4. fermer ;
5. rouvrir ;
6. restaurer ;
7. reconnecter ;
8. synchroniser ;
9. vérifier le serveur.

## 22.4 Séance partagée

1. créer deux utilisateurs ;
2. créer une salle ;
3. partager le code ;
4. rejoindre ;
5. démarrer ;
6. enregistrer depuis deux clients ;
7. changer de station ;
8. déconnecter un client ;
9. reconnecter ;
10. terminer ;
11. vérifier les historiques.

## 22.5 Nutrition

1. créer un objectif ;
2. créer un aliment ;
3. ajouter une portion ;
4. créer un repas ;
5. copier le repas ;
6. consulter le résumé.

## 22.6 Couche Coaching (5.1–5.6)

1. recommandation INCREASE / HOLD / DECREASE / REVIEW ;
2. décision ACCEPTED + snapshot ACTIVE inchangé ;
3. plateau WATCH → PLATEAU → NONE après progression ;
4. overview Coach (REVIEW load reco visible) ;
5. explication IA fake + stale fingerprint ;
6. chat : tool call + IDOR + busy + conflict command ;
7. offline chat : envoi bloqué.

## 22.6bis Coach IA — propositions structurées (jalon 8, livré)

1. poser une question au chat entraînant une proposition (programme ou séance) ;
2. recevoir une proposition simulée (provider `fake`) sous forme de carte dédiée, pas de JSON brut ;
3. consulter le détail (aperçu dénormalisé) ;
4. accepter (séance : choisir un programme cible) ;
5. vérifier le programme/la séance créé(e) côté déterministe (`ProgramsService`) ;
6. rafraîchir la page et vérifier que le statut `ACCEPTED` persiste ;
7. refuser une autre proposition et vérifier qu’elle ne peut plus être acceptée.

Modification/négociation en langage naturel avant acceptation reste hors périmètre du jalon 8
(la proposition est accept/dismiss uniquement — pas d’édition inline).

## 22.7 Confidentialité

1. créer deux comptes ;
2. tenter d’ouvrir une ressource étrangère ;
3. tenter de modifier une série étrangère ;
4. vérifier le refus ;
5. vérifier l’absence de donnée exposée.

## 23. Navigateurs et appareils

### Navigateurs prioritaires

- Chrome récent Android ;
- Safari récent iOS ;
- Chrome desktop ;
- Firefox desktop ;
- Safari desktop, selon disponibilité.

### Résolutions minimales

Tester au minimum :

- petit téléphone ;
- téléphone standard ;
- grand téléphone ;
- tablette ;
- desktop.

### Particularités

Vérifier :

- safe areas ;
- clavier virtuel ;
- PWA standalone ;
- retour navigateur ;
- mise en arrière-plan ;
- notifications ;
- thème sombre.

## 24. Tests d’accessibilité

### Automatiques

Vérifier :

- labels ;
- contrastes détectables ;
- rôles ;
- structure ;
- attributs invalides.

### Manuels

Tester :

- navigation clavier ;
- focus ;
- lecteur d’écran ;
- zoom ;
- taille du texte ;
- réduction des mouvements ;
- boutons tactiles.

### Parcours prioritaires

- connexion ;
- création de programme ;
- séance active ;
- ajout alimentaire ;
- confirmation destructive.

## 25. Tests visuels

Des tests de capture peuvent être ajoutés pour les composants stables.

Cibles possibles :

- boutons ;
- cartes ;
- formulaire ;
- séance active ;
- station partagée ;
- états réseau ;
- thème clair et sombre.

Les snapshots visuels ne doivent pas remplacer les assertions comportementales.

## 26. Tests de performance frontend

Mesurer :

- taille des bundles ;
- temps de chargement ;
- temps d’interaction ;
- rendu de longues listes ;
- graphiques ;
- consommation mémoire pendant une séance ;
- reconnexions.

Objectifs initiaux :

- charger rapidement l’écran actif ;
- éviter une requête à chaque saisie ;
- ne pas rerendre toute la séance après chaque seconde de chronomètre ;
- lazy-load les modules secondaires.

## 27. Tests de performance backend

Tester :

- liste d’exercices ;
- historique paginé ;
- création de série ;
- calcul de progression ;
- création de snapshot ;
- rotation ;
- synchronisation par lot ;
- connexions Socket.IO.

### Tests de charge initiaux

Scénarios raisonnables :

- plusieurs dizaines de salles ;
- quelques utilisateurs par salle ;
- commandes répétées ;
- reconnexions ;
- historique volumineux.

L’objectif n’est pas de simuler immédiatement des millions d’utilisateurs.

## 28. Tests de sécurité

Vérifications prioritaires :

- IDOR ;
- token expiré ;
- refresh token révoqué ;
- CORS ;
- cookies ;
- CSRF selon stratégie ;
- rate limits ;
- payload trop grand ;
- entrée HTML ;
- requête brute ;
- accès admin ;
- join par code (rate limit, code invalide neutre, owner-only rotate) ;
- Shared 5.4 : attach IDOR (séance étrangère → 404) ; pas de cross-write ;
  `myWorkoutSessionId` viewer-only ;
- lien public `/invite/:code` (futur) ;
- événement Socket.IO étranger ;
- export d’un autre utilisateur.

## 29. Tests des migrations

Chaque migration importante doit être testée sur :

- base vide ;
- base contenant des données ;
- données proches des cas réels ;
- contraintes ;
- rollback logique lorsque possible.

Avant production :

1. sauvegarder ;
2. tester sur copie ;
3. mesurer la durée ;
4. vérifier les verrous ;
5. prévoir une procédure de retour.

## 30. Couverture

### 30.1 Cible générale

Une couverture chiffrée peut servir d’indicateur, mais ne doit pas devenir l’objectif principal.

### 30.2 Exigence forte

Les éléments suivants doivent avoir une couverture élevée :

- règles métier ;
- calculs ;
- autorisations ;
- rotation ;
- synchronisation ;
- validation IA ;
- authentification.

### 30.3 Exclusions raisonnables

Peuvent être moins couverts :

- fichiers de configuration simples ;
- wrappers sans logique ;
- composants purement décoratifs ;
- code généré.

## 31. CI

À chaque pull request :

1. installation avec lockfile ;
2. vérification du format ;
3. lint ;
4. typecheck ;
5. tests unitaires ;
6. tests d’intégration ;
7. build ;
8. validation Prisma ;
9. audit de sécurité selon seuil ;
10. tests end-to-end ciblés.

Les tests les plus longs peuvent être répartis.

## 32. Pipeline proposé

```text
install
  ↓
format-check
  ↓
lint
  ↓
typecheck
  ↓
unit-tests
  ↓
integration-tests
  ↓
build
  ↓
e2e-tests
  ↓
security-check
  ↓
artifact
```

## 33. Tests avant merge

Une pull request ne peut pas être fusionnée si :

- build échoué ;
- test critique échoué ;
- migration invalide ;
- erreur TypeScript ;
- vulnérabilité critique nouvelle ;
- contrat cassé sans mise à jour ;
- documentation incohérente avec le changement.

## 34. Tests avant déploiement

Exécuter :

- suite complète ;
- build de production ;
- migration sur environnement de test ;
- smoke tests ;
- vérification PWA ;
- connexion WebSocket ;
- sauvegarde ;
- test de restauration récent ;
- vérification des variables.

## 35. Smoke tests de production

Après déploiement, vérifier :

- page publique ;
- health checks ;
- connexion ;
- lecture du profil ;
- lecture des exercices ;
- création d’une ressource de test contrôlée ;
- connexion Socket.IO ;
- téléchargement des assets ;
- service worker ;
- logs d’erreur.

Les smoke tests ne doivent pas modifier les données d’utilisateurs réels.

## 36. Environnements de test

### Local

- rapide ;
- données de développement ;
- services simulés.

### CI

- base éphémère ;
- secrets de test ;
- navigateur headless ;
- fournisseur IA simulé.

### Staging

- configuration proche de la production ;
- données fictives ;
- notifications et emails de test ;
- migrations réelles ;
- HTTPS.

### Production

- smoke tests limités ;
- monitoring ;
- alertes ;
- pas de données fictives mélangées aux vraies.

## 37. Gestion des tests instables

Un test instable doit être traité comme un défaut.

Procédure :

1. identifier ;
2. reproduire ;
3. corriger la dépendance au temps ou à l’ordre ;
4. ajouter du diagnostic ;
5. ne pas simplement relancer indéfiniment.

Une quarantaine temporaire peut être utilisée uniquement avec un ticket et une échéance.

## 38. Bugs de production

Lorsqu’un bug est découvert :

1. écrire un test qui reproduit le bug ;
2. vérifier que le test échoue ;
3. corriger ;
4. vérifier que le test passe ;
5. conserver le test comme non-régression.

## 39. Données personnelles dans les tests

Ne jamais utiliser de vraies données utilisateur dans :

- fixtures ;
- captures ;
- logs CI ;
- rapports ;
- snapshots ;
- bases de développement.

Les données doivent être fictives.

## 40. Rapports

La CI peut produire :

- rapport de tests ;
- couverture ;
- traces Playwright ;
- vidéos de tests échoués ;
- captures ;
- résultats d’audit ;
- bundle analysis.

Les artefacts doivent avoir une durée de conservation limitée.

## 41. Responsabilité de l’agent IA

Lorsqu’un agent IA implémente une fonctionnalité, il doit :

- identifier les tests nécessaires ;
- ajouter ou modifier les tests ;
- exécuter les commandes adaptées ;
- ne pas modifier les assertions pour masquer une régression ;
- indiquer les tests non exécutés ;
- documenter les hypothèses.

## 42. Critères de validation

La stratégie de tests est correctement appliquée lorsque :

- les règles métier critiques ont des tests unitaires ;
- chaque endpoint important possède des tests d’intégration ;
- les accès entre utilisateurs sont testés ;
- la rotation est testée avec plusieurs configurations ;
- la synchronisation hors ligne couvre doublons et conflits ;
- les événements WebSocket sont testés ;
- l’IA est testée avec un fournisseur simulé ;
- les migrations sont testées avant production ;
- les parcours principaux possèdent des tests end-to-end ;
- un bug corrigé reçoit un test de non-régression ;
- la CI bloque les erreurs critiques.
