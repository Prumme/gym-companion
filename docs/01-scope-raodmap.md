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

### 6.1 Objectif

Permettre à l’utilisateur d’exécuter et d’enregistrer une séance complète depuis son téléphone.

### 6.2 Fonctionnalités incluses

#### Démarrage

- Lancer une séance depuis un modèle.
- Lancer une séance vide.
- Reprendre une séance active.
- Afficher la dernière performance.
- Copier les charges précédentes.

#### Pendant la séance

- Afficher l’exercice courant.
- Afficher la série courante.
- Modifier la charge.
- Modifier la cible.
- Enregistrer les répétitions réelles.
- Enregistrer une durée ou une distance.
- Marquer une série comme réussie.
- Marquer une série comme partielle.
- Marquer une série comme échouée.
- Ignorer une série.
- Enregistrer RIR ou RPE.
- Ajouter une note.
- Ajouter ou supprimer une série.
- Ajouter un exercice.
- Réordonner les exercices.
- Remplacer un exercice.
- Démarrer un chronomètre de repos.

#### Fin de séance

- Terminer la séance.
- Annuler la séance.
- Conserver une séance incomplète.
- Afficher un résumé.
- Afficher le volume.
- Afficher les records obtenus.
- Enregistrer la durée réelle.

### 6.3 Mode hors ligne

- La séance active est stockée localement.
- Les actions non synchronisées sont conservées.
- L’état de synchronisation est visible.
- Une reconnexion déclenche une synchronisation.
- Les conflits doivent être détectés.

### 6.4 Hors périmètre

- Séance collaborative.
- Coaching vidéo.
- Détection automatique des répétitions.
- Intégration montre connectée.
- Recommandation IA en direct.

### 6.5 Critères de validation

La phase est terminée lorsque :

- une séance peut être effectuée entièrement depuis un téléphone ;
- une série peut être enregistrée rapidement ;
- une série échouée peut être enregistrée sans être perdue ;
- une séance active peut être reprise ;
- une coupure réseau courte ne provoque pas de perte de données ;
- la séance terminée apparaît dans l’historique.

## 7. Phase 4 — Historique et progression

### 7.1 Objectif

Transformer les données enregistrées en informations utiles.

### 7.2 Fonctionnalités incluses

- Liste des séances passées.
- Détail d’une séance.
- Historique par exercice.
- Évolution de la charge.
- Évolution des répétitions.
- Volume par séance.
- Volume par exercice.
- Estimation du 1RM.
- Records personnels.
- Comparaison entre périodes.
- Graphiques.
- Filtres par programme, exercice et période.
- Export des données d’entraînement.

### 7.3 Records initiaux

- charge maximale ;
- répétitions maximales ;
- volume maximal sur une série ;
- volume maximal sur une séance ;
- meilleur 1RM estimé ;
- meilleure durée ;
- meilleure distance.

### 7.4 Hors périmètre

- Analyse prédictive complexe.
- Comparaison publique entre utilisateurs.
- Classements.
- Score global universel.
- Diagnostic de stagnation automatique.

### 7.5 Critères de validation

La phase est terminée lorsque :

- l’utilisateur peut retrouver n’importe quelle séance ;
- il peut visualiser sa progression sur un exercice ;
- les estimations sont identifiées comme telles ;
- les records reposent sur des règles déterministes ;
- les graphiques sont utilisables sur mobile.

## 8. Phase 5 — Séances partagées

### 8.1 Objectif

Permettre à plusieurs utilisateurs de réaliser une même séance en organisant leur rotation sur les équipements.

### 8.2 Fonctionnalités incluses

#### Création d’une salle

- Création d’une séance partagée.
- Sélection d’un modèle.
- Séance libre.
- Code d’invitation.
- Lien d’invitation.
- Expiration du code.
- Révocation du code.
- Liste des participants.

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
