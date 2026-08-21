# PWA et fonctionnement hors ligne

## 1. Objectif de ce document

Ce document définit le comportement PWA et hors ligne de Gym Companion.

Il précise :

- les fonctionnalités installables ;
- le rôle du service worker ;
- les stratégies de cache ;
- le stockage IndexedDB ;
- la conservation d’une séance active ;
- la file de commandes ;
- la synchronisation ;
- la gestion des conflits ;
- les mises à jour de l’application ;
- les notifications push ;
- les limites imposées par les navigateurs.

L’objectif n’est pas de rendre toute l’application totalement autonome sans réseau.

L’objectif est d’éviter la perte de données et de permettre la poursuite d’une séance individuelle lors d’une coupure temporaire.

## 2. Principes

### 2.1 Offline-first limité

L’application adopte une approche offline-first pour la séance individuelle active.

Les autres fonctionnalités utilisent une approche online-first avec cache lorsque pertinent.

### 2.2 Transparence

L’utilisateur doit toujours savoir si une donnée est :

- locale ;
- en attente ;
- en cours de synchronisation ;
- confirmée ;
- refusée ;
- en conflit.

### 2.3 Aucune fausse synchronisation

Lorsque le réseau est coupé, l’application ne doit pas prétendre que :

- les données sont sur le serveur ;
- une séance partagée continue normalement ;
- une tentative de join est effectuée ;
- une proposition IA est générée.

### 2.4 Préservation des données

Une mise à jour, un crash ou une fermeture de l’application ne doit pas supprimer une séance active non synchronisée.

### 2.4bis Screen Wake Lock (Active Workout)

Pendant qu’une séance **ACTIVE** ou **PAUSED** est affichée dans l’UI Active Workout, les appareils compatibles demandent un *screen wake lock* (`navigator.wakeLock.request('screen')`) afin de limiter la mise en veille automatique.

- best-effort (feature detection uniquement, pas de dépendance tierce) ;
- réacquisition lorsque l’app redevient visible (`visibilitychange`) ;
- release à la fin / annulation, au unmount, ou en quittant la page Active Workout ;
- refus système silencieux — la séance reste utilisable.

### 2.5 Sécurité

Le cache et IndexedDB ne doivent contenir que les données nécessaires à l’usage hors ligne.

## 3. Capacités par fonctionnalité

| Fonctionnalité               |              Hors ligne |    Lecture depuis cache |              Écriture locale |
| ---------------------------- | ----------------------: | ----------------------: | ---------------------------: |
| Shell de l’application       |                     Oui |                     Oui |                          Non |
| Connexion                    |                     Non |                     Non |                          Non |
| Profil                       |                 Partiel |                     Oui |             Non initialement |
| Catalogue d’exercices récent |                     Oui |                     Oui |             Non initialement |
| Programmes récents           |                     Oui |                     Oui |             Non initialement |
| Séance individuelle active   |                     Oui |                     Oui |                          Oui |
| Historique complet           |                     Non |                 Partiel |                          Non |
| Progression                  |                     Non |                 Partiel |                          Non |
| Séance partagée              |                     Non |         Snapshot limité | Séries en attente uniquement |
| Nutrition                    |           Partiel futur |                     Oui |                        Futur |
| Coach déterministe / overview |                     Non |                   Non |                          Non |
| Explication IA (5.5)          |                     Non |                   Non |                          Non |
| Chat Coach (5.6)              |                     Non | historique déjà chargé (mémoire Query) | Non |

### Coaching — NetworkOnly et hors file offline

Tous les endpoints :

```text
/api/v1/coaching/*
```

restent **NetworkOnly** dans le service worker (comme l’ensemble de `/api/`).

Précisions coaching :

- **pas** de queue IndexedDB pour les messages chat ;
- **pas** d’explication IA générée offline ;
- les résultats sportifs officiels (records, progression, recommandations, plateau, CoachSummary) restent **serveur-authoritative** ;
- l’historique de conversation déjà présent dans TanStack Query peut rester visible offline, sans nouvel envoi.

### Shared workouts — NetworkOnly (Shared 5.1 → 5.6)

```text
/api/v1/shared-workouts/*
```

