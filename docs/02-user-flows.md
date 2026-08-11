# Parcours utilisateurs

## 1. Objectif de ce document

Ce document décrit les principaux parcours utilisateurs.

Il ne définit pas précisément la disposition visuelle des pages. Il décrit les actions, décisions, résultats et situations d’erreur que l’application doit prendre en charge.

## 2. Principes généraux

Chaque parcours doit prévoir :

* un état initial ;
* une action principale ;
* un résultat attendu ;
* un état de chargement ;
* un état vide ;
* un état d’erreur ;
* un comportement hors ligne lorsque pertinent ;
* une possibilité de retour en arrière ;
* une confirmation pour les actions destructrices.

## 3. Inscription

### 3.1 Parcours principal

1. L’utilisateur ouvre l’application.
2. Il choisit de créer un compte.
3. Il saisit son adresse email.
4. Il saisit son mot de passe.
5. Il confirme son mot de passe.
6. Il accepte les conditions d’utilisation et la politique de confidentialité.
7. L’application valide les champs.
8. Le compte est créé.
9. Une session est ouverte.
10. L’utilisateur est dirigé vers la configuration initiale.

### 3.2 Erreurs possibles

* adresse email invalide ;
* adresse déjà utilisée ;
* mot de passe insuffisamment robuste ;
* mots de passe différents ;
* conditions non acceptées ;
* serveur indisponible ;
* trop de tentatives.

### 3.3 Résultat attendu

L’utilisateur possède un compte authentifié.

Aucune donnée facultative de santé ou de performance ne doit être exigée pour créer le compte.

## 4. Configuration initiale

### 4.1 Parcours principal

1. L’utilisateur choisit un nom affiché.
2. Il confirme son fuseau horaire.
3. Il choisit son unité de poids.
4. Il choisit son unité de distance.
5. Il sélectionne son objectif principal :

   * endurance ;
   * hypertrophie ;
   * force ;
   * forme générale.
6. Il sélectionne son niveau :

   * débutant ;
   * intermédiaire ;
   * avancé.
7. Il peut renseigner facultativement :

   * taille ;
   * poids actuel ;
   * nombre de séances par semaine ;
   * équipements disponibles.
8. Il termine la configuration.
9. Il arrive sur le tableau de bord.

### 4.2 Règle

La configuration doit rester courte.

Les informations non indispensables sont demandées ultérieurement au moment où elles deviennent utiles.

## 5. Connexion

### 5.1 Parcours principal

1. L’utilisateur saisit son email.
2. Il saisit son mot de passe.
3. L’application vérifie les identifiants.
4. Une session est créée.
5. L’utilisateur est redirigé vers l’application.

### 5.2 Cas particuliers

* compte désactivé ;
* email non confirmé ;
* mot de passe oublié ;
* session déjà active ;
* accès depuis un nouvel appareil ;
* serveur indisponible.

## 6. Réinitialisation du mot de passe

1. L’utilisateur demande une réinitialisation.
2. Il saisit son email.
3. L’application affiche une réponse neutre.
4. Un email est envoyé si le compte existe.
5. L’utilisateur ouvre le lien.
6. Il saisit un nouveau mot de passe.
7. Les anciennes sessions peuvent être révoquées.
8. Il peut se reconnecter.

L’application ne doit pas révéler publiquement si une adresse possède un compte.

## 7. Consultation du catalogue d’exercices

1. L’utilisateur ouvre la section Exercices.
2. Il consulte les exercices disponibles.
3. Il peut effectuer une recherche.
4. Il peut filtrer par :

   * groupe musculaire ;
   * équipement ;
   * type de mesure ;
   * exercice système ou personnel.
5. Il ouvre un exercice.
6. Il consulte :

   * nom ;
   * muscles ;
   * équipement ;
   * instructions ;
   * historique personnel éventuel ;
   * records éventuels.

## 8. Création d’un exercice personnalisé

1. L’utilisateur choisit Nouvel exercice.
2. Il saisit un nom.
3. Il sélectionne le groupe musculaire principal.
4. Il sélectionne les groupes secondaires facultatifs.
5. Il sélectionne l’équipement.
6. Il choisit le type de mesure.
7. Il définit un temps de repos facultatif.
8. Il ajoute des instructions facultatives.
9. Il enregistre.
10. L’exercice est disponible dans ses programmes.

### Erreurs possibles

* nom absent ;
* doublon évident dans les exercices personnels ;
* type de mesure incompatible ;
* valeurs numériques invalides.

## 9. Création d’un programme

