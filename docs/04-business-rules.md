# Règles métier

## 1. Objectif de ce document

Ce document définit les règles métier indépendamment de l’interface et de la technologie utilisée.

Ces règles doivent être appliquées de manière cohérente :

- dans l’API ;
- dans les traitements WebSocket ;
- dans les calculs de progression ;
- dans les suggestions ;
- dans les validations ;
- dans les tests.

Le frontend peut reproduire certaines validations pour améliorer l’expérience utilisateur, mais le backend reste responsable de la validation définitive.

## 2. Principes généraux

### 2.1 Autorité du backend

Le backend est la source de vérité pour les données persistées.

Le frontend peut maintenir un état temporaire, mais il ne doit pas pouvoir contourner les règles métier.

### 2.2 Traçabilité

Une valeur affichée doit pouvoir être classée comme :

- saisie par l’utilisateur ;
- issue d’une séance enregistrée ;
- calculée par l’application ;
- estimée ;
- proposée par une IA ;
- importée depuis une source externe.

L’origine d’une valeur doit être conservée lorsqu’elle influence une décision importante.

### 2.3 Immuabilité historique

Les données d’une séance terminée ne doivent pas être modifiées par une évolution ultérieure :

- d’un exercice ;
- d’un programme ;
- d’un modèle de séance ;
- d’une règle de calcul ;
- d’un objectif utilisateur.

Une séance conserve un snapshot des éléments nécessaires à son interprétation.

### 2.4 Archivage

Une entité utilisée dans un historique doit généralement être archivée plutôt que supprimée.

Cela concerne notamment :

- exercices ;
- équipements ;
- programmes ;
- séances modèles ;
- aliments ;
- recettes.

## 3. Utilisateurs, dates et unités

### 3.1 Propriété des données

Chaque donnée personnelle possède un propriétaire explicite.

Un utilisateur ne peut consulter ou modifier une donnée appartenant à un autre utilisateur que dans les cas prévus :

- séance partagée ;
- invitation ;
- fonctionnalité administrative autorisée ;
- partage explicite futur.

### 3.2 Dates

Les timestamps sont enregistrés en UTC.

La timezone utilisateur sert à déterminer :

- le jour local d’une séance ;
- le jour d’un repas ;
- le jour d’une mesure ;
- le déclenchement des rappels ;
- les statistiques quotidiennes.

Une date locale ne doit pas être reconstruite uniquement à partir de la timezone actuelle de l’appareil.

### 3.3 Unités canoniques

Les valeurs sont enregistrées dans des unités canoniques.

Première version :

- poids : kilogrammes ;
- distance : mètres ;
- durée : secondes ;
- énergie : kilocalories ;
- taille : centimètres.

Les conversions d’affichage ne modifient pas les valeurs enregistrées.

### 3.4 Précision

Les poids peuvent être enregistrés avec une précision décimale adaptée aux équipements.

La base de données ne doit pas utiliser un type flottant imprécis pour les valeurs nécessitant une cohérence stricte.

## 4. Exercices

### 4.1 Types d’exercice

Les modes de mesure initiaux sont :

- `WEIGHT_REPS` : charge externe et répétitions ;
- `BODYWEIGHT_REPS` : poids du corps et répétitions ;
- `ASSISTED_BODYWEIGHT_REPS` : assistance et répétitions ;
- `REPS_ONLY` : répétitions sans charge enregistrée ;
- `DURATION` : durée ;
- `DISTANCE_DURATION` : distance et durée ;
- `WEIGHT_DURATION` : charge et durée.

### 4.2 Groupes musculaires

Un exercice possède :

- un groupe musculaire principal ;
- zéro ou plusieurs groupes musculaires secondaires.

Les groupes musculaires servent à la recherche, à l’affichage et à certaines analyses.

Ils ne doivent pas être utilisés seuls pour produire des recommandations médicales ou biomécaniques.

### 4.3 Source

Un exercice est :

- `SYSTEM` : géré par l’application ;
- `USER` : créé par un utilisateur.

Un utilisateur standard ne peut modifier que ses exercices personnels.

