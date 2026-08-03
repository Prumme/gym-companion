# Exigences fonctionnelles

## 1. Objectif de ce document

Ce document définit les comportements que l’application doit fournir.

Chaque exigence possède un identifiant stable afin de pouvoir être référencée dans :

- les tickets ;
- les commits ;
- les pull requests ;
- les tests ;
- les critères d’acceptation ;
- la documentation technique.

Les exigences sont regroupées par domaine.

## 2. Priorités

Les niveaux de priorité sont :

- `MUST` : nécessaire au fonctionnement de la version concernée ;
- `SHOULD` : important mais reportable temporairement ;
- `COULD` : amélioration facultative ;
- `WONT` : volontairement exclu du périmètre actuel.

## 3. Authentification

### AUTH-001 — Création de compte

**Priorité : MUST**

Un utilisateur doit pouvoir créer un compte avec une adresse email unique et un mot de passe.

#### Critères d’acceptation

- L’email est normalisé.
- L’email est validé.
- Le mot de passe respecte la politique définie.
- Le mot de passe n’est jamais stocké en clair.
- Une adresse déjà utilisée produit une erreur compréhensible.
- La réponse ne contient jamais le hash du mot de passe.

### AUTH-002 — Connexion

**Priorité : MUST**

Un utilisateur doit pouvoir ouvrir une session avec ses identifiants.

#### Critères d’acceptation

- Les identifiants invalides produisent une réponse générique.
- Une session valide permet d’accéder aux routes privées.
- Un compte désactivé ne peut pas se connecter.
- Les tentatives répétées sont limitées.

### AUTH-003 — Déconnexion

**Priorité : MUST**

Un utilisateur doit pouvoir fermer sa session.

#### Critères d’acceptation

- Le refresh token actif est révoqué.
- Les données privées du cache client sont nettoyées.
- L’utilisateur est redirigé vers une page publique.

### AUTH-004 — Renouvellement de session

**Priorité : MUST**

Une session doit pouvoir être renouvelée sans demander fréquemment le mot de passe.

#### Critères d’acceptation

- Le refresh token est vérifié côté serveur.
- Un token révoqué est refusé.
- La rotation des refresh tokens est supportée si retenue.
- Une compromission présumée permet de révoquer les sessions.

### AUTH-005 — Mot de passe oublié

**Priorité : MUST**

Un utilisateur doit pouvoir demander une réinitialisation.

#### Critères d’acceptation

- La réponse ne révèle pas si l’adresse existe.
- Le lien est temporaire.
- Le token est à usage unique.
- Le nouveau mot de passe invalide le token.
- Les anciennes sessions peuvent être révoquées.

### AUTH-006 — Vérification d’adresse email

**Priorité : SHOULD**

L’application doit pouvoir vérifier l’adresse email.

### AUTH-007 — Gestion des sessions

**Priorité : SHOULD**

L’utilisateur doit pouvoir consulter et révoquer ses sessions actives.

## 4. Profil utilisateur

### USER-001 — Consultation du profil

**Priorité : MUST**

Un utilisateur authentifié doit pouvoir consulter son profil.

### USER-002 — Modification du profil

**Priorité : MUST**

Il doit pouvoir modifier :

- nom affiché ;
- fuseau horaire ;
- unité de poids ;
- unité de distance ;
- objectif principal ;
- niveau d’expérience.

### USER-003 — Données physiques facultatives

**Priorité : MUST**

La taille et le poids doivent rester facultatifs.

### USER-004 — Préférences sportives

**Priorité : SHOULD**

L’utilisateur peut définir :

- fréquence d’entraînement ;
- durée habituelle ;
- équipements disponibles ;
- méthode RIR ou RPE préférée.

### USER-005 — Restrictions déclarées

**Priorité : SHOULD**

L’utilisateur peut déclarer des restrictions d’exercice.

L’interface doit préciser que cette information ne remplace pas un avis médical.

## 5. Exercices

### EXE-001 — Catalogue système

**Priorité : MUST**

L’application doit fournir un catalogue initial d’exercices.

### EXE-002 — Recherche

