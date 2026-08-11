# Sécurité et confidentialité

## 1. Objectif de ce document

Ce document définit les exigences de sécurité et de protection des données de Gym Companion.

Il couvre :

- l’authentification ;
- les sessions ;
- les autorisations ;
- les données personnelles ;
- les données de santé et de performance ;
- la sécurité HTTP ;
- WebSocket ;
- PWA et stockage local ;
- IA et services externes ;
- notifications ;
- logs ;
- sauvegardes ;
- suppression ;
- incidents ;
- administration ;
- tests de sécurité.

Le projet peut être utilisé par un nombre limité de personnes, mais cela ne réduit pas la nécessité de protéger correctement les données.

## 2. Modèle de menace initial

Les risques principaux sont :

- vol de compte ;
- accès aux données d’un autre utilisateur ;
- fuite de tokens ;
- exposition de données dans les logs ;
- modification non autorisée d’une séance ;
- code d’accès partagé utilisé par une personne non prévue ;
- commandes WebSocket falsifiées ;
- injection ;
- abus du service IA ;
- perte de données ;
- appareil partagé ;
- données locales persistantes après déconnexion ;
- mauvaise configuration du serveur ;
- sauvegardes non protégées.

## 3. Classification des données

### 3.1 Données d’identification

- adresse email ;
- nom affiché ;
- identifiants techniques ;
- informations de session.

### 3.2 Données sportives

- exercices ;
- charges ;
- répétitions ;
- échecs ;
- fréquence ;
- records ;
- programmes ;
- objectifs.

### 3.3 Données corporelles

- poids ;
- taille ;
- évolution corporelle ;
- autres mesures futures.

### 3.4 Données nutritionnelles

- aliments ;
- calories ;
- macronutriments ;
- habitudes ;
- poids associé.

### 3.5 Données déclaratives potentiellement sensibles

- restrictions ;
- notes ;
- difficultés ;
- préférences.

Ces données doivent être traitées avec un niveau de protection élevé, même si elles ne constituent pas toutes des données médicales au sens strict.

## 4. Minimisation des données

Le produit ne collecte que les données nécessaires.

Exemples :

- la taille n’est pas obligatoire pour enregistrer une séance ;
- le poids n’est pas obligatoire pour créer un compte ;
- une séance partagée n’expose pas l’historique complet ;
- l’IA ne reçoit pas l’email ;
- les logs ne contiennent pas les repas détaillés.

Toute nouvelle donnée doit répondre à une finalité claire.

## 5. Finalités

Les finalités principales sont :

- fournir le compte ;
- enregistrer les entraînements ;
- synchroniser les appareils ;
- organiser les séances partagées ;
- calculer les statistiques ;
- suivre la nutrition ;
- envoyer des notifications choisies ;
- générer des propositions IA à la demande ;
- sécuriser et exploiter le service.

Une donnée ne doit pas être réutilisée pour une nouvelle finalité sans information appropriée.

## 6. Authentification

### 6.1 Mot de passe

Les mots de passe sont hachés avec Argon2.

Paramètres à configurer selon l’environnement :

- mémoire ;
- nombre d’itérations ;
- parallélisme ;
- longueur du hash.

Ils doivent être suffisamment coûteux en production sans créer de déni de service facile.

### 6.2 Politique de mot de passe

Recommandations :

- longueur minimale raisonnable ;
- autoriser les phrases longues ;
- ne pas imposer de changements périodiques arbitraires ;
- ne pas limiter inutilement les caractères ;
- empêcher les mots de passe manifestement compromis lorsque possible.

### 6.3 Réponses d’erreur

La connexion ne doit pas distinguer publiquement :

- email inconnu ;
- mot de passe incorrect.

Message générique :

```text id="b12et1"
Identifiants invalides.
```

### 6.4 Limitation des tentatives

Limiter :

- connexion ;
- inscription ;
- réinitialisation ;
- vérification ;
- refresh.

