# Déploiement et exploitation

## 1. Objectif de ce document

Ce document définit la stratégie de déploiement et d’exploitation de Gym Companion.

Il couvre :

- les environnements ;
- l’infrastructure initiale ;
- Docker ;
- le reverse proxy ;
- PostgreSQL ;
- les migrations ;
- les secrets ;
- les sauvegardes ;
- les logs ;
- l’observabilité ;
- les mises à jour ;
- les procédures de retour ;
- les tâches planifiées ;
- la montée en charge ;
- la maintenance.

L’architecture initiale doit rester simple, économique et exploitable par une seule personne.

## 2. Principes

### 2.1 Simplicité

La première version privilégie :

- un monolithe modulaire ;
- une seule API ;
- une seule base PostgreSQL ;
- un seul point d’entrée HTTPS ;
- un nombre limité de services.

### 2.2 Reproductibilité

L’environnement doit pouvoir être recréé à partir :

- du dépôt ;
- des images ;
- des variables documentées ;
- des sauvegardes ;
- des scripts de migration.

### 2.3 Pas de modification manuelle non documentée

Les changements serveur doivent être décrits dans :

- le dépôt ;
- la configuration ;
- un script ;
- une procédure.

### 2.4 Sauvegarde avant migration

Une migration de production ne doit pas être lancée sans sauvegarde adaptée.

### 2.5 Retour possible

Chaque déploiement doit disposer d’une stratégie de retour ou de correction.

## 3. Environnements

### 3.1 Local

Utilisé pour le développement.

Services :

- web ;
- API ;
- PostgreSQL ;
- capture d’email facultative ;
- faux fournisseur IA.

### 3.2 Test

Utilisé automatiquement par la CI.

Caractéristiques :

- base éphémère ;
- données fictives ;
- secrets temporaires ;
- pas de fournisseur réel ;
- destruction après exécution.

### 3.3 Staging

Recommandé avant l’ouverture à plusieurs utilisateurs.

Caractéristiques :

- HTTPS ;
- configuration proche de la production ;
- domaine distinct ;
- base distincte ;
- données fictives ;
- clés externes de test ;
- migrations réelles.

### 3.4 Production

Contient les données réelles.

Elle doit être isolée des autres environnements.

## 4. Architecture initiale

Architecture recommandée :

```text
Internet
    ↓
DNS
    ↓
Caddy ou Nginx
    ├── fichiers statiques PWA
    └── API NestJS + Socket.IO
                ↓
           PostgreSQL
```

Déploiement possible sur un seul VPS :

```text
Docker Compose
├── reverse-proxy
├── web
├── api
├── postgres
└── backup
```

Un service de capture d’email ne doit pas être présent en production.

## 5. Hébergement du frontend

Deux approches sont possibles.

### 5.1 Image Docker

Le build React est servi par :

- Caddy ;
- Nginx ;
- un conteneur statique.

Avantages :

- déploiement uniforme ;
- configuration centralisée ;
- simple avec Docker Compose.

### 5.2 Hébergement statique externe

Le frontend peut être placé sur :

- stockage objet ;
- CDN ;
- plateforme statique.

L’API reste séparée.

Cette approche est pertinente lorsque le projet grandit.

### Choix initial recommandé

Servir le build depuis le même VPS pour réduire la complexité.

## 6. Hébergement de l’API

L’API NestJS est exécutée dans un conteneur.

Le processus doit :

- écouter sur un port interne ;
- ne pas être exposé directement à Internet ;
- recevoir les requêtes via le reverse proxy ;
- gérer l’arrêt propre ;
- exposer des health checks.

## 7. WebSocket

### 7.0 Shared 5.3 (présence)

- Namespace `/shared-workouts` sur la **même** origine/port API que REST.
- Docker Compose local : API exposée sur **3000** (Socket.IO inclus) ;
  le nginx du service `web` sert la SPA uniquement — **pas** de proxy WS
  aujourd’hui. Si un reverse proxy unifié est ajouté plus tard, configurer
  l’upgrade WebSocket (`Upgrade`, `Connection`, timeouts longs) vers l’API.
