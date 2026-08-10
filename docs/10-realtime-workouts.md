# Séances partagées en temps réel

## 0. Statut d’implémentation

> **Nomenclature :** ne pas confondre avec la Couche Coaching (jalons techniques 5.1 → 5.6).
> Ici : **Shared 5.x** (Phase 5 produit — séances partagées).

### Shared 5.1 + 5.2 — REST (livré)

Fondations salle, invitations email, accept/decline/cancel et leave en HTTP
(`/api/v1/shared-workouts`, `/api/v1/shared-workout-invitations`).
REST / PostgreSQL restent la **source de vérité métier**.

### Shared 5.3 — Présence + invalidation Socket.IO (livré)

Livré **uniquement** :

- présence en ligne des membres abonnés ;
- hints d’invalidation (`room:changed`) pour refetch REST.

### Shared 5.4 — Invalidation statut séance membre (livré)

Ajoute la raison `MEMBER_WORKOUT_CHANGED` sur `room:changed` après :

- attach / create `my-workout-session` ;
- mutation lifecycle d’une `WorkoutSession` déjà liée à la room.

Effet client : invalidation TanStack Query (détail salle + « ma séance ») —
**statut / résumé uniquement**. **Pas** de sync de séries, stations ni snapshot
workout.

### Shared 5.5 — Exercice courant + progression (livré)

Ajoute :

- `MEMBER_CURRENT_EXERCISE_CHANGED` — sélection d’exercice courant ;
- `MEMBER_WORKOUT_PROGRESS_CHANGED` — changement du caractère `processed`
  d’une série (après commit `PATCH` set, y compris via sync offline).

Packets **compacts** uniquement : `{ roomId, reason, memberUserId? }`.
**Aucune** performance (poids, reps, RIR, statut set détaillé, notes).

Client : invalidate/refetch détail salle (coalescing ~200 ms pour progress).

**Hors Shared 5.3–5.5 (cible Shared 5.6+)** — ce document décrit aussi la cible
workout sync ; ne pas la lire comme livrée :

- sync séries / stations / rotation ;
- commandes idempotentes `commandId` / `expectedVersion` partagées ;
- snapshot workout live ;
- chronomètre partagé.

### Protocole Shared 5.3 / 5.4 / 5.5 (livré)

| Élément | Valeur |
|---------|--------|
| Namespace | `/shared-workouts` (`SHARED_WORKOUT_SOCKET_NAMESPACE`) |
| Protocole | `SHARED_WORKOUT_REALTIME_PROTOCOL_V1` (= `1`) |
| Auth handshake | `auth: { token }` ; aussi `accessToken` ou header `Authorization: Bearer …` |
| CORS | mêmes origines que REST (`CORS_ALLOWED_ORIGINS`) |
| Channel room | `shared-workout-room:{roomId}` |
| Présence | mémoire process : `roomId → userId → Set<socketId>` (multi-onglets) |
| Persistance | **aucune** table / colonne Presence ; **pas** de migration Prisma |

#### Client → serveur

- `room:subscribe` `{ roomId }` — Zod strict, UUID ; membership actif + statut `LOBBY`/`ACTIVE`
- `room:unsubscribe` `{ roomId }` — Zod strict

Ack subscribe succès : `{ ok: true, roomId, presence: { connectedUserIds } }`.
Échecs : `UNAUTHORIZED` | `ROOM_NOT_ACCESSIBLE` | `VALIDATION_ERROR`.

#### Serveur → client

- `presence:snapshot` `{ roomId, connectedUserIds }`
- `presence:joined` `{ roomId, userId }` — premier socket de l’utilisateur
- `presence:left` `{ roomId, userId }` — dernier socket retiré
- `room:changed` `{ roomId, reason, memberUserId? }`

Raisons `room:changed` :

```text
RENAMED | STARTED | COMPLETED | CANCELLED | MEMBER_JOINED | MEMBER_LEFT
| MEMBER_WORKOUT_CHANGED
| MEMBER_CURRENT_EXERCISE_CHANGED | MEMBER_WORKOUT_PROGRESS_CHANGED
```

`MEMBER_WORKOUT_CHANGED` (Shared 5.4) = hint d’invalidation du **résumé**
séance membre (`memberWorkout` / `myWorkoutSessionId`). Ce n’est **pas** une
commande de sync de séries ni un snapshot workout.