### 4.4 Archivage

Un exercice archivé :

- n’apparaît plus par défaut dans les sélecteurs ;
- reste visible dans les séances passées ;
- peut être restauré ;
- ne doit pas être supprimé si des performances y sont liées.

### 4.5 Remplacement

Lorsqu’un exercice est remplacé pendant une séance, le remplacement ne change pas automatiquement le modèle d’origine.

L’utilisateur peut choisir, après la séance, de reporter le changement dans le modèle.

## 5. Équipements et charges disponibles

### 5.1 Équipement générique ou spécifique

Un équipement peut représenter :

- une catégorie générique, comme une barre ou des haltères ;
- une machine particulière d’une salle ;
- un équipement personnel.

### 5.2 Configuration des charges

Un équipement peut définir :

- une charge minimale ;
- une charge maximale ;
- un incrément régulier ;
- une liste explicite de charges disponibles ;
- une charge de base ;
- une unité d’affichage.

### 5.3 Arrondi

Une charge suggérée doit être arrondie vers une valeur réellement disponible.

Le système d’arrondi doit être déterministe.

Lorsque deux valeurs disponibles sont aussi proches, l’application privilégie par défaut la valeur inférieure, sauf règle explicitement configurée.

### 5.4 Machines différentes

Deux machines destinées au même mouvement peuvent produire des sensations et valeurs différentes.

Les performances doivent pouvoir être associées à un équipement précis.

Une charge utilisée sur une machine ne doit pas être comparée automatiquement à une autre machine comme s’il s’agissait de la même mesure.

## 6. Maximal et référence de performance

### 6.1 Types de maximum

L’application distingue :

- `DECLARED_ONE_REP_MAX` : maximum déclaré par l’utilisateur ;
- `ESTIMATED_ONE_REP_MAX` : estimation calculée ;
- `OBSERVED_MAX_WEIGHT` : charge maximale réellement enregistrée ;
- `TRAINING_MAX` : valeur de travail volontairement inférieure au maximum ;
- `MACHINE_REFERENCE_MAX` : référence propre à une machine.

### 6.2 Sécurité

L’application ne doit pas obliger l’utilisateur à tester une répétition maximale.

Elle doit permettre de définir une référence à partir :

- d’une saisie volontaire ;
- d’une série sous-maximale ;
- de performances historiques ;
- d’un maximum de travail prudent.

### 6.3 Max par équipement

Une référence maximale est liée à la combinaison :

```text
utilisateur + exercice + équipement
```

Lorsque l’équipement n’a pas d’importance, `equipmentId` peut rester vide.

### 6.4 Expiration de la référence

Une référence ne doit pas nécessairement être considérée comme permanente.

Elle peut comporter :

- une date d’évaluation ;
- une source ;
- un niveau de confiance ;
- une date de dernière confirmation.

## 7. Séries planifiées

Une série planifiée peut contenir :

- type de série ;
- charge cible ;
- pourcentage d’intensité ;
- répétitions minimales ;
- répétitions maximales ;
- durée cible ;
- distance cible ;
- RIR cible ;
- RPE cible ;
- repos ;
- note.

Types initiaux :

- `WARMUP` ;
- `WORKING` ;
- `BACKOFF` ;
- `DROP_SET` ;
- `AMRAP`;
- `FAILURE_OPTIONAL`.

L’application ne doit pas considérer toutes les séries comme des séries de travail équivalentes.

## 8. Séries réalisées

### 8.1 Données réelles

Une série réalisée conserve les valeurs réellement déclarées :

- charge ;
- répétitions ;
- durée ;
- distance ;
- RIR ;
- RPE ;
- statut ;
- note ;
- heure de réalisation.

La cible planifiée reste disponible séparément.

### 8.2 Statuts

Les statuts initiaux sont :

- `COMPLETED` : série terminée et considérée comme satisfaisante ;
- `PARTIAL` : série effectuée partiellement ;
- `FAILED` : série interrompue ou cible clairement manquée ;
- `SKIPPED` : série non réalisée ;
- `CANCELLED` : série annulée à la suite d’une modification de séance.

