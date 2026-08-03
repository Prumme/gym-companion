# Vision produit

## 1. Présentation

Gym Companion est une application mobile-first dédiée au suivi des entraînements, de la nutrition et des séances de sport partagées.

Elle est conçue en priorité pour une utilisation sur téléphone pendant une séance de musculation.

L’application doit permettre à un utilisateur de :

- préparer ses programmes ;
- lancer une séance ;
- connaître les exercices à réaliser ;
- retrouver ses charges précédentes ;
- enregistrer ses séries ;
- indiquer s’il a atteint sa cible ;
- suivre sa progression ;
- consulter ses records ;
- gérer ses apports alimentaires.

Elle doit également permettre à plusieurs utilisateurs de réaliser une séance commune en organisant leur rotation sur les équipements disponibles.

## 2. Problème traité

Les applications de suivi de musculation existantes répondent généralement correctement au suivi individuel, mais elles gèrent moins bien les entraînements à plusieurs.

Lorsqu’un groupe s’entraîne ensemble, plusieurs problèmes apparaissent :

- chacun possède un niveau différent ;
- chacun utilise une charge différente ;
- les objectifs peuvent être différents ;
- les temps de repos ne sont pas identiques ;
- plusieurs utilisateurs attendent parfois la même machine ;
- l’ordre de passage devient confus ;
- les participants oublient les charges utilisées précédemment ;
- les changements improvisés sont rarement enregistrés ;
- les performances individuelles sont difficiles à suivre dans une séance commune.

Gym Companion doit réduire ces frictions.

## 3. Proposition de valeur

### 3.1 Pour une séance individuelle

L’utilisateur peut :

- préparer ses programmes ;
- consulter sa séance du jour ;
- démarrer rapidement une séance ;
- voir sa dernière performance sur chaque exercice ;
- obtenir une charge cible ;
- consulter une plage de répétitions ;
- enregistrer la performance réelle ;
- indiquer son niveau d’effort ;
- lancer un chronomètre de repos ;
- suivre sa progression sur plusieurs semaines.

### 3.2 Pour une séance partagée

Un groupe peut :

- créer une salle privée ;
- rejoindre la séance par lien ou code ;
- sélectionner les équipements disponibles ;
- utiliser un programme commun ;
- conserver des charges adaptées à chaque personne ;
- organiser une rotation entre les machines ;
- voir qui utilise quelle station ;
- enregistrer les performances en temps réel ;
- retrouver un état cohérent après une perte de connexion ;
- obtenir un résumé commun à la fin de la séance.

### 3.3 Pour la nutrition

L’utilisateur peut :

- définir un objectif calorique ;
- enregistrer ses repas ;
- suivre les protéines, glucides et lipides ;
- créer des aliments personnalisés ;
- enregistrer des repas réutilisables ;
- suivre son poids ;
- comparer les apports sur plusieurs jours ;
- consulter séparément la dépense sportive estimée.

### 3.4 Pour l’assistance intelligente

L’application pourra proposer :

- un programme d’entraînement ;
- une séance adaptée à un objectif ;
- une modification de charge ;
- une diminution temporaire de difficulté ;
- une variation d’exercice ;
- une analyse de progression ;
- une explication des recommandations.

L’intelligence artificielle ne doit pas remplacer les calculs métier ou la décision de l’utilisateur.

## 4. Utilisateurs cibles

### Cible principale

Adultes pratiquant la musculation en salle, seuls ou avec un petit groupe d’amis.

Ils souhaitent suivre leurs performances sans passer une partie importante de la séance à configurer l’application.

### Cibles secondaires

- Débutants ayant besoin d’un cadre.
- Utilisateurs intermédiaires souhaitant mesurer leur progression.
- Groupes de deux à cinq personnes.
- Utilisateurs souhaitant réunir entraînement et nutrition.
- Développeurs ou sportifs souhaitant héberger leur propre instance à terme.

## 5. Cas d’usage principal

Trois amis arrivent dans une salle de sport.

Ils créent une séance partagée et indiquent les machines disponibles.

L’application connaît leurs performances précédentes et leurs objectifs.

Elle propose une rotation :

```text
Participant A
Station actuelle : développé couché
Charge cible : 75 kg
Objectif : 8 répétitions

Participant B
Station actuelle : tirage horizontal
Charge cible : 45 kg
Objectif : 10 répétitions

Participant C
Station actuelle : presse à cuisses
Charge cible : 110 kg
Objectif : 12 répétitions
```

Chaque participant enregistre sa série depuis son téléphone.

Lorsque la rotation change, les utilisateurs voient leur prochaine station et leur charge personnelle.

À la fin de la séance, chacun retrouve ses données dans son propre historique.

## 6. Différenciation

La principale différenciation du produit est la gestion d’une séance collaborative avec rotation sur les équipements.

Les autres axes différenciants sont :

- charges personnalisées dans une séance commune ;
- objectifs différents pour un même exercice ;
- suivi précis de chaque série ;
- reconnexion à une séance en cours ;
- fonctionnement PWA ;
- mode hors ligne pour les séances individuelles ;
- propositions basées sur l’historique ;
- transparence concernant les estimations ;
- interface conçue spécifiquement pour l’usage en salle.

## 7. Principes produit