également **NetworkOnly**. Serveur authoritative ; **aucune** queue offline IndexedDB
pour les rooms, join codes, ni l’**association** séance↔salle (Shared 5.4),
ni l’exercice courant shared (Shared 5.5).
Création / join / rotate code / leave / mutations lifecycle / attach /
create `my-workout-session` / `current-exercise` nécessitent une connexion ;
message UI :

```text
Une connexion est nécessaire pour gérer une séance partagée.
```

**Socket.IO Shared 5.3–5.5 :** indisponible hors ligne. Pas de file d’événements
présence / `room:changed` / `MEMBER_WORKOUT_CHANGED` / progress / current exercise.
L’UI affiche « Présence inconnue » ; le détail salle reste consultable /
actionnable via REST dès que le réseau revient (pas de prétention que les
autres sont synchronisés).

**Shared 5.4 — association online-only :** rattacher ou créer une séance depuis
la room exige le réseau. Une fois la `WorkoutSession` créée, elle conserve le
mode dégradé Phase 3 (IndexedDB / file de commandes) pour **ses** séries —
indépendamment de la room.

**Shared 5.5 — progression :** la performance personnelle peut progresser
offline ; la progression partagée n’est officielle qu’après sync serveur des
commandes set. L’exercice courant shared n’est **pas** mis en file IndexedDB.

**Shared 5.6 — équipements :** request / release / cancel = **online only**.
Disconnect socket **≠** release (occupation reste USING). Pas de queue IndexedDB.

## 4. Installation PWA

### 4.1 Manifeste

Le manifeste doit définir :

- nom ;
- nom court ;
- description ;
- icônes ;
- couleur de thème ;
- couleur d’arrière-plan ;
- orientation ;
- `display: standalone` ;
- URL de démarrage ;
- scope.

Exemple conceptuel :

```json
{
  "name": "Gym Companion",
  "short_name": "Gym",
  "display": "standalone",
  "start_url": "/",
  "scope": "/",
  "theme_color": "#000000",
  "background_color": "#000000"
}
```

Les couleurs exactes dépendent du design final.

### 4.2 Icônes

Prévoir :

- 192 × 192 ;
- 512 × 512 ;
- icônes maskable ;
- favicon ;
- icônes Apple lorsque nécessaire.

### 4.3 Invitation à installer

L’application ne doit pas afficher immédiatement une bannière intrusive.

Une proposition d’installation peut apparaître après :

- plusieurs ouvertures ;
- une première séance ;
- une visite depuis un appareil compatible ;
- une action volontaire dans les paramètres.

## 5. Service worker

Le service worker est généré ou intégré avec `vite-plugin-pwa`.

Il prend en charge :

- précache des assets ;
- cache runtime ;
- page hors ligne ;
- notifications push ;
- clics sur notification ;
- mise à jour de version.

Il ne gère pas directement toute la logique métier hors ligne.

Cette logique reste dans l’application et IndexedDB.

## 6. Stratégies de cache

### 6.1 Assets statiques

Stratégie :

```text
Cache First
```

Concernés :

- JavaScript versionné ;
- CSS versionné ;
- polices ;
- icônes ;
- images statiques.

Les noms de fichiers hashés permettent l’invalidation.

### 6.2 Navigation de l’application

Stratégie :

```text
Network First avec fallback sur le shell
```

Lorsqu’une navigation SPA échoue, le service worker retourne le shell.

### 6.3 Données de référence

Exemples :

- groupes musculaires ;
- types d’équipement ;
- catalogue système.

Stratégie possible :

```text
Stale While Revalidate
```

La durée du cache doit être définie explicitement.

### 6.4 Données utilisateur

Les réponses privées ne doivent pas être mises en cache automatiquement sans contrôle.

Recommandation :

- TanStack Query pour le cache mémoire ;
- IndexedDB pour les données explicitement nécessaires ;
- pas de cache opaque généralisé des endpoints privés dans le service worker ;
- en particulier `/api/v1/coaching/*` et `/api/v1/shared-workouts/*` → **NetworkOnly** (voir §3).

### 6.5 Réponses d’authentification

Ne jamais mettre en cache :

- login ;
- refresh ;
- logout ;
- reset password ;
- profil sensible complet.

## 7. Stockage local

### 7.1 Technologie

IndexedDB est utilisé pour les données structurées.

