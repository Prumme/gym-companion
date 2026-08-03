# Instructions permanentes pour les agents IA

## 1. Rôle de la documentation

Le dossier `docs/` constitue la spécification officielle du projet.

Avant toute modification significative, l’agent doit :

1. Lire `docs/00-vision.md`.
2. Lire `docs/01-scope-and-roadmap.md`.
3. Lire les documents directement liés à la tâche demandée.
4. Inspecter le code existant avant de proposer ou d’appliquer une modification.
5. Vérifier que la fonctionnalité appartient à la phase actuellement développée.

L’agent ne doit pas inventer silencieusement une règle métier absente de la documentation.

Lorsqu’une information importante manque, l’agent doit :

- utiliser l’hypothèse la plus prudente lorsque cela ne bloque pas le développement ;
- signaler clairement cette hypothèse ;
- proposer une mise à jour du document concerné ;
- éviter d’introduire une décision difficile à modifier ultérieurement.

## 2. Ordre de priorité des documents

En cas de contradiction entre plusieurs documents :

1. `docs/04-business-rules.md` prime pour les règles métier.
2. `docs/09-api-contracts.md` prime pour les échanges HTTP et WebSocket.
3. `docs/05-data-model.md` prime pour les entités et relations.
4. `docs/01-scope-and-roadmap.md` détermine ce qui doit être implémenté maintenant.
5. `docs/07-ui-ux-guidelines.md` prime pour les comportements d’interface.
6. Le code existant ne doit pas être considéré comme correct s’il contredit la documentation officielle.

Toute contradiction détectée doit être signalée.

## 3. Principes généraux de développement

- Utiliser TypeScript en mode strict.
- Ne pas introduire de `any` sans justification explicite.
- Préférer des fonctions petites, nommées clairement et testables.
- Éviter la duplication de logique métier.
- Séparer la présentation, la logique métier, le transport réseau et la persistance.
- Ne pas placer de logique métier complexe dans les composants React.
- Ne pas dupliquer les contrats partagés entre le frontend et le backend.
- Valider toutes les données externes.
- Traiter explicitement les dates, les unités et les fuseaux horaires.
- Ne jamais utiliser un libellé utilisateur comme identifiant technique.
- Préserver la compatibilité mobile.
- Préserver l’accessibilité.
- Ne pas ajouter une dépendance lorsqu’une solution simple existe déjà dans le projet.

## 4. Organisation du projet

Le projet utilise un monorepo.

```text
apps/
├── web/
└── api/

packages/
├── shared/
├── validation/
└── config/
```

### `apps/web`

Application React et PWA.

### `apps/api`

API NestJS, logique métier, authentification, persistance et WebSocket.

### `packages/shared`

Contient notamment :

- les types communs ;
- les enums ;
- les contrats d’événements ;
- les constantes partagées ;
- les structures de réponses communes.

### `packages/validation`

Contient les schémas de validation réutilisés entre les applications.

### `packages/config`

Contient les configurations communes de TypeScript, lint, formatage et outils de build.

## 5. Règles frontend

La stack frontend est composée de :

- React ;
- TypeScript ;
- Vite ;
- React Router ;
- Tailwind CSS ;
- shadcn/ui ;
- Lucide React ;
- TanStack Query ;
- Zustand ;
- React Hook Form ;
- Zod ;
- Socket.IO Client ;
- Recharts ;
- vite-plugin-pwa.

### État serveur

TanStack Query doit être utilisé pour les données provenant de l’API :

- exercices ;
- programmes ;
- séances ;
- historique ;
- repas ;
- mesures ;
- profil utilisateur.

Ces données ne doivent pas être dupliquées inutilement dans Zustand.

### État client

Zustand est réservé aux états temporaires ou transversaux :

- séance active non encore synchronisée ;
- état du chronomètre ;
- préférences temporaires d’interface ;
- état de connexion WebSocket ;
- brouillons ;
- navigation interne complexe.