### 8.3 Validation minimale

Une série doit respecter le type de mesure de l’exercice.

Exemples :

- `WEIGHT_REPS` exige des répétitions et accepte une charge ;
- `DURATION` exige une durée ;
- `DISTANCE_DURATION` exige au moins une distance ou une durée selon la configuration ;
- `REPS_ONLY` ne doit pas exiger de charge.

### 8.4 Série à l’échec

Une série peut indiquer que l’utilisateur est allé à l’échec.

Cette information est distincte du statut.

Une série à l’échec peut être :

- terminée avec la cible atteinte ;
- partielle ;
- échouée.

L’application ne doit pas encourager systématiquement l’entraînement à l’échec.

## 9. RIR et RPE

### 9.1 RIR

Le RIR représente le nombre estimé de répétitions supplémentaires qui auraient pu être effectuées.

La valeur initiale autorisée est comprise entre 0 et 10.

### 9.2 RPE

Le RPE représente la difficulté perçue.

La première version utilise une échelle de 1 à 10.

### 9.3 Préférence utilisateur

Un utilisateur peut choisir :

- RIR ;
- RPE ;
- aucun des deux.

Les deux champs peuvent exister dans le modèle, mais l’interface ne doit pas obliger à saisir les deux.

### 9.4 Caractère subjectif

RIR et RPE sont des évaluations subjectives.

Ils peuvent guider une suggestion mais ne doivent pas être traités comme des mesures parfaitement précises.

## 10. Volume d’entraînement

### 10.1 Série avec charge

Pour une série compatible :

```text
volume = charge × répétitions
```

### 10.2 Volume total

```text
volume total = somme des volumes des séries compatibles
```

### 10.3 Séries exclues

Par défaut, le calcul principal peut exclure :

- séries ignorées ;
- séries annulées ;
- séries sans charge ou répétitions valides.

Les séries d’échauffement peuvent être incluses dans un volume total détaillé mais séparées du volume de travail.

### 10.4 Poids du corps

Le volume des exercices au poids du corps ne doit pas être comparé directement au volume des exercices avec charge externe sans convention explicite.

Une analyse dédiée peut utiliser :

- nombre de répétitions ;
- difficulté ;
- assistance ;
- charge additionnelle ;
- poids corporel enregistré à la date de la séance.

## 11. Estimation du 1RM

### 11.1 Principe

Le 1RM estimé est une approximation calculée depuis une série enregistrée.

L’application doit afficher le terme :

```text
1RM estimé
```

Elle ne doit pas présenter cette valeur comme un maximum réellement testé.

### 11.2 Conditions

Une estimation peut être calculée lorsque :

- l’exercice est compatible ;
- la charge est positive ;
- les répétitions sont positives ;
- la série n’est pas ignorée ou annulée ;
- le nombre de répétitions reste dans une plage configurée.

### 11.3 Formule

La formule utilisée doit être :

- explicitement choisie ;
- testée ;
- centralisée ;
- versionnée si elle change.

Une évolution de formule ne doit pas modifier silencieusement l’interprétation des anciennes données.

L’application peut recalculer les valeurs d’affichage avec la formule actuelle, mais elle doit pouvoir identifier la stratégie utilisée.

### 11.4 Plusieurs estimations

Lorsque plusieurs séries sont disponibles, l’application peut retenir :

- la meilleure estimation valide ;
- la moyenne d’un sous-ensemble cohérent ;
- une valeur lissée.

La stratégie doit être déterministe et documentée.

## 12. Objectifs d’entraînement

Objectifs initiaux :

- `ENDURANCE` ;
- `HYPERTROPHY` ;
- `STRENGTH` ;
- `GENERAL_FITNESS`.

Les plages de répétitions, intensités et repos associées à ces objectifs sont des paramètres configurables.

Elles ne doivent pas être dispersées sous forme de nombres codés en dur dans plusieurs composants.

## 13. Suggestions de charge

### 13.1 Données utilisables

Une suggestion de charge peut utiliser :