**Priorité : MUST**

L’utilisateur doit pouvoir rechercher un exercice par nom.

### EXE-003 — Filtres

**Priorité : MUST**

L’utilisateur doit pouvoir filtrer par :

- groupe musculaire ;
- équipement ;
- type de mesure ;
- source système ou personnelle.

### EXE-004 — Fiche exercice

**Priorité : MUST**

Une fiche exercice doit afficher :

- nom ;
- groupe musculaire principal ;
- groupes secondaires ;
- équipement ;
- type de mesure ;
- instructions ;
- temps de repos par défaut.

### EXE-005 — Exercice personnalisé

**Priorité : MUST**

Un utilisateur doit pouvoir créer un exercice personnel.

### EXE-006 — Modification

**Priorité : MUST**

Un utilisateur peut modifier uniquement ses propres exercices.

### EXE-007 — Archivage

**Priorité : MUST**

Un exercice personnel peut être archivé sans supprimer les historiques associés.

### EXE-008 — Protection des exercices système

**Priorité : MUST**

Un utilisateur standard ne peut pas modifier les exercices système.

### EXE-009 — Types de mesure

**Priorité : MUST**

Les types initiaux sont :

- poids et répétitions ;
- poids du corps et répétitions ;
- répétitions seules ;
- durée ;
- distance et durée.

### EXE-010 — Doublons

**Priorité : SHOULD**

L’application doit avertir lorsqu’un exercice personnalisé ressemble fortement à un exercice existant.

## 6. Équipements

### EQP-001 — Catalogue d’équipements

**Priorité : MUST**

Les types d’équipement courants doivent être disponibles.

### EQP-002 — Équipement personnalisé

**Priorité : SHOULD**

Un utilisateur peut enregistrer une machine ou un équipement spécifique.

### EQP-003 — Incréments

**Priorité : MUST**

Un équipement peut définir :

- charge minimale ;
- charge maximale ;
- incrément ;
- liste de charges disponibles.

### EQP-004 — Arrondi des charges

**Priorité : MUST**

Les charges suggérées doivent respecter les incréments disponibles.

## 7. Programmes

### PRG-001 — Création

**Priorité : MUST**

Un utilisateur doit pouvoir créer un programme.

### PRG-002 — Modification

**Priorité : MUST**

Un utilisateur doit pouvoir modifier son programme.

### PRG-003 — Duplication

**Priorité : SHOULD**

Un programme peut être dupliqué.

### PRG-004 — Archivage

**Priorité : MUST**

Un programme peut être archivé.

### PRG-005 — Activation

**Priorité : MUST**

Un utilisateur peut définir un programme actif.

### PRG-006 — Objectif

**Priorité : MUST**

Un programme possède un objectif principal.

### PRG-007 — Plusieurs séances

**Priorité : MUST**

Un programme contient une ou plusieurs séances modèles.

### PRG-008 — Immuabilité historique

**Priorité : MUST**

La modification d’un programme ne modifie pas les séances déjà démarrées ou terminées.

## 8. Séances modèles

### TPL-001 — Création

**Priorité : MUST**

Un utilisateur doit pouvoir créer une séance modèle.

### TPL-002 — Exercices ordonnés

**Priorité : MUST**

Une séance modèle contient une liste ordonnée d’exercices.

### TPL-003 — Cibles

**Priorité : MUST**

Chaque exercice peut définir :

- nombre de séries ;
- répétitions minimales ;
- répétitions maximales ;
- durée ;
- intensité ;
- charge ;
- repos ;
- RIR ;
- RPE ;
- notes.

### TPL-004 — Réorganisation

**Priorité : MUST**

Les exercices doivent pouvoir être réordonnés.

### TPL-005 — Duplication

**Priorité : SHOULD**

Une séance modèle peut être dupliquée.

### TPL-006 — Estimation de durée

**Priorité : SHOULD**

L’application peut estimer la durée à partir des séries et repos.

## 9. Séances individuelles

### WKT-001 — Lancement depuis un modèle

**Priorité : MUST**

