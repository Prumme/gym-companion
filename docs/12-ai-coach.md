# Coach IA

## 1. Objectif de ce document

Ce document définit le rôle du coach IA dans Gym Companion.

Il précise :

- les cas d’usage autorisés ;
- les cas d’usage interdits ;
- les données pouvant être utilisées ;
- l’architecture du module IA ;
- la construction du contexte ;
- les formats de réponse ;
- la validation métier ;
- la confirmation utilisateur ;
- la gestion des erreurs ;
- la maîtrise des coûts ;
- la confidentialité ;
- les critères de test.

Le coach IA est un module facultatif.

**UX (UX-8)** : l’interface sépare clairement le Coach déterministe (recommandations /
plateau / résumé) de l’explication et du chat IA. L’IA n’est jamais présentée comme
la source d’une recommandation de charge. Voir `docs/07-ui-ux-guidelines.md` §28.

Son indisponibilité ne doit jamais bloquer :

- l’authentification ;
- la consultation des programmes ;
- le suivi d’une séance ;
- les séances partagées ;
- l’historique ;
- la nutrition.

## 2. Positionnement

Le coach IA est un assistant de préparation et d’analyse.

Il peut :

- proposer ;
- expliquer ;
- résumer ;
- comparer ;
- suggérer une adaptation.

Il ne doit pas :

- prendre une décision à la place de l’utilisateur ;
- appliquer silencieusement un changement ;
- remplacer les règles métier ;
- se présenter comme un professionnel de santé ;
- garantir un résultat sportif.

## 3. Principes fondamentaux

### 3.1 L’IA propose, l’utilisateur confirme

Toute proposition produisant une modification de données doit être présentée à l’utilisateur.

L’utilisateur doit pouvoir :

- accepter ;
- modifier ;
- refuser.

### 3.2 Les calculs déterministes restent dans le code

L’IA ne doit pas être responsable des calculs suivants :

- volume d’entraînement ;
- calories et macronutriments ;
- estimation du 1RM ;
- records personnels ;
- **recommandations de charge (moteur 5.1)** ;
- **application de charge au programme (jalon 5.2 — décision utilisateur obligatoire)** ;
- **détection de plateau / stagnation (jalon 5.3 — signal descriptif uniquement)** ;
- arrondi des charges ;
- validation des incréments disponibles ;
- contraintes de rotation ;
- limites de séries et répétitions ;
- autorisations ;
- calcul des dates ;
- synchronisation.

Architecture cible du coaching :

```text
données historiques
→ métriques déterministes
→ plateau déterministe (5.3)
→ recommandations déterministes (5.1)
→ décision utilisateur (5.2)
→ CoachSummary déterministe (5.4)
→ AiCoachExplanationInput V1 (5.5)
→ provider LLM
→ validation structurée
→ UI
→ future conversation (hors 5.5)
```

Le LLM reçoit des **faits structurés** provenant du Coach (statut, recommandation,
raisons, plateau, progression, e1RM, décision récente, notices). Il ne reçoit
pas un accès direct non filtré à toute la base. Il ne doit **pas** inventer un plateau ni
contourner la décision utilisateur.

Le jalon 5.1 livre le moteur déterministe (lecture seule).
Le jalon 5.2 livre l’application confirmée (ACCEPTED / ADJUSTED / IGNORED), sans
auto-apply et sans appel OpenAI.
Le jalon 5.3 livre le signal de stagnation (NONE / WATCH / PLATEAU / …), sans
prescription corrective.
Le jalon 5.4 livre le Coach explicatif déterministe (composition, `/coach`), sans LLM.
Le jalon 5.5 livre l’explication LLM à la demande (pas de chat, pas de mémoire,
pas d’application d’action, pas de génération de programme).
Le jalon 5.6 livre le **chat multi-tour** avec outils lecture seule allowlistés.
Le jalon 8 livre les **propositions structurées** (`discussion | proposal`) : l’IA ne crée jamais
directement un programme ou une séance, uniquement une `AiCoachProposal` que l’utilisateur doit
explicitement accepter (voir §3.2bis).

