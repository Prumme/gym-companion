/**
 * Jeu de données local pour vérifier le remplacement d’exercice en séance.
 * Ne fait pas partie du seed catalogue (`prisma db seed`).
 *
 *   pnpm --filter @gym-companion/api seed:ux
 *
 * Compte : ux@gym-companion.local / UxTest!2026
 * Programme : TEST UX — FULL BODY (activé, planifié aujourd’hui)
 */
const path = require('node:path');
const { config } = require('dotenv');
const argon2 = require('argon2');
const { PrismaClient } = require('@prisma/client');

config({ path: path.resolve(__dirname, '../../../.env') });

const EMAIL = 'ux@gym-companion.local';
const PASSWORD = 'UxTest!2026';
const PROGRAM_NAME = 'TEST UX — FULL BODY';

const SESSION_EXERCISES = [
  'Chest Press machine',
  'Tirage vertical (Lat Pulldown)',
  'Presse à cuisses',
  'Développé épaules haltères',
  'Rowing assis poulie',
  'Leg Curl assis',
  'Curl barre EZ',
  'Extension triceps à la poulie',
];

const CARDIO = [
  { name: 'Treadmill', cardioType: 'TREADMILL', measurementType: 'DURATION' },
  { name: 'Running', cardioType: 'RUNNING', measurementType: 'DISTANCE_DURATION' },
  { name: 'Walking', cardioType: 'WALKING', measurementType: 'DISTANCE_DURATION' },
  { name: 'Rowing', cardioType: 'ROWING', measurementType: 'DISTANCE_DURATION' },
  { name: 'Cycling', cardioType: 'CYCLING', measurementType: 'DISTANCE_DURATION' },
  { name: 'StairMaster', cardioType: 'STAIR_CLIMBING', measurementType: 'DURATION' },
];

const SETS = [
  { targetWeightKg: 40, targetRepMin: 10, targetRepMax: 10 },
  { targetWeightKg: 45, targetRepMin: 10, targetRepMax: 10 },
  { targetWeightKg: 45, targetRepMin: 8, targetRepMax: 8 },
];

function weekdayOf(date) {
  return [
    'SUNDAY',
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
  ][date.getDay()];
}

function normalizeName(name) {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const passwordHash = await argon2.hash(PASSWORD);
    const user = await prisma.user.upsert({
      where: { email: EMAIL },
      update: { passwordHash, status: 'ACTIVE', emailVerifiedAt: new Date() },
      create: {
        email: EMAIL,
        passwordHash,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });
    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: { displayName: 'UX Test' },
      create: { userId: user.id, displayName: 'UX Test' },
    });

    const muscle = await prisma.muscleGroup.findFirst({
      orderBy: { name: 'asc' },
    });
    if (!muscle) {
      throw new Error('Aucun groupe musculaire. Lance d’abord pnpm prisma:seed.');
    }

    for (const cardio of CARDIO) {
      const existing = await prisma.exercise.findFirst({
        where: { ownerUserId: user.id, name: cardio.name },
      });
      if (existing) continue;
      await prisma.exercise.create({
        data: {
          ownerUserId: user.id,
          source: 'USER',
          name: cardio.name,
          normalizedName: normalizeName(cardio.name),
          primaryMuscleGroupId: muscle.id,
          measurementType: cardio.measurementType,
          category: 'CARDIO',
          cardioType: cardio.cardioType,
        },
      });
    }

    const exercises = [];
    for (const name of SESSION_EXERCISES) {
      const exercise = await prisma.exercise.findFirst({
        where: { name, source: 'SYSTEM', archivedAt: null },
      });
      if (!exercise) {
        throw new Error(`Exercice système introuvable : ${name}`);
      }
      exercises.push(exercise);
    }

    const previous = await prisma.program.findFirst({
      where: { ownerUserId: user.id, name: PROGRAM_NAME },
    });
    if (previous) {
      await prisma.program.delete({ where: { id: previous.id } });
    }

    await prisma.programActivation.updateMany({
      where: { userId: user.id, endedOn: null },
      data: { endedOn: new Date() },
    });

    const today = new Date();
    const startedOn = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
    );

    const program = await prisma.program.create({
      data: {
        ownerUserId: user.id,
        name: PROGRAM_NAME,
        description: 'Programme local pour vérifier le remplacement d’exercice.',
        goal: 'GENERAL_FITNESS',
        status: 'ACTIVE',
        activatedAt: new Date(),
        workoutTemplates: {
          create: {
            ownerUserId: user.id,
            name: 'Full body',
            positionInProgram: 0,
            estimatedDurationMinutes: 60,
            exercises: {
              create: exercises.map((exercise, index) => ({
                exerciseId: exercise.id,
                position: index,
                sets: { create: SETS.map((set, setIndex) => ({
                  position: setIndex,
                  setType: 'WORKING',
                  targetWeightKg: set.targetWeightKg,
                  targetRepMin: set.targetRepMin,
                  targetRepMax: set.targetRepMax,
                })) },
              })),
            },
          },
        },
      },
      include: { workoutTemplates: true },
    });

    const template = program.workoutTemplates[0];
    await prisma.programScheduleEntry.create({
      data: {
        programId: program.id,
        workoutTemplateId: template.id,
        weekday: weekdayOf(today),
        position: 0,
      },
    });
    await prisma.programActivation.create({
      data: {
        userId: user.id,
        programId: program.id,
        startedOn,
      },
    });

    console.log(`Utilisateur ${EMAIL} / ${PASSWORD}`);
    console.log(`Programme ${PROGRAM_NAME} (${program.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