- CORS socket = `CORS_ALLOWED_ORIGINS` (identique REST).
- **Une seule instance API** pour Shared 5.3 : présence in-memory
  (`roomId → userId → Set<socketId>`). Multi-instance sans adapter Redis =
  présence incorrecte / événements manqués.
- Dette volontaire : adapter Socket.IO Redis avant de scaler horizontalement.

### 7.1 Reverse proxy (cible production)

Le reverse proxy doit prendre en charge les upgrades WebSocket.

Il doit conserver :

- en-têtes nécessaires ;
- délais adaptés ;
- connexion persistante ;
- adresse IP de confiance selon configuration.

Les timeouts ne doivent pas fermer une séance active trop rapidement.

Le client doit néanmoins savoir se reconnecter.

## 8. PostgreSQL

### 8.1 Déploiement initial

PostgreSQL peut être exécuté dans Docker sur le VPS.

Conditions :

- volume persistant ;
- sauvegardes externes ;
- réseau privé ;
- mot de passe robuste ;
- port non exposé publiquement.

### 8.2 Évolution

Un PostgreSQL managé devient pertinent lorsque :

- la disponibilité doit augmenter ;
- la maintenance devient lourde ;
- le volume augmente ;
- des sauvegardes et replicas managés sont souhaités.

### 8.3 Version

La version majeure doit être fixée.

Les mises à jour majeures sont planifiées et testées.

## 9. Docker Compose local

Services possibles :

```yaml
services:
  postgres:
    image: postgres:<version>

  api:
    build:
      context: .
      dockerfile: docker/api.Dockerfile
    depends_on:
      - postgres

  web:
    build:
      context: .
      dockerfile: docker/web.Dockerfile

  mail:
    image: mailpit/mailpit
```

Le fichier réel doit définir :

- health checks ;
- volumes ;
- réseaux ;
- variables ;
- ports nécessaires uniquement.

## 10. Docker Compose de production

Le fichier de production ne doit pas simplement réutiliser toutes les options de développement.

Il doit éviter :

- montage du code source ;
- hot reload ;
- ports de base publics ;
- secrets dans le fichier ;
- outils de debug ;
- utilisateurs root inutiles.

## 11. Images Docker

### 11.1 Multi-stage

Utiliser plusieurs étapes :

1. dépendances ;
2. build ;
3. image runtime.

### 11.2 Runtime minimal

L’image finale ne contient que :

- fichiers compilés ;
- dépendances de production ;
- certificats nécessaires ;
- utilisateur non root.

### 11.3 Versions

Éviter les tags flottants comme :

```text
latest
```

Fixer une version ou un digest pour les composants critiques.

### 11.4 Secrets

Aucun secret ne doit être copié dans l’image.

### 11.5 Health check

L’API expose un endpoint utilisé par Docker ou l’orchestrateur.

## 12. Utilisateur non root

Les conteneurs applicatifs doivent fonctionner avec un utilisateur non root lorsque possible.

Les permissions des volumes doivent être configurées explicitement.

## 13. Reverse proxy

### 13.1 Choix

Caddy est intéressant pour :

- configuration simple ;
- HTTPS automatique ;
- renouvellement de certificats ;
- WebSocket.

Nginx est intéressant pour :

- contrôle fin ;
- grande documentation ;
- configurations connues.

### 13.2 Recommandation initiale

Caddy peut être privilégié pour simplifier la première mise en production.

### 13.3 Responsabilités

- HTTPS ;
- redirection HTTP ;
- compression ;
- headers de sécurité ;
- fichiers statiques ;
- proxy API ;
- proxy Socket.IO ;
- limites de taille ;
- logs d’accès ;
- cache des assets statiques.

## 14. DNS et domaines

Exemple :

```text
app.example.com
api.example.com
```

ou domaine unique :

```text
example.com
example.com/api
```

### Domaine unique

Avantages :

- cookies plus simples ;
- CORS simplifié ;
- déploiement initial plus facile.

### Sous-domaines

Avantages :

- séparation claire ;
- évolution indépendante.