`MEMBER_CURRENT_EXERCISE_CHANGED` / `MEMBER_WORKOUT_PROGRESS_CHANGED`
(Shared 5.5) = hints d’invalidation pour exercice courant / compteurs —
**sans aucune donnée sportive** dans le packet.

#### Règles d’émission

- Émettre **après** commit PostgreSQL de la mutation REST.
- `COMPLETED` / `CANCELLED` → clear présence + refuse nouveaux `subscribe`.
- Leave REST → `MEMBER_LEFT` + eviction sockets (+ `presence:left` si était en ligne).
- Accept invitation → `MEMBER_JOINED` ; présence « en ligne » seulement après `subscribe`.
- Membership ≠ présence.
- Shared 5.4 : attach/create + lifecycle workout lié → `MEMBER_WORKOUT_CHANGED`.
- Shared 5.5 : PUT current-exercise → `MEMBER_CURRENT_EXERCISE_CHANGED` ;
  PATCH set (processed changed) sur séance liée + room ACTIVE + membership
  actif → `MEMBER_WORKOUT_PROGRESS_CHANGED`. Pas d’émission si room terminale
  ou membre left. Client **ne peut pas** forger ces events.

#### Client web

- `apps/web/.../lib/shared-workout-realtime.ts`
- hook `useSharedWorkoutRoomRealtime` sur `/shared-workouts/:roomId`
- `room:changed` → invalidation TanStack Query (refetch REST)
- Libellés : En ligne / Hors ligne / Présence inconnue
- Navigateur offline : socket non utilisé ; page REST toujours utilisable ; **pas** de file d’événements socket

#### Reconnexion (Shared 5.3 / 5.4)

1. reconnect Socket.IO avec JWT frais si besoin ;
2. `room:subscribe` → ack + `presence:snapshot` ;
3. refetch REST du détail salle (+ « ma séance » si Shared 5.4).

Pas de replay d’événements manqués ni de snapshot workout.

#### Déploiement / dette

- Docker local : API expose le port **3000** directement (Socket.IO inclus) ;
  nginx du service `web` = SPA uniquement — prévoir upgrade WS si reverse proxy
  unifié plus tard.
- **Une** instance API pour Shared 5.3 (présence in-memory).
- Adapter Socket.IO Redis = dette volontaire pour multi-instance.

## 1. Objectif de ce document

Ce document définit le fonctionnement temps réel des séances partagées.

Il décrit :

- le rôle de Socket.IO ;
- l’authentification des connexions ;
- le cycle de vie d’une salle ;
- les événements échangés ;
- la structure des commandes ;
- la gestion des versions ;
- l’idempotence ;
- la présence des participants ;
- la rotation sur les stations ;
- la reconnexion ;
- la gestion des conflits ;
- les règles de sécurité ;
- les critères de test.

L’objectif principal est de garantir qu’une séance partagée reste cohérente malgré :

- plusieurs utilisateurs actifs ;
- des actions simultanées ;
- des connexions mobiles instables ;
- des événements dupliqués ;
- des reconnexions ;
- des téléphones mis en arrière-plan.

## 2. Principes fondamentaux

### 2.1 Le serveur est autoritaire

Le serveur conserve l’état de référence de la séance partagée.

Le client ne décide pas seul :

- de l’affectation d’une station ;
- de la version de la salle ;
- de la présence d’un autre utilisateur ;
- de la validation définitive d’une série ;
- de la fin de la séance.

En Shared 5.3–5.4, l’autorité métier reste **REST** ; le socket informe seulement
présence et besoin de refetch (`MEMBER_WORKOUT_CHANGED` = statut séance membre).

### 2.2 HTTP et Socket.IO ont des responsabilités différentes

HTTP est utilisé pour :

- créer une salle ;
- inviter par email / accepter / refuser / annuler une invitation *(Shared 5.2 livré)* ;
- quitter une salle (leave soft) *(Shared 5.2 livré)* ;
- rename / start / complete / cancel *(Shared 5.1 livré)* ;
- rattacher / créer ma `WorkoutSession` (`/my-workout-session`) *(Shared 5.4 livré)* ;
- résoudre un code d’invitation public *(futur)* ;
- rejoindre via code *(futur)* ;
- récupérer un snapshot workout *(Shared 5.5+)* ;
- consulter le résumé ;
- modifier des paramètres hors séance.

Socket.IO Shared 5.3–5.4 (livré) :

