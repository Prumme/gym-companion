# AI Program Import Bridge

## 1. Objectif

Gym Companion permet d’importer un programme généré par une IA **externe choisie par l’utilisateur**.

L’application :

1. génère un prompt copiable ;
2. l’utilisateur le colle dans ChatGPT, Claude, Gemini ou un autre outil ;
3. l’IA retourne un JSON ;
4. l’utilisateur colle ce JSON dans Gym Companion ;
5. Gym Companion parse, valide, prévisualise, puis importe.

**Gym Companion ne contacte aucune IA.** Aucune clé provider, aucun appel LLM, aucun coût token côté serveur.

Le JSON est une entrée utilisateur hostile.

Cette feature fonctionne avec `AI_COACH_ENABLED=false` et `AI_COACH_PROVIDER=none`.

Le Coach IA intégré n’est ni requis ni réutilisé comme provider.

## 2. Contrat JSON V1

Racine stricte (propriétés inconnues refusées) :

```json
{
  "schemaVersion": 1,
  "program": {
    "name": "Push Pull Legs",
    "description": "Programme 3 séances, priorité haut du corps.",
    "goal": "HYPERTROPHY",
    "workouts": [
      {
        "name": "Push",
        "description": null,
        "estimatedDurationMinutes": 60,
        "exercises": [
          {
            "exerciseSlug": "developpe-couche-barre",
            "notes": null,
            "sets": [
              {
                "repsMin": 8,
                "repsMax": 10,
                "rir": 2,
                "restSeconds": 120
              }
            ]
          }
        ]
      }
    ]
  }
}
```

- `schemaVersion` doit valoir `1`. Toute autre valeur : `Version d'import non supportée : N. Version supportée : 1.`
- `exerciseSlug` identifie un exercice **SYSTEM** actuel. Jamais d’UUID.
- `measurementType` n’est pas dans le JSON : il est lu depuis l’Exercise.
- `setType` n’est pas dans le JSON V1 : import = `WORKING`.
- `goal` : `ENDURANCE` | `HYPERTROPHY` | `STRENGTH` | `GENERAL_FITNESS`.

Schéma Zod : `packages/validation/src/program-import.ts`.

## 3. Validation

Trois niveaux :

| Niveau | Exemple |
| --- | --- |
| Syntaxe JSON | Ligne 24, colonne 8 : JSON invalide. |
| Schéma | `program.workouts[1].name` — Champ obligatoire. |
| Métier | `exerciseSlug` inconnu, cibles incompatibles avec le `measurementType`. |

Le frontend parse le JSON pour le feedback immédiat. Le backend **revalide tout** à l’import. Une preview n’est pas une preuve de validité.

Aucune correction silencieuse (pas d’inversion repsMin/repsMax, pas de remplacement de slug, pas de clamp RIR).

## 4. API

```text
GET  /api/v1/exercises/system-catalog     # auth — catalogue SYSTEM compact
POST /api/v1/program-imports/validate     # auth — aucune persistance
POST /api/v1/program-imports              # auth — transaction, DRAFT
```

Payload maximal : 64 Ko.

## 5. Import

Transaction Prisma unique :

Program → WorkoutTemplate → WorkoutTemplateExercise → WorkoutTemplateSet

- statut **`DRAFT`** (inactif) ;
- pas d’activation ;
- pas de `ProgramActivation` ;
- pas de planning ;
- pas de `WorkoutSession` ;
- un nom déjà utilisé **n’écrase pas** un programme existant (doublons de nom autorisés, comme le reste du produit).

## 6. Hors périmètre

- appels OpenAI / Anthropic / Gemini ;
- exercices `USER` ;
- édition d’un Program existant par JSON ;
- import déjà actif ;
- tables d’historique d’import.