1. L’utilisateur ouvre Programmes.
2. Il choisit Nouveau programme.
3. Il saisit un nom.
4. Il sélectionne un objectif.
5. Il ajoute une description facultative.
6. Il crée une première séance modèle.
7. Il ajoute des exercices.
8. Pour chaque exercice, il définit :

   * nombre de séries ;
   * répétitions minimales ;
   * répétitions maximales ;
   * durée cible si applicable ;
   * repos ;
   * intensité ou charge facultative ;
   * RIR ou RPE cible facultatif ;
   * notes.
9. Il réorganise les exercices.
10. Il ajoute d’autres séances si nécessaire.
11. Il enregistre le programme.
12. Il peut l’activer immédiatement.

## 10. Modification d’un programme

1. L’utilisateur ouvre un programme.
2. Il choisit Modifier.
3. Il change les informations souhaitées.
4. Il enregistre.
5. Les futurs lancements utilisent la nouvelle version.

### Règle importante

Les séances déjà démarrées ou terminées conservent leur snapshot.

Elles ne sont pas modifiées rétroactivement.

## 11. Lancement d’une séance individuelle depuis un modèle

1. L’utilisateur ouvre Aujourd’hui ou Programmes.
2. Il sélectionne une séance.
3. L’application affiche :

   * exercices ;
   * séries ;
   * durée estimée ;
   * dernière performance ;
   * éventuelles contraintes.
4. L’utilisateur choisit Démarrer.
5. Une séance active est créée.
6. Un snapshot du modèle est enregistré.
7. Le premier exercice est affiché.
8. Le chronomètre général démarre.

## 12. Lancement d’une séance libre

1. L’utilisateur choisit Séance libre.
2. Une séance vide est créée.
3. Il ajoute un exercice.
4. Il définit ou copie les séries.
5. Il commence l’enregistrement.
6. Il peut sauvegarder ultérieurement la séance comme modèle.

## 13. Enregistrement d’une série

### 13.1 Parcours principal

1. L’utilisateur consulte la cible.
2. L’application préremplit la charge précédente si disponible.
3. L’utilisateur ajuste la charge.
4. Il effectue la série.
5. Il saisit les répétitions réelles.
6. Il peut saisir RIR ou RPE.
7. Il choisit un statut.
8. Il valide.
9. La série est sauvegardée.
10. Le chronomètre de repos démarre.
11. La série suivante devient active.

### 13.2 Statuts possibles

* réussie ;
* partielle ;
* échouée ;
* ignorée.

### 13.3 Contraintes UX

L’enregistrement doit pouvoir être effectué en quelques secondes.

Les valeurs précédentes doivent être facilement réutilisables.

## 14. Série partielle ou échouée

1. L’utilisateur saisit le résultat réellement obtenu.
2. Il choisit Partielle ou Échouée.
3. Il peut ajouter une note.
4. La série est enregistrée.
5. L’application ne remplace pas la valeur réelle par la cible.
6. Une suggestion future peut tenir compte de cet échec.

L’application ne doit pas présenter l’échec d’une série comme une faute.

## 15. Modification de la séance en cours

L’utilisateur peut :

* ajouter une série ;
* supprimer une série non réalisée ;
* ajouter un exercice ;
* remplacer un exercice ;
* ignorer un exercice ;
* modifier l’ordre ;
* modifier le repos ;
* modifier une cible.

Les modifications concernent la séance active.

Elles ne changent pas automatiquement le modèle d’origine.

À la fin, l’application peut proposer de mettre à jour le modèle.

## 16. Chronomètre de repos

1. Une série est validée.
2. Le chronomètre démarre avec la durée prévue.
3. L’utilisateur peut :

   * ajouter du temps ;
   * réduire le temps ;
   * mettre en pause ;
   * terminer immédiatement.
4. À zéro, un signal visuel apparaît.
5. Une notification peut être envoyée si autorisée.
6. L’utilisateur passe à la suite.

Le chronomètre ne doit pas bloquer les autres écrans.

## 17. Fin d’une séance individuelle

1. L’utilisateur choisit Terminer.
2. L’application vérifie les séries non traitées.
3. Elle demande une confirmation si nécessaire.
4. La séance reçoit une heure de fin.
5. Les statistiques sont calculées.
6. Les records sont détectés.
7. Le résumé affiche :

   * durée ;
   * exercices ;
   * séries ;
   * volume ;
   * records ;
   * notes.
8. La séance est ajoutée à l’historique.

## 18. Abandon d’une séance

1. L’utilisateur choisit Quitter ou Annuler.
2. L’application propose :

   * conserver comme séance incomplète ;
   * supprimer le brouillon ;
   * continuer la séance.
3. Une confirmation est demandée pour la suppression.
4. Les données déjà synchronisées ne sont jamais supprimées silencieusement.

## 19. Reprise d’une séance active