Le choix initial peut utiliser un domaine unique.

## 15. HTTPS

HTTPS obligatoire en production.

Le certificat doit être :

- valide ;
- renouvelé automatiquement ;
- surveillé.

Activer HSTS uniquement après validation du fonctionnement HTTPS.

## 16. Variables d’environnement

Les variables sont séparées par environnement.

Exemple :

```text
NODE_ENV
PORT
PUBLIC_APP_URL
API_BASE_URL

DATABASE_URL

JWT_ACCESS_SECRET
JWT_ACCESS_EXPIRES_IN
REFRESH_TOKEN_EXPIRES_IN
COOKIE_SECRET

CORS_ALLOWED_ORIGINS

EMAIL_PROVIDER
EMAIL_FROM
EMAIL_API_KEY

VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT

AI_COACH_ENABLED
AI_COACH_PROVIDER
AI_COACH_API_KEY
AI_COACH_MODEL
AI_COACH_TIMEOUT_MS
AI_COACH_RATE_LIMIT_PER_MINUTE

LOG_LEVEL
SENTRY_DSN

BACKUP_ENCRYPTION_KEY
```

Noms alignés sur `apiEnvSchema` (`packages/validation`) pour le Coach IA 5.5.
`AI_COACH_ENABLED=false` (défaut) : aucun appel fournisseur ; Coach déterministe inchangé.
`AI_COACH_PROVIDER=openai` nécessite `AI_COACH_API_KEY`.
`AI_COACH_PROVIDER=fake` réservé aux tests / développement local (interdit en production).

## 17. Validation des variables

L’API valide les variables au démarrage.

En production, le démarrage échoue si une variable critique manque.

Les erreurs ne doivent pas afficher la valeur du secret.

## 18. Gestion des secrets

### 18.1 Initialement

Les secrets peuvent être fournis via :

- fichier d’environnement protégé sur le serveur ;
- secrets CI ;
- variables Docker.

Le fichier ne doit pas être commité.

### 18.2 Évolution

Un gestionnaire de secrets devient pertinent lorsque l’infrastructure grandit.

### 18.3 Permissions

Les fichiers de secrets doivent être lisibles uniquement par les comptes nécessaires.

## 19. Build

Le build de production doit être reproductible.

Étapes :

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

La version du runtime Node.js doit être fixée.

## 20. Version applicative

Chaque build doit pouvoir exposer :

- version ;
- commit ;
- date de build ;
- version de schéma.

Exemple :

```json
{
  "version": "1.2.0",
  "commit": "abc123",
  "builtAt": "2026-08-03T10:00:00.000Z"
}
```

Ces informations ne doivent pas exposer de secrets.

## 21. CI/CD

Pipeline recommandé :

```text
Pull request
    ↓
lint
    ↓
typecheck
    ↓
tests
    ↓
build
    ↓
security checks
    ↓
image
    ↓
staging
    ↓
smoke tests
    ↓
production
```

Le déploiement de production peut rester manuel au début.

## 22. Registre d’images

Les images peuvent être publiées dans un registre privé ou protégé.

Tags recommandés :

```text
api:<commit>
api:<version>
web:<commit>
web:<version>
```

Éviter de déployer uniquement avec `latest`.

## 23. Procédure de déploiement

### 23.1 Avant

1. vérifier la CI ;
2. lire les migrations ;
3. sauvegarder la base ;
4. vérifier l’espace disque ;
5. vérifier les variables ;
6. construire ou récupérer les images ;
7. annoncer une maintenance si nécessaire.

### 23.2 Pendant

1. tirer les images ;
2. exécuter les migrations ;
3. redémarrer l’API ;
4. déployer le frontend ;
5. vérifier les health checks ;
6. exécuter les smoke tests.

### 23.3 Après

1. surveiller les erreurs ;
2. surveiller les connexions ;
3. vérifier les jobs ;
4. vérifier les nouvelles versions PWA ;
5. confirmer la sauvegarde ;
6. documenter le résultat.

## 24. Migrations Prisma

### 24.1 Développement

Les migrations sont créées et revues dans le dépôt.