- dernière charge ;
- répétitions réalisées ;
- plage cible ;
- statut des séries ;
- RIR ou RPE ;
- historique récent ;
- référence maximale ;
- incréments disponibles ;
- objectif ;
- équipement.

### 13.2 Proposition, pas application

Une suggestion ne modifie pas automatiquement :

- la prochaine séance ;
- le programme ;
- le maximum de référence.

L’utilisateur doit confirmer.

### 13.3 Moteur déterministe (jalon 5.1)

Le premier moteur de coaching est **déterministe**, **explicable** et **conservateur**.

Principes :

- calcul serveur à la lecture — **aucune table** `LoadRecommendation` / historique d’acceptation ;
- aucune IA, aucun prompt, aucun score opaque ;
- uniquement `measurementType = WEIGHT_REPS` (snapshot historique `WEIGHT_REPS`) ;
- contexte principal : `WorkoutTemplateExercise` (séries cibles du modèle) ;
- séances éligibles : `status = COMPLETED` uniquement (max **3** plus récentes) ;
- `sourceExerciseId` non null ; warmups exclus ; base = séries `WORKING` ;
- équipement : même identité stable que records / progression ; sinon `REVIEW` ;
- RIR / RPE facultatifs (tolérance ±1) ; mode `NONE` autorise une décision sur reps/statuts ;
- incrément : préférence exercice si disponible, sinon `DEFAULT_LOAD_INCREMENT_KG = 2.5` avec `incrementSource = SYSTEM_DEFAULT`.

Actions :

| Action | Sens |
|--------|------|
| `INCREASE` | Toutes les séries de travail évaluables de la dernière séance au sommet (ou au-dessus) de la plage, sans `PARTIAL`/`FAILED`, effort non excessif |
| `HOLD` | Performance compatible sans justifier une hausse ; une seule mauvaise séance ne baisse pas |
| `DECREASE` | Au moins **2** séances consécutives comparables sous-performantes |
| `INSUFFICIENT_DATA` | Pas d’historique, pas de working sets, pas de charge/plage cible |
| `REVIEW` | Données présentes mais configuration ambiguë (cibles hétérogènes, équipement, charge historique incompatible) |

Suggestions numériques :

- `INCREASE` : `current + increment` ;
- `DECREASE` : `max(current − 2 × increment, increment)` (> 0) ;
- `HOLD` : charge actuelle ;
- `REVIEW` / `INSUFFICIENT_DATA` : `suggestedWeightKg = null`.

L’application d’une recommandation au modèle est **hors 5.1** (voir 13.3bis).

### 13.3bis Décision utilisateur (jalon 5.2)

Le moteur **propose** ; l’utilisateur **décide** ; le serveur **valide**.

Aucun changement de charge sans action explicite. Pas de mode auto-apply / progression automatique.

#### Décisions

| Décision | Sens |
|----------|------|
| `ACCEPTED` | Appliquer exactement la proposition recalculée (ou conserver la charge si `HOLD`) |
| `ADJUSTED` | Accepter le principe, choisir une autre charge (`adjustedWeightKg` obligatoire) |
| `IGNORED` | Ne rien appliquer (`appliedWeightKg = null`) |

Autorisées selon l’action 5.1 :

- `INCREASE` / `HOLD` / `DECREASE` → `ACCEPTED` | `ADJUSTED` | `IGNORED` ;
- `REVIEW` / `INSUFFICIENT_DATA` → `IGNORED` uniquement (ou aucune action UI).

#### Fingerprint et staleness

Chaque recommandation porte `engineVersion = LOAD_RECOMMENDATION_V1` et un
`recommendationFingerprint` déterministe (cible, équipement, action, suggestion,
historique utilisé…). À la décision, le serveur recalcule et compare. Écart →
`409 LOAD_RECOMMENDATION_STALE` — aucune mutation.

#### Application

- Uniquement `targetWeightKg` des séries `WORKING` du groupe analysé.
- Ne modifie pas warmups, backoff, reps, RIR/RPE, repos, nombre de séries.
- Transaction : ownership + recalcul + fingerprint + idempotence + validation +
  updates + création `LoadRecommendationDecision`.