### 3.2bis Jalon 8 — Propositions structurées (livré)

Depuis le jalon 8, la réponse finale du chat (`AI_COACH_CHAT_STRUCTURED_V1`) est toujours l’une des
deux formes **canoniques** suivantes :

- `discussion` : `{ type: "discussion", text, data: null, references, suggestedFollowUps }` ;
- `proposal` : `{ type: "proposal", text (≤ 280 caractères), data: { kind: "workout"|"program",
  workout, program }, references, suggestedFollowUps }`.

#### Wire format OpenAI (privé provider)

Pour réduire les tokens Structured Outputs, OpenAI reçoit/produit un **wire format compact**
(`AI_COACH_WIRE_OUTPUT_JSON_SCHEMA`, `strict: true`, **Responses API** `text.format.json_schema`
via `POST /v1/responses` — pas de SDK `openai`, appels `fetch` bruts).

Ce format :

- est **privé au provider** OpenAI ;
- **n’est pas** un contrat frontend ;
- **n’est pas** le modèle métier ni le payload DB ;
- est immédiatement mappé (`mapAiCoachWireResponse`) vers les DTOs canoniques ci-dessus.

Correspondances principales : `t`→type (`d`/`p`), `x`→text, `d`→data, `k`→kind (`wk`/`pg`),
`n`→name, `e`→exercises, `id`→exerciseId, `s`→sets, `r`→`[repsMin,repsMax]`, `rir`/`rpe`/`kg`/`pct`/`sec`/`m`/`rest`.

`AiCoachProposal.payloadJson` stocke le payload **canonique** (jamais les clés wire).

Budgets `max_output_tokens` réponse finale : discussion ≈ 900, workout ≈ 2800, program / défaut ≈ 4500
(marge anti-troncature). Les tools function sont envoyés au format Responses (`type/name/parameters`,
`strict: false` car plusieurs paramètres sont optionnels).

Trois outils lecture seule supplémentaires permettent à l’IA de construire une proposal réaliste
sans jamais inventer un identifiant : `search_exercises` (seule source de vrais `exerciseId`),
`get_active_program`, `get_program_detail`.

Pipeline serveur pour une réponse `proposal` :

```text
réponse LLM (proposal)
→ revalidation métier complète (exercices accessibles/non archivés, équipement actif,
  validateWorkoutTemplateSetTargets)
→ invalide ? → réponse renvoyée à l’utilisateur en "discussion" (message d’erreur clair),
  AUCUNE AiCoachProposal créée
→ valide ? → AiCoachProposal PENDING (payloadJson + previewJson dénormalisé) liée au message
→ utilisateur : accepter (POST .../proposals/:id/accept) ou refuser (.../dismiss)
→ accept → nouvelle revalidation intégrale (le catalogue peut avoir changé depuis) → transaction
  ProgramsService (Program DRAFT jamais activé, ou WorkoutTemplate rattaché à un programId fourni)
→ AiCoachProposal ACCEPTED (createdProgramId | createdWorkoutTemplateId)
```

Voir `docs/09-api-contracts.md` §23.2novies pour les endpoints et codes d’erreur, et
`docs/05-data-model.md` (jalon 8) pour le modèle `AiCoachProposal`.

### Sécurité chat 5.6

```text
LLM
→ aucun accès DB direct
→ outils allowlistés
→ outils lecture seule
→ validation Zod
→ owner JWT côté serveur
→ output minimisé
```

Le texte utilisateur et les données textuelles (noms d’exercices, notes) sont non fiables.
Les permissions ne sont **jamais** définies par le prompt : l’absence d’outil d’écriture est le garde-fou principal.