- `room:subscribe` / `room:unsubscribe` ;
- présence (`presence:*`) ;
- invalidation (`room:changed`, y compris `MEMBER_WORKOUT_CHANGED`) ;
- reconnexion via re-subscribe + refetch REST.

Socket.IO Shared 5.5+ (cible, non livré) :

- synchroniser l’état workout actif ;
- enregistrer des commandes pendant la séance ;
- gérer les rotations ;
- snapshot workout / versions / ACK commandes.

### 2.3 Les événements ne remplacent pas la persistance

Une action importante doit être persistée avant d’être considérée comme confirmée.

Exemples :

- série terminée ;
- changement de station ;
- participant retiré ;
- séance terminée ;
- rotation recalculée.

### 2.4 Les clients doivent pouvoir reconstruire l’état

Un client ne doit pas dépendre d’une suite parfaite d’événements depuis son arrivée.

À tout moment, il doit pouvoir demander ou recevoir un snapshot complet.

### 2.5 Les commandes critiques sont idempotentes

Une commande envoyée plusieurs fois ne doit être appliquée qu’une seule fois.

## 3. Technologie

### 3.1 Serveur

- NestJS ;
- gateway Socket.IO ;
- namespace dédié ;
- rooms Socket.IO ;
- authentification JWT ;
- persistance PostgreSQL ;
- Prisma ;
- événements typés partagés.

### 3.2 Client

- Socket.IO Client ;
- connexion centralisée ;
- état de connexion exposé à l’interface ;
- reconnexion automatique contrôlée ;
- cache du snapshot ;
- file de commandes non confirmées.

### 3.3 Namespace

Namespace livré (Shared 5.3) :

```text
/shared-workouts
```

Constante partagée : `SHARED_WORKOUT_SOCKET_NAMESPACE`.

Exemple de connexion :

```ts
const socket = io(`${API_URL}/shared-workouts`, {
  auth: {
    token: accessToken, // aussi accessToken accepté côté serveur
  },
  transports: ["websocket", "polling"],
  autoConnect: false,
  reconnection: true,
});
```

Channel interne room : `shared-workout-room:{roomId}` (pas un mécanisme d’auth).

## 4. Authentification de la connexion

### 4.1 Handshake

Le client transmet un access token lors du handshake Shared 5.3 :

- `auth.token` (préféré) ;
- ou `auth.accessToken` ;
- ou header `Authorization: Bearer <token>`.

Le serveur vérifie :

- signature ;
- expiration ;
- utilisateur ;
- statut du compte (`DISABLED` / `DELETION_PENDING` refusés).

Le `userId` attaché au socket vient uniquement du JWT vérifié.

### 4.2 Données attachées au socket

Après authentification, le serveur peut attacher :

```ts
type AuthenticatedSocketData = {
  userId: string;
  sessionId: string | null;
  role: "USER" | "ADMIN";
};
```

Le serveur ne doit pas faire confiance à un `userId` présent dans le payload d’un événement.

### 4.3 Token expiré

Si le token expire :

1. le serveur refuse les nouvelles commandes ;
2. le client renouvelle la session via HTTP ;
3. le client se reconnecte avec un nouveau token ;
4. le snapshot est rechargé.

Les données déjà saisies localement doivent être conservées.

### 4.4 Erreurs d’authentification

Codes recommandés :

```text
SOCKET_AUTH_REQUIRED
SOCKET_AUTH_INVALID
SOCKET_AUTH_EXPIRED
SOCKET_ACCOUNT_DISABLED
```

## 5. Room Socket.IO

Chaque salle partagée utilise une room technique.

Format livré (Shared 5.3) :

```text
shared-workout-room:<roomId>
```

Un client ne rejoint cette room qu’après :

- authentification JWT ;
- `room:subscribe` validé ;
- membership actif (`leftAt IS NULL`) ;
- statut salle `LOBBY` ou `ACTIVE`.

Le nom technique de la room ne doit pas servir de mécanisme d’autorisation.

## 6. Cycle de vie d’une salle

États :

```text
LOBBY
PREPARING
ACTIVE
PAUSED
COMPLETED
CANCELLED
```

### `LOBBY`

- invitations ouvertes ;
- participants rejoignent ;
- participants indiquent leur disponibilité ;
- équipements configurés.

### `PREPARING`

- génération ou modification de la rotation ;
- validation des plans individuels ;
- préparation du snapshot initial.

### `ACTIVE`

- séries enregistrées ;
- rotations appliquées ;
- présence synchronisée ;
- chronomètres actifs.