1. L’utilisateur rouvre l’application.
2. Une séance active est détectée.
3. L’application propose de la reprendre.
4. Les données locales et serveur sont comparées.
5. L’état le plus récent cohérent est chargé.
6. Les actions en attente sont synchronisées.
7. L’utilisateur revient sur l’exercice courant.

## 20. Utilisation hors ligne pendant une séance individuelle

1. Le réseau devient indisponible.
2. Un indicateur hors ligne apparaît.
3. L’utilisateur continue à enregistrer ses séries.
4. Les actions sont stockées localement.
5. Chaque action reçoit un identifiant unique.
6. Le réseau revient.
7. Les actions sont envoyées dans l’ordre.
8. Le serveur confirme ou refuse chaque action.
9. Les conflits sont affichés.
10. L’état synchronisé remplace l’état temporaire.

## 21. Consultation de l’historique

1. L’utilisateur ouvre Historique.
2. Il consulte les séances récentes.
3. Il filtre par :

   * période ;
   * programme ;
   * exercice ;
   * statut.
4. Il ouvre une séance.
5. Il consulte toutes les performances.
6. Il peut ajouter ou corriger une note.
7. Les corrections de performance sensibles peuvent être journalisées.

## 22. Consultation de la progression d’un exercice

1. L’utilisateur ouvre un exercice.
2. Il sélectionne Progression.
3. Il choisit une période.
4. L’application affiche :

   * performances récentes ;
   * charge maximale ;
   * volume ;
   * meilleur 1RM estimé ;
   * records ;
   * graphique.
5. L’utilisateur peut comparer deux périodes.

Les valeurs calculées doivent être distinguées des valeurs saisies.

## 23. Création d’une séance partagée

1. L’utilisateur choisit Séance partagée.
2. Il choisit Créer une salle.
3. Il sélectionne :

   * un modèle existant ;
   * ou une séance libre.
4. Il définit éventuellement :

   * nombre attendu de participants ;
   * durée cible ;
   * équipements disponibles.
5. Le serveur crée la salle et génère un **code d’accès** (6 caractères, affiché `XXX-XXX`).
6. L’utilisateur devient hôte.
7. Le code est affiché sur le détail salle (owner, `LOBBY` / `ACTIVE`).
8. L’hôte partage le code manuellement (messagerie, oral, etc.).

## 24. Rejoindre une séance partagée

1. Le participant authentifié saisit le code (depuis `/shared-workouts` ou une sheet dédiée).
2. Le client normalise la saisie (casse, tiret optionnel).
3. Le serveur vérifie le code et le statut de la salle (`LOBBY` / `ACTIVE` uniquement).
4. Le participant voit :

   * nom de l’hôte ;
   * séance prévue ;
   * participants présents.
5. Il confirme qu’il souhaite rejoindre.
6. Il renseigne éventuellement :

   * restrictions ;
   * exercices incompatibles ;
   * équipements préférés.
7. Il entre dans la salle d’attente.

## 25. Préparation de la rotation

1. Les participants rejoignent la salle.
2. L’hôte confirme les équipements disponibles.
3. L’application récupère les charges précédentes de chacun.
4. Le serveur calcule une proposition de rotation.
5. Chaque participant voit :

   * première station ;
   * exercice ;
   * charge ;
   * cible ;
   * station suivante.
6. L’hôte peut modifier la proposition.
7. L’hôte démarre la séance.

## 26. Déroulement d’une séance partagée

1. Chaque participant voit sa station actuelle.
2. Il effectue sa série.
3. Il saisit sa performance.
4. Le client envoie une commande avec un identifiant unique.
5. Le serveur valide et persiste.
6. Le serveur accuse réception.
7. L’état mis à jour est diffusé.
8. Lorsque la rotation est possible, le serveur change les stations.
9. Chaque participant reçoit sa nouvelle affectation.
10. Le processus continue jusqu’à la fin.

## 27. Participant en retard

1. Un participant rejoint après le démarrage.
2. Le serveur récupère l’état courant.
3. L’hôte accepte son arrivée.
4. Le serveur recalcule ou adapte la rotation.
5. Les participants reçoivent la nouvelle organisation.

L’ajout ne doit pas supprimer les performances déjà enregistrées.

## 28. Participant temporairement absent

1. Le participant indique une pause ou perd la connexion.
2. Il reste membre de la séance pendant un délai de grâce.
3. La rotation peut :

   * conserver sa place ;
   * le passer temporairement ;
   * attendre une décision de l’hôte.
4. À son retour, un snapshot est chargé.

## 29. Reconnexion WebSocket

1. Le client détecte la déconnexion.
2. L’interface indique que le temps réel est interrompu.
3. Les actions critiques sont bloquées ou mises en attente selon leur nature.
4. Le client se reconnecte.
5. Il transmet :

   * identifiant de séance ;
   * dernière version connue ;
   * commandes non confirmées.