Les limites peuvent dépendre de :

- IP ;
- compte ;
- appareil ;
- période.

### 6.5 Blocage

Éviter un blocage permanent facilement exploitable contre un utilisateur.

Préférer :

- délais progressifs ;
- limitation temporaire ;
- vérification supplémentaire.

## 7. Sessions

### 7.1 Access token

- durée courte ;
- signature robuste ;
- audience et issuer définis ;
- algorithme fixé ;
- validation stricte de l’expiration.

### 7.2 Refresh token

- valeur aléatoire ;
- durée limitée ;
- stocké haché ;
- lié à une session ;
- révocable ;
- rotation recommandée.

### 7.3 Cookie

Si le refresh token utilise un cookie :

- `HttpOnly` ;
- `Secure` en production ;
- `SameSite` adapté ;
- `Path` limité ;
- durée explicite.

### 7.4 CSRF

Si une authentification par cookie est utilisée sur des routes modificatrices, mettre en place une protection adaptée :

- `SameSite` ;
- token CSRF ;
- vérification d’origine ;
- en-têtes personnalisés.

La stratégie exacte dépend du déploiement frontend/API.

### 7.5 Révocation

L’utilisateur peut :

- révoquer une session ;
- révoquer toutes les autres sessions ;
- consulter les appareils approximatifs.

### 7.6 Changement de mot de passe

Un changement de mot de passe peut révoquer les autres sessions.

## 8. Réinitialisation de mot de passe

Le token doit être :

- aléatoire ;
- à usage unique ;
- de courte durée ;
- stocké haché ;
- invalidé après utilisation.

La réponse à la demande reste neutre.

Le lien ne doit pas contenir d’information personnelle supplémentaire.

## 9. Vérification d’email

Le token suit les mêmes principes :

- aléatoire ;
- temporaire ;
- à usage unique ;
- stocké haché.

La vérification ne doit pas connecter automatiquement un utilisateur dans un contexte non sûr sans règle explicite.

## 10. Autorisations

### 10.1 Principe

Toute ressource privée doit faire l’objet d’un contrôle d’accès côté serveur.

### 10.2 Propriété

Vérifier la propriété pour :

- programmes ;
- modèles ;
- exercices personnels ;
- équipements ;
- séances ;
- aliments ;
- recettes ;
- mesures ;
- propositions IA ;
- exports.

### 10.3 Séances partagées

Vérifier :

- appartenance à la salle ;
- rôle ;
- statut ;
- propriété de la performance ;
- permission de gérer la rotation.

### 10.4 Administration

Le rôle administrateur ne doit pas donner automatiquement accès à tous les détails personnels dans l’interface.

Les opérations doivent suivre le principe du moindre privilège.

## 11. Protection contre les IDOR

Ne jamais considérer qu’un identifiant difficile à deviner suffit comme protection.

Exemple incorrect :

```text id="u6vf73"
GET /workouts/:id
```

sans vérification du propriétaire.

Tous les endpoints doivent vérifier :

```text id="duqv6d"
resource.ownerUserId === authenticatedUser.id
```

ou une règle d’accès équivalente.

### 11.1 Shared 5.4 / 5.5 — ownership séance / room / progression

- attach / create / current-exercise : identity JWT uniquement ; jamais de
  `userId` / `roomMemberId` client ;
- invariant : `roomMember.userId === workoutSession.ownerUserId` ;
- exercice courant doit appartenir à la séance liée (cross-session /
  cross-user → 404) ;
- séance absente **ou** d’un autre utilisateur → **404** `WORKOUT_NOT_FOUND`
  (neutre, anti-énumération) ;
- détail salle : `myWorkoutSessionId` = séance du **viewer** seulement ;
  jamais les IDs des autres membres ;
- `memberWorkout` = résumé statut/nom/timestamps + Shared 5.5 compteurs /
  nom d’exercice courant **sans** perfs ni ID croisé ;