Une librairie légère peut simplifier son utilisation.

La décision exacte doit être documentée lors de l’implémentation.

### 7.2 LocalStorage

LocalStorage est limité à :

- thème ;
- choix d’affichage ;
- tutoriels vus ;
- préférences non sensibles.

### 7.3 SessionStorage

SessionStorage peut être utilisé pour :

- redirection temporaire ;
- état non persistant d’un formulaire simple.

## 8. Schéma IndexedDB proposé

### Implémentation actuelle (jalon 3.5)

Base versionnée :

```text
gym-companion-offline
```

Stores :

```text
workoutSnapshots
workoutCommands
workoutSyncState
```

Cloisonnement : clé logique `userId + workoutSessionId`.

Commandes supportées :

```text
UPDATE_WORKOUT_SET
PAUSE_WORKOUT
RESUME_WORKOUT
COMPLETE_WORKOUT
CANCEL_WORKOUT
```

Non supporté hors ligne : création de séance, édition du snapshot, add/remove/reorder.

La minuterie de repos (3.4) reste dans `localStorage` et ne crée aucune commande.

Synchronisation : lorsque l’application est ouverte (`online`, focus, manuel). Pas de Background Sync garanti.

### Schéma évolutif documenté

Base :

```text
gym-companion
```

Stores proposés :

```text
activeWorkouts
offlineCommands
syncMetadata
cachedExercises
cachedTemplates
appMetadata
```

## 9. `activeWorkouts`

Contient le snapshot local d’une séance active.

```ts
type OfflineActiveWorkout = {
  workoutSessionId: string;
  ownerUserId: string;

  serverVersion: number;
  localVersion: number;

  workout: OfflineWorkoutSnapshot;

  lastServerSyncAt: string | null;
  lastLocalChangeAt: string;

  syncStatus: "SYNCED" | "PENDING" | "SYNCING" | "FAILED" | "CONFLICT";

  schemaVersion: string;
};
```

Un seul enregistrement actif est attendu dans la première version.

## 10. `offlineCommands`

```ts
type StoredOfflineCommand = {
  commandId: string;

  userId: string;
  aggregateType: "WORKOUT_SESSION";
  aggregateId: string;

  commandType:
    | "CREATE_WORKOUT_SET"
    | "UPDATE_WORKOUT_SET"
    | "CANCEL_WORKOUT_SET"
    | "ADD_WORKOUT_EXERCISE"
    | "UPDATE_WORKOUT_EXERCISE"
    | "REORDER_WORKOUT_EXERCISES"
    | "COMPLETE_WORKOUT"
    | "CANCEL_WORKOUT";

  expectedVersion: number;
  payload: unknown;

  createdAt: string;
  updatedAt: string;

  status: "PENDING" | "SENDING" | "CONFIRMED" | "FAILED" | "CONFLICT";

  attempts: number;
  lastAttemptAt: string | null;

  serverResult: unknown | null;
  error: OfflineCommandError | null;

  schemaVersion: string;
};
```

## 11. `syncMetadata`

```ts
type SyncMetadata = {
  key: string;
  userId: string;
  lastSuccessfulSyncAt: string | null;
  lastSyncAttemptAt: string | null;
  currentDeviceId: string;
  schemaVersion: string;
};
```

## 12. Identifiant de l’appareil

Un identifiant local non sensible peut être généré.

Il sert à :

- diagnostiquer les commandes ;
- identifier leur source ;
- différencier plusieurs installations ;
- faciliter la synchronisation.

Il ne constitue pas une preuve d’identité.

## 13. Cycle d’une action hors ligne

### 13.1 Action utilisateur

L’utilisateur enregistre une série.

### 13.2 Mise à jour locale

L’application :

1. crée un `commandId` ;
2. applique le changement au snapshot local ;
3. incrémente `localVersion` ;
4. enregistre le snapshot ;
5. enregistre la commande ;
6. affiche le résultat comme en attente.

### 13.3 Tentative réseau

Si le réseau est disponible :

1. la commande passe à `SENDING` ;
2. elle est envoyée ;
3. le serveur répond ;
4. le statut est mis à jour.

### 13.4 Confirmation

En cas de succès :