6. Le serveur vérifie l’identité.
7. Il renvoie un snapshot complet.
8. Les commandes sont réconciliées.
9. Les conflits sont signalés.
10. L’utilisateur reprend la séance.

## 30. Fin d’une séance partagée

1. Tous les participants ont terminé ou l’hôte choisit Terminer.
2. Le serveur vérifie l’état.
3. Une confirmation est demandée.
4. La salle passe en état terminé.
5. Les performances sont enregistrées pour chaque utilisateur.
6. Chaque participant reçoit son résumé individuel.
7. Un résumé commun est disponible.
8. La salle devient en lecture seule.
9. Les connexions peuvent être fermées proprement.

## 31. Définition d’un objectif nutritionnel

1. L’utilisateur ouvre Nutrition.
2. Il choisit Définir mes objectifs.
3. Il saisit ou accepte :

   * calories ;
   * protéines ;
   * glucides ;
   * lipides.
4. L’application affiche l’origine des valeurs.
5. L’utilisateur confirme.
6. Les objectifs prennent effet à la date choisie.

Une suggestion ne doit pas être confondue avec une prescription.

## 32. Ajout d’un aliment

1. L’utilisateur choisit un repas.
2. Il recherche un aliment.
3. Il sélectionne une portion.
4. Les calories et macros sont calculées.
5. Il ajuste la quantité.
6. Il enregistre.
7. Le total quotidien est actualisé.

## 33. Création d’un aliment personnalisé

1. L’utilisateur choisit Nouvel aliment.
2. Il saisit un nom.
3. Il définit une portion de référence.
4. Il saisit les valeurs nutritionnelles.
5. Il indique la source facultative.
6. Il enregistre.
7. L’aliment est disponible dans son catalogue personnel.

## 34. Création d’un repas réutilisable

1. L’utilisateur sélectionne plusieurs aliments.
2. Il choisit Enregistrer comme repas.
3. Il donne un nom.
4. Il définit le nombre de portions.
5. Il enregistre.
6. Le repas peut être ajouté rapidement à une autre date.

## 35. Enregistrement du poids

1. L’utilisateur ouvre Suivi du poids.
2. Il saisit une mesure.
3. Il sélectionne la date.
4. Il ajoute une note facultative.
5. La mesure est enregistrée.
6. La tendance est recalculée.

Une mesure isolée ne doit pas être interprétée comme une évolution durable.

## 36. Activation des notifications

1. L’utilisateur ouvre Paramètres.
2. Il consulte les catégories de notifications.
3. Il active une catégorie.
4. L’application explique l’utilité.
5. Elle demande la permission système.
6. Si la permission est accordée, un abonnement est créé.
7. L’utilisateur définit ses horaires silencieux.
8. Il peut tester la notification.

La permission ne doit pas être demandée dès la première ouverture sans contexte.

## 37. Demande de création de programme par IA

1. L’utilisateur ouvre Coach IA.
2. Il choisit Créer un programme.
3. Il renseigne :

   * objectif ;
   * fréquence ;
   * durée ;
   * équipement ;
   * préférences ;
   * restrictions.
4. L’application affiche les données qui seront envoyées.
5. L’utilisateur confirme.
6. Le backend construit un contexte minimal.
7. L’IA renvoie une réponse structurée.
8. Le backend valide la réponse.
9. L’application affiche :

   * programme ;
   * hypothèses ;
   * explications ;
   * avertissements.
10. L’utilisateur peut modifier.
11. Il confirme l’enregistrement.
12. Le programme est créé.

## 38. Demande d’analyse par IA

1. L’utilisateur choisit Analyser ma progression.
2. Il sélectionne une période et des exercices.
3. Il confirme les données utilisées.
4. L’IA produit une analyse.
5. Le backend vérifie le format.
6. L’application affiche les tendances et hypothèses.
7. Les suggestions ne sont pas appliquées automatiquement.

## 39. Export des données

1. L’utilisateur ouvre Confidentialité et données.
2. Il demande un export.
3. L’application prépare les données.
4. Le fichier contient un format versionné.
5. L’utilisateur télécharge l’archive.
6. L’opération peut être journalisée.

## 40. Suppression du compte

1. L’utilisateur ouvre les paramètres du compte.
2. Il choisit Supprimer mon compte.
3. Les conséquences sont expliquées.
4. Une nouvelle authentification est demandée.
5. L’utilisateur confirme.
6. Le compte peut passer en période de suppression différée.
7. Les sessions sont révoquées.
8. Les données sont supprimées ou anonymisées selon la politique.
9. Une confirmation est envoyée.

Une suppression ne doit jamais être déclenchée par un seul clic accidentel.