- Snapshots de séances déjà créées (actives ou historiques) **immuables**.

#### Idempotence

`clientCommandId` unique par propriétaire + `payloadFingerprint`. Même commande /
même payload → replay. Payload différent → `LOAD_RECOMMENDATION_COMMAND_CONFLICT`.

### 13.3ter Plateau / stagnation (jalon 5.3)

Le moteur **détecte** ; il ne **prescrit** pas.

Principes :

- lecture seule, **aucune** table `PlateauDetection` / `StagnationAlert` ;
- uniquement `WEIGHT_REPS` ; autres types → `supported: false` ;
- regroupement par `WorkoutSessionExercise.sourceExerciseId` (jamais par nom) ;
- `sourceExerciseId = null` exclu ; séances `COMPLETED` uniquement ;
- séries `WORKING` + statuts `COMPLETED` / `PARTIAL` / `FAILED` ; warmups exclus ;
- fenêtre max `PLATEAU_HISTORY_LIMIT = 6` ; minimum 3 séances pour un signal ;
- équipement : même identité snapshotée que records / progression / 5.1 ;
- cibles : snapshots historiques (pas le template courant) ;
- e1RM : Epley V1 (règles 4.5) ; tolérance progression `E1RM_PROGRESS_TOLERANCE_PERCENT = 1` ;
- charge : progression si hausse ≥ `LOAD_PROGRESS_TOLERANCE_KG = 1` (ou incrément réel) ;
- pas de score opaque.

Statuts :

| Statut | Sens |
|--------|------|
| `NONE` | Pas de signal notable (ou progression récente) |
| `WATCH` | ≥ 3 séances comparables sans hausse charge/e1RM + signal secondaire |
| `PLATEAU` | ≥ 4 séances sans hausse charge/e1RM + (reps stagnantes / cible haute jamais atteinte / misses / échecs / effort élevé) |
| `INSUFFICIENT_DATA` | Historique insuffisant |
| `REVIEW` | Équipement ou cibles incompatibles |

Indépendant de 5.1/5.2 : un `PLATEAU` n’altère pas `INCREASE`/`HOLD`/`DECREASE`.

### 13.3quater Coach déterministe (jalon 5.4)

Le Coach **explique** ; il ne **décide** pas et n’**applique** rien.

```text
données → métriques → moteurs 4.x/5.1/5.2/5.3 → Coach explicatif → future LLM
```

- Aucun LLM / prompt / OpenAI.
- Aucune table `CoachSummary` / `CoachInsight`.
- Statut UI dérivé (priorité : REVIEW > PLATEAU > WATCH > PROGRESSING > STABLE > BUILDING_HISTORY > NO_DATA).
- HOLD 5.1 ne devient pas WATCH sans signal plateau.
- Actions = navigation uniquement (`VIEW_*`), jamais de mutation.

### 13.3quinquies Coach IA explicatif (jalon 5.5)

```text
métriques déterministes
→ ExerciseCoachSummary (5.4)
→ AiCoachExplanationInput V1
→ provider LLM
→ validation structurée
→ UI (distincte du résumé déterministe)
```

- L’IA **explique / reformule** ; elle ne **calcule** pas et ne **décide** pas.
- Aucun prompt libre utilisateur ; aucun outil de mutation.
- Si `AI_COACH_ENABLED=false` ou fournisseur indisponible : Coach 5.4 seul.
- Aucune table `AiExplanation` / persistance du texte généré.
- Rate limit + timeout côté serveur ; erreurs contrôlées (`AI_COACH_*`).

### 13.3sexies Chat Coach multi-tour (jalon 5.6)

```text
message utilisateur
→ LLM
→ outils READ ONLY allowlistés
→ services déterministes
→ réponse structurée
```

- Tables `AiCoachConversation` / `AiCoachMessage` / `AiCoachToolInvocation`.
- Aucun outil `update/create/delete/apply_*`.
- `ownerUserId` toujours injecté depuis le JWT ; IDs étrangers → inaccessible.
- Texte utilisateur = contenu non fiable ; permissions définies par le registre, pas le prompt.

### 13.4 Cas de progression