### 7.1 Rapidité

Les actions les plus fréquentes doivent être très rapides.

Enregistrer une série ne doit pas nécessiter de naviguer entre plusieurs pages.

### 7.2 Mobile-first

La majorité des fonctionnalités doit être conçue d’abord pour un écran de téléphone.

Les interfaces desktop peuvent enrichir l’analyse, mais ne doivent pas définir l’expérience principale.

### 7.3 Utilisation à une main

Pendant une séance, les boutons principaux doivent rester accessibles avec le pouce.

Les interactions doivent limiter la saisie de texte.

### 7.4 Continuité

Une perte temporaire de réseau ne doit pas provoquer la perte des données d’une séance individuelle.

Une séance partagée doit pouvoir retrouver un état cohérent après reconnexion.

### 7.5 Transparence

L’application doit distinguer :

- une valeur saisie ;
- une valeur mesurée ;
- une valeur calculée ;
- une estimation ;
- une suggestion fournie par une IA.

### 7.6 Contrôle utilisateur

Une recommandation ne doit jamais être appliquée automatiquement sans confirmation.

L’utilisateur peut modifier, ignorer ou refuser une proposition.

### 7.7 Sécurité avant performance

L’application ne doit pas encourager la réalisation de tests maximaux dangereux.

Elle doit privilégier les estimations obtenues à partir de séries contrôlées.

### 7.8 Encouragement sans culpabilisation

L’application peut valoriser les progrès, mais ne doit pas punir ou culpabiliser un utilisateur pour :

- une séance manquée ;
- une baisse de performance ;
- une série échouée ;
- un dépassement alimentaire ;
- une période d’arrêt.

## 8. Positionnement de l’IA

L’IA est utilisée comme assistant.

Elle peut interpréter les données et proposer une solution, mais elle n’est pas responsable de la logique métier.

Le code classique doit rester responsable de :

- calculer le volume ;
- calculer les records ;
- estimer le 1RM ;
- arrondir les charges ;
- vérifier les bornes ;
- contrôler les incompatibilités ;
- organiser une rotation déterministe ;
- calculer les calories et macronutriments ;
- valider les données.

L’IA intervient pour :

- proposer une combinaison d’exercices ;
- adapter une formulation ;
- expliquer une tendance ;
- suggérer un changement ;
- construire une première version de programme ;
- prendre en compte plusieurs préférences.

## 9. PWA et mobilité

Gym Companion est d’abord une application web installable.

La PWA doit permettre :

- l’installation sur l’écran d’accueil ;
- une ouverture sans interface de navigateur visible ;
- le cache du shell principal ;
- la consultation de certaines données récentes hors ligne ;
- la poursuite temporaire d’une séance individuelle ;
- la réception de notifications lorsque la plateforme le permet.

Une application native n’est pas nécessaire pour les premières versions.

Elle ne sera envisagée que si une fonctionnalité importante ne peut pas être proposée correctement via la PWA.

## 10. Données sensibles

Les données enregistrées peuvent inclure :

- poids corporel ;
- performances sportives ;
- habitudes alimentaires ;
- objectifs ;
- restrictions déclarées ;
- historique d’activité.

Ces données doivent être considérées comme personnelles et potentiellement sensibles.

Le produit doit :

- limiter leur collecte ;
- expliquer leur usage ;
- permettre leur export ;
- permettre leur suppression ;
- éviter leur exposition dans les logs ;
- limiter les données envoyées à des services tiers.

## 11. Non-objectifs initiaux

Les premières versions n’ont pas pour objectif de :

- remplacer un médecin ;
- remplacer un kinésithérapeute ;
- remplacer un diététicien ;
- établir un diagnostic ;
- créer un programme de rééducation ;
- analyser une blessure ;
- recommander des médicaments ou substances ;
- gérer les abonnements d’une salle de sport ;
- créer un réseau social public ;
- mettre en relation des inconnus ;
- fournir un coaching professionnel payant ;
- reconnaître automatiquement un repas depuis une photo ;
- gérer immédiatement toutes les montres connectées ;
- supporter des groupes très importants ;
- développer une application native iOS et Android.

## 12. Critères de réussite

Le produit peut être considéré comme réussi lorsque :

- une séance peut être lancée en moins d’une minute ;
- une série peut être enregistrée en quelques secondes ;
- l’utilisateur retrouve immédiatement sa charge précédente ;
- une série échouée peut être enregistrée sans difficulté ;
- les données d’une séance ne sont pas perdues après une coupure courte ;
- deux à cinq personnes peuvent terminer une séance commune ;
- la rotation réduit les temps d’attente ;
- les utilisateurs comprennent les valeurs affichées ;
- les estimations sont clairement identifiées ;
- l’application reste lisible sur un petit écran ;
- les données peuvent être exportées ;
- l’application reste utilisable sans abonnement commercial.

## 13. Vision à long terme

À long terme, Gym Companion peut devenir un compagnon personnel regroupant :

- entraînement ;
- progression ;
- nutrition ;
- récupération ;
- planification ;
- statistiques ;
- séances partagées ;
- recommandations.

Cette évolution doit rester progressive.

Le projet ne doit pas devenir une accumulation de fonctionnalités au détriment de la simplicité d’utilisation pendant une séance.