- statut `CONFIRMED` ;
- version serveur mise à jour ;
- snapshot serveur éventuellement fusionné ;
- indicateur de synchronisation actualisé.

### 13.5 Échec temporaire

En cas d’erreur réseau :

- retour à `PENDING` ;
- incrément de `attempts` ;
- nouvelle tentative plus tard.

### 13.6 Rejet métier

En cas de rejet :

- statut `FAILED` ou `CONFLICT` ;
- conservation du payload ;
- information utilisateur ;
- aucune suppression silencieuse.

## 14. Ordre des commandes

Les commandes liées à une même séance doivent être envoyées dans leur ordre de création.

Une commande ne doit pas dépasser une commande précédente dépendante non confirmée.

Exemple :

```text
1. ajouter un exercice
2. ajouter une série à cet exercice
```

La seconde ne peut pas être envoyée avec succès avant la première.

## 15. Commandes compressibles

Certaines commandes successives peuvent être consolidées avant envoi.

Exemple :

```text
modifier la charge 60 → 62,5 → 65
```

Une seule commande finale peut suffire si aucune version intermédiaire n’a été confirmée.

Ne pas compresser :

- création de série ;
- fin de séance ;
- suppression ayant une conséquence métier ;
- commandes déjà envoyées.

## 16. Détection du réseau

L’événement navigateur `online` ou `offline` n’est pas une preuve absolue de disponibilité serveur.

La synchronisation doit vérifier réellement l’API.

Un état réseau peut être :

```text
ONLINE
DEGRADED
OFFLINE
SERVER_UNAVAILABLE
AUTHENTICATION_REQUIRED
```

## 17. Déclencheurs de synchronisation

La synchronisation peut être déclenchée :

- après une action ;
- au retour du réseau ;
- à l’ouverture de l’application ;
- au retour au premier plan ;
- après renouvellement de session ;
- manuellement ;
- via mécanisme de background sync lorsque disponible.

L’application ne doit pas dépendre uniquement du Background Sync, car son support varie.

## 18. Algorithme de synchronisation

Pseudo-processus :

```text
vérifier l’utilisateur
vérifier la session
charger les commandes PENDING
regrouper par agrégat
ordonner
envoyer un lot
traiter chaque résultat
mettre à jour le snapshot
répéter jusqu’à épuisement ou erreur bloquante
```

### 18.1 Lot

Un lot doit avoir une taille maximale.

### 18.2 Arrêt

La synchronisation s’arrête pour un agrégat lorsqu’une commande retourne un conflit bloquant.

Les autres agrégats peuvent continuer.

## 19. Endpoint de synchronisation

Endpoint recommandé :

```text
POST /api/v1/sync/commands
```

La réponse doit identifier chaque commande individuellement.

Résultats possibles :

```text
APPLIED
ALREADY_APPLIED
REJECTED
CONFLICT
```

## 20. Idempotence

Le serveur conserve le résultat d’un `commandId`.

Lorsqu’une commande déjà appliquée est renvoyée :

- elle n’est pas réexécutée ;
- le résultat précédent est retourné ;
- le client peut la marquer confirmée.

## 21. Conflits

### 21.1 Types de conflit

- séance terminée sur un autre appareil ;
- série modifiée ailleurs ;
- exercice supprimé ;
- ordre d’exercices changé ;
- version trop ancienne ;
- utilisateur déconnecté ou compte désactivé ;
- commande incompatible avec l’état actuel.

### 21.2 Structure

```ts
type OfflineConflict = {
  commandId: string;
  code: string;

  localValue: unknown;
  serverValue: unknown;

  resolutionOptions:
    | "KEEP_SERVER"
    | "REAPPLY_LOCAL"
    | "MANUAL_MERGE"
    | "DUPLICATE_AS_NEW";
};
```

### 21.3 Résolution automatique

Une résolution automatique est possible uniquement lorsque le comportement est sûr.

Exemples :

- commande déjà appliquée ;
- favori ;
- note non concurrente ;
- valeur identique.

### 21.4 Résolution manuelle

Pour une performance contradictoire, afficher :

- valeur locale ;
- valeur serveur ;
- date ;
- appareil ;
- choix possible.

## 22. Interface de synchronisation

### 22.1 Indicateur global

États possibles :