Une augmentation peut être proposée lorsqu’un utilisateur réussit de manière répétée les séries prévues avec une marge suffisante.

### 13.5 Cas de maintien

Le maintien peut être proposé lorsque :

- les séries sont réussies avec difficulté ;
- les données sont insuffisantes ;
- la performance est irrégulière.

### 13.6 Cas de diminution

Une diminution peut être proposée lorsque :

- plusieurs séries sont échouées ;
- la cible est régulièrement manquée ;
- le RPE déclaré est très élevé ;
- le RIR est inférieur à la cible ;
- l’utilisateur demande une séance plus légère.

La diminution ne doit pas être présentée comme une sanction.
En 5.1, une baisse exige au minimum deux séances consécutives comparables sous-performantes.

## 14. Records personnels

### 14.1 Types initiaux

- charge maximale ;
- nombre maximal de répétitions ;
- répétitions maximales à une charge donnée ;
- meilleur volume sur une série ;
- meilleur volume sur une séance ;
- meilleur 1RM estimé ;
- meilleure durée ;
- meilleure distance ;
- meilleur rythme lorsque pertinent.

### 14.2 Source

Un record est calculé à partir d’une performance persistée.

Une simple cible ou suggestion ne crée pas un record.

### 14.3 Équipement

Les records peuvent être séparés par équipement lorsque la comparaison entre machines n’est pas pertinente.

### 14.4 Corrections

Lorsqu’une performance est corrigée, les records dépendants doivent être recalculés.

## 15. Programmes et modèles

### 15.1 Programme actif

Un utilisateur peut posséder plusieurs programmes, mais un seul programme principal actif dans la première version.

Il peut néanmoins lancer une séance depuis un autre programme.

### 15.2 Snapshot

Au lancement d’une séance, l’application copie les informations nécessaires du modèle.

Le snapshot contient notamment :

- ordre des exercices ;
- cibles ;
- temps de repos ;
- notes ;
- équipement préféré.

### 15.3 Modification du modèle

Une modification du modèle n’affecte pas :

- les séances terminées ;
- la séance active ;
- les séances déjà créées sous forme de snapshot.

## 16. Séance active

### 16.1 Nombre de séances actives

La première version autorise une seule séance active individuelle par utilisateur.

Une séance partagée active peut être traitée comme cette séance active.

### 16.2 États

États initiaux :

- `PLANNED` ;
- `ACTIVE` ;
- `PAUSED` ;
- `COMPLETED` ;
- `CANCELLED`.

### 16.3 Fin

Une séance terminée doit comporter :

- une date de début ;
- une date de fin ;
- au moins une trace d’activité ou une confirmation explicite de séance vide ;
- un propriétaire ;
- un statut final.

### 16.4 Annulation

Une séance annulée peut conserver ses données selon le choix utilisateur.

Le statut final doit permettre de la distinguer d’une séance terminée.

## 17. Fonctionnement hors ligne

### 17.1 Identifiant de commande

Chaque action hors ligne persistable reçoit un `clientCommandId` unique.

### 17.2 File locale

Une commande locale peut être :

- `PENDING` ;
- `SENDING` ;
- `CONFIRMED` ;
- `FAILED` ;
- `CONFLICT`.

### 17.3 Idempotence

Le serveur conserve suffisamment d’informations pour ne pas appliquer deux fois une même commande.

### 17.4 Conflit

Un conflit peut apparaître lorsque :

- la même série a été modifiée ailleurs ;
- la séance a été terminée depuis un autre appareil ;
- l’exercice a été supprimé de la séance ;
- la version serveur a évolué de façon incompatible.

Le conflit ne doit pas être résolu silencieusement en supprimant les données locales.

## 18. Séances partagées

### 18.1 Rôles

Rôles initiaux :

- `HOST` ;
- `PARTICIPANT`.

Un rôle `OBSERVER` pourra être ajouté plus tard.

### 18.2 Autorité

Le serveur possède l’état autoritaire de la salle.

Le frontend affiche une représentation de cet état.

### 18.3 Capacité

La première version accepte de deux à cinq participants.

