# Contexte du dépôt gym-companion

Les règles de travail sont dans `AGENTS.MD` (§13 : format du compte rendu). La vision, la roadmap et les règles métier sont dans `docs/00` à `docs/07`.

## Carte

- **API (NestJS)** : `apps/api/src/modules/*`. On y trouve auth, users, reference, exercises, programs, program-imports, workouts, personal-records, progress, coaching, shared-workouts et training-shares.
- **Base de données** : le schéma Prisma est dans `apps/api/prisma/schema.prisma`. Le seed de référence (équipements, muscles…) est dans `apps/api/src/modules/reference/reference-seed-data.json`.
- **Web (React 19 + Vite)** : `apps/web/src/features/*`, avec un dossier par domaine (`pages/`, `components/`, `hooks/`, `lib/` pour les fonctions pures, `tests/`).
- **Séance active** : `apps/web/src/features/workouts/pages/ActiveWorkoutPage.tsx`, puis `components/ActiveExercisePanel.tsx` (menu exercice, bottom sheets) et `WorkoutSetFormDialog.tsx` (saisie d'une série).
- **Partagé** : les schémas Zod sont dans `packages/validation/src/index.ts`, les types dans `packages/shared/src/index.ts`.

## Roadmap

Les phases 0 à 5 sont livrées : fondations, catalogue, programmes, séances, records et progression, séances partagées. La nutrition (phase 6) et les notifications (phase 7, Web Push) ne sont pas commencées. Le backlog de la phase 3 est dans `docs/01` §6.3.

## Conventions

- **Mutations** : chaque mutation de séance envoie `expectedVersion` et `clientCommandId` (idempotence, conflits de version).
- **Hors ligne** : snapshot et file de commandes dans IndexedDB (`workouts/offline` : type dans `types.ts` + `schemas.ts`, application optimiste dans `apply-command.ts`, rejeu dans `sync-engine.executeCommand`, libellé dans `WorkoutConflictPanel`). File : saisie de série, cibles (`UPDATE_WORKOUT_SET_TARGETS`), cycle de vie. La création de séance, le remplacement d'exercice et l'ajout ou la suppression de séries fonctionnent en ligne seulement.
- **État** : TanStack Query pour l'état serveur, Zustand ou localStorage pour l'état temporaire ou propre à l'appareil.
- **Logique métier** : jamais dans les composants. Elle va dans des fonctions pures de `lib/`, testées avec vitest.

## Commandes

À la racine, via turbo : `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

Pour le web seul : `pnpm --filter @gym-companion/web test`.

Les tests d'API ont besoin de Postgres sur `localhost:5433` : `docker compose up -d postgres`, puis `pnpm --filter @gym-companion/api prisma:deploy` et `prisma:generate` (comme en CI). Sinon : `Can't reach database server` et tous les tests sont ignorés.

## Pièges

- `clearOtherRestTimers` efface toutes les clés localStorage qui commencent par `gym-companion:rest-timer:`. Toute nouvelle clé doit utiliser un autre préfixe.
- `sanitizeRestTimerState` garde un minuteur expiré depuis moins de 2 minutes. Au rechargement, `justExpired` repasse donc à true : il faut vérifier `expiredOnRestoreRef` dans `use-rest-timer.ts` avant tout effet de fin de repos.
- `addWorkoutSessionSetSchema` est `.strict()` et ne crée que des WORKING sans cible. Les séries WARMUP avec cibles passent par `POST …/sets/warmup` (`addWarmupSets`). Positions calculées dans `workouts/workout-set-positions.ts`, idempotence par `clientCommandId` dérivé par série (`id`, `id:1`…).
- Cibles d’une série PENDING : `PATCH …/sets/:id/targets` (`updateSetTargets`), règles d’applicabilité partagées dans `validation` (`validateWorkoutSessionSetTargetsPatch`), formulaire pur dans `workouts/lib/set-targets-form.ts`.
- Séance libre : `POST /workouts/free` (`createFree`). `StartWorkoutButton` / `useStartWorkoutSession` avec `sourceWorkoutTemplateId = null` la démarrent. La page active doit gérer `exercises: []`.
- Tests d’API : `expectedVersion` doit être ≥ 1 (une version 0 donne 400, pas 409), et `PATCH …/sets/:id` exige tous les champs `actual*`, `reachedFailure` et `notes`.
- `WorkoutSet` a un unique `(workoutSessionExerciseId, position)` : pour décaler des positions, passer d’abord par des valeurs négatives puis réécrire (voir `deleteSet`, `addWarmupSets`).
- Tests d’API : démarrer l’app avec `await app.listen(0, '127.0.0.1')`, jamais `app.init()` seul. Sinon supertest fait un `listen(0)` sur `::` à chaque requête, et sous macOS le port peut déjà être pris en 127.0.0.1 par une autre application : on obtient alors des 404, 401 ou timeouts aléatoires.
- Une copie neuve (worktree) n’a ni `node_modules` ni `.env` : lancer `pnpm install --frozen-lockfile` et `cp .env.example .env` avant `prisma:deploy`.
- L’API importe `@gym-companion/validation` depuis `dist/` : après une modification du package, `pnpm --filter @gym-companion/validation build` avant de lancer un test d’API isolé.
- La barre se détecte par `exercise.equipment.code === 'barbell'`. Comparer en minuscules : certaines fixtures utilisent `BARBELL`.
- L'overview coaching (`coach-summary.service.ts`) ne voit que les `COACH_OVERVIEW_RECENCY_DAYS` (90) derniers jours. Dans les tests d'API, utiliser des dates relatives à aujourd'hui, jamais des dates fixes.
- `profile.weightUnit` peut valoir `LB`, mais les écrans de séance stockent et affichent toujours des kg.