### 24.2 Production

Utiliser la commande de déploiement des migrations adaptée.

Ne pas utiliser une commande interactive ou générant une migration en production.

### 24.3 Migration destructive

Toute suppression de colonne ou transformation importante doit être réalisée en plusieurs étapes.

Exemple :

1. ajouter une nouvelle colonne ;
2. déployer un code compatible ;
3. migrer les données ;
4. vérifier ;
5. supprimer l’ancienne colonne lors d’un déploiement ultérieur.

### 24.4 Migration longue

Pour une table volumineuse :

- mesurer ;
- limiter les verrous ;
- exécuter hors période active ;
- utiliser un traitement par lots si nécessaire.

## 25. Compatibilité descendante

Lorsqu’un frontend PWA ancien peut rester installé, l’API doit éviter les changements cassants immédiats.

Stratégies :

- champs facultatifs ;
- maintien temporaire d’un endpoint ;
- version d’API ;
- mise à jour obligatoire uniquement si nécessaire.

Le déploiement backend doit généralement précéder ou accompagner un frontend compatible.

## 26. Retour arrière

### 26.1 Code

Conserver l’image précédente.

Pour revenir :

1. redéployer l’image précédente ;
2. vérifier les health checks ;
3. exécuter les smoke tests.

### 26.2 Base de données

Une migration n’est pas toujours facilement réversible.

La stratégie principale est :

- sauvegarde ;
- migration compatible ;
- correction vers l’avant.

Une restauration complète est réservée aux incidents importants, car elle peut supprimer des écritures récentes.

### 26.3 Frontend

Le frontend peut être redéployé rapidement.

Attention au service worker et aux caches.

## 27. Déploiement sans interruption

La première version n’exige pas nécessairement un déploiement zéro interruption parfait.

Cependant :

- l’arrêt doit être court ;
- les sockets doivent se reconnecter ;
- les requêtes en cours doivent être drainées si possible ;
- les commandes doivent être idempotentes ;
- l’état partagé doit être reconstructible.

## 28. Arrêt propre de l’API

Lors d’un signal d’arrêt :

1. refuser les nouvelles connexions si nécessaire ;
2. arrêter les nouveaux jobs ;
3. terminer les requêtes en cours ;
4. fermer les sockets proprement ;
5. fermer Prisma ;
6. sortir.

Un délai maximal doit empêcher un arrêt bloqué.

## 29. Redémarrage et séances actives

Après redémarrage :

- les clients se reconnectent ;
- les rooms Socket.IO sont recréées ;
- les séances actives sont rechargées ;
- les snapshots sont disponibles ;
- les timers sont recalculés ;
- les commandes dupliquées restent détectées.

Une maintenance ne doit pas effacer une séance active.

## 30. Sauvegardes PostgreSQL

### 30.1 Fréquence initiale

Exemple :

- sauvegarde quotidienne complète ;
- conservation de plusieurs jours ;
- sauvegarde avant migration ;
- export plus fréquent si l’usage augmente.

### 30.2 Stockage

Les sauvegardes doivent être copiées hors du VPS principal.

Exemples :

- stockage objet ;
- autre serveur ;
- service de sauvegarde.

### 30.3 Chiffrement

Les sauvegardes contenant les données utilisateur doivent être chiffrées.

### 30.4 Rétention

Exemple indicatif :

- quotidiennes : 14 jours ;
- hebdomadaires : 8 semaines ;
- mensuelles : 6 mois.

Cette politique doit être adaptée au volume et aux besoins.

## 31. Test de restauration

Une restauration doit être testée régulièrement.

Procédure :

1. créer une base temporaire ;
2. restaurer ;
3. exécuter les migrations si nécessaire ;
4. vérifier les tables ;
5. vérifier des données ;
6. démarrer une API de test ;
7. supprimer l’environnement temporaire.

Le résultat du test doit être documenté.

## 32. Objectifs de reprise

Objectifs initiaux indicatifs :

### RPO

Perte maximale de données acceptable :

```text
jusqu’à 24 heures avec une sauvegarde quotidienne
```