Données envoyées au provider : messages récents bornés (12), contexte exercice minimal, outputs tools minimisés.
Non envoyés : tokens, email, ownerUserId, historique complet, base brute.

### Limitations 5.5 / 5.6

- Explication et chat : le texte IA n’est pas une garantie métier.
- Chat multi-tour livré en 5.6 ; pas de mémoire longue durée ni de résumé IA automatique.
- Pas de persistance des explications 5.5 générées.
- Les décisions métier restent déterministes (5.1–5.4).
- En cas d’échec fournisseur : message d’erreur contrôlé ; le résumé 5.4 reste visible.
- **Dettes volontaires (clôture 5.7) :** busy lock conversation et rate limiter IA restent
  **process-local / mémoire** (pas Redis / multi-instance). Acceptable tant que l’API tourne en mono-process.
- Incrément de charge : uniquement `SYSTEM_DEFAULT` (2,5 kg) — aucune préférence utilisateur d’incrément en base pour l’instant.

### 3.3 Les sorties sont structurées

Une réponse destinée à être enregistrée doit respecter un schéma JSON défini.

Le texte libre peut être utilisé pour l’explication, mais ne doit pas être la seule source de données métier.

### 3.4 Les réponses sont validées côté serveur

Le backend doit vérifier :

- la structure ;
- les références ;
- les valeurs ;
- les bornes ;
- les restrictions ;
- les autorisations ;
- les incompatibilités.

### 3.5 Les données envoyées sont minimisées

Le système n’envoie au fournisseur IA que les informations nécessaires à la demande.

## 4. Cas d’usage prévus

### 4.1 Génération d’un programme

Le coach peut proposer un programme à partir de :

- objectif ;
- niveau ;
- fréquence ;
- durée des séances ;
- équipements disponibles ;
- exercices préférés ;
- exercices exclus ;
- historique récent facultatif ;
- références de force facultatives ;
- restrictions déclarées.

### 4.2 Génération d’une séance ponctuelle

Exemples :

- séance haut du corps de 45 minutes ;
- séance jambes avec équipements limités ;
- séance légère ;
- séance adaptée à un groupe ;
- séance de reprise.

### 4.3 Analyse de progression

Le coach peut commenter des tendances déjà calculées par l’application.

Exemples :

- charge stable ;
- répétitions en hausse ;
- volume en baisse ;
- séries régulièrement échouées ;
- fréquence irrégulière ;
- stagnation sur un exercice.

### 4.4 Suggestion de charge

L’IA peut expliquer une suggestion calculée par le moteur métier.

Elle peut également proposer une stratégie générale, mais la charge finale doit être validée par les règles déterministes.

### 4.5 Suggestion de diminution ou semaine légère

Le coach peut proposer :

- diminution de charge ;
- diminution du nombre de séries ;
- augmentation du repos ;
- séance de récupération ;
- semaine plus légère.

### 4.6 Alternative d’exercice

L’IA peut proposer un exercice alternatif en tenant compte de :

- groupe musculaire ;
- mouvement ;
- équipement ;
- préférence ;
- exclusion ;
- historique.

L’exercice proposé doit être présent dans le catalogue ou clairement identifié comme nouvelle suggestion à valider.

### 4.7 Explication

L’IA peut expliquer :

- pourquoi un exercice est proposé ;
- pourquoi une charge est maintenue ;
- pourquoi une augmentation n’est pas recommandée ;
- comment lire une progression ;
- comment fonctionne un programme.

### 4.8 Adaptation à plusieurs participants

L’IA peut proposer une structure générale de séance partagée.

Elle ne doit pas être responsable de la rotation en temps réel.

## 5. Cas d’usage interdits

Le module ne doit pas fournir :

- diagnostic médical ;
- diagnostic de blessure ;
- programme de rééducation ;
- recommandation de traitement ;
- conseil de reprise après blessure présenté comme médical ;
- recommandation de médicament ;
- recommandation de produit dopant ;
- recommandation de substance dangereuse ;
- plan nutritionnel thérapeutique ;
- objectif de perte de poids extrême ;
- encouragement à l’entraînement malgré une douleur anormale ;
- garantie de résultat ;
- ordre de tester une charge maximale dangereuse.