### `PAUSED`

- séance temporairement suspendue ;
- aucune rotation automatique ;
- actions limitées.

### `COMPLETED`

- lecture seule ;
- performances persistées ;
- résumé disponible.

### `CANCELLED`

- salle fermée ;
- conservation éventuelle des performances déjà validées selon la décision de l’hôte.

## 7. Version de l’état

Chaque salle possède un entier :

```ts
stateVersion: number;
```

La version augmente lors d’une modification métier significative.

Exemples :

- participant ajouté ;
- participant retiré ;
- station modifiée ;
- série confirmée ;
- rotation appliquée ;
- séance mise en pause ;
- séance terminée.

### 7.1 Version connue du client

Le client conserve :

```ts
lastKnownVersion: number;
```

### 7.2 Commande

Une commande critique contient :

```ts
expectedVersion: number;
```

### 7.3 Réponse serveur

Le serveur peut :

- appliquer la commande ;
- appliquer sans conflit malgré une version ancienne ;
- rejeter pour conflit ;
- demander un resnapshot.

### 7.4 Conflit de version

Code :

```text
SHARED_STATE_VERSION_CONFLICT
```

Réponse :

```ts
type VersionConflict = {
  expectedVersion: number;
  currentVersion: number;
  requiresSnapshot: boolean;
};
```

## 8. Structure commune des commandes

```ts
type RealtimeCommand<TPayload> = {
  commandId: string;
  roomId: string;
  expectedVersion: number;
  clientCreatedAt: string;
  payload: TPayload;
};
```

### `commandId`

Identifiant unique généré côté client.

### `roomId`

Salle concernée.

### `expectedVersion`

Version connue lors de la création de la commande.

### `clientCreatedAt`

Information diagnostique.

Le serveur ne l’utilise pas comme ordre autoritaire.

### `payload`

Données propres à la commande.

## 9. Structure des acknowledgements

```ts
type CommandAcknowledgement<TResult = unknown> =
  | {
      commandId: string;
      status: "APPLIED" | "ALREADY_APPLIED";
      serverVersion: number;
      result: TResult;
    }
  | {
      commandId: string;
      status: "REJECTED" | "CONFLICT";
      serverVersion: number;
      error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
      };
    };
```

Toute commande critique doit recevoir un acknowledgement.

Le client ne doit pas considérer une commande comme confirmée avant cet acknowledgement.

## 10. Nommage des événements

Convention recommandée :

```text
domain:action
```

Commandes client vers serveur :

```text
room:join
room:leave
room:set-ready
room:start
room:pause
room:resume
room:complete
room:cancel

participant:set-status
participant:pause
participant:resume
participant:finish
participant:remove

set:complete
set:update
set:cancel

rotation:recalculate
rotation:apply
rotation:override

station:disable
station:enable
station:assign
```

Événements serveur vers client :

```text
room:snapshot
room:state-updated
room:started
room:paused
room:resumed
room:completed
room:cancelled

participant:joined
participant:left
participant:status-changed
participant:connection-changed

set:completed
set:updated
set:cancelled

rotation:updated
station:assignment-changed

server:error
server:resync-required
```

## 11. Types partagés

Les contrats Socket.IO doivent être placés dans `packages/shared`.

Exemple :

```ts
interface ClientToServerEvents {
  "room:join": (
    command: RealtimeCommand<JoinRoomPayload>,
    ack: (result: CommandAcknowledgement<JoinRoomResult>) => void,
  ) => void;

  "set:complete": (
    command: RealtimeCommand<CompleteSetPayload>,
    ack: (result: CommandAcknowledgement<CompleteSetResult>) => void,
  ) => void;

  "rotation:override": (
    command: RealtimeCommand<OverrideRotationPayload>,
    ack: (result: CommandAcknowledgement<RotationResult>) => void,
  ) => void;
}

interface ServerToClientEvents {
  "room:snapshot": (snapshot: SharedWorkoutSnapshot) => void;
  "room:state-updated": (event: SharedStateUpdatedEvent) => void;
  "participant:status-changed": (event: ParticipantStatusChangedEvent) => void;
  "set:completed": (event: SetCompletedEvent) => void;
  "rotation:updated": (event: RotationUpdatedEvent) => void;
  "server:resync-required": (event: ResyncRequiredEvent) => void;
}
```

## 12. Snapshot de salle

Le snapshot représente l’état complet nécessaire au client.