Cet objectif devra être amélioré si plusieurs utilisateurs utilisent fréquemment l’application.

### RTO

Temps visé pour restaurer un service personnel :

```text
quelques heures
```

Ces objectifs ne constituent pas une garantie contractuelle.

## 33. Sauvegarde des fichiers

Si des exports ou fichiers sont stockés :

- ils ne doivent pas dépendre du disque temporaire ;
- les exports expirés peuvent être supprimés ;
- les fichiers permanents doivent être sauvegardés ;
- les références doivent être cohérentes avec la base.

## 34. Logs

### 34.1 API

Logs structurés :

- requêtes ;
- erreurs ;
- jobs ;
- WebSocket ;
- authentification ;
- migrations ;
- services externes.

### 34.2 Reverse proxy

Logs :

- méthode ;
- route ;
- statut ;
- durée ;
- taille ;
- IP selon politique.

### 34.3 Rotation

Les logs doivent être rotés.

Ils ne doivent pas remplir le disque.

### 34.4 Rétention

Définir une durée limitée.

## 35. Monitoring

### Minimum initial

- disponibilité de l’API ;
- utilisation CPU ;
- mémoire ;
- disque ;
- espace base ;
- temps de réponse ;
- erreurs 5xx ;
- health checks ;
- certificat HTTPS ;
- sauvegardes.

### Application

- inscriptions ;
- connexions échouées ;
- séances actives ;
- rooms actives ;
- connexions Socket.IO ;
- conflits de synchronisation ;
- jobs échoués ;
- appels IA échoués.

## 36. Alertes

Alertes utiles :

- API indisponible ;
- base indisponible ;
- disque presque plein ;
- sauvegarde échouée ;
- certificat proche de l’expiration ;
- taux d’erreurs élevé ;
- mémoire excessive ;
- nombre anormal de tentatives de connexion ;
- coûts IA inhabituels.

Les alertes doivent être actionnables.

## 37. Sentry ou suivi d’erreurs

Un outil de suivi peut recevoir :

- stack traces ;
- version ;
- route ;
- navigateur ;
- requestId.

Avant envoi :

- supprimer les tokens ;
- supprimer les données sensibles ;
- limiter les payloads ;
- configurer l’échantillonnage.

## 38. Métriques de WebSocket

Surveiller :

- connexions ;
- déconnexions ;
- reconnexions ;
- rooms ;
- événements ;
- acknowledgements ;
- latence ;
- conflits ;
- erreurs d’authentification.

## 39. Jobs planifiés

Tâches possibles :

- suppression des tokens expirés ;
- expiration des invitations ;
- nettoyage des commandes confirmées ;
- nettoyage des exports ;
- envoi de notifications ;
- suppression différée des comptes ;
- nettoyage des propositions IA ;
- agrégation de métriques ;
- sauvegarde.

## 40. Exécution des jobs

### Approche initiale

Les jobs peuvent être exécutés par :

- processus API ;
- processus worker séparé ;
- cron du serveur appelant une commande.

Un worker séparé est préférable lorsque les tâches deviennent coûteuses.

### Verrouillage

Éviter qu’un même job s’exécute deux fois simultanément.

Utiliser :

- verrou PostgreSQL ;
- table de jobs ;
- mécanisme de queue.

## 41. Email

En production, utiliser un fournisseur transactionnel.

Configurer :

- domaine d’envoi ;
- SPF ;
- DKIM ;
- DMARC lorsque pertinent ;
- adresse de réponse ;
- gestion des erreurs.

Les clés restent côté serveur.

## 42. Notifications Web Push

Nécessitent :

- clés VAPID ;
- HTTPS ;
- abonnements ;
- gestion des endpoints invalides.

Surveiller :

- envois ;
- échecs ;
- abonnements expirés.

## 43. Fournisseur IA

Configurer :

- clé ;
- modèle ;
- timeout ;
- quota ;
- coût maximal ;
- circuit breaker ;
- logs limités.

Le module IA doit pouvoir être désactivé par variable ou feature flag.

## 44. Feature flags

Des flags simples peuvent être utilisés pour :