Lorsqu’une demande dépasse le périmètre, l’application doit :

1. refuser la partie interdite ;
2. expliquer la limite ;
3. proposer une alternative sûre si possible.

## 6. Données autorisées

### 6.1 Données de profil

- objectif principal ;
- niveau déclaré ;
- fréquence souhaitée ;
- durée disponible ;
- unités ;
- préférences ;
- équipements.

### 6.2 Données d’entraînement

- exercices ;
- séries ;
- répétitions ;
- charges ;
- durée ;
- RIR ou RPE ;
- statuts ;
- volume calculé ;
- records calculés ;
- fréquence ;
- historique limité à une période pertinente.

### 6.3 Données nutritionnelles

Uniquement pour les cas d’usage prévus :

- objectifs ;
- moyennes ;
- apports agrégés ;
- tendances.

Le détail complet des repas ne doit pas être envoyé lorsqu’un résumé suffit.

### 6.4 Mesures corporelles

- poids ;
- tendance ;
- taille, uniquement si nécessaire et consentie.

### 6.5 Restrictions

Les restrictions déclarées peuvent être utilisées pour éviter certaines propositions.

Elles ne doivent pas être transformées en diagnostic.

## 7. Données à éviter

Ne pas envoyer au fournisseur lorsque cela n’est pas nécessaire :

- email ;
- nom complet ;
- identifiant interne ;
- adresse IP ;
- tokens ;
- identifiants de session ;
- détails des autres participants ;
- notes privées non sélectionnées ;
- historique alimentaire complet ;
- historique illimité ;
- données d’administration ;
- logs.

Un identifiant pseudonyme temporaire peut être utilisé pour relier les éléments d’une requête sans exposer l’identité réelle.

## 8. Consentement

Avant une demande IA, l’application doit indiquer les catégories de données utilisées.

Exemple :

```text id="tbgqgr"
Cette demande utilisera :

- ton objectif sportif ;
- tes équipements disponibles ;
- tes huit dernières séances ;
- tes références de charge.
```

L’utilisateur doit pouvoir :

- retirer une catégorie facultative ;
- continuer avec moins de données ;
- annuler.

Le consentement à une requête IA ne constitue pas nécessairement un consentement permanent pour toutes les futures requêtes.

## 9. Architecture du module IA

Structure proposée :

```text id="o4vdt2"
modules/ai/
├── application/
│   ├── generate-program-proposal.use-case.ts
│   ├── generate-workout-proposal.use-case.ts
│   ├── analyze-progress.use-case.ts
│   ├── accept-proposal.use-case.ts
│   └── reject-proposal.use-case.ts
│
├── domain/
│   ├── proposal/
│   ├── policies/
│   ├── schemas/
│   └── services/
│
├── infrastructure/
│   ├── providers/
│   ├── prompts/
│   └── repositories/
│
└── presentation/
    └── http/
```

## 10. Abstraction du fournisseur

Le code métier ne doit pas appeler directement un SDK dans les cas d’usage.

Interface possible :

```ts id="xay846"
interface AiProvider {
  generateStructuredResponse<TInput, TOutput>(
    request: AiStructuredRequest<TInput>,
  ): Promise<AiStructuredResult<TOutput>>;
}
```

Structure :

```ts id="8am0oq"
type AiStructuredRequest<TInput> = {
  taskType: string;
  input: TInput;
  schemaName: string;
  schemaVersion: string;
  promptVersion: string;
  timeoutMs: number;
};

type AiStructuredResult<TOutput> = {
  output: TOutput;
  provider: string;
  model: string;
  inputTokenCount: number | null;
  outputTokenCount: number | null;
  rawResponseReference: string | null;
};
```