- frontière : progression générale visible ; performances détaillées
  (poids, reps, RIR, notes, volume…) **privées** ;
- aucun endpoint Shared 5.4/5.5 ne permet d’écrire / lire le détail de la
  séance d’un autre membre (pas de cross-write, pas d’IDOR via room).
- events `MEMBER_*_CHANGED` : **serveur → client uniquement**.

## 12. Validation des entrées

Valider :

- taille ;
- type ;
- format ;
- enum ;
- nombre ;
- date ;
- relation ;
- propriété ;
- état métier.

Limiter la taille des champs texte :

- noms ;
- descriptions ;
- notes ;
- explications ;
- payloads IA.

Limiter également :

- nombre d’exercices ;
- séries ;
- participants ;
- ingrédients ;
- commandes par lot.

## 13. Injection

### 13.1 SQL

Prisma réduit les risques, mais les requêtes brutes doivent être paramétrées.

### 13.2 HTML et XSS

React échappe les textes par défaut.

Ne pas utiliser `dangerouslySetInnerHTML` sur du contenu utilisateur ou IA sans assainissement strict.

### 13.3 Commande

Ne pas exécuter de commande système construite depuis une entrée utilisateur.

### 13.4 Prompt injection

Les données utilisateur ne doivent pas être traitées comme instructions privilégiées par le module IA.

## 14. Sécurité HTTP

### 14.1 HTTPS

HTTPS obligatoire en production.

### 14.2 En-têtes

Configurer notamment :

- `Content-Security-Policy` ;
- `Strict-Transport-Security` ;
- `X-Content-Type-Options` ;
- `Referrer-Policy` ;
- `Permissions-Policy` ;
- protection contre l’intégration non souhaitée.

### 14.3 CSP

La CSP doit être compatible avec :

- React ;
- API ;
- WebSocket ;
- fournisseur d’images éventuel ;
- service IA uniquement côté serveur ;
- Web Push.

Éviter `unsafe-inline` lorsque possible.

### 14.4 CORS

Autoriser uniquement les origines nécessaires.

Ne pas utiliser :

```text id="z1151g"
Access-Control-Allow-Origin: *
```

avec des credentials.

### 14.5 Méthodes

Limiter les méthodes HTTP autorisées.

## 15. Sécurité WebSocket

### 15.0 Shared 5.3 / 5.4 (présence + invalidation)

Livré sur le namespace `/shared-workouts` :

- handshake JWT obligatoire (`auth.token` / `accessToken` / `Bearer`) ;
- utilisateur `DISABLED` / `DELETION_PENDING` → déconnexion ;
- `room:subscribe` : membership actif + salle `LOBBY`/`ACTIVE` uniquement ;
  sinon `ROOM_NOT_ACCESSIBLE` (anti-IDOR : pas de fuite d’existence hors membership) ;
- payloads client validés Zod strict (`roomId` UUID) ;
- payloads serveur minimaux : `roomId`, `userId`, `connectedUserIds`, `reason` —
  pas d’email, pas de token, pas d’objet Prisma ;
- CORS socket = `CORS_ALLOWED_ORIGINS` (comme REST) ;
- présence en mémoire process (pas de persistance de tracking long terme) ;
- Shared 5.4 : `MEMBER_WORKOUT_CHANGED` n’embarque **aucun** détail de séance
  (pas d’ID, pas de perfs) — invalidation uniquement.

### 15.1 Authentification

Chaque connexion est authentifiée.

### 15.2 Autorisation par événement

Une connexion authentifiée n’est pas automatiquement autorisée à toutes les rooms.

### 15.3 Validation

Tous les payloads sont validés.

### 15.4 Taille

Limiter la taille des messages.

### 15.5 Fréquence

Limiter les événements répétés.

### 15.6 Rooms