- nutrition ;
- séances partagées ;
- coach IA ;
- notifications ;
- fonctionnalités expérimentales.

Ils peuvent être configurés côté serveur.

Un système commercial complexe de feature flags n’est pas requis initialement.

## 45. Maintenance

Une page de maintenance peut être affichée lorsque :

- migration incompatible ;
- incident ;
- maintenance planifiée ;
- base indisponible.

L’application doit conserver les données locales d’une séance.

## 46. Stockage et espace disque

Surveiller :

- volume PostgreSQL ;
- logs ;
- images Docker ;
- caches ;
- exports ;
- sauvegardes locales temporaires.

Mettre en place un nettoyage des images inutilisées et fichiers expirés.

## 47. Mise à jour du système

Le VPS doit recevoir :

- mises à jour de sécurité ;
- mises à jour du runtime ;
- mises à jour Docker ;
- mises à jour PostgreSQL mineures.

Les mises à jour majeures sont testées.

## 48. Accès serveur

### Recommandations

- clé SSH ;
- désactivation du mot de passe SSH si possible ;
- utilisateur non root ;
- sudo limité ;
- pare-feu ;
- fail2ban ou protection équivalente ;
- accès base privé.

### Ports publics

Initialement :

```text
80
443
22, idéalement restreint
```

PostgreSQL ne doit pas être exposé publiquement.

## 49. Pare-feu

Autoriser uniquement les ports nécessaires.

Les réseaux Docker internes isolent :

- base ;
- API ;
- reverse proxy.

## 50. Déploiement sur un VPS

Procédure initiale possible :

1. préparer le VPS ;
2. installer Docker ;
3. configurer le domaine ;
4. configurer le pare-feu ;
5. créer les répertoires ;
6. installer les secrets ;
7. démarrer PostgreSQL ;
8. exécuter les migrations ;
9. démarrer API et frontend ;
10. vérifier HTTPS ;
11. configurer les sauvegardes ;
12. configurer les alertes.

## 51. Arborescence serveur possible

```text
/opt/gym-companion/
├── compose/
├── env/
├── data/
│   ├── postgres/
│   └── exports/
├── backups/
├── scripts/
└── logs/
```

Les permissions doivent être contrôlées.

## 52. Scripts d’exploitation

Scripts recommandés :

```text
deploy.sh
backup.sh
restore-test.sh
health-check.sh
cleanup.sh
rollback.sh
```

Les scripts doivent :

- échouer explicitement ;
- journaliser ;
- vérifier les préconditions ;
- ne pas afficher les secrets.

## 53. Procédure de sauvegarde avant déploiement

1. vérifier la base ;
2. produire le dump ;
3. chiffrer ;
4. copier hors serveur ;
5. vérifier la taille ;
6. vérifier le code retour ;
7. enregistrer la date.

Le déploiement doit être annulé si une sauvegarde obligatoire échoue.

## 54. Procédure de rollback

### Sans migration destructive

1. identifier la version précédente ;
2. redéployer les images ;
3. redémarrer ;
4. vérifier ;
5. surveiller.

### Avec migration incompatible

1. arrêter les écritures si nécessaire ;
2. évaluer une correction vers l’avant ;
3. restaurer uniquement en dernier recours ;
4. informer les utilisateurs d’une éventuelle perte depuis la sauvegarde.

## 55. Déploiement de la PWA

Le frontend produit des assets hashés.

Le fichier HTML et le service worker doivent utiliser une stratégie de cache adaptée.

Vérifier :

- manifeste ;
- icônes ;
- chemins ;
- HTTPS ;
- service worker ;
- ancienne version ;
- écran standalone ;
- deep links.

## 56. Invalidation du service worker

Lorsqu’une version est déployée :

- le nouveau service worker s’installe ;
- l’utilisateur est informé ;
- les anciennes données locales sont migrées ;
- les caches obsolètes sont supprimés après activation.

Ne pas forcer un rechargement au milieu d’une séance sans nécessité.

## 57. Compatibilité frontend/backend

Le déploiement doit respecter cet ordre lorsque nécessaire :