- synchronisé ;
- changements en attente ;
- synchronisation ;
- hors ligne ;
- erreur ;
- conflit.

### 22.2 Indicateur par série

Une série peut afficher une icône discrète :

- coche : confirmée ;
- horloge : en attente ;
- rotation : envoi ;
- triangle : erreur ;
- conflit : intervention requise.

### 22.3 Messages

Exemple hors ligne :

```text
Mode hors ligne — tes séries restent enregistrées sur ce téléphone.
```

Exemple en attente :

```text
3 changements seront synchronisés au retour de la connexion.
```

Exemple conflit :

```text
Une série a aussi été modifiée depuis un autre appareil.
```

## 23. Séance active et fermeture de l’application

Avant chaque action importante, le snapshot doit être persisté rapidement.

La fermeture de l’application ne doit pas dépendre d’un dernier appel réseau.

Lors de la réouverture :

1. charger IndexedDB ;
2. afficher la séance locale ;
3. vérifier la session ;
4. récupérer la version serveur ;
5. lancer la synchronisation.

## 24. Crash ou actualisation

La séance active doit survivre à :

- actualisation ;
- fermeture d’onglet ;
- crash du renderer ;
- redémarrage du téléphone ;
- mise à jour de la PWA.

Les données peuvent être perdues uniquement en cas de :

- suppression volontaire des données du navigateur ;
- désinstallation avec suppression du stockage ;
- stockage corrompu ;
- quota navigateur dépassé non géré.

## 25. Quota de stockage

L’application doit surveiller les erreurs de quota.

Elle doit éviter de stocker localement :

- historique complet ;
- images volumineuses ;
- réponses IA multiples ;
- données nutritionnelles illimitées.

Lorsque possible, utiliser l’API Storage pour estimer l’espace disponible.

## 26. Persistance du stockage

L’application peut demander un stockage persistant via l’API navigateur lorsque disponible.

La demande doit être effectuée dans un contexte compréhensible, par exemple après l’installation ou la première séance.

## 27. Chiffrement local

Le navigateur protège son propre espace de stockage, mais IndexedDB n’est pas un coffre-fort chiffré par l’application.

La première version ne met pas en œuvre de chiffrement applicatif complexe.

Conséquences :

- minimiser les données locales ;
- ne pas stocker les tokens longs ;
- nettoyer les données à la déconnexion ;
- avertir sur les appareils partagés ;
- protéger l’accès général au téléphone.

## 28. Déconnexion utilisateur

Lors d’une déconnexion volontaire :

1. tenter de synchroniser les commandes ;
2. avertir si des données restent en attente ;
3. proposer d’annuler ou poursuivre la déconnexion ;
4. nettoyer les données privées ;
5. conserver uniquement ce qui est explicitement nécessaire.

Si l’utilisateur force la déconnexion avec des commandes non synchronisées, expliquer le risque.

## 29. Changement de compte

Les données locales doivent être séparées par `userId`.

Les données d’un compte ne doivent jamais apparaître dans un autre compte.

Au changement de compte :

- fermer les requêtes ;
- fermer Socket.IO ;
- vider TanStack Query ;
- charger l’espace IndexedDB du nouvel utilisateur ;
- nettoyer les données non nécessaires.

## 30. Séance partagée hors ligne

Une séance partagée ne peut pas continuer normalement sans réseau.

### 30.0 Shared 5.3–5.5 (présence + association + progression)

Hors ligne / socket coupé :

- fermer ou ignorer Socket.IO ;
- **ne pas** mettre en file `room:subscribe`, `presence:*` ni `room:changed` ;
- afficher présence indisponible (« Présence inconnue ») ;
- conserver l’UI REST (détail, membres) sans inventer l’état des autres ;
- **ne pas** tenter attach / create `my-workout-session` hors ligne
  (message connexion) ;
- **ne pas** queue `current-exercise` (Shared 5.5) ;
- si une `WorkoutSession` individuelle est déjà liée, ses séries suivent
  le offline Phase 3 (indépendant de la room) ; les autres ne voient la
  progression qu’après sync serveur.

### 30.1 Comportement autorisé

Le participant peut éventuellement :

- consulter le dernier snapshot REST chargé ;
- saisir une série localement sur **sa** séance individuelle déjà créée
  *(Phase 3 offline ; progression shared officielle après sync = Shared 5.5 ;
  sync séries détaillées entre membres = Shared 5.6+)* ;