Un utilisateur doit pouvoir lancer une séance depuis un modèle.

### WKT-002 — Séance libre

**Priorité : MUST**

Un utilisateur doit pouvoir lancer une séance sans modèle.

### WKT-003 — Snapshot

**Priorité : MUST**

Le contenu prévu doit être copié dans la séance au démarrage.

### WKT-004 — Séance active

**Priorité : MUST**

Une séance active doit pouvoir être reprise après fermeture de l’application.

### WKT-005 — Dernière performance

**Priorité : MUST**

L’application doit afficher la dernière performance pertinente.

### WKT-006 — Modification en cours

**Priorité : MUST**

L’utilisateur doit pouvoir modifier la séance active.

### WKT-007 — Ajout d’exercice

**Priorité : MUST**

Un exercice peut être ajouté pendant la séance.

### WKT-008 — Remplacement d’exercice

**Priorité : SHOULD**

Un exercice peut être remplacé sans modifier automatiquement le modèle.

### WKT-009 — Fin de séance

**Priorité : MUST**

Une séance peut être terminée et enregistrée.

### WKT-010 — Séance incomplète

**Priorité : MUST**

Une séance abandonnée peut être conservée comme incomplète.

### WKT-011 — Annulation

**Priorité : MUST**

Une séance peut être annulée avec confirmation.

## 10. Séries

### SET-001 — Enregistrement

**Priorité : MUST**

Une série doit pouvoir enregistrer une performance réelle.

### SET-002 — Charge

**Priorité : MUST**

La charge réelle est enregistrée lorsque le type d’exercice l’exige.

### SET-003 — Répétitions

**Priorité : MUST**

Le nombre réel de répétitions est enregistré.

### SET-004 — Durée

**Priorité : MUST**

Une durée réelle peut être enregistrée.

### SET-005 — Distance

**Priorité : MUST**

Une distance réelle peut être enregistrée.

### SET-006 — Statut

**Priorité : MUST**

Les statuts sont :

- completed ;
- partial ;
- failed ;
- skipped.

### SET-007 — RIR

**Priorité : SHOULD**

L’utilisateur peut enregistrer le nombre de répétitions en réserve.

### SET-008 — RPE

**Priorité : SHOULD**

L’utilisateur peut enregistrer la difficulté perçue.

### SET-009 — Échauffement

**Priorité : MUST**

Une série peut être identifiée comme série d’échauffement.

### SET-010 — Notes

**Priorité : SHOULD**

Une note peut être associée à une série.

### SET-011 — Idempotence

**Priorité : MUST**

Une même commande client ne doit pas créer plusieurs séries.

### SET-012 — Correction

**Priorité : SHOULD**

Une performance passée peut être corrigée selon des règles explicites.

## 11. Chronomètre

### TIMER-001 — Démarrage automatique

**Priorité : MUST**

Le chronomètre peut démarrer après validation d’une série.

### TIMER-002 — Contrôles

**Priorité : MUST**

L’utilisateur peut :

- mettre en pause ;
- reprendre ;
- ajouter du temps ;
- retirer du temps ;
- terminer.

### TIMER-003 — Continuité

**Priorité : MUST**

Le chronomètre doit rester cohérent lorsque l’application passe en arrière-plan.

### TIMER-004 — Notification

**Priorité : SHOULD**

Une notification peut signaler la fin du repos.

## 12. Historique

### HIST-001 — Liste des séances

**Priorité : MUST**

L’utilisateur doit pouvoir consulter ses séances passées.

### HIST-002 — Détail

**Priorité : MUST**

Une séance doit afficher exercices, séries et notes.

### HIST-003 — Filtres

**Priorité : SHOULD**

L’historique peut être filtré par période, programme et exercice.

### HIST-004 — Export

**Priorité : SHOULD**

L’historique peut être exporté.

## 13. Progression

### PROG-001 — Historique d’exercice

**Priorité : MUST**

L’utilisateur doit pouvoir consulter toutes ses performances sur un exercice.

### PROG-002 — Volume

**Priorité : MUST**

L’application calcule le volume lorsque la mesure est compatible.