```ts
type SharedWorkoutSnapshot = {
  room: {
    id: string;
    name: string;
    status:
      | "LOBBY"
      | "PREPARING"
      | "ACTIVE"
      | "PAUSED"
      | "COMPLETED"
      | "CANCELLED";
    hostUserId: string;
    stateVersion: number;
    startedAt: string | null;
    completedAt: string | null;
    targetDurationMinutes: number | null;
  };

  currentUser: {
    participantId: string;
    userId: string;
    role: "HOST" | "PARTICIPANT";
    status: string;
  };

  participants: SharedParticipantView[];
  stations: SharedStationView[];
  assignments: SharedAssignmentView[];
  currentUserPlan: SharedParticipantPlanView[];
  currentUserWorkout: SharedUserWorkoutView;
  timers: SharedTimerView[];
  permissions: SharedRoomPermissions;
};
```

### 12.1 Données privées

Le snapshot ne doit pas forcément contenir les performances détaillées de tous les participants.

Chaque participant reçoit :

- ses propres charges ;
- ses propres séries ;
- son propre historique ;
- les informations collectives nécessaires.

Les autres participants peuvent être représentés par :

- nom affiché ;
- avatar éventuel ;
- station ;
- statut ;
- progression générale ;
- connexion.

## 13. Connexion à une salle

Commande :

```text
room:join
```

Payload :

```ts
type JoinRoomPayload = {
  lastKnownVersion: number | null;
  pendingCommandIds: string[];
};
```

Le serveur :

1. vérifie l’utilisateur ;
2. vérifie son appartenance ;
3. rejoint la room Socket.IO ;
4. met à jour sa présence ;
5. renvoie le snapshot ;
6. diffuse son état de connexion.

Résultat :

```ts
type JoinRoomResult = {
  snapshot: SharedWorkoutSnapshot;
};
```

## 14. Quitter la connexion et quitter la séance

Deux actions doivent être distinguées.

### Déconnexion technique

Le téléphone perd le réseau ou ferme le socket.

Le participant reste membre.

### Quitter la séance

Commande explicite :

```text
room:leave
```

Le participant change de statut.

Une confirmation peut être demandée dans l’interface.

## 15. Présence

### 15.1 États techniques

```text
CONNECTED
TEMPORARILY_DISCONNECTED
OFFLINE
```

### 15.2 États métier

```text
JOINED
READY
ACTIVE
PAUSED
FINISHED
LEFT
REMOVED
```

Les deux notions ne doivent pas être confondues.

Un participant peut être :

```text
métier : ACTIVE
connexion : TEMPORARILY_DISCONNECTED
```

### 15.3 Déconnexion

Lors de `disconnect` :

1. le serveur marque la connexion comme interrompue ;
2. il conserve le participant ;
3. un délai de grâce commence ;
4. l’état est diffusé ;
5. aucune suppression immédiate n’est effectuée.

### 15.4 Délai de grâce

Valeur configurable.

Exemple initial :

```text
120 secondes
```

Après expiration, le participant peut être marqué hors ligne sans quitter définitivement la séance.

## 16. Participant prêt

Commande :

```text
room:set-ready
```

Payload :

```ts
type SetReadyPayload = {
  isReady: boolean;
};
```

Le démarrage peut exiger que tous les participants actifs soient prêts.

L’hôte peut disposer d’une action explicite pour démarrer malgré un participant non prêt.

## 17. Démarrage de la séance

Commande réservée à l’hôte :

```text
room:start
```

Avant de démarrer, le serveur vérifie :

- statut `LOBBY` ou `PREPARING` ;
- nombre minimal de participants ;
- stations valides ;
- rotation valide ;
- plans individuels ;
- absence de conflit bloquant.

Résultat :

```ts
type StartRoomResult = {
  startedAt: string;
  stateVersion: number;
  assignments: SharedAssignmentView[];
};
```

Événement diffusé :

```text
room:started
```

## 18. Enregistrement d’une série

Commande :

```text
set:complete
```

Payload :

```ts
type CompleteSetPayload = {
  participantExercisePlanId: string;
  workoutSessionExerciseId: string;
  setNumber: number;
  setType:
    | "WARMUP"
    | "WORKING"
    | "BACKOFF"
    | "DROP_SET"
    | "AMRAP"
    | "FAILURE_OPTIONAL";

  status: "COMPLETED" | "PARTIAL" | "FAILED" | "SKIPPED";

  actualWeightKg: number | null;
  actualReps: number | null;
  actualDurationSeconds: number | null;
  actualDistanceMeters: number | null;

  actualRir: number | null;
  actualRpe: number | null;

  reachedFailure: boolean;
  notes: string | null;
};
```