## 11. Construction du contexte

Le contexte est construit côté backend.

Le frontend ne doit pas envoyer directement un long prompt libre comme seule instruction.

Le backend reçoit des paramètres structurés, puis prépare :

- instructions système ;
- règles métier pertinentes ;
- schéma attendu ;
- profil autorisé ;
- données sélectionnées ;
- valeurs calculées ;
- contraintes ;
- version du prompt.

## 12. Versionnement des prompts

Chaque type de demande utilise un identifiant de prompt.

Exemples :

```text id="k59stq"
PROGRAM_GENERATION_V1
WORKOUT_GENERATION_V1
PROGRESS_ANALYSIS_V1
LOAD_ADJUSTMENT_V1
EXERCISE_ALTERNATIVE_V1
```

La version doit être enregistrée avec la demande.

Une modification importante du prompt crée une nouvelle version.

## 13. Schéma de programme proposé

Exemple conceptuel :

```ts id="n9a007"
const AiProgramProposalSchema = z.object({
  name: z.string().min(1).max(100),

  goal: z.enum(["ENDURANCE", "HYPERTROPHY", "STRENGTH", "GENERAL_FITNESS"]),

  summary: z.string().min(1).max(1000),

  assumptions: z.array(z.string().max(300)).max(20),
  warnings: z.array(z.string().max(300)).max(20),

  sessions: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        estimatedDurationMinutes: z.number().int().min(15).max(240),

        exercises: z
          .array(
            z.object({
              exerciseId: z.string(),
              equipmentId: z.string().nullable(),

              position: z.number().int().positive(),

              sets: z
                .array(
                  z.object({
                    setType: z.enum([
                      "WARMUP",
                      "WORKING",
                      "BACKOFF",
                      "DROP_SET",
                      "AMRAP",
                      "FAILURE_OPTIONAL",
                    ]),

                    targetRepMin: z.number().int().min(1).max(100).nullable(),
                    targetRepMax: z.number().int().min(1).max(100).nullable(),

                    targetDurationSeconds: z
                      .number()
                      .int()
                      .min(1)
                      .max(7200)
                      .nullable(),

                    targetIntensityPercent: z
                      .number()
                      .min(0)
                      .max(100)
                      .nullable(),

                    targetRir: z.number().int().min(0).max(10).nullable(),
                    targetRpe: z.number().min(1).max(10).nullable(),

                    restSeconds: z.number().int().min(0).max(1800),
                  }),
                )
                .min(1)
                .max(20),

              rationale: z.string().max(500),
            }),
          )
          .min(1)
          .max(20),
      }),
    )
    .min(1)
    .max(14),
});
```

Ce schéma est indicatif.

Il doit être adapté aux types partagés réels.

## 14. Validation métier après Zod

La validation du schéma ne suffit pas.

Le backend doit vérifier :

- appartenance des exercices au catalogue ;
- accès aux exercices personnels ;
- compatibilité exercice-équipement ;
- restrictions ;
- doublons ;
- nombre total de séries ;
- durée estimée ;
- plages de répétitions ;
- intensités ;
- incréments ;
- cohérence avec l’objectif ;
- disponibilité des équipements.

## 15. Exercices inconnus

Si l’IA retourne un exercice inconnu :

### Option recommandée

Rejeter la proposition ou demander une nouvelle génération avec uniquement les identifiants fournis.

### Option future

Créer une suggestion de nouvel exercice avec :

- nom ;
- description ;
- type de mesure ;
- équipement ;
- muscles ;
- statut `UNRESOLVED`.

Cet exercice doit être confirmé avant intégration.

## 16. Références de charge

L’IA ne doit pas produire directement une charge définitive sans validation.

Deux approches sont possibles :

### Pourcentage d’intensité

L’IA propose :

```text id="jur87w"
70 % de la référence
```

Le moteur calcule et arrondit la charge.