L’utilisateur ne peut rejoindre qu’une room autorisée.

### 15.7 Émission

Ne jamais utiliser un identifiant de room fourni comme seule preuve d’accès.

### 15.8 Déconnexion

Déconnecter ou refuser les clients :

- non authentifiés ;
- utilisant un token expiré ;
- envoyant des payloads invalides de manière répétée ;
- abusant du service.

## 16. Codes d’accès de séance partagée

### 16.1 Génération

Le code doit être suffisamment aléatoire (`crypto.randomInt`, alphabet sans I/O/0/1).

Éviter les identifiants incrémentaux ou prévisibles.

### 16.2 Validité

En V1, pas d’expiration temporelle : le code est joinable tant que la salle est `LOBBY` ou `ACTIVE`. Une salle terminée refuse le join avec une erreur neutre (pas de fuite d’existence).

Les codes des salles terminées restent en base pour éviter une réutilisation immédiate.

### 16.3 Rotation

L’hôte peut régénérer le code en `LOBBY` / `ACTIVE`. L’ancien code cesse d’être valide immédiatement.

### 16.4 Capacité

Une salle complète refuse les nouveaux participants.

### 16.5 Authentification

Rejoindre exige un JWT valide. Le code seul ne suffit pas.

### 16.6 Partage et confidentialité

Le code ne doit pas exposer de données privées des participants.

Informations visibles après join (membership) : inchangées (privacy coarse Shared 5.5).

Rate limit sur `POST /join` (~10/min, throttler process-local ; Redis multi-instance = dette future).

## 17. Protection des données locales

### 17.1 IndexedDB

Ne conserver que les données nécessaires au mode hors ligne.

### 17.2 Tokens

Ne pas stocker de refresh token dans IndexedDB ou LocalStorage.

### 17.3 Déconnexion

Nettoyer :

- cache TanStack Query ;
- données utilisateur temporaires ;
- sockets ;
- données locales non nécessaires ;
- fichiers temporaires.

### 17.4 Plusieurs comptes

Isoler les données locales par utilisateur.

### 17.5 Appareil partagé

Afficher une recommandation dans les paramètres ou à la déconnexion lorsque l’application contient des données locales non synchronisées.

## 18. Service worker

Le service worker ne doit pas :

- mettre en cache aveuglément les réponses privées ;
- stocker les tokens ;
- exposer des données dans une URL de cache ;
- afficher une notification avec des données trop détaillées.

Les caches doivent être supprimés lors des changements de version majeurs.

## 19. Notifications push

### 19.1 Permission

Aucune demande sans contexte.

### 19.2 Abonnement

Les endpoints et clés d’abonnement sont des données sensibles.

### 19.3 Payload

Le payload visible reste discret.

### 19.4 Écran verrouillé

Ne pas afficher par défaut :

- poids ;
- calories ;
- charge ;
- échec ;
- restriction ;
- contenu de note.

### 19.5 Expiration

Supprimer les abonnements rejetés par le service push.

## 20. Données IA

### 20.1 Minimisation

Construire un contexte minimal.

Pour le jalon **5.5** (explication Coach) :

- payload versionné `AI_COACH_EXPLANATION_V1` uniquement ;
- pas d’email, userId, JWT, historique brut, objets Prisma ;
- noms d’exercice traités comme données non fiables (séparés des instructions) ;
- aucun prompt libre utilisateur.

### 20.2 Pseudonymisation

Ne pas envoyer l’identité réelle lorsque cela n’est pas nécessaire.

### 20.3 Fournisseur

Documenter :

- fournisseur ;
- région de traitement si pertinente ;
- politique de conservation ;
- sous-traitants ;
- usage ou non des données pour entraînement ;
- durée.

### 20.4 Secrets

La clé IA reste côté serveur (`AI_COACH_API_KEY`). Jamais dans Vite / localStorage / IndexedDB.

### 20.5 Logs