1. backend compatible avec ancienne et nouvelle version ;
2. frontend ;
3. suppression ultérieure de l’ancien contrat.

## 58. Environnement de staging

Le staging doit permettre de tester :

- migration ;
- PWA ;
- HTTPS ;
- cookies ;
- CORS ;
- WebSocket ;
- emails ;
- Web Push ;
- IA ;
- sauvegarde ;
- restauration.

Les données doivent être fictives.

## 59. Smoke tests

Après chaque déploiement :

```text
GET /health/live
GET /health/ready
GET /
GET /api/v1/reference/muscle-groups
```

Puis vérifier avec un compte technique :

- connexion ;
- profil ;
- lecture d’une ressource ;
- connexion Socket.IO.

## 60. Checklist de production initiale

### Infrastructure

- domaine configuré ;
- HTTPS actif ;
- pare-feu actif ;
- Docker installé ;
- volumes persistants ;
- base non publique.

### Application

- build de production ;
- migrations ;
- variables validées ;
- PWA installable ;
- WebSocket fonctionnel ;
- emails fonctionnels.

### Sécurité

- secrets uniques ;
- cookies sécurisés ;
- CORS restreint ;
- headers ;
- rate limiting ;
- compte admin protégé.

### Données

- sauvegarde ;
- restauration testée ;
- export ;
- suppression ;
- rétention.

### Observabilité

- logs ;
- suivi d’erreur ;
- health checks ;
- alertes ;
- espace disque.

## 61. Montée en charge

Le système initial peut évoluer progressivement.

### Étape 1

- un VPS ;
- PostgreSQL local ;
- une instance API ;
- présence Shared 5.3 in-memory (acceptable mono-instance).

### Étape 2

- PostgreSQL managé ;
- stockage objet ;
- worker séparé.

### Étape 3

- Redis ;
- plusieurs instances API ;
- adapter Socket.IO Redis (requis pour présence Shared 5.3 multi-instance) ;
- load balancer avec sticky sessions ou adapter pub/sub.

### Étape 4

- CDN ;
- autoscaling ;
- queues avancées ;
- observabilité centralisée.

## 62. Passage à plusieurs instances

Avant d’ajouter plusieurs API :

- supprimer l’état critique en mémoire (dont présence Shared 5.3) ;
- ajouter un adapter Socket.IO Redis ;
- partager les sessions ;
- coordonner les jobs ;
- gérer les verrous ;
- centraliser les métriques.

## 63. Redis

Redis devient pertinent pour :

- adapter Socket.IO (requis dès multi-instance Shared 5.3 présence) ;
- cache ;
- rate limiting distribué ;
- BullMQ ;
- verrous ;
- présence temporaire partagée entre instances.

Il n’est pas obligatoire dans la première version.

## 64. Disponibilité

La première version n’est pas obligée de fournir une haute disponibilité complète.

Elle doit néanmoins limiter les points de perte :

- sauvegardes ;
- redémarrage automatique ;
- health checks ;
- monitoring ;
- reconstruction des séances ;
- idempotence.

## 65. Documentation d’exploitation

Le dépôt doit contenir :

- démarrage local ;
- déploiement ;
- sauvegarde ;
- restauration ;
- migration ;
- rollback ;
- rotation de secrets ;
- gestion d’incident ;
- ajout d’un administrateur ;
- désactivation de l’IA.

## 66. Critères de validation

Le déploiement initial est considéré comme maîtrisé lorsque :

- l’environnement est reproductible ;
- l’API et la PWA sont accessibles en HTTPS ;
- Socket.IO fonctionne derrière le proxy ;
- PostgreSQL n’est pas exposé publiquement ;
- les secrets ne sont pas dans le dépôt ;
- les migrations sont automatisées et revues ;
- une sauvegarde est réalisée hors du VPS ;
- une restauration a été testée ;
- les logs sont rotés ;
- l’espace disque est surveillé ;
- le service worker peut être mis à jour sans perte de séance ;
- une version précédente peut être redéployée ;
- le module IA peut être désactivé ;
- les health checks et alertes principales fonctionnent.