### PROG-003 — 1RM estimé

**Priorité : MUST**

L’application peut calculer un 1RM estimé selon une formule déterministe.

### PROG-004 — Records personnels

**Priorité : MUST**

Les records sont calculés depuis les séries persistées.

### PROG-005 — Graphiques

**Priorité : SHOULD**

Les évolutions peuvent être affichées graphiquement.

### PROG-006 — Comparaison de périodes

**Priorité : SHOULD**

L’utilisateur peut comparer deux périodes.

### PROG-007 — Distinction des estimations

**Priorité : MUST**

Les valeurs estimées doivent être clairement identifiées.

## 14. Séances partagées

### SHR-001 — Création de salle

**Priorité : MUST**

Un utilisateur authentifié peut créer une salle privée.

### SHR-002 — Hôte

**Priorité : MUST**

Le créateur devient hôte.

### SHR-003 — Code d’invitation

**Priorité : MUST**

Une salle dispose d’un code d’invitation.

### SHR-004 — Lien d’invitation

**Priorité : MUST**

Une salle dispose d’un lien partageable.

### SHR-005 — Expiration

**Priorité : MUST**

Une invitation peut expirer.

### SHR-006 — Révocation

**Priorité : MUST**

L’hôte peut révoquer l’invitation.

### SHR-007 — Participants

**Priorité : MUST**

L’hôte voit la liste des participants.

### SHR-008 — Limite de participants

**Priorité : MUST**

La première version limite une salle à cinq participants.

### SHR-009 — Salle privée

**Priorité : MUST**

Une salle n’est pas publiquement découvrable.

### SHR-010 — Accès autorisé

**Priorité : MUST**

Le serveur vérifie l’autorisation de rejoindre la salle.

## 15. Rotation des machines

### ROT-001 — Équipements disponibles

**Priorité : MUST**

L’hôte peut définir les équipements disponibles.

### ROT-002 — Rotation initiale

**Priorité : MUST**

Le serveur peut calculer une rotation initiale.

### ROT-003 — Déterminisme

**Priorité : MUST**

Une même entrée doit produire une organisation cohérente.

### ROT-004 — Personnalisation des charges

**Priorité : MUST**

Chaque participant peut posséder une charge différente.

### ROT-005 — Objectifs individuels

**Priorité : MUST**

Chaque participant peut posséder une cible différente.

### ROT-006 — Modification manuelle

**Priorité : MUST**

L’hôte peut modifier la rotation proposée.

### ROT-007 — Participant en retard

**Priorité : SHOULD**

Un participant peut rejoindre après le démarrage.

### ROT-008 — Participant absent

**Priorité : MUST**

La rotation peut gérer un participant temporairement absent.

### ROT-009 — Fin anticipée

**Priorité : SHOULD**

Un participant peut terminer avant les autres.

## 16. Temps réel

### RT-001 — Authentification Socket.IO

**Priorité : MUST**

Chaque connexion doit être authentifiée.

### RT-002 — Room

**Priorité : MUST**

Chaque séance partagée utilise une room dédiée.

### RT-003 — État autoritaire

**Priorité : MUST**

Le serveur détient l’état de référence.

### RT-004 — Accusés de réception

**Priorité : MUST**

Les commandes critiques reçoivent une réponse.

### RT-005 — Version d’état

**Priorité : MUST**

L’état de séance possède une version croissante.

### RT-006 — Snapshot

**Priorité : MUST**

Le serveur peut envoyer un snapshot complet.

### RT-007 — Reconnexion

**Priorité : MUST**

Un client reconnecté peut retrouver l’état actuel.

### RT-008 — Commandes dupliquées

**Priorité : MUST**

Une commande dupliquée ne doit pas être appliquée deux fois.

### RT-009 — Conflit

**Priorité : MUST**

Une commande fondée sur un état obsolète peut être refusée.

### RT-010 — Présence

**Priorité : MUST**

Les participants voient les états connecté, déconnecté temporairement et absent.

## 17. Nutrition

### NUT-001 — Objectif calorique

**Priorité : MUST**