### Validation serveur

Le serveur vérifie :

- propriétaire de la performance ;
- exercice et plan ;
- numéro de série ;
- type de mesure ;
- valeurs ;
- statut de la salle ;
- version ;
- commande déjà appliquée.

### Transaction

La transaction peut :

1. créer ou mettre à jour la série ;
2. mettre à jour la progression du participant ;
3. recalculer son statut sur la station ;
4. recalculer la rotation si nécessaire ;
5. incrémenter la version ;
6. enregistrer la commande ;
7. produire les événements.

### Résultat

```ts
type CompleteSetResult = {
  workoutSetId: string;
  participantProgress: SharedParticipantProgress;
  rotationChanged: boolean;
};
```

## 19. Mise à jour d’une série

Commande :

```text
set:update
```

Une série confirmée peut être corrigée uniquement par son propriétaire, selon les règles métier.

Le serveur doit recalculer :

- progression ;
- records éventuels ;
- rotation si la correction modifie l’état d’avancement.

## 20. Chronomètres

### 20.1 Autorité temporelle

Un chronomètre partagé ne doit pas dépendre de décréments envoyés chaque seconde.

Le serveur transmet :

```ts
type SharedTimer = {
  id: string;
  ownerParticipantId: string;
  timerType: "REST" | "ROOM_PAUSE";
  startedAt: string;
  endsAt: string;
  pausedAt: string | null;
  remainingSecondsWhenPaused: number | null;
};
```

Le client calcule l’affichage depuis `endsAt`.

### 20.2 Synchronisation

Le serveur ne diffuse pas un événement chaque seconde.

Il diffuse uniquement :

- démarrage ;
- pause ;
- reprise ;
- modification ;
- fin logique.

### 20.3 Horloge

Le client doit tenir compte d’un décalage estimé entre l’horloge client et l’horloge serveur.

Un endpoint ou événement de synchronisation peut retourner :

```ts
type ServerTimePayload = {
  serverTime: string;
};
```

## 21. Rotation

### 21.1 Calcul

Le moteur de rotation reçoit un état déterministe.

```ts
type RotationInput = {
  algorithmVersion: string;
  participants: RotationParticipantInput[];
  stations: RotationStationInput[];
  plans: RotationPlanInput[];
  currentAssignments: RotationAssignmentInput[];
  completedSets: RotationCompletedSetInput[];
};
```

### 21.2 Résultat

```ts
type RotationOutput = {
  assignments: RotationAssignmentOutput[];
  waitingParticipants: string[];
  warnings: RotationWarning[];
};
```

### 21.3 Déclencheurs

La rotation peut être recalculée lorsque :

- une série ou un bloc de séries est terminé ;
- un participant termine une station ;
- un participant se met en pause ;
- un participant revient ;
- une station est désactivée ;
- l’hôte demande un recalcul ;
- un participant rejoint tardivement.

### 21.4 Application

Un calcul ne doit pas forcément être appliqué automatiquement.

Selon le mode de salle :

- rotation automatique ;
- rotation proposée puis validée par l’hôte.

La première version peut choisir un seul mode pour réduire la complexité.

## 22. Modification manuelle de rotation

Commande réservée à l’hôte :

```text
rotation:override
```

Payload :

```ts
type OverrideRotationPayload = {
  assignments: Array<{
    participantId: string;
    stationId: string | null;
  }>;
  reason: string | null;
};
```

Le serveur vérifie :

- absence de double occupation incompatible ;
- participants valides ;
- stations valides ;
- capacité ;
- statut de salle.

## 23. Désactivation d’une station

Commande :

```text
station:disable
```

Cas possibles :

- machine occupée par une autre personne ;
- machine en panne ;
- équipement indisponible ;
- changement de plan.

Le serveur :

1. désactive la station ;
2. retire ou déplace ses affectations ;
3. recalcule la rotation ;
4. incrémente la version ;
5. diffuse le nouvel état.

## 24. Mise en pause de la salle

Commande hôte :

```text
room:pause
```

Pendant la pause :

- les chronomètres de salle peuvent être suspendus ;
- les séries déjà en cours peuvent rester enregistrables selon la règle choisie ;
- les rotations automatiques sont suspendues.