Ne pas enregistrer automatiquement les prompts complets ni la réponse brute.

Log minimal 5.5 : durée, succès/erreur, code, provider, taille approximative, identifiant utilisateur hashé.

### 20.6 Sorties

Considérer toute sortie comme non fiable jusqu’à validation Zod.

La sortie 5.5 ne contient **aucun** champ décisionnel (`action`, `suggestedWeight`, `plateauStatus`).

### 20.7 Protections 5.5

- timeout configurable (`AI_COACH_TIMEOUT_MS`) ;
- rate limit par utilisateur authentifié ;
- fallback déterministe (Coach 5.4) ;
- feature flag `AI_COACH_ENABLED` ;
- provider `fake` interdit en production.

### 20.8 Chat multi-tour (5.6)

- outils lecture seule uniquement ;
- boucle d’outils bornée ;
- IDOR tool : `ownerUserId` jamais pris depuis les arguments LLM ;
- conversations isolées par propriétaire ;
- pas de queue offline pour les messages IA ;
- rate limit et busy lock **process-local** (dette documentée — pas Redis dans la clôture 5.7).

### 20.9 Propositions structurées (jalon 8)

- l’IA **ne mutate jamais** directement une ressource métier : `search_exercises`,
  `get_active_program`, `get_program_detail` restent des outils **lecture seule**, ajoutés à
  l’allowlist stricte (§20.8) — aucun outil `create_*` / `apply_*` n’est exposé au modèle ;
- une réponse `proposal` est **toujours revalidée côté serveur** avant toute persistance
  (`AiCoachProposal`) : un `exerciseId` inventé ou inaccessible ne peut jamais aboutir à une
  création, ni même à une ligne `PENDING` persistée ;
- `payloadJson` (source de vérité, revalidé à chaque étape) et `previewJson` (aperçu dénormalisé,
  affichage uniquement — jamais utilisé pour la décision métier) sont explicitement distingués ;
- l’acceptation (`POST /proposals/:id/accept`) revalide **de nouveau** l’intégralité du payload au
  moment de la création : le catalogue (exercices, équipement) a pu changer depuis la génération ;
- `ownerUserId` de la proposal vient exclusivement de la session JWT ; l’accès à une proposal
  d’un autre utilisateur renvoie `404` (jamais `403`, pour ne pas confirmer l’existence) ;
- Structured Outputs (`response_format: json_schema`, `strict: true`) réduit mais ne remplace pas
  la validation Zod côté serveur — toute sortie IA reste non fiable jusqu’à validation complète ;
- logs d’usage (`prompt_tokens`, `completion_tokens`) sans jamais logger le contenu du prompt, de
  la réponse brute, ni la clé API.

### 20.10 Contention tests d’intégration

Les suites API coaching partagent parfois la même base PostgreSQL de test.
Un flaky isolé historique sur `coach-summary` (404 set pendant suite parallèle) est
classé comme contention DB possible entre fichiers — non corrigé sans preuve de bug métier.

## 21. Emails

Les emails ne doivent pas contenir plus d’informations que nécessaire.

Exemples acceptables :

- lien de vérification ;
- lien de réinitialisation ;
- alerte de sécurité ;
- export disponible.

Ne pas envoyer un historique de performance détaillé par défaut.

## 22. Secrets

Les secrets doivent être fournis via :

- variables d’environnement ;
- gestionnaire de secrets futur ;
- configuration de déploiement sécurisée.

Secrets concernés :

- clé JWT ;
- secret de cookie ;
- base de données ;
- email ;
- VAPID ;
- IA ;
- stockage ;
- monitoring.

Aucun fichier `.env` réel ne doit être commité.

Un `.env.example` sans valeur sensible peut être fourni.

## 23. Rotation des secrets

Prévoir la capacité de rotation pour :

- clés JWT ;
- secrets de cookies ;
- clés VAPID ;
- clés IA ;
- mot de passe de base de données.