Un utilisateur peut définir un objectif calorique.

### NUT-002 — Macronutriments

**Priorité : MUST**

Un utilisateur peut définir des objectifs de protéines, glucides et lipides.

### NUT-003 — Journal alimentaire

**Priorité : MUST**

Un utilisateur peut enregistrer ses aliments par journée et repas.

### NUT-004 — Portions

**Priorité : MUST**

La quantité consommée doit pouvoir être ajustée.

### NUT-005 — Aliment personnalisé

**Priorité : MUST**

Un utilisateur peut créer un aliment.

### NUT-006 — Repas réutilisable

**Priorité : SHOULD**

Un groupe d’aliments peut être enregistré comme repas.

### NUT-007 — Copie de repas

**Priorité : SHOULD**

Un repas précédent peut être copié.

### NUT-008 — Résumé quotidien

**Priorité : MUST**

L’application affiche le total de la journée.

### NUT-009 — Résumé hebdomadaire

**Priorité : SHOULD**

L’application affiche une moyenne et une tendance hebdomadaire.

### NUT-010 — Source des valeurs

**Priorité : MUST**

La source des informations nutritionnelles doit être identifiable.

### NUT-011 — Dépense sportive

**Priorité : MUST**

La dépense sportive doit être affichée comme estimation séparée.

### NUT-012 — Absence de compensation automatique

**Priorité : MUST**

L’objectif alimentaire ne doit pas augmenter automatiquement de toute la dépense sportive.

## 18. Mesures corporelles

### BODY-001 — Poids

**Priorité : MUST**

Un utilisateur peut enregistrer son poids.

### BODY-002 — Date

**Priorité : MUST**

Une mesure peut être associée à une date et une heure.

### BODY-003 — Tendance

**Priorité : SHOULD**

L’application peut afficher une tendance lissée.

### BODY-004 — Autres mesures

**Priorité : COULD**

D’autres mesures corporelles pourront être ajoutées ultérieurement.

## 19. PWA

### PWA-001 — Installation

**Priorité : MUST**

L’application doit être installable lorsque la plateforme le permet.

### PWA-002 — Shell hors ligne

**Priorité : MUST**

L’interface principale doit être chargée hors ligne après une première utilisation.

### PWA-003 — Mise à jour

**Priorité : MUST**

Une nouvelle version du service worker doit être appliquée sans perte de données.

### PWA-004 — Séance locale

**Priorité : MUST**

Une séance individuelle déjà chargée peut continuer hors ligne.

### PWA-005 — File de synchronisation

**Priorité : MUST**

Les commandes hors ligne sont conservées localement.

### PWA-006 — État visible

**Priorité : MUST**

L’utilisateur voit si une action est synchronisée ou en attente.

### PWA-007 — Conflit visible

**Priorité : MUST**

Un conflit ne doit pas être résolu silencieusement au détriment des données utilisateur.

### PWA-008 — Limite du collaboratif

**Priorité : MUST**

L’interface indique clairement qu’une séance partagée nécessite une connexion.

## 20. Notifications

### NOT-001 — Consentement

**Priorité : MUST**

Aucune notification push n’est activée sans consentement.

### NOT-002 — Préférences

**Priorité : MUST**

Chaque catégorie peut être activée ou désactivée.

### NOT-003 — Horaires silencieux

**Priorité : MUST**

L’utilisateur peut définir une période silencieuse.

### NOT-004 — Séance planifiée

**Priorité : SHOULD**

Une notification peut rappeler une séance.

### NOT-005 — Fin de repos

**Priorité : SHOULD**

Une notification peut signaler la fin d’un repos.

### NOT-006 — Invitation

**Priorité : MUST**

Une invitation partagée peut déclencher une notification.

### NOT-007 — Changement de station

**Priorité : SHOULD**

Un changement de station peut être signalé.

### NOT-008 — Nettoyage des abonnements

**Priorité : MUST**

Un abonnement push invalide doit pouvoir être supprimé.

## 21. Intelligence artificielle

### AI-001 — Création de programme

**Priorité : MUST pour la phase IA**

