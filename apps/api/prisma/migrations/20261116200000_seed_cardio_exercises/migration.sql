-- Catalogue cardio SYSTEM (course, marche, vélo, rameur, elliptique, escaliers, corde).
-- Généré depuis apps/api/src/modules/exercises/exercises-seed-data.json (section CARDIO).
--
-- Référentiel (pas une donnée de démo) : livré par migration car le seed n’est
-- pas rejoué automatiquement en production. Idempotent : ON CONFLICT (slug) DO NOTHING,
-- et aucun effet tant que les référentiels (muscles, équipements) ne sont pas seedés
-- (base neuve : le seed crée ensuite ces exercices depuis le même JSON).

INSERT INTO "exercises" (
  "id", "source", "ownerUserId", "name", "normalizedName", "slug",
  "primaryMuscleGroupId", "measurementType", "category", "cardioType",
  "defaultEquipmentTypeId", "defaultRestSeconds", "instructions", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(), 'SYSTEM', NULL, v.name, v.normalized_name, v.slug,
  mg.id, v.measurement_type::"ExerciseMeasurementType", 'CARDIO', v.cardio_type::"CardioType",
  eq.id, v.rest_seconds, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('course-exterieur', 'Course à pied (extérieur)', 'course a pied (exterieur)', 'quadriceps', 'DISTANCE_DURATION', 'RUNNING', 'bodyweight', 60),
  ('course-tapis', 'Course sur tapis', 'course sur tapis', 'quadriceps', 'DISTANCE_DURATION', 'TREADMILL', 'cardio-machine', 60),
  ('marche-exterieur', 'Marche (extérieur)', 'marche (exterieur)', 'quadriceps', 'DISTANCE_DURATION', 'WALKING', 'bodyweight', 60),
  ('marche-inclinee-tapis', 'Marche inclinée sur tapis', 'marche inclinee sur tapis', 'glutes', 'DISTANCE_DURATION', 'TREADMILL', 'cardio-machine', 60),
  ('velo-exterieur', 'Vélo (extérieur)', 'velo (exterieur)', 'quadriceps', 'DISTANCE_DURATION', 'CYCLING', 'other', 60),
  ('velo-appartement', 'Vélo d’appartement', 'velo d’appartement', 'quadriceps', 'DISTANCE_DURATION', 'CYCLING', 'cardio-machine', 60),
  ('velo-elliptique', 'Vélo elliptique', 'velo elliptique', 'quadriceps', 'DISTANCE_DURATION', 'ELLIPTICAL', 'cardio-machine', 60),
  ('rameur', 'Rameur', 'rameur', 'back', 'DISTANCE_DURATION', 'ROWING', 'cardio-machine', 60),
  ('simulateur-escaliers', 'Simulateur d’escaliers', 'simulateur d’escaliers', 'glutes', 'DURATION', 'STAIR_CLIMBING', 'cardio-machine', 60),
  ('corde-a-sauter', 'Corde à sauter', 'corde a sauter', 'calves', 'DURATION', 'OTHER', 'other', 60)
) AS v(slug, name, normalized_name, primary_muscle_code, measurement_type, cardio_type, equipment_code, rest_seconds)
JOIN "muscle_groups" mg ON mg."code" = v.primary_muscle_code
JOIN "equipment_types" eq ON eq."code" = v.equipment_code
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "exercise_secondary_muscles" ("exerciseId", "muscleGroupId")
SELECT e.id, mg.id
FROM (VALUES
  ('course-exterieur', 'hamstrings'),
  ('course-exterieur', 'calves'),
  ('course-exterieur', 'glutes'),
  ('course-tapis', 'hamstrings'),
  ('course-tapis', 'calves'),
  ('course-tapis', 'glutes'),
  ('marche-exterieur', 'calves'),
  ('marche-exterieur', 'glutes'),
  ('marche-inclinee-tapis', 'hamstrings'),
  ('marche-inclinee-tapis', 'calves'),
  ('velo-exterieur', 'glutes'),
  ('velo-exterieur', 'calves'),
  ('velo-appartement', 'glutes'),
  ('velo-appartement', 'calves'),
  ('velo-elliptique', 'glutes'),
  ('velo-elliptique', 'hamstrings'),
  ('rameur', 'quadriceps'),
  ('rameur', 'hamstrings'),
  ('rameur', 'glutes'),
  ('simulateur-escaliers', 'quadriceps'),
  ('simulateur-escaliers', 'calves'),
  ('corde-a-sauter', 'quadriceps'),
  ('corde-a-sauter', 'shoulders')
) AS v(slug, muscle_code)
JOIN "exercises" e ON e."slug" = v.slug AND e."source" = 'SYSTEM'
JOIN "muscle_groups" mg ON mg."code" = v.muscle_code
ON CONFLICT DO NOTHING;

INSERT INTO "exercise_equipment_compatibilities" ("id", "exerciseId", "equipmentTypeId", "isPreferred", "notes")
SELECT gen_random_uuid(), e.id, eq.id, v.is_preferred, NULL
FROM (VALUES
  ('course-exterieur', 'bodyweight', true),
  ('course-tapis', 'cardio-machine', true),
  ('marche-exterieur', 'bodyweight', true),
  ('marche-inclinee-tapis', 'cardio-machine', true),
  ('velo-exterieur', 'other', true),
  ('velo-appartement', 'cardio-machine', true),
  ('velo-elliptique', 'cardio-machine', true),
  ('rameur', 'cardio-machine', true),
  ('simulateur-escaliers', 'cardio-machine', true),
  ('corde-a-sauter', 'other', true)
) AS v(slug, equipment_code, is_preferred)
JOIN "exercises" e ON e."slug" = v.slug AND e."source" = 'SYSTEM'
JOIN "equipment_types" eq ON eq."code" = v.equipment_code
ON CONFLICT ("exerciseId", "equipmentTypeId") DO NOTHING;