### Charge proposée

L’IA propose une valeur, puis le backend :

- vérifie la référence ;
- vérifie les limites ;
- arrondit ;
- identifie la valeur comme suggestion.

La première approche est préférable lorsque les références sont fiables.

## 17. Analyse de progression

L’application prépare des tendances calculées.

Exemple d’entrée :

```ts id="z8wr3h"
type ProgressAnalysisInput = {
  period: {
    from: string;
    to: string;
  };

  exercises: Array<{
    exerciseId: string;
    name: string;

    sessionCount: number;
    maxWeightTrend: number[];
    estimatedOneRepMaxTrend: number[];
    volumeTrend: number[];

    completedSetRate: number;
    partialSetRate: number;
    failedSetRate: number;

    recentPerformances: Array<{
      localDate: string;
      maxWeightKg: number | null;
      bestReps: number | null;
      estimatedOneRepMaxKg: number | null;
      averageRir: number | null;
      averageRpe: number | null;
    }>;
  }>;
};
```

L’IA commente les tendances.

Elle ne recalcule pas les valeurs à partir de données brutes si l’application peut le faire.

## 18. Format d’analyse

```ts id="3hp0h1"
type ProgressAnalysisProposal = {
  summary: string;

  observations: Array<{
    title: string;
    description: string;
    evidenceKeys: string[];
    confidence: "LOW" | "MEDIUM" | "HIGH";
  }>;

  suggestions: Array<{
    type:
      | "MAINTAIN"
      | "INCREASE_LOAD"
      | "DECREASE_LOAD"
      | "INCREASE_REST"
      | "REDUCE_VOLUME"
      | "CHANGE_EXERCISE"
      | "DELOAD"
      | "COLLECT_MORE_DATA";

    exerciseId: string | null;
    description: string;
    rationale: string;
  }>;

  warnings: string[];
};
```

## 19. Niveau de confiance

Les observations peuvent être accompagnées d’un niveau de confiance.

Exemples :

- `LOW` : peu de données ou forte variabilité ;
- `MEDIUM` : plusieurs séances cohérentes ;
- `HIGH` : tendance claire sur une période suffisante.

Le fournisseur ne doit pas déterminer seul ce niveau.

Le backend peut le calculer ou le limiter selon la quantité de données.

## 20. Données insuffisantes

Lorsque les données sont insuffisantes, la réponse doit pouvoir indiquer :

```text id="o6nlyu"
COLLECT_MORE_DATA
```

L’application ne doit pas forcer une recommandation lorsque l’historique ne permet pas une conclusion raisonnable.

## 21. Création d’une séance partagée

L’IA peut suggérer :

- exercices communs ;
- alternatives ;
- durée ;
- répartition générale.

Le moteur déterministe reste responsable de :

- affectation des stations ;
- capacité ;
- ordre temps réel ;
- changement après déconnexion ;
- conflits.

## 22. Nutrition

L’utilisation de l’IA pour la nutrition doit rester limitée.

Cas acceptables :

- proposer des idées de repas correspondant à des macros ;
- expliquer un écart ;
- proposer une répartition de repas ;
- résumer une semaine.

Cas interdits :

- traiter un trouble alimentaire ;
- prescrire un régime médical ;
- recommander une restriction extrême ;
- diagnostiquer une carence ;
- garantir une perte de poids.

## 23. Gestion des propositions

Une proposition est enregistrée avant application.

Champs principaux :

- demande source ;
- type ;
- statut ;
- payload ;
- explication ;
- hypothèses ;
- avertissements ;
- erreurs de validation ;
- expiration ;
- date d’acceptation ou refus.

## 24. Cycle de vie

```text id="n20ggd"
GENERATING
    ↓
VALID ou INVALID
    ↓
ACCEPTED, REJECTED ou EXPIRED
```

Une proposition `INVALID` ne peut pas être acceptée.

Une proposition expirée peut être régénérée.