Commande de reprise :

```text
room:resume
```

## 25. Participant en pause

Commande :

```text
participant:pause
```

Le participant reste membre.

La rotation peut libérer sa station après confirmation.

Commande de retour :

```text
participant:resume
```

Le serveur propose une nouvelle affectation.

## 26. Participant terminé

Commande :

```text
participant:finish
```

Le participant indique avoir fini sa partie.

Le serveur vérifie les séries restantes.

L’utilisateur peut confirmer qu’il souhaite ignorer les éléments incomplets.

Sa station est libérée.

## 27. Fin de la salle

Commande réservée à l’hôte :

```text
room:complete
```

Le serveur vérifie :

- salle active ou en pause ;
- autorisation ;
- séries non confirmées ;
- commandes en cours ;
- état des participants.

Une confirmation spécifique peut permettre de terminer malgré des exercices incomplets.

Après succès :

1. la salle passe à `COMPLETED` ;
2. les séances individuelles sont finalisées ;
3. les records sont calculés ;
4. le résumé est créé ;
5. la version augmente ;
6. `room:completed` est diffusé ;
7. la salle devient en lecture seule.

## 28. Reconnexion

### 28.1 Détection client

Le client affiche immédiatement que le temps réel est interrompu.

### 28.2 Actions locales

Les actions critiques pendant une déconnexion doivent être traitées prudemment.

Options possibles :

- blocage temporaire ;
- enregistrement local avec statut en attente ;
- saisie autorisée sans application de rotation.

Recommandation initiale :

- permettre de saisir une série localement ;
- ne pas simuler la rotation ;
- envoyer la commande à la reconnexion.

### 28.3 Reconnexion Socket.IO

À la reconnexion :

1. renouveler le token si nécessaire ;
2. reconnecter le socket ;
3. émettre `room:join` ;
4. transmettre la dernière version ;
5. transmettre les identifiants des commandes en attente ;
6. recevoir un snapshot ;
7. réconcilier les commandes.

### 28.4 Commandes non confirmées

Le serveur peut indiquer pour chaque commande :

- déjà appliquée ;
- à renvoyer ;
- rejetée ;
- en conflit.

## 29. Resynchronisation forcée

Événement :

```text
server:resync-required
```

Payload :

```ts
type ResyncRequiredEvent = {
  roomId: string;
  currentVersion: number;
  reason:
    | "VERSION_TOO_OLD"
    | "MISSED_EVENTS"
    | "SERVER_RESTART"
    | "STATE_INCONSISTENT";
};
```

Le client doit alors demander ou recevoir un snapshot complet.

## 30. Redémarrage du serveur

L’état nécessaire doit être reconstruisible depuis PostgreSQL.

Après redémarrage :

- les sockets se reconnectent ;
- les rooms techniques sont recréées ;
- les snapshots sont chargés ;
- les timers sont reconstruits depuis leurs dates ;
- les commandes appliquées restent connues.

L’état critique ne doit pas exister uniquement en mémoire.

## 31. Plusieurs onglets ou appareils

Un utilisateur peut être connecté depuis plusieurs appareils.

La première version peut autoriser plusieurs connexions, mais doit définir le comportement.

Recommandation :

- plusieurs connexions peuvent consulter ;
- une commande peut être envoyée depuis n’importe laquelle ;
- les versions et command IDs empêchent les doublons ;
- toutes les connexions de l’utilisateur reçoivent les mises à jour.

Une stratégie future peut désigner un appareil principal pendant la séance.

## 32. Diffusion des événements

### 32.1 À toute la room

Exemples :

- rotation ;
- présence ;
- statut de salle ;
- station désactivée.

### 32.2 À un participant précis

Exemples :

- charge personnelle ;
- conflit sur sa série ;
- plan privé ;
- information sensible.

### 32.3 À l’hôte

Exemples :

- demande nécessitant une validation ;
- participant non prêt ;
- erreur de rotation ;
- conflit administratif.

## 33. Confidentialité

Les événements ne doivent pas diffuser automatiquement :

- poids corporel ;
- historique complet ;
- objectifs nutritionnels ;
- restrictions détaillées ;
- charges privées si le partage est désactivé ;
- notes personnelles ;
- données IA.

Les DTO envoyés à la room doivent être conçus spécifiquement pour l’affichage collectif.

## 34. Limitation de débit