La rotation JWT peut nécessiter plusieurs clés actives temporairement.

## 24. Base de données

### 24.1 Réseau

PostgreSQL ne doit pas être exposé publiquement sans nécessité.

### 24.2 Compte

Utiliser un compte applicatif dédié.

### 24.3 Permissions

Le compte applicatif ne doit pas posséder plus de droits que nécessaire.

### 24.4 Chiffrement

Utiliser un canal chiffré lorsque la base est distante.

### 24.5 Migrations

Les migrations sont revues et sauvegardées.

### 24.6 Données de test

Ne jamais copier directement les données de production dans un environnement de développement non protégé.

## 25. Sauvegardes

Les sauvegardes doivent être :

- régulières ;
- chiffrées ;
- stockées séparément ;
- testées ;
- soumises à une rétention ;
- protégées par des accès limités.

Une sauvegarde non testée ne doit pas être considérée comme fiable.

## 26. Logs

### 26.1 Autorisé

- identifiant de requête ;
- identifiant utilisateur lorsque nécessaire ;
- endpoint ;
- durée ;
- statut ;
- code d’erreur ;
- type de commande ;
- version.

### 26.2 Interdit

- mot de passe ;
- access token ;
- refresh token ;
- code complet d’accès ;
- token de réinitialisation ;
- clés push ;
- clé IA ;
- prompt complet ;
- réponse IA brute sensible ;
- détail complet des repas ;
- notes privées.

### 26.3 Rétention

Définir une durée de conservation.

Les logs de développement et production peuvent avoir des politiques différentes.

## 27. Audit

Les actions sensibles doivent être journalisées.

Exemples :

- désactivation de compte ;
- changement de rôle ;
- suppression ;
- export ;
- révocation de session ;
- modification administrative du catalogue ;
- accès administratif exceptionnel ;
- acceptation de proposition IA ;
- changement important de consentement.

L’audit doit enregistrer le minimum nécessaire.

## 28. Administration

### 28.1 Accès

Les comptes administrateurs doivent utiliser des protections renforcées.

Une authentification multifacteur pourra être ajoutée.

### 28.2 Interface

Les pages administratives sont séparées et non visibles pour un utilisateur standard.

### 28.3 Données privées

Une interface administrateur ne doit pas présenter automatiquement les journaux alimentaires ou notes privées.

### 28.4 Actions

Les actions destructrices nécessitent :

- confirmation ;
- justification éventuelle ;
- audit.

## 29. Export des données

### 29.1 Authentification

Un export nécessite une session valide.

### 29.2 Réauthentification

Un export complet peut nécessiter une vérification récente.

### 29.3 Fichier

Le fichier doit :

- avoir une expiration ;
- être accessible uniquement à son propriétaire ;
- utiliser une URL difficile à deviner ;
- être supprimé après expiration ;
- être chiffré si stocké durablement.

### 29.4 Contenu

Le format doit être versionné.

## 30. Suppression du compte

### 30.1 Confirmation

La suppression demande :

- réauthentification ;
- confirmation explicite ;
- explication des conséquences.

### 30.2 Période de grâce

Une période de grâce peut être utilisée.

Exemple :

```text id="hm4t9y"
14 jours
```

### 30.3 Révocation

Révoquer les sessions dès la demande ou selon la politique définie.

### 30.4 Données personnelles

Supprimer ou anonymiser :

- profil ;
- entraînements ;
- nutrition ;
- mesures ;
- préférences ;
- propositions IA ;
- abonnements push.

### 30.5 Données partagées

Pour préserver l’historique des autres participants, certaines références peuvent devenir :

```text id="1rl90l"
Utilisateur supprimé
```

Les données privées du compte supprimé ne doivent plus être accessibles.

## 31. Conservation des données

Politique initiale indicative :