La limite doit rester configurable.

### 18.4 Propriété des performances

Chaque performance appartient au participant qui l’a réalisée.

L’hôte ne peut pas modifier silencieusement les performances d’un autre utilisateur.

### 18.5 État de participant

États initiaux :

- `INVITED` ;
- `JOINED` ;
- `READY` ;
- `ACTIVE` ;
- `TEMPORARILY_DISCONNECTED` ;
- `PAUSED` ;
- `FINISHED` ;
- `LEFT`;
- `REMOVED`.

### 18.6 Délai de reconnexion

Une perte de connexion ne fait pas quitter immédiatement le participant.

Le serveur applique un délai de grâce configurable.

## 19. Rotation sur les équipements

### 19.1 Entrées de l’algorithme

La rotation utilise :

- participants actifs ;
- exercices prévus ;
- équipements disponibles ;
- compatibilités ;
- ordre souhaité ;
- progression de chaque participant ;
- stations occupées ;
- restrictions déclarées ;
- durée cible facultative.

### 19.2 Sortie

Pour chaque participant, la rotation indique :

- station actuelle ;
- exercice ;
- équipement ;
- série à réaliser ;
- charge ou cible personnelle ;
- prochaine station éventuelle ;
- statut d’attente éventuel.

### 19.3 Déterminisme

Pour une même entrée et une même version d’algorithme, le résultat doit être reproductible.

### 19.4 Objectifs

L’algorithme cherche à :

1. éviter qu’une même station soit attribuée à plusieurs personnes simultanément ;
2. limiter l’attente ;
3. respecter autant que possible l’ordre des exercices ;
4. éviter des changements inutiles ;
5. conserver une progression compréhensible.

### 19.5 Priorité à la cohérence

L’optimisation parfaite n’est pas exigée pour la première version.

Une rotation stable et compréhensible est préférable à une rotation mathématiquement optimale mais imprévisible.

### 19.6 Modification manuelle

L’hôte peut déplacer un participant vers une autre station.

Cette action crée une nouvelle version de l’état.

## 20. Commandes WebSocket

### 20.1 Structure

Toute commande critique contient :

- `commandId` ;
- `roomId` ;
- `expectedVersion` ;
- payload métier ;
- timestamp client informatif.

### 20.2 Version

Le serveur compare `expectedVersion` à la version actuelle.

Il peut :

- accepter ;
- accepter en réconciliant ;
- refuser pour conflit ;
- refuser pour autorisation ;
- refuser pour validation.

### 20.3 Accusé de réception

L’accusé contient au minimum :

- `commandId` ;
- résultat ;
- version serveur ;
- code d’erreur éventuel.

### 20.4 Snapshot

À la reconnexion, le serveur transmet un snapshot complet plutôt qu’une suite supposée exhaustive d’événements manqués.

## 21. Fin d’une séance partagée

### 21.1 Déclenchement

La séance peut être terminée :

- par l’hôte ;
- automatiquement lorsque tous les participants ont terminé, avec confirmation ;
- par une procédure administrative exceptionnelle.

### 21.2 Persistance

Les performances de chaque participant sont intégrées à son historique personnel.

La salle terminée devient en lecture seule.

### 21.3 Résumés

Chaque participant reçoit son résumé individuel.

Un résumé partagé peut afficher :

- durée totale ;
- exercices réalisés ;
- nombre total de séries ;
- participants ;
- records personnels, visibles uniquement par leur propriétaire sauf choix de partage.

## 22. Nutrition

### 22.1 Valeurs nutritionnelles

Une portion alimentaire peut contenir :

- calories ;
- protéines ;
- glucides ;
- lipides ;
- fibres facultatives ;
- sel facultatif.

Les valeurs proviennent d’une portion de référence.

### 22.2 Source

Sources initiales :

- `SYSTEM` ;
- `USER` ;
- `EXTERNAL`.

### 22.3 Calcul d’une portion

Les valeurs consommées sont calculées proportionnellement à la quantité.

Les arrondis d’affichage ne doivent pas modifier le calcul stocké.

### 22.4 Repas

Types initiaux :