### Composants

- Les composants doivent rester réutilisables sans devenir excessivement génériques.
- Les composants métier doivent être séparés des composants purement visuels.
- Les composants ne doivent pas appeler directement Prisma ou une ressource backend.
- Les appels API doivent passer par une couche dédiée.
- Les formulaires doivent utiliser React Hook Form et Zod.
- Les erreurs doivent être compréhensibles par l’utilisateur.

### Expérience mobile

L’application est mobile-first.

Les écrans utilisés pendant une séance doivent :

- être utilisables d’une seule main ;
- comporter des zones tactiles suffisamment grandes ;
- limiter le nombre de saisies ;
- conserver les actions principales accessibles ;
- éviter les tableaux larges ;
- éviter les fenêtres modales longues ;
- privilégier les pages dédiées, drawers ou bottom sheets ;
- rester lisibles dans une salle peu ou très éclairée.

### Accessibilité

- Ne jamais transmettre une information uniquement par une couleur.
- Ajouter des labels accessibles aux boutons contenant uniquement une icône.
- Conserver un contraste suffisant.
- Permettre la navigation au clavier.
- Associer correctement les erreurs aux champs de formulaire.
- Respecter les préférences de réduction des animations.

## 6. Règles backend

La stack backend est composée de :

- NestJS ;
- PostgreSQL ;
- Prisma ;
- REST ;
- Socket.IO ;
- JWT ;
- refresh tokens ;
- Argon2 ;
- Swagger ou OpenAPI.

### Architecture

Les contrôleurs et gateways doivent rester minces.

La logique métier doit être placée dans des services ou modules de domaine.

Exemples de domaines :

```text
auth
users
exercises
programs
workouts
progress
shared-workouts
nutrition
notifications
ai
```

### Validation

Toutes les entrées externes doivent être validées :

- paramètres HTTP ;
- corps de requête ;
- query parameters ;
- événements WebSocket ;
- variables d’environnement ;
- fichiers importés ;
- réponses fournies par une IA.

### Autorisations

- Ne jamais faire confiance à un `userId` fourni par le client.
- Utiliser l’identité de la session authentifiée.
- Vérifier l’accès à chaque ressource.
- Un utilisateur ne peut modifier que ses propres données, sauf autorisation explicite.
- Les opérations administratives doivent être protégées par un rôle.

### Persistance

- Utiliser des transactions pour les opérations comportant plusieurs écritures dépendantes.
- Éviter les suppressions physiques lorsqu’une donnée est utilisée par un historique.
- Préférer l’archivage.
- Les migrations doivent être versionnées.
- Les données de démonstration ne doivent pas être mélangées aux migrations de production.

## 7. Règles WebSocket et temps réel

Le serveur est l’autorité sur l’état d’une séance partagée.

### Principes obligatoires

- Une connexion WebSocket ne constitue pas une preuve d’identité suffisante.
- Chaque connexion doit être authentifiée.
- Chaque utilisateur doit être autorisé à rejoindre la salle demandée.
- Toute commande critique doit recevoir un accusé de réception.
- Les événements doivent utiliser des types partagés.
- Les commandes doivent être idempotentes lorsque cela est pertinent.
- Une reconnexion doit permettre de récupérer un snapshot complet.
- L’état local ne doit pas écraser silencieusement un état serveur plus récent.

### Modifications des performances

Un participant peut modifier ses propres séries.

L’hôte peut gérer :

- la salle ;
- les invitations ;
- la rotation ;
- la présence des participants ;
- la fin de séance.

L’hôte ne doit pas modifier silencieusement les performances d’un autre participant.

### Persistance

Les événements WebSocket ne remplacent pas la base de données.

Une série confirmée doit être persistée.

L’état diffusé aux clients doit pouvoir être reconstruit depuis les données serveur.

## 8. Règles PWA et hors ligne

Le shell de l’application doit pouvoir être chargé hors ligne après une première visite.