| Donnée                   | Conservation              |
| ------------------------ | ------------------------- |
| Compte actif             | Tant que le compte existe |
| Séances                  | Tant que le compte existe |
| Nutrition                | Tant que le compte existe |
| Sessions révoquées       | Durée limitée             |
| Tokens expirés           | Nettoyage rapide          |
| Logs applicatifs         | 30 à 90 jours             |
| Audit sensible           | Plus long selon besoin    |
| Propositions IA refusées | Durée courte              |
| Métadonnées IA           | 30 à 90 jours             |
| Exports                  | Quelques heures ou jours  |
| Sauvegardes              | Rétention définie         |

Les durées exactes doivent être confirmées avant la production.

## 32. Confidentialité des séances partagées

Par défaut, les autres participants peuvent voir :

- nom affiché ;
- présence en ligne *(Shared 5.3 : userId dans `presence:*` / snapshot ; pas d’email)* ;
- résumé de statut de séance rattachée *(Shared 5.4 : `memberWorkout.status` /
  nom / timestamps — **pas** l’ID ni les perfs)* ;
- progression générale (exercice courant nom snapshot + compteurs séries /
  exercices) *(Shared 5.5 — **pas** poids/reps/RIR/notes)* ;
- file d’équipement logique (display name + position) *(Shared 5.6)* ;
- station physique / inventaire *(Shared 5.7+)* ;
- sync détaillée des séries *(Shared 5.7+)* ;
- disponibilité / ready *(Shared 5.7+)*.

Ils ne doivent pas voir automatiquement :

- poids corporel ;
- historique ;
- nutrition ;
- restrictions détaillées ;
- notes personnelles ;
- statistiques complètes ;
- données IA ;
- l’identifiant ni le détail des `WorkoutSession` / séries des autres
  *(Shared 5.4 / 5.5)* ;
- JWT / tokens / emails dans les événements socket.

## 33. Visibilité des profils

La première version ne possède pas de profil public.

Un utilisateur n’est visible par un autre que dans le contexte d’une séance partagée (membership active).

## 34. Sécurité nutritionnelle

L’application doit éviter les mécanismes pouvant renforcer une relation malsaine avec l’alimentation.

Exemples :

- pas de message culpabilisant ;
- pas de compensation automatique totale ;
- pas de restriction extrême générée ;
- possibilité de masquer certains indicateurs ;
- avertissement sur les estimations.

## 35. Téléversements futurs

Si des images ou fichiers sont ajoutés :

- vérifier le type réel ;
- limiter la taille ;
- renommer côté serveur ;
- stocker hors du répertoire exécutable ;
- analyser lorsque nécessaire ;
- servir avec des en-têtes sûrs ;
- ne pas faire confiance à l’extension.

## 36. Dépendances

### 36.1 Vérification

Utiliser :

- audit des dépendances ;
- mises à jour régulières ;
- lockfile ;
- outil automatisé facultatif.

### 36.2 Ajout

Toute dépendance doit être évaluée :

- maintenance ;
- popularité ;
- licence ;
- permissions ;
- taille ;
- vulnérabilités ;
- nécessité.

### 36.3 Scripts

Être prudent avec les scripts d’installation de dépendances.

## 37. CI/CD

Le pipeline doit :

- installer depuis le lockfile ;
- lint ;
- typecheck ;
- tester ;
- construire ;
- analyser les vulnérabilités importantes ;
- empêcher le déploiement si les étapes critiques échouent.

Les secrets CI doivent être protégés.

## 38. Images Docker

- base minimale ;
- utilisateur non root ;
- versions maîtrisées ;
- pas de secret dans l’image ;
- multi-stage build ;
- scan de vulnérabilités ;
- système de fichiers en lecture seule lorsque possible.

## 39. Reverse proxy

Le reverse proxy gère :

- HTTPS ;
- redirection HTTP ;
- tailles maximales ;
- timeouts ;
- WebSocket ;
- headers ;
- compression ;
- limitation basique.