- `BREAKFAST` ;
- `LUNCH` ;
- `DINNER` ;
- `SNACK` ;
- `OTHER`.

### 22.5 Objectifs

Un objectif nutritionnel est historisé avec une date de début.

Une modification ne doit pas réécrire l’objectif des jours précédents.

## 23. Calories dépensées

### 23.1 Estimation

Les calories dépensées pendant une séance sont des estimations.

Elles peuvent dépendre de données telles que :

- durée ;
- poids corporel ;
- type d’activité ;
- intensité déclarée.

### 23.2 Présentation

L’application affiche séparément :

- objectif alimentaire ;
- calories consommées ;
- calories sportives estimées ;
- écart alimentaire ;
- balance énergétique estimée facultative.

### 23.3 Absence de compensation automatique

La totalité de la dépense sportive estimée ne doit pas être ajoutée automatiquement à l’objectif alimentaire.

Une stratégie de compensation future doit être :

- explicitement activée ;
- configurable ;
- expliquée ;
- plafonnée si nécessaire.

### 23.4 Incertitude

L’interface doit rappeler que la dépense réelle peut différer de l’estimation.

## 24. Mesures corporelles

### 24.1 Poids

Une mesure de poids contient :

- valeur ;
- date et heure ;
- source ;
- note facultative.

### 24.2 Tendance

Une tendance doit utiliser plusieurs mesures.

Une valeur isolée ne suffit pas à conclure à une progression ou régression.

### 24.3 Suppression

Une mesure erronée peut être supprimée ou corrigée par son propriétaire.

## 25. Notifications

### 25.1 Consentement

Chaque utilisateur doit consentir aux notifications.

### 25.2 Catégories

Catégories initiales :

- séance planifiée ;
- fin de repos ;
- invitation ;
- début d’une séance partagée ;
- changement de station ;
- rappel nutritionnel ;
- sécurité du compte.

### 25.3 Horaires silencieux

Les notifications non critiques respectent les horaires silencieux.

### 25.4 Données sensibles

Le contenu affiché sur l’écran verrouillé doit rester discret par défaut.

## 26. Intelligence artificielle

### 26.1 Statut d’une réponse

Une réponse IA possède un statut :

- `GENERATING` ;
- `VALID` ;
- `INVALID` ;
- `ACCEPTED` ;
- `REJECTED` ;
- `EXPIRED`.

### 26.2 Validation

Une proposition doit respecter :

- les schémas techniques ;
- les limites de valeurs ;
- les exercices disponibles ;
- les équipements ;
- les restrictions ;
- le périmètre de la demande.

### 26.3 Confirmation

Une proposition acceptée peut créer ou modifier une entité.

Une proposition non acceptée ne modifie aucune donnée métier.

### 26.4 Explicabilité

Une proposition doit contenir une explication synthétique de ses choix.

Cette explication ne remplace pas les données structurées.

### 26.5 Restrictions

Une réponse doit être refusée ou neutralisée lorsqu’elle contient :

- un diagnostic ;
- une prescription médicale ;
- une recommandation de produit dopant ;
- une charge ou un volume manifestement hors limites ;
- une contradiction avec une restriction ;
- une instruction dangereuse ;
- une entité inconnue inexploitable.

## 27. Suppression du compte

### 27.1 Réauthentification

La suppression nécessite une vérification récente de l’identité.

### 27.2 Sessions

Toutes les sessions sont révoquées.

### 27.3 Données

Les données personnelles sont supprimées ou anonymisées selon la politique de conservation.

### 27.4 Séances partagées

Les données nécessaires à l’intégrité de l’historique des autres participants peuvent être anonymisées plutôt que supprimées intégralement.

## 28. Versionnement des règles

Les éléments suivants doivent posséder une version explicite lorsqu’ils peuvent modifier les résultats :

- formule de 1RM ;
- algorithme de rotation ;
- calcul de calories sportives ;
- schéma d’import/export ;
- schéma de réponse IA ;
- stratégie de progression.

Ce versionnement permet de comprendre pourquoi une ancienne valeur diffère d’un calcul plus récent.