- conserver une note ;
- voir que la rotation est figée *(cible Shared 5.6+)*.

### 30.2 Comportement interdit

Le client ne doit pas :

- changer seul de station ;
- considérer la série comme confirmée auprès des autres ;
- afficher les autres comme synchronisés ou « en ligne » sans socket ;
- terminer la salle hors ligne ;
- rattacher / créer une séance depuis la room hors ligne ;
- appliquer une nouvelle rotation ;
- rejouer une file d’événements Socket.IO à la reconnexion.

### 30.3 Retour du réseau

À la reconnexion (Shared 5.3 / 5.4) :

1. reconnect Socket.IO + `room:subscribe` ;
2. refetch REST du détail salle (+ « ma séance ») ;
3. rétablir les libellés de présence depuis le snapshot socket.

*(Shared 5.5+ : snapshot workout, conflits de séries, etc.)*

## 31. Nutrition hors ligne

La première version peut limiter la nutrition hors ligne à la lecture de la journée récemment chargée.

Une évolution future peut permettre :

- ajout d’aliments récents ;
- file de commandes ;
- copie locale de repas sauvegardés.

Ce module ne doit pas retarder le mode hors ligne des séances.

## 32. Mise à jour de l’application

### 32.1 Nouvelle version disponible

L’application affiche une information non bloquante.

Exemple :

```text
Une nouvelle version est disponible.
```

### 32.2 Mise à jour sûre

Avant de recharger :

- persister la séance ;
- persister les commandes ;
- vérifier les formulaires ;
- fermer les connexions proprement.

### 32.3 Mise à jour forcée

Une mise à jour forcée est réservée aux cas :

- faille de sécurité ;
- incompatibilité API majeure ;
- version corrompue.

Même dans ce cas, les données locales doivent être persistées avant actualisation.

### 32.4 Migration IndexedDB

Chaque structure locale possède une version.

Une migration doit :

- préserver les données ;
- être testée ;
- pouvoir échouer proprement ;
- éviter de supprimer une séance active.

## 33. Compatibilité API

Le frontend peut envoyer sa version :

```text
X-Client-Version: 1.4.0
```

L’API peut signaler :

- version supportée ;
- version obsolète ;
- mise à jour obligatoire.

Réponse possible :

```text
426 Upgrade Required
```

Cette réponse ne doit être utilisée qu’en cas d’incompatibilité réelle.

## 34. Notifications push

### 34.1 Prérequis

- HTTPS ;
- service worker ;
- permission utilisateur ;
- abonnement Web Push ;
- clés VAPID ;
- backend d’envoi.

### 34.2 Permission

La permission doit être demandée après une action utilisateur explicite.

Exemples :

- activer les rappels ;
- activer la fin de repos ;
- recevoir les rappels de séance partagée ;

### 34.3 Réception

Le service worker reçoit le push et affiche la notification.

### 34.4 Clic

Le clic doit :

- ouvrir l’application ;
- réutiliser une fenêtre existante si possible ;
- naviguer vers la route pertinente.

Exemples :

```text
/shared-workouts/:roomId/lobby
/workouts/active
/nutrition/today
```

### 34.5 Données sensibles

Le payload visible doit rester discret.

Préférer :

```text
Ta séance partagée va commencer.
```

à :

```text
Lucas attend que tu fasses 80 kg au développé couché.
```

## 35. Chronomètre en arrière-plan

Un navigateur mobile peut suspendre JavaScript.

Le chronomètre ne doit pas reposer sur un `setInterval` continu.

Il doit stocker :

```text
startedAt
endsAt
pausedAt
```

Au retour au premier plan, l’application recalcule le temps restant.

Pour alerter l’utilisateur :

- notification locale lorsque possible ;
- notification push serveur pour certains usages ;
- signal lors du retour.

La fiabilité exacte varie selon la plateforme.

## 36. Background Sync

Le Background Sync peut être utilisé lorsqu’il est disponible.

Il ne doit pas être indispensable.

Fallback :

- synchronisation à l’ouverture ;
- synchronisation au retour au premier plan ;
- synchronisation lors de l’événement `online` ;
- bouton manuel.