Appliquer une limitation aux événements sensibles.

Exemples :

- rejoindre une room ;
- recalculer une rotation ;
- modifier une station ;
- compléter une série ;
- envoyer une commande répétée.

La limitation doit éviter les abus sans bloquer un usage normal en salle.

## 35. Taille des payloads

Les événements doivent rester compacts.

Éviter d’envoyer un snapshot complet après chaque série.

Utiliser :

- événement différentiel pour les changements normaux ;
- snapshot complet pour initialisation ou resynchronisation.

## 36. Gestion des erreurs

Événement non lié à une commande :

```text
server:error
```

Payload :

```ts
type ServerErrorEvent = {
  code: string;
  message: string;
  recoverable: boolean;
  requestId: string | null;
};
```

Les erreurs liées à une commande doivent être retournées dans son acknowledgement.

## 37. Codes d’erreur temps réel

```text
SOCKET_AUTH_REQUIRED
SOCKET_AUTH_INVALID
SOCKET_AUTH_EXPIRED

SHARED_ROOM_NOT_FOUND
SHARED_ROOM_ACCESS_DENIED
SHARED_ROOM_NOT_ACTIVE
SHARED_ROOM_ALREADY_COMPLETED
SHARED_ROOM_FULL

SHARED_PARTICIPANT_NOT_FOUND
SHARED_PARTICIPANT_NOT_READY
SHARED_PARTICIPANT_REMOVED
SHARED_HOST_REQUIRED

SHARED_STATE_VERSION_CONFLICT
SHARED_COMMAND_ALREADY_APPLIED
SHARED_COMMAND_INVALID

SHARED_SET_INVALID
SHARED_SET_NOT_OWNED
SHARED_SET_ALREADY_COMPLETED

SHARED_STATION_NOT_FOUND
SHARED_STATION_DISABLED
SHARED_STATION_CAPACITY_EXCEEDED

SHARED_ROTATION_INVALID
SHARED_ROTATION_CONFLICT
SHARED_ROTATION_UNAVAILABLE
```

## 38. Journalisation

Chaque commande critique doit pouvoir être reliée à :

- `commandId` ;
- `roomId` ;
- `userId` ;
- `socketId` ;
- version attendue ;
- version appliquée ;
- résultat ;
- durée ;
- code d’erreur.

Ne pas journaliser inutilement les charges ou notes personnelles.

## 39. Métriques

Métriques utiles :

- sockets connectés ;
- rooms actives ;
- connexions par room ;
- reconnexions ;
- commandes par type ;
- conflits ;
- acknowledgements en erreur ;
- latence des commandes ;
- temps de calcul d’une rotation ;
- commandes dupliquées ;
- échecs de persistance.

## 40. Tests unitaires

Tester notamment :

- changement d’état de salle ;
- permissions ;
- algorithme de rotation ;
- validation des charges ;
- versionnement ;
- idempotence ;
- participant en pause ;
- station désactivée ;
- fin de séance.

## 41. Tests d’intégration

Scénarios :

1. deux utilisateurs rejoignent une room ;
2. l’hôte démarre ;
3. un participant complète une série ;
4. l’autre reçoit l’événement ;
5. la série est persistée ;
6. la version augmente.

Autres scénarios :

- commande dupliquée ;
- commande avec mauvaise version ;
- utilisateur non membre ;
- participant modifiant une série étrangère ;
- serveur redémarré ;
- reconnexion ;
- salle terminée ;
- token expiré.

## 42. Tests end-to-end

Scénario principal :

1. création de deux comptes ;
2. création d’une salle ;
3. invitation ;
4. arrivée dans le lobby ;
5. confirmation des participants ;
6. démarrage ;
7. enregistrement de séries depuis deux clients ;
8. rotation ;
9. perte de connexion d’un client ;
10. reconnexion ;
11. récupération du snapshot ;
12. fin de séance ;
13. présence des performances dans les deux historiques.

## 43. Critères de validation

Le module temps réel est considéré comme fiable lorsque :

- aucune série n’est créée en double après reconnexion ;
- un utilisateur ne peut pas modifier les performances d’un autre ;
- un snapshot restaure correctement l’interface ;
- une perte de réseau courte ne fait pas quitter la salle ;
- la rotation reste cohérente ;
- la fin de séance produit les historiques attendus ;
- un redémarrage du serveur ne détruit pas l’état métier ;
- l’interface identifie clairement une perte de synchronisation.