## 25. Acceptation

Lorsqu’un utilisateur accepte :

1. vérifier la propriété ;
2. vérifier le statut ;
3. vérifier l’expiration ;
4. vérifier la version ;
5. revalider le payload ;
6. créer les entités dans une transaction ;
7. marquer la proposition acceptée ;
8. retourner les ressources créées.

Une double acceptation avec la même clé d’idempotence ne doit pas créer deux programmes.

## 26. Modification avant acceptation

L’utilisateur peut modifier une proposition.

Deux approches possibles :

### Copie éditable côté frontend

Le payload IA reste inchangé et le frontend envoie une version modifiée lors de l’acceptation.

### Version de proposition utilisateur

Une nouvelle version est enregistrée.

La première approche suffit initialement, à condition de valider intégralement le payload final.

## 27. Refus

Un refus peut enregistrer facultativement :

- raison ;
- catégorie ;
- commentaire.

Ces informations peuvent servir à améliorer les futures propositions, sans être envoyées automatiquement au fournisseur.

## 28. Expiration

Une proposition doit posséder une durée de validité.

Exemple initial :

```text id="6kx06f"
7 jours
```

Une proposition utilisant des données récentes peut devenir obsolète si :

- le programme change ;
- de nouvelles séances sont effectuées ;
- les restrictions changent ;
- les références changent.

## 29. Gestion des erreurs fournisseur

Types d’erreur :

- timeout ;
- quota ;
- fournisseur indisponible ;
- réponse vide ;
- JSON invalide ;
- schéma invalide ;
- contenu refusé ;
- erreur interne.

Le frontend doit afficher un message compréhensible.

Exemple :

```text id="13rkn4"
Le coach n’a pas pu générer une proposition exploitable. Tes données n’ont pas été modifiées.
```

## 30. Retry

Les retries automatiques doivent être limités.

Ne pas relancer automatiquement plusieurs requêtes coûteuses après une réponse invalide sans contrôle.

Une stratégie possible :

1. appel initial ;
2. tentative de réparation structurée ;
3. échec final.

## 31. Timeout

Chaque demande possède un timeout explicite.

La requête utilisateur ne doit pas rester bloquée indéfiniment.

Pour les traitements longs :

- créer une demande ;
- traiter en arrière-plan ;
- permettre la consultation du statut ;
- notifier lorsque prêt.

## 32. Traitement asynchrone

Flux recommandé :

```text id="oxnt3x"
POST demande
    ↓
AiRequest PENDING
    ↓
worker
    ↓
appel fournisseur
    ↓
validation
    ↓
AiProposal VALID ou INVALID
    ↓
notification interne
```

L’API peut aussi traiter directement les premières versions si le timeout reste raisonnable.

## 33. Limitation de débit

Limiter par :

- utilisateur ;
- type de demande ;
- période ;
- coût estimé.

Exemples :

- création de programme : peu fréquente ;
- analyse : fréquence modérée ;
- alternative d’exercice : plus fréquente.

## 34. Quotas

Un quota peut être défini même si l’application est gratuite.

Objectifs :

- éviter une boucle accidentelle ;
- protéger la clé ;
- limiter les abus ;
- maîtriser les coûts.

Le quota ne doit pas être présenté comme une fonctionnalité commerciale si le projet reste personnel.

## 35. Suivi des coûts

Enregistrer lorsque disponible :

- fournisseur ;
- modèle ;
- tokens d’entrée ;
- tokens de sortie ;
- coût estimé ;
- durée ;
- résultat.

Ne pas enregistrer le contenu complet du prompt uniquement pour mesurer le coût.

## 36. Cache des demandes

Une demande identique peut être réutilisée lorsque :

- le contexte n’a pas changé ;
- la proposition est toujours valide ;
- l’utilisateur le confirme.

Le cache ne doit pas mélanger les données de plusieurs utilisateurs.