## 37. Periodic Background Sync

Ne pas dépendre de cette API pour les rappels ou traitements métier.

Son support et ses conditions d’exécution sont variables.

Les rappels planifiés importants doivent être envoyés par le backend via Web Push.

## 38. Cache des exercices et programmes

Les exercices et modèles récemment utilisés peuvent être conservés dans IndexedDB.

Chaque entrée contient :

```ts
type CachedEntity<T> = {
  id: string;
  userId: string | null;
  data: T;
  cachedAt: string;
  expiresAt: string | null;
  schemaVersion: string;
};
```

Les données archivées ou modifiées peuvent rester visibles temporairement hors ligne.

Elles doivent être rafraîchies au retour du réseau.

## 39. Données préchargées avant séance

Avant le démarrage d’une séance, l’application doit stocker :

- séance ;
- exercices ;
- séries prévues ;
- équipements ;
- dernière performance utile ;
- paramètres de repos ;
- règles nécessaires à la saisie.

L’utilisateur doit pouvoir savoir que la séance est disponible hors ligne.

## 40. Service worker et authentification

Le service worker ne doit pas tenter de renouveler silencieusement une session de manière complexe.

Les requêtes authentifiées restent pilotées par l’application.

Le service worker peut gérer les assets et notifications sans conserver les tokens.

## 41. Nettoyage

Nettoyage possible :

- commandes confirmées anciennes ;
- snapshots terminés ;
- cache expiré ;
- propositions IA obsolètes ;
- anciennes versions de schéma ;
- données d’un utilisateur déconnecté.

Les commandes en conflit ne doivent pas être supprimées automatiquement.

## 42. Sauvegarde serveur

Le stockage local n’est pas une sauvegarde durable.

Une fois synchronisées, les données doivent être protégées par les sauvegardes serveur décrites dans `docs/15-deployment.md`.

## 43. Télémétrie

Mesures utiles :

- installations PWA ;
- erreurs service worker ;
- échecs IndexedDB ;
- commandes hors ligne ;
- durée moyenne avant synchronisation ;
- conflits ;
- quota dépassé ;
- erreurs de migration ;
- notifications délivrées.

Les métriques ne doivent pas exposer le contenu personnel des séances.

## 44. Tests unitaires

Tester :

- création de commande ;
- ordre ;
- consolidation ;
- changement de statut ;
- retry ;
- idempotence côté client ;
- migration locale ;
- résolution automatique ;
- calcul de chronomètre.

## 45. Tests d’intégration

Tester :

- IndexedDB réelle ou simulée ;
- redémarrage de l’application ;
- reconnexion ;
- synchronisation par lots ;
- conflit de version ;
- changement de compte ;
- mise à jour du service worker.

## 46. Tests end-to-end

Scénarios principaux :

### Séance hors ligne

1. charger une séance ;
2. couper le réseau ;
3. enregistrer plusieurs séries ;
4. fermer l’application ;
5. rouvrir ;
6. retrouver les séries ;
7. rétablir le réseau ;
8. synchroniser ;
9. vérifier l’historique serveur.

### Commande dupliquée

1. envoyer une commande ;
2. perdre la réponse ;
3. renvoyer la commande ;
4. vérifier qu’une seule série existe.

### Conflit multi-appareil

1. ouvrir une séance sur deux appareils ;
2. modifier la même série ;
3. synchroniser ;
4. afficher un conflit ;
5. résoudre ;
6. vérifier la valeur finale.

### Mise à jour PWA

1. démarrer une séance ;
2. créer des commandes en attente ;
3. déployer une nouvelle version ;
4. installer la mise à jour ;
5. vérifier la conservation des données.

## 47. Critères de validation

Le fonctionnement PWA et hors ligne est considéré comme acceptable lorsque :

- l’application est installable ;
- le shell se charge hors ligne ;
- une séance individuelle chargée peut continuer sans réseau ;
- les données survivent à une fermeture ;
- les commandes sont synchronisées dans l’ordre ;
- une commande dupliquée ne crée pas de doublon ;
- un conflit est visible ;
- une mise à jour ne supprime pas la séance ;
- les données d’un compte ne sont pas affichées à un autre ;
- une séance partagée indique clairement la perte du temps réel.
