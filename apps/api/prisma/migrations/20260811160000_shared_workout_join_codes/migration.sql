-- Shared join code: remplace les invitations email.
-- leftAt (membres) reste intact — ajouté dans 20260810160000.

-- 1. Colonnes joinCode (nullable temporaire pour backfill)
ALTER TABLE "shared_workout_rooms" ADD COLUMN "joinCode" TEXT;
ALTER TABLE "shared_workout_rooms" ADD COLUMN "joinCodeCreatedAt" TIMESTAMP(3);
ALTER TABLE "shared_workout_rooms" ADD COLUMN "joinCodeRotatedAt" TIMESTAMP(3);

-- 2. Backfill codes uniques (alphabet sans I/O/0/1). random() SQL ok pour migration one-shot.
DO $$
DECLARE
  r RECORD;
  alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  attempt INT;
  i INT;
BEGIN
  FOR r IN SELECT id FROM "shared_workout_rooms" WHERE "joinCode" IS NULL LOOP
    attempt := 0;
    LOOP
      attempt := attempt + 1;
      code := '';
      FOR i IN 1..6 LOOP
        code := code || substr(alphabet, 1 + (floor(random() * length(alphabet)))::int, 1);
      END LOOP;
      BEGIN
        UPDATE "shared_workout_rooms"
        SET "joinCode" = code, "joinCodeCreatedAt" = CURRENT_TIMESTAMP
        WHERE id = r.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF attempt >= 30 THEN
          RAISE EXCEPTION 'Failed to generate unique joinCode for room %', r.id;
        END IF;
      END;
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE "shared_workout_rooms" ALTER COLUMN "joinCode" SET NOT NULL;
ALTER TABLE "shared_workout_rooms" ALTER COLUMN "joinCodeCreatedAt" SET NOT NULL;
ALTER TABLE "shared_workout_rooms" ALTER COLUMN "joinCodeCreatedAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "shared_workout_rooms_joinCode_key" ON "shared_workout_rooms"("joinCode");

-- 3. Drop ancien système invitations email
DROP TABLE IF EXISTS "shared_workout_room_invitations";
DROP TYPE IF EXISTS "SharedWorkoutRoomInvitationStatus";