La configuration WebSocket doit préserver les connexions sans autoriser des timeouts excessifs non contrôlés.

## 40. Protection contre les abus

Limiter :

- création de comptes ;
- tentatives de connexion ;
- reset password ;
- création de salles ;
- join par code ;
- commandes Socket.IO ;
- appels IA ;
- exports ;
- notifications de test.

Le système peut désactiver temporairement une fonctionnalité en cas d’abus.

## 41. Déni de service

Mesures :

- limites de payload ;
- pagination ;
- limites de lots ;
- timeouts ;
- quotas ;
- circuit breaker externe ;
- nombre maximal de participants ;
- nombre maximal de séries ;
- limites de génération IA ;
- protection du moteur de rotation.

## 42. Erreurs

Les réponses client ne doivent pas contenir :

- stack trace ;
- requête SQL ;
- nom de table ;
- chemin serveur ;
- secret ;
- détail de configuration.

Un `requestId` permet le diagnostic.

## 43. Environnements

### Développement

- données fictives ;
- emails capturés localement ;
- clés de test ;
- logs plus détaillés.

### Production

- HTTPS ;
- secrets distincts ;
- cookies sécurisés ;
- logs limités ;
- CSP stricte ;
- sauvegardes ;
- monitoring ;
- accès administrateur restreint.

## 44. Incident de sécurité

Prévoir une procédure minimale :

1. identifier ;
2. contenir ;
3. révoquer les secrets ou sessions ;
4. analyser ;
5. corriger ;
6. restaurer ;
7. informer les utilisateurs lorsque nécessaire ;
8. documenter.

Exemples :

- clé IA exposée ;
- token JWT compromis ;
- accès base non autorisé ;
- sauvegarde perdue ;
- compte administrateur compromis.

## 45. Révocation d’urgence

Le système doit permettre :

- changement de clé JWT ;
- révocation de toutes les sessions ;
- désactivation d’un compte ;
- désactivation de l’IA ;
- désactivation des joins par code ;
- désactivation des notifications ;
- mise en maintenance.

## 46. Tests de sécurité

### Unitaires

- autorisations ;
- propriété ;
- expiration ;
- hash ;
- validation ;
- restrictions.

### Intégration

- accès à une ressource étrangère ;
- code invalide ou salle terminée ;
- modification de série étrangère ;
- refresh token révoqué ;
- payload trop large ;
- rôle insuffisant ;
- rate limiting.

### End-to-end

- utilisateur A tente d’accéder aux données B ;
- participant tente une action hôte ;
- code d’accès rotaté (ancien code refusé) ;
- compte désactivé ;
- changement de compte sur une PWA avec données locales ;
- suppression du compte ;
- export protégé.

## 47. Revue avant production

Vérifier :

- HTTPS ;
- CORS ;
- CSP ;
- cookies ;
- secrets ;
- permissions base ;
- backups ;
- logs ;
- rate limits ;
- erreurs ;
- endpoints admin ;
- WebSocket ;
- suppression ;
- exports ;
- fournisseur IA ;
- politique de confidentialité ;
- conditions d’utilisation ;
- dépendances ;
- images Docker.

## 48. Critères de validation

La sécurité initiale est considérée comme acceptable lorsque :

- aucun secret n’est dans le dépôt ;
- les mots de passe utilisent Argon2 ;
- les refresh tokens sont révocables et hachés ;
- les routes vérifient la propriété ;
- les connexions Socket.IO sont authentifiées ;
- les codes des salles terminées ne sont plus joinables ;
- les données locales sont nettoyées au changement de compte ;
- les logs excluent les données sensibles ;
- les données IA sont minimisées ;
- les exports sont protégés ;
- la suppression de compte est testée ;
- les sauvegardes sont chiffrées et restaurables ;
- les principales attaques d’accès horizontal sont couvertes par des tests.