## 37. Prompt injection

Les données utilisateur doivent être considérées comme du contenu non fiable.

Exemples :

- nom d’exercice contenant une instruction ;
- note de séance ;
- description de programme ;
- nom d’aliment.

Le prompt doit distinguer clairement :

- instructions système ;
- données ;
- schéma attendu.

Les données ne doivent jamais être concaténées comme des instructions privilégiées.

## 38. Sorties dangereuses

Après validation structurelle, un contrôle de sécurité doit rechercher :

- instructions médicales ;
- substances interdites ;
- charges hors limites ;
- volumes déraisonnables ;
- violation de restriction ;
- demandes non prises en charge.

Les contrôles déterministes sont prioritaires.

## 39. Journalisation

Journaliser :

- identifiant de demande ;
- utilisateur ;
- type ;
- fournisseur ;
- modèle ;
- durée ;
- statut ;
- nombre de tokens ;
- erreurs techniques ;
- version du prompt ;
- version du schéma.

Ne pas journaliser par défaut :

- prompt complet ;
- réponse brute complète ;
- notes personnelles ;
- données alimentaires détaillées ;
- restrictions détaillées.

## 40. Conservation

Les demandes et propositions doivent posséder une politique de conservation.

Exemple initial :

- métadonnées techniques : 90 jours ;
- propositions acceptées : liées aux ressources créées ;
- propositions refusées : suppression plus rapide ;
- réponses brutes : non conservées ou conservation minimale chiffrée.

La politique exacte doit être définie dans `docs/13-security-and-privacy.md`.

## 41. Interface utilisateur

Une page de proposition doit afficher :

- titre ;
- résumé ;
- détails structurés ;
- explication ;
- hypothèses ;
- avertissements ;
- données principales utilisées ;
- date ;
- statut ;
- actions.

Actions :

- accepter ;
- modifier ;
- refuser ;
- régénérer ;
- créer manuellement.

## 42. Transparence

L’interface doit préciser :

```text id="cb6l8w"
Cette proposition a été générée automatiquement à partir des informations sélectionnées. Elle peut contenir des erreurs.
```

Elle doit également afficher :

- informations non prises en compte ;
- données insuffisantes ;
- niveau de confiance lorsque disponible.

## 43. Tests unitaires

Tester :

- construction du contexte ;
- minimisation ;
- schémas ;
- validation des bornes ;
- exercices inconnus ;
- restriction ;
- acceptation ;
- expiration ;
- idempotence ;
- quota ;
- contrôle de sécurité.

## 44. Tests d’intégration

Tester avec un faux fournisseur :

- réponse valide ;
- réponse JSON invalide ;
- schéma invalide ;
- timeout ;
- refus ;
- réponse dangereuse ;
- exercice inexistant ;
- fournisseur indisponible ;
- acceptation transactionnelle.

Les tests automatiques ne doivent pas dépendre du fournisseur réel.

## 45. Tests de non-régression des prompts

Créer un jeu de cas fixes.

Exemples :

- débutant, trois séances ;
- utilisateur sans équipement ;
- groupe de trois ;
- données insuffisantes ;
- exercice exclu ;
- demande de diagnostic ;
- objectif irréaliste ;
- stagnation apparente.

Les tests vérifient surtout :

- structure ;
- respect des contraintes ;
- absence de contenu interdit ;
- stabilité des champs essentiels.

## 46. Critères de validation

Le module IA est considéré comme acceptable lorsque :

- une réponse invalide n’est jamais persistée comme programme ;
- les calculs métier restent déterministes ;
- l’utilisateur confirme toute modification ;
- les données envoyées sont explicites et minimisées ;
- une restriction est respectée ;
- un contenu médical interdit est refusé ;
- les coûts sont mesurables ;
- un fournisseur indisponible ne bloque pas l’application ;
- les prompts et schémas sont versionnés ;
- les tests utilisent un fournisseur simulé.