Une séance individuelle déjà chargée peut continuer en mode dégradé.

Les actions hors ligne doivent être identifiées comme :

- synchronisées ;
- en attente ;
- échouées ;
- en conflit.

Une séance partagée nécessite une connexion réseau active.

L’interface ne doit pas prétendre que les autres participants sont synchronisés lorsque la connexion est perdue.

Les mises à jour du service worker doivent être gérées sans provoquer de perte de données.

## 9. Règles concernant l’intelligence artificielle

L’IA est un outil de proposition, pas l’autorité métier.

### L’IA peut

- proposer un programme ;
- proposer une séance ;
- analyser des tendances ;
- expliquer une stagnation possible ;
- suggérer un ajustement ;
- reformuler des consignes ;
- adapter une proposition aux contraintes renseignées.

### L’IA ne peut pas

- établir un diagnostic médical ;
- recommander un traitement ;
- prescrire une rééducation ;
- recommander des substances interdites ou dangereuses ;
- modifier automatiquement un programme sans confirmation ;
- ignorer une restriction utilisateur ;
- exécuter directement une réponse textuelle non validée.

### Validation

Toute sortie IA doit :

1. respecter un schéma structuré ;
2. être validée côté backend ;
3. respecter les règles métier ;
4. utiliser des exercices connus ou clairement identifiés ;
5. être présentée à l’utilisateur avant enregistrement.

Les calculs déterministes restent dans le code métier :

- volume ;
- estimation de 1RM ;
- records ;
- arrondi des charges ;
- contraintes de rotation ;
- plages autorisées ;
- calculs nutritionnels.

## 10. Sécurité

- Aucun secret ne doit être commité.
- Aucun token ne doit apparaître dans les logs.
- Aucun mot de passe ne doit être stocké en clair.
- Utiliser Argon2 pour les mots de passe.
- Appliquer une limitation de débit aux routes sensibles.
- Protéger les routes d’authentification contre les abus.
- Protéger les routes IA contre les coûts incontrôlés.
- Configurer correctement CORS.
- Utiliser HTTPS en production.
- Sécuriser les cookies lorsqu’ils sont utilisés.
- Ne pas exposer les erreurs internes détaillées au client.
- Journaliser les actions administratives sensibles.
- Limiter les données envoyées aux fournisseurs externes.

## 11. Tests et qualité

Avant de considérer une tâche terminée, l’agent doit exécuter les vérifications disponibles :

- formatage ;
- lint ;
- typecheck ;
- tests unitaires concernés ;
- tests d’intégration concernés ;
- build ;
- tests end-to-end lorsque la fonctionnalité le justifie.

L’agent ne doit jamais :

- supprimer un test pour faire passer la suite ;
- désactiver silencieusement une règle de lint ;
- ignorer une erreur TypeScript ;
- modifier une configuration globale pour masquer une erreur locale.

Les règles métier importantes doivent être testées sans dépendre de l’interface.

Les flux WebSocket doivent couvrir :

- connexion ;
- autorisation ;
- événement accepté ;
- événement refusé ;
- reconnexion ;
- événement dupliqué ;
- conflit de version.

## 12. Documentation

Lorsqu’une implémentation change une décision produit ou technique, l’agent doit mettre à jour le document concerné.

Il doit notamment vérifier :

- les règles métier ;
- le modèle de données ;
- les contrats API ;
- les événements WebSocket ;
- la roadmap ;
- les critères d’acceptation.

Les noms métier doivent rester cohérents dans le code et la documentation.

## 13. Fin de tâche

À la fin d’une intervention, l’agent doit fournir un résumé contenant :

- les fonctionnalités ajoutées ou modifiées ;
- les fichiers principaux concernés ;
- les migrations créées ;
- les tests ajoutés ;
- les commandes de vérification exécutées ;
- les hypothèses prises ;
- les éventuels points restant à traiter.