L’IA peut proposer un programme structuré.

### AI-002 — Proposition de séance

**Priorité : SHOULD**

L’IA peut proposer une séance ponctuelle.

### AI-003 — Analyse de progression

**Priorité : SHOULD**

L’IA peut commenter des tendances sélectionnées.

### AI-004 — Format structuré

**Priorité : MUST**

Les réponses métier doivent respecter un schéma validé.

### AI-005 — Validation serveur

**Priorité : MUST**

Le backend valide les bornes et références.

### AI-006 — Confirmation utilisateur

**Priorité : MUST**

Une proposition n’est pas enregistrée sans confirmation.

### AI-007 — Transparence

**Priorité : MUST**

L’application affiche hypothèses et limites.

### AI-008 — Données minimales

**Priorité : MUST**

Seules les données nécessaires sont envoyées au fournisseur.

### AI-009 — Indisponibilité

**Priorité : MUST**

L’indisponibilité du service IA ne bloque pas le suivi classique.

### AI-010 — Limitation d’usage

**Priorité : MUST**

Les appels IA doivent être limités par utilisateur.

### AI-011 — Sécurité médicale

**Priorité : MUST**

L’IA ne doit pas produire de diagnostic ou traitement.

## 22. Export et confidentialité

### DATA-001 — Export

**Priorité : MUST**

Un utilisateur peut exporter ses données.

### DATA-002 — Format versionné

**Priorité : MUST**

Le format d’export possède une version.

### DATA-003 — Suppression du compte

**Priorité : MUST**

Un utilisateur peut demander la suppression de son compte.

### DATA-004 — Réauthentification

**Priorité : MUST**

Une action sensible demande une nouvelle vérification d’identité.

### DATA-005 — Révocation des sessions

**Priorité : MUST**

La suppression du compte révoque les sessions.

### DATA-006 — Minimisation

**Priorité : MUST**

L’application ne collecte pas de données inutiles.

## 23. Administration

### ADM-001 — Catalogue système

**Priorité : SHOULD**

Un administrateur peut gérer les exercices système.

### ADM-002 — Désactivation de compte

**Priorité : MUST**

Un administrateur peut désactiver un compte en cas d’abus ou de risque.

### ADM-003 — Journalisation

**Priorité : MUST**

Les actions administratives sensibles sont journalisées.

### ADM-004 — Pas d’accès arbitraire

**Priorité : MUST**

Un administrateur ne doit pas consulter les données privées sans besoin et autorisation définis.

## 24. Exigences transversales

### CROSS-001 — Mobile-first

**Priorité : MUST**

Toutes les fonctionnalités principales doivent être utilisables sur téléphone.

### CROSS-002 — Accessibilité

**Priorité : MUST**

Les interactions essentielles doivent être accessibles au clavier et aux technologies d’assistance.

### CROSS-003 — États d’interface

**Priorité : MUST**

Chaque vue asynchrone doit prévoir :

- chargement ;
- erreur ;
- vide ;
- succès ;
- hors ligne lorsque pertinent.

### CROSS-004 — Internationalisation future

**Priorité : SHOULD**

Les textes doivent pouvoir être externalisés pour une traduction future.

### CROSS-005 — Observabilité

**Priorité : MUST**

Les erreurs serveur importantes doivent être journalisées sans exposer de secrets.

### CROSS-006 — Performance mobile

**Priorité : MUST**

Les écrans de séance doivent limiter les chargements et calculs inutiles.

### CROSS-007 — Protection contre les doubles actions

**Priorité : MUST**

Les boutons critiques doivent éviter les soumissions multiples.

### CROSS-008 — Cohérence des dates

**Priorité : MUST**

Les timestamps utilisent UTC et les jours locaux utilisent la timezone utilisateur.

### CROSS-009 — Cohérence des unités

**Priorité : MUST**

Les valeurs sont enregistrées dans une unité canonique et converties pour l’affichage.

### CROSS-010 — Dégradation contrôlée

**Priorité : MUST**

L’indisponibilité d’un module facultatif ne doit pas rendre toute l’application inutilisable.
