'use strict';

/**
 * One-shot generator for SYSTEM exercise seed data.
 * Run: node apps/api/scripts/generate-system-exercises-seed.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const OUT = path.resolve(
  __dirname,
  '../src/modules/exercises/exercises-seed-data.json',
);

const MUSCLES = new Set([
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'core',
]);

const EQUIPMENT = new Set([
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'bodyweight',
  'resistance-band',
  'cardio-machine',
  'other',
]);

const MEASUREMENTS = new Set([
  'WEIGHT_REPS',
  'BODYWEIGHT_REPS',
  'ASSISTED_BODYWEIGHT_REPS',
  'REPS_ONLY',
  'DURATION',
  'DISTANCE_DURATION',
  'WEIGHT_DURATION',
]);

function normalize(name) {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/** @type {Array<Record<string, unknown>>} */
const exercises = [];

function add(e) {
  const secondary = e.secondary ?? [];
  const comp = e.comp ?? [e.eq];
  const mt = e.mt ?? 'WEIGHT_REPS';
  const rest =
    e.rest ??
    (['chest', 'back', 'quadriceps', 'hamstrings', 'glutes'].includes(e.primary)
      ? 120
      : 60);

  exercises.push({
    slug: e.slug,
    name: e.name,
    primaryMuscleCode: e.primary,
    secondaryMuscleCodes: secondary,
    measurementType: mt,
    defaultEquipmentCode: e.eq,
    compatibleEquipmentCodes: comp,
    defaultRestSeconds: rest,
    instructions: null,
  });
}

// ——— PECTORAUX ———
add({
  slug: 'developpe-couche-barre',
  name: 'Développé couché à la barre',
  primary: 'chest',
  secondary: ['triceps', 'shoulders'],
  eq: 'barbell',
  comp: ['barbell', 'machine'],
  rest: 120,
});
add({
  slug: 'developpe-couche-halteres',
  name: 'Développé couché avec haltères',
  primary: 'chest',
  secondary: ['triceps', 'shoulders'],
  eq: 'dumbbell',
  rest: 120,
});
add({
  slug: 'developpe-couche-smith',
  name: 'Développé couché Smith',
  primary: 'chest',
  secondary: ['triceps', 'shoulders'],
  eq: 'machine',
  rest: 120,
});
add({
  slug: 'chest-press-machine',
  name: 'Chest Press machine',
  primary: 'chest',
  secondary: ['triceps', 'shoulders'],
  eq: 'machine',
  rest: 90,
});
add({
  slug: 'developpe-incline-barre',
  name: 'Développé incliné à la barre',
  primary: 'chest',
  secondary: ['triceps', 'shoulders'],
  eq: 'barbell',
  rest: 120,
});
add({
  slug: 'developpe-incline-halteres',
  name: 'Développé incliné haltères',
  primary: 'chest',
  secondary: ['triceps', 'shoulders'],
  eq: 'dumbbell',
  rest: 120,
});
add({
  slug: 'developpe-incline-machine',
  name: 'Développé incliné machine',
  primary: 'chest',
  secondary: ['triceps', 'shoulders'],
  eq: 'machine',
  rest: 90,
});
add({
  slug: 'developpe-incline-smith',
  name: 'Développé incliné Smith',
  primary: 'chest',
  secondary: ['triceps', 'shoulders'],
  eq: 'machine',
  rest: 120,
});
add({
  slug: 'developpe-decline-barre',
  name: 'Développé décliné à la barre',
  primary: 'chest',
  secondary: ['triceps', 'shoulders'],
  eq: 'barbell',
  rest: 120,
});
add({
  slug: 'developpe-decline-halteres',
  name: 'Développé décliné haltères',
  primary: 'chest',
  secondary: ['triceps', 'shoulders'],
  eq: 'dumbbell',
  rest: 120,
});
add({
  slug: 'developpe-decline-machine',
  name: 'Développé décliné machine',
  primary: 'chest',
  secondary: ['triceps', 'shoulders'],
  eq: 'machine',
  rest: 90,
});
add({
  slug: 'pec-deck',
  name: 'Pec Deck (Butterfly)',
  primary: 'chest',
  secondary: ['shoulders'],
  eq: 'machine',
  rest: 75,
});
add({
  slug: 'ecarte-halteres-couche',
  name: 'Écarté haltères couché',
  primary: 'chest',
  secondary: ['shoulders'],
  eq: 'dumbbell',
  rest: 75,
});
add({
  slug: 'ecarte-halteres-incline',
  name: 'Écarté haltères incliné',
  primary: 'chest',
  secondary: ['shoulders'],
  eq: 'dumbbell',
  rest: 75,
});
add({
  slug: 'ecarte-poulie-vis-a-vis',
  name: 'Écarté poulie vis-à-vis',
  primary: 'chest',
  secondary: ['shoulders'],
  eq: 'cable',
  rest: 75,
});
add({
  slug: 'ecarte-poulie-basse-haute',
  name: 'Écarté poulie basse vers haute',
  primary: 'chest',
  secondary: ['shoulders'],
  eq: 'cable',
  rest: 75,
});
add({
  slug: 'ecarte-poulie-haute-basse',
  name: 'Écarté poulie haute vers basse',
  primary: 'chest',
  secondary: ['shoulders'],
  eq: 'cable',
  rest: 75,
});
add({
  slug: 'pompes',
  name: 'Pompes',
  primary: 'chest',
  secondary: ['triceps', 'shoulders', 'core'],
  eq: 'bodyweight',
  mt: 'BODYWEIGHT_REPS',
  rest: 60,
});
add({
  slug: 'pompes-inclinees',
  name: 'Pompes inclinées',
  primary: 'chest',
  secondary: ['triceps', 'shoulders'],
  eq: 'bodyweight',
  mt: 'BODYWEIGHT_REPS',
  rest: 60,
});
add({
  slug: 'pompes-declinees',
  name: 'Pompes déclinées',
  primary: 'chest',
  secondary: ['triceps', 'shoulders'],
  eq: 'bodyweight',
  mt: 'BODYWEIGHT_REPS',
  rest: 60,
});
add({
  slug: 'dips-pectoraux',
  name: 'Dips orientés pectoraux',
  primary: 'chest',
  secondary: ['triceps', 'shoulders'],
  eq: 'bodyweight',
  comp: ['bodyweight', 'machine'],
  mt: 'BODYWEIGHT_REPS',
  rest: 90,
});

// ——— DOS ———
add({
  slug: 'tractions',
  name: 'Tractions',
  primary: 'back',
  secondary: ['biceps', 'forearms'],
  eq: 'bodyweight',
  comp: ['bodyweight', 'machine', 'resistance-band'],
  mt: 'BODYWEIGHT_REPS',
  rest: 120,
});
add({
  slug: 'tractions-pronation',
  name: 'Tractions pronation',
  primary: 'back',
  secondary: ['biceps', 'forearms'],
  eq: 'bodyweight',
  mt: 'BODYWEIGHT_REPS',
  rest: 120,
});
add({
  slug: 'tractions-supination',
  name: 'Tractions supination',
  primary: 'back',
  secondary: ['biceps', 'forearms'],
  eq: 'bodyweight',
  mt: 'BODYWEIGHT_REPS',
  rest: 120,
});
add({
  slug: 'tractions-prise-neutre',
  name: 'Tractions prise neutre',
  primary: 'back',
  secondary: ['biceps', 'forearms'],
  eq: 'bodyweight',
  mt: 'BODYWEIGHT_REPS',
  rest: 120,
});
add({
  slug: 'tractions-assistees',
  name: 'Tractions assistées',
  primary: 'back',
  secondary: ['biceps'],
  eq: 'machine',
  comp: ['machine', 'resistance-band'],
  mt: 'ASSISTED_BODYWEIGHT_REPS',
  rest: 90,
});
add({
  slug: 'tirage-vertical-poulie',
  name: 'Tirage vertical (Lat Pulldown)',
  primary: 'back',
  secondary: ['biceps'],
  eq: 'cable',
  comp: ['cable', 'machine'],
  rest: 90,
});
add({
  slug: 'tirage-vertical-prise-large',
  name: 'Tirage vertical prise large',
  primary: 'back',
  secondary: ['biceps'],
  eq: 'cable',
  comp: ['cable', 'machine'],
  rest: 90,
});
add({
  slug: 'tirage-vertical-prise-neutre',
  name: 'Tirage vertical prise neutre',
  primary: 'back',
  secondary: ['biceps'],
  eq: 'cable',
  comp: ['cable', 'machine'],
  rest: 90,
});
add({
  slug: 'tirage-vertical-prise-serree',
  name: 'Tirage vertical prise serrée',
  primary: 'back',
  secondary: ['biceps'],
  eq: 'cable',
  comp: ['cable', 'machine'],
  rest: 90,
});
add({
  slug: 'tirage-vertical-supination',
  name: 'Tirage vertical supination',
  primary: 'back',
  secondary: ['biceps'],
  eq: 'cable',
  comp: ['cable', 'machine'],
  rest: 90,
});
add({
  slug: 'tirage-vertical-unilateral',
  name: 'Tirage vertical unilatéral poulie',
  primary: 'back',
  secondary: ['biceps'],
  eq: 'cable',
  rest: 75,
});
add({
  slug: 'rowing-assis-poulie-neutre',
  name: 'Rowing assis poulie',
  primary: 'back',
  secondary: ['biceps', 'shoulders'],
  eq: 'cable',
  comp: ['cable', 'machine'],
  rest: 90,
});
add({
  slug: 'rowing-assis-poulie-large',
  name: 'Rowing assis poulie prise large',
  primary: 'back',
  secondary: ['biceps', 'shoulders'],
  eq: 'cable',
  comp: ['cable', 'machine'],
  rest: 90,
});
add({
  slug: 'rowing-machine',
  name: 'Rowing machine',
  primary: 'back',
  secondary: ['biceps', 'shoulders'],
  eq: 'machine',
  rest: 90,
});
add({
  slug: 'rowing-machine-unilateral',
  name: 'Rowing machine unilatéral',
  primary: 'back',
  secondary: ['biceps', 'shoulders'],
  eq: 'machine',
  rest: 75,
});
add({
  slug: 'rowing-barre',
  name: 'Rowing à la barre',
  primary: 'back',
  secondary: ['biceps', 'shoulders'],
  eq: 'barbell',
  comp: ['barbell', 'dumbbell', 'cable'],
  rest: 120,
});
add({
  slug: 'rowing-barre-en-t',
  name: 'Rowing barre en T',
  primary: 'back',
  secondary: ['biceps', 'shoulders'],
  eq: 'barbell',
  comp: ['barbell', 'machine'],
  rest: 90,
});
add({
  slug: 'rowing-haltere-unilateral',
  name: 'Rowing haltère unilatéral',
  primary: 'back',
  secondary: ['biceps', 'shoulders'],
  eq: 'dumbbell',
  rest: 75,
});
add({
  slug: 'rowing-poitrine-appui-halteres',
  name: 'Rowing poitrine appuyée haltères',
  primary: 'back',
  secondary: ['biceps', 'shoulders'],
  eq: 'dumbbell',
  rest: 90,
});
add({
  slug: 'rowing-poitrine-appui-machine',
  name: 'Rowing poitrine appuyée machine',
  primary: 'back',
  secondary: ['biceps', 'shoulders'],
  eq: 'machine',
  rest: 90,
});
add({
  slug: 'rowing-smith',
  name: 'Rowing Smith',
  primary: 'back',
  secondary: ['biceps', 'shoulders'],
  eq: 'machine',
  rest: 90,
});
add({
  slug: 'tirage-horizontal-unilateral',
  name: 'Tirage horizontal unilatéral poulie',
  primary: 'back',
  secondary: ['biceps', 'shoulders'],
  eq: 'cable',
  rest: 75,
});
add({
  slug: 'pullover-poulie',
  name: 'Pullover poulie bras tendus',
  primary: 'back',
  secondary: ['chest'],
  eq: 'cable',
  rest: 75,
});
add({
  slug: 'pullover-machine',
  name: 'Pullover machine',
  primary: 'back',
  secondary: ['chest'],
  eq: 'machine',
  rest: 75,
});
add({
  slug: 'pullover-haltere',
  name: 'Pullover haltère',
  primary: 'back',
  secondary: ['chest'],
  eq: 'dumbbell',
  rest: 75,
});
add({
  slug: 'shrugs-barre',
  name: 'Shrugs barre',
  primary: 'back',
  secondary: ['forearms'],
  eq: 'barbell',
  rest: 75,
});
add({
  slug: 'shrugs-halteres',
  name: 'Shrugs haltères',
  primary: 'back',
  secondary: ['forearms'],
  eq: 'dumbbell',
  rest: 75,
});
add({
  slug: 'shrugs-machine',
  name: 'Shrugs machine',
  primary: 'back',
  secondary: ['forearms'],
  eq: 'machine',
  rest: 75,
});

// ——— ÉPAULES ———
add({
  slug: 'developpe-militaire-barre',
  name: 'Développé militaire à la barre',
  primary: 'shoulders',
  secondary: ['triceps'],
  eq: 'barbell',
  comp: ['barbell', 'dumbbell'],
  rest: 120,
});
add({
  slug: 'developpe-epaules-halteres',
  name: 'Développé épaules haltères',
  primary: 'shoulders',
  secondary: ['triceps'],
  eq: 'dumbbell',
  rest: 90,
});
add({
  slug: 'shoulder-press-machine',
  name: 'Shoulder Press machine',
  primary: 'shoulders',
  secondary: ['triceps'],
  eq: 'machine',
  rest: 90,
});
add({
  slug: 'developpe-epaules-smith',
  name: 'Développé épaules Smith',
  primary: 'shoulders',
  secondary: ['triceps'],
  eq: 'machine',
  rest: 90,
});
add({
  slug: 'arnold-press',
  name: 'Arnold Press',
  primary: 'shoulders',
  secondary: ['triceps'],
  eq: 'dumbbell',
  rest: 90,
});
add({
  slug: 'elevations-laterales-halteres',
  name: 'Élévations latérales haltères',
  primary: 'shoulders',
  eq: 'dumbbell',
  rest: 60,
});
add({
  slug: 'elevations-laterales-poulie',
  name: 'Élévations latérales poulie',
  primary: 'shoulders',
  eq: 'cable',
  rest: 60,
});
add({
  slug: 'elevations-laterales-machine',
  name: 'Élévations latérales machine',
  primary: 'shoulders',
  eq: 'machine',
  rest: 60,
});
add({
  slug: 'elevation-laterale-unilaterale-poulie',
  name: 'Élévation latérale unilatérale poulie',
  primary: 'shoulders',
  eq: 'cable',
  rest: 60,
});
add({
  slug: 'elevations-frontales-halteres',
  name: 'Élévations frontales haltères',
  primary: 'shoulders',
  eq: 'dumbbell',
  rest: 60,
});
add({
  slug: 'elevations-frontales-poulie',
  name: 'Élévations frontales poulie',
  primary: 'shoulders',
  eq: 'cable',
  rest: 60,
});
add({
  slug: 'oiseau-halteres',
  name: 'Oiseau haltères',
  primary: 'shoulders',
  secondary: ['back'],
  eq: 'dumbbell',
  rest: 60,
});
add({
  slug: 'oiseau-banc-incline',
  name: 'Oiseau sur banc incliné',
  primary: 'shoulders',
  secondary: ['back'],
  eq: 'dumbbell',
  rest: 60,
});
add({
  slug: 'reverse-pec-deck',
  name: 'Reverse Pec Deck',
  primary: 'shoulders',
  secondary: ['back'],
  eq: 'machine',
  rest: 60,
});
add({
  slug: 'face-pull',
  name: 'Face Pull',
  primary: 'shoulders',
  secondary: ['back'],
  eq: 'cable',
  rest: 60,
});
add({
  slug: 'reverse-fly-machine',
  name: 'Reverse Fly machine',
  primary: 'shoulders',
  secondary: ['back'],
  eq: 'machine',
  rest: 60,
});
add({
  slug: 'reverse-fly-poulie',
  name: 'Reverse Fly poulie',
  primary: 'shoulders',
  secondary: ['back'],
  eq: 'cable',
  rest: 60,
});
add({
  slug: 'upright-row-barre',
  name: 'Upright Row barre',
  primary: 'shoulders',
  secondary: ['back'],
  eq: 'barbell',
  rest: 75,
});
add({
  slug: 'upright-row-poulie',
  name: 'Upright Row poulie',
  primary: 'shoulders',
  secondary: ['back'],
  eq: 'cable',
  rest: 75,
});

// ——— BICEPS ———
add({
  slug: 'curl-barre-droite',
  name: 'Curl barre droite',
  primary: 'biceps',
  secondary: ['forearms'],
  eq: 'barbell',
  rest: 60,
});
add({
  slug: 'curl-barre-ez',
  name: 'Curl barre EZ',
  primary: 'biceps',
  secondary: ['forearms'],
  eq: 'barbell',
  rest: 60,
});
add({
  slug: 'curl-halteres',
  name: 'Curl avec haltères',
  primary: 'biceps',
  secondary: ['forearms'],
  eq: 'dumbbell',
  comp: ['dumbbell', 'barbell', 'cable'],
  rest: 60,
});
add({
  slug: 'curl-alterne-halteres',
  name: 'Curl alterné haltères',
  primary: 'biceps',
  secondary: ['forearms'],
  eq: 'dumbbell',
  rest: 60,
});
add({
  slug: 'curl-marteau',
  name: 'Curl marteau',
  primary: 'biceps',
  secondary: ['forearms'],
  eq: 'dumbbell',
  rest: 60,
});
add({
  slug: 'curl-marteau-croise',
  name: 'Curl marteau croisé',
  primary: 'biceps',
  secondary: ['forearms'],
  eq: 'dumbbell',
  rest: 60,
});
add({
  slug: 'curl-incline-halteres',
  name: 'Curl incliné haltères',
  primary: 'biceps',
  secondary: ['forearms'],
  eq: 'dumbbell',
  rest: 60,
});
add({
  slug: 'curl-pupitre-barre-ez',
  name: 'Curl pupitre barre EZ',
  primary: 'biceps',
  eq: 'barbell',
  rest: 60,
});
add({
  slug: 'curl-pupitre-haltere',
  name: 'Curl pupitre haltère',
  primary: 'biceps',
  eq: 'dumbbell',
  rest: 60,
});
add({
  slug: 'curl-pupitre-machine',
  name: 'Curl pupitre machine',
  primary: 'biceps',
  eq: 'machine',
  rest: 60,
});
add({
  slug: 'curl-poulie-basse-barre',
  name: 'Curl poulie basse barre',
  primary: 'biceps',
  secondary: ['forearms'],
  eq: 'cable',
  rest: 60,
});
add({
  slug: 'curl-poulie-basse-corde',
  name: 'Curl poulie basse corde',
  primary: 'biceps',
  secondary: ['forearms'],
  eq: 'cable',
  rest: 60,
});
add({
  slug: 'curl-unilateral-poulie',
  name: 'Curl unilatéral poulie',
  primary: 'biceps',
  eq: 'cable',
  rest: 60,
});
add({
  slug: 'bayesian-curl-poulie',
  name: 'Bayesian Curl poulie',
  primary: 'biceps',
  eq: 'cable',
  rest: 60,
});
add({
  slug: 'curl-machine',
  name: 'Curl machine',
  primary: 'biceps',
  eq: 'machine',
  rest: 60,
});
add({
  slug: 'curl-concentration',
  name: 'Curl concentration',
  primary: 'biceps',
  eq: 'dumbbell',
  rest: 60,
});

// ——— TRICEPS ———
add({
  slug: 'extension-triceps-poulie',
  name: 'Extension triceps à la poulie',
  primary: 'triceps',
  eq: 'cable',
  comp: ['cable', 'dumbbell'],
  rest: 60,
});
add({
  slug: 'extension-triceps-poulie-barre',
  name: 'Extension triceps poulie barre',
  primary: 'triceps',
  eq: 'cable',
  rest: 60,
});
add({
  slug: 'extension-triceps-poulie-corde',
  name: 'Extension triceps poulie corde',
  primary: 'triceps',
  eq: 'cable',
  rest: 60,
});
add({
  slug: 'extension-triceps-unilaterale-poulie',
  name: 'Extension triceps unilatérale poulie',
  primary: 'triceps',
  eq: 'cable',
  rest: 60,
});
add({
  slug: 'extension-triceps-overhead-corde',
  name: 'Extension triceps overhead corde',
  primary: 'triceps',
  eq: 'cable',
  rest: 60,
});
add({
  slug: 'extension-triceps-overhead-haltere',
  name: 'Extension triceps overhead haltère',
  primary: 'triceps',
  eq: 'dumbbell',
  rest: 60,
});
add({
  slug: 'barre-au-front-ez',
  name: 'Barre au front barre EZ',
  primary: 'triceps',
  eq: 'barbell',
  rest: 75,
});
add({
  slug: 'barre-au-front-halteres',
  name: 'Barre au front haltères',
  primary: 'triceps',
  eq: 'dumbbell',
  rest: 75,
});
add({
  slug: 'developpe-couche-prise-serree',
  name: 'Développé couché prise serrée',
  primary: 'triceps',
  secondary: ['chest', 'shoulders'],
  eq: 'barbell',
  rest: 90,
});
add({
  slug: 'dips-triceps',
  name: 'Dips triceps',
  primary: 'triceps',
  secondary: ['chest', 'shoulders'],
  eq: 'bodyweight',
  comp: ['bodyweight', 'machine'],
  mt: 'BODYWEIGHT_REPS',
  rest: 90,
});
add({
  slug: 'dips-assistes',
  name: 'Dips assistés',
  primary: 'triceps',
  secondary: ['chest', 'shoulders'],
  eq: 'machine',
  mt: 'ASSISTED_BODYWEIGHT_REPS',
  rest: 75,
});
add({
  slug: 'extension-triceps-machine',
  name: 'Extension triceps machine',
  primary: 'triceps',
  eq: 'machine',
  rest: 60,
});
add({
  slug: 'kickback-haltere',
  name: 'Kickback haltère',
  primary: 'triceps',
  eq: 'dumbbell',
  rest: 60,
});
add({
  slug: 'kickback-poulie',
  name: 'Kickback poulie',
  primary: 'triceps',
  eq: 'cable',
  rest: 60,
});

// ——— QUADRICEPS ———
add({
  slug: 'squat-barre',
  name: 'Squat à la barre',
  primary: 'quadriceps',
  secondary: ['glutes', 'hamstrings', 'core'],
  eq: 'barbell',
  rest: 180,
});
add({
  slug: 'squat-barre-avant',
  name: 'Squat barre avant',
  primary: 'quadriceps',
  secondary: ['glutes', 'core'],
  eq: 'barbell',
  rest: 150,
});
add({
  slug: 'squat-smith',
  name: 'Squat Smith',
  primary: 'quadriceps',
  secondary: ['glutes', 'hamstrings'],
  eq: 'machine',
  rest: 120,
});
add({
  slug: 'goblet-squat',
  name: 'Goblet Squat',
  primary: 'quadriceps',
  secondary: ['glutes', 'core'],
  eq: 'dumbbell',
  comp: ['dumbbell', 'other'],
  rest: 90,
});
add({
  slug: 'hack-squat-machine',
  name: 'Hack Squat machine',
  primary: 'quadriceps',
  secondary: ['glutes'],
  eq: 'machine',
  rest: 120,
});
add({
  slug: 'presse-cuisses',
  name: 'Presse à cuisses',
  primary: 'quadriceps',
  secondary: ['glutes', 'hamstrings'],
  eq: 'machine',
  rest: 120,
});
add({
  slug: 'presse-cuisses-45',
  name: 'Presse à cuisses 45°',
  primary: 'quadriceps',
  secondary: ['glutes', 'hamstrings'],
  eq: 'machine',
  rest: 120,
});
add({
  slug: 'presse-cuisses-horizontale',
  name: 'Presse à cuisses horizontale',
  primary: 'quadriceps',
  secondary: ['glutes', 'hamstrings'],
  eq: 'machine',
  rest: 120,
});
add({
  slug: 'presse-cuisses-unilaterale',
  name: 'Presse à cuisses unilatérale',
  primary: 'quadriceps',
  secondary: ['glutes'],
  eq: 'machine',
  rest: 90,
});
add({
  slug: 'leg-extension',
  name: 'Leg Extension',
  primary: 'quadriceps',
  eq: 'machine',
  rest: 75,
});
add({
  slug: 'leg-extension-unilateral',
  name: 'Leg Extension unilatéral',
  primary: 'quadriceps',
  eq: 'machine',
  rest: 60,
});
add({
  slug: 'fentes-avant',
  name: 'Fentes avant',
  primary: 'quadriceps',
  secondary: ['glutes', 'hamstrings'],
  eq: 'dumbbell',
  comp: ['dumbbell', 'barbell', 'bodyweight'],
  rest: 90,
});
add({
  slug: 'fentes-arriere',
  name: 'Fentes arrière',
  primary: 'quadriceps',
  secondary: ['glutes', 'hamstrings'],
  eq: 'dumbbell',
  comp: ['dumbbell', 'barbell', 'bodyweight'],
  rest: 90,
});
add({
  slug: 'fentes-marchees',
  name: 'Fentes marchées',
  primary: 'quadriceps',
  secondary: ['glutes'],
  eq: 'dumbbell',
  comp: ['dumbbell', 'bodyweight'],
  rest: 90,
});
add({
  slug: 'split-squat',
  name: 'Split Squat',
  primary: 'quadriceps',
  secondary: ['glutes'],
  eq: 'dumbbell',
  comp: ['dumbbell', 'barbell', 'bodyweight'],
  rest: 90,
});
add({
  slug: 'bulgarian-split-squat',
  name: 'Bulgarian Split Squat',
  primary: 'quadriceps',
  secondary: ['glutes', 'hamstrings'],
  eq: 'dumbbell',
  comp: ['dumbbell', 'barbell', 'bodyweight'],
  rest: 90,
});
add({
  slug: 'step-up',
  name: 'Step-Up',
  primary: 'quadriceps',
  secondary: ['glutes'],
  eq: 'dumbbell',
  comp: ['dumbbell', 'bodyweight'],
  rest: 75,
});

// ——— ISCHIOS ———
add({
  slug: 'leg-curl-assis',
  name: 'Leg Curl assis',
  primary: 'hamstrings',
  eq: 'machine',
  rest: 75,
});
add({
  slug: 'leg-curl-allonge',
  name: 'Leg Curl allongé',
  primary: 'hamstrings',
  eq: 'machine',
  rest: 75,
});
add({
  slug: 'leg-curl-debout',
  name: 'Leg Curl debout',
  primary: 'hamstrings',
  eq: 'machine',
  rest: 60,
});
add({
  slug: 'leg-curl-unilateral',
  name: 'Leg Curl unilatéral',
  primary: 'hamstrings',
  eq: 'machine',
  rest: 60,
});
add({
  slug: 'souleve-de-terre-roumain-barre',
  name: 'Soulevé de terre roumain barre',
  primary: 'hamstrings',
  secondary: ['glutes', 'back'],
  eq: 'barbell',
  rest: 120,
});
add({
  slug: 'souleve-de-terre-roumain-halteres',
  name: 'Soulevé de terre roumain haltères',
  primary: 'hamstrings',
  secondary: ['glutes', 'back'],
  eq: 'dumbbell',
  rest: 90,
});
add({
  slug: 'souleve-de-terre-roumain-smith',
  name: 'Soulevé de terre roumain Smith',
  primary: 'hamstrings',
  secondary: ['glutes', 'back'],
  eq: 'machine',
  rest: 90,
});
add({
  slug: 'souleve-de-terre-jambes-tendues',
  name: 'Soulevé de terre jambes tendues',
  primary: 'hamstrings',
  secondary: ['glutes', 'back'],
  eq: 'barbell',
  rest: 120,
});
add({
  slug: 'good-morning-barre',
  name: 'Good Morning barre',
  primary: 'hamstrings',
  secondary: ['back', 'glutes'],
  eq: 'barbell',
  rest: 90,
});
add({
  slug: 'nordic-curl',
  name: 'Nordic Curl',
  primary: 'hamstrings',
  eq: 'bodyweight',
  mt: 'BODYWEIGHT_REPS',
  rest: 90,
});

// ——— FESSIERS ———
add({
  slug: 'hip-thrust-barre',
  name: 'Hip Thrust barre',
  primary: 'glutes',
  secondary: ['hamstrings'],
  eq: 'barbell',
  rest: 90,
});
add({
  slug: 'hip-thrust-machine',
  name: 'Hip Thrust machine',
  primary: 'glutes',
  secondary: ['hamstrings'],
  eq: 'machine',
  rest: 90,
});
add({
  slug: 'hip-thrust-smith',
  name: 'Hip Thrust Smith',
  primary: 'glutes',
  secondary: ['hamstrings'],
  eq: 'machine',
  rest: 90,
});
add({
  slug: 'glute-bridge',
  name: 'Glute Bridge',
  primary: 'glutes',
  secondary: ['hamstrings'],
  eq: 'bodyweight',
  mt: 'BODYWEIGHT_REPS',
  rest: 60,
});
add({
  slug: 'glute-bridge-barre',
  name: 'Glute Bridge barre',
  primary: 'glutes',
  secondary: ['hamstrings'],
  eq: 'barbell',
  rest: 75,
});
add({
  slug: 'kickback-fessier-poulie',
  name: 'Kickback fessier poulie',
  primary: 'glutes',
  eq: 'cable',
  rest: 60,
});
add({
  slug: 'kickback-fessier-machine',
  name: 'Kickback fessier machine',
  primary: 'glutes',
  eq: 'machine',
  rest: 60,
});
add({
  slug: 'abduction-machine',
  name: 'Abduction machine',
  primary: 'glutes',
  eq: 'machine',
  rest: 60,
});
add({
  slug: 'abduction-poulie',
  name: 'Abduction poulie',
  primary: 'glutes',
  eq: 'cable',
  rest: 60,
});
add({
  slug: 'adduction-machine',
  name: 'Adduction machine',
  primary: 'glutes',
  eq: 'machine',
  rest: 60,
});
add({
  slug: 'adduction-poulie',
  name: 'Adduction poulie',
  primary: 'glutes',
  eq: 'cable',
  rest: 60,
});
add({
  slug: 'pull-through-poulie',
  name: 'Pull Through poulie',
  primary: 'glutes',
  secondary: ['hamstrings'],
  eq: 'cable',
  rest: 75,
});

// ——— MOLLETS ———
add({
  slug: 'mollets-debout-machine',
  name: 'Mollets debout machine',
  primary: 'calves',
  eq: 'machine',
  rest: 60,
});
add({
  slug: 'mollets-assis-machine',
  name: 'Mollets assis machine',
  primary: 'calves',
  eq: 'machine',
  rest: 60,
});
add({
  slug: 'mollets-presse',
  name: 'Mollets à la presse',
  primary: 'calves',
  eq: 'machine',
  rest: 60,
});
add({
  slug: 'mollets-debout-smith',
  name: 'Mollets debout Smith',
  primary: 'calves',
  eq: 'machine',
  rest: 60,
});
add({
  slug: 'mollets-debout-halteres',
  name: 'Mollets debout haltères',
  primary: 'calves',
  eq: 'dumbbell',
  rest: 60,
});
add({
  slug: 'mollets-unilateraux',
  name: 'Mollets unilatéraux',
  primary: 'calves',
  eq: 'dumbbell',
  comp: ['dumbbell', 'machine', 'bodyweight'],
  rest: 45,
});

// ——— CORE ———
add({
  slug: 'crunch-sol',
  name: 'Crunch au sol',
  primary: 'core',
  eq: 'bodyweight',
  mt: 'BODYWEIGHT_REPS',
  rest: 45,
});
add({
  slug: 'crunch-machine',
  name: 'Crunch machine',
  primary: 'core',
  eq: 'machine',
  rest: 45,
});
add({
  slug: 'crunch-poulie',
  name: 'Crunch poulie',
  primary: 'core',
  eq: 'cable',
  rest: 45,
});
add({
  slug: 'releve-genoux-suspendu',
  name: 'Relevé de genoux suspendu',
  primary: 'core',
  eq: 'bodyweight',
  mt: 'BODYWEIGHT_REPS',
  rest: 60,
});
add({
  slug: 'releve-jambes-suspendu',
  name: 'Relevé de jambes suspendu',
  primary: 'core',
  eq: 'bodyweight',
  mt: 'BODYWEIGHT_REPS',
  rest: 60,
});
add({
  slug: 'releve-jambes-sol',
  name: 'Relevé de jambes au sol',
  primary: 'core',
  eq: 'bodyweight',
  mt: 'BODYWEIGHT_REPS',
  rest: 45,
});
add({
  slug: 'releve-jambes-chaise-romaine',
  name: 'Relevé de jambes chaise romaine',
  primary: 'core',
  eq: 'bodyweight',
  mt: 'BODYWEIGHT_REPS',
  rest: 60,
});
add({
  slug: 'sit-up',
  name: 'Sit-Up',
  primary: 'core',
  eq: 'bodyweight',
  mt: 'BODYWEIGHT_REPS',
  rest: 45,
});
add({
  slug: 'reverse-crunch',
  name: 'Reverse Crunch',
  primary: 'core',
  eq: 'bodyweight',
  mt: 'BODYWEIGHT_REPS',
  rest: 45,
});
add({
  slug: 'planche',
  name: 'Planche',
  primary: 'core',
  eq: 'bodyweight',
  mt: 'DURATION',
  rest: 60,
});
add({
  slug: 'planche-laterale',
  name: 'Planche latérale',
  primary: 'core',
  eq: 'bodyweight',
  mt: 'DURATION',
  rest: 45,
});
add({
  slug: 'dead-bug',
  name: 'Dead Bug',
  primary: 'core',
  eq: 'bodyweight',
  mt: 'BODYWEIGHT_REPS',
  rest: 45,
});
add({
  slug: 'bird-dog',
  name: 'Bird Dog',
  primary: 'core',
  eq: 'bodyweight',
  mt: 'BODYWEIGHT_REPS',
  rest: 45,
});
add({
  slug: 'pallof-press',
  name: 'Pallof Press',
  primary: 'core',
  eq: 'cable',
  rest: 45,
});
add({
  slug: 'rotation-buste-poulie',
  name: 'Rotation du buste poulie',
  primary: 'core',
  eq: 'cable',
  rest: 45,
});
add({
  slug: 'woodchopper-haute-basse',
  name: 'Woodchopper poulie haute vers basse',
  primary: 'core',
  eq: 'cable',
  rest: 45,
});
add({
  slug: 'woodchopper-basse-haute',
  name: 'Woodchopper poulie basse vers haute',
  primary: 'core',
  eq: 'cable',
  rest: 45,
});
add({
  slug: 'ab-wheel',
  name: 'Ab Wheel',
  primary: 'core',
  eq: 'other',
  mt: 'BODYWEIGHT_REPS',
  rest: 60,
});
add({
  slug: 'russian-twist',
  name: 'Russian Twist',
  primary: 'core',
  eq: 'bodyweight',
  comp: ['bodyweight', 'dumbbell', 'other'],
  mt: 'BODYWEIGHT_REPS',
  rest: 45,
});
add({
  slug: 'extensions-lombaires-45',
  name: 'Extensions lombaires banc 45°',
  primary: 'back',
  secondary: ['glutes', 'hamstrings'],
  eq: 'bodyweight',
  mt: 'BODYWEIGHT_REPS',
  rest: 60,
});
add({
  slug: 'extensions-lombaires-machine',
  name: 'Extensions lombaires machine',
  primary: 'back',
  secondary: ['glutes'],
  eq: 'machine',
  rest: 60,
});
add({
  slug: 'superman',
  name: 'Superman',
  primary: 'back',
  secondary: ['glutes'],
  eq: 'bodyweight',
  mt: 'BODYWEIGHT_REPS',
  rest: 45,
});

// ——— COMPOSÉS / FULL BODY ———
add({
  slug: 'souleve-de-terre',
  name: 'Soulevé de terre',
  primary: 'back',
  secondary: ['hamstrings', 'glutes', 'core'],
  eq: 'barbell',
  comp: ['barbell', 'dumbbell'],
  rest: 180,
});
add({
  slug: 'souleve-de-terre-sumo',
  name: 'Soulevé de terre sumo',
  primary: 'glutes',
  secondary: ['quadriceps', 'hamstrings', 'back'],
  eq: 'barbell',
  rest: 180,
});
add({
  slug: 'kettlebell-swing',
  name: 'Kettlebell Swing',
  primary: 'glutes',
  secondary: ['hamstrings', 'core', 'back'],
  eq: 'other',
  rest: 75,
});
add({
  slug: 'farmer-carry',
  name: 'Farmer Carry',
  primary: 'forearms',
  secondary: ['core', 'shoulders'],
  eq: 'dumbbell',
  comp: ['dumbbell', 'other'],
  mt: 'DISTANCE_DURATION',
  rest: 90,
});
add({
  slug: 'suitcase-carry',
  name: 'Suitcase Carry',
  primary: 'core',
  secondary: ['forearms', 'shoulders'],
  eq: 'dumbbell',
  mt: 'DISTANCE_DURATION',
  rest: 75,
});

// ——— AVANT-BRAS ———
add({
  slug: 'wrist-curl-barre',
  name: 'Wrist Curl barre',
  primary: 'forearms',
  eq: 'barbell',
  rest: 45,
});
add({
  slug: 'wrist-curl-halteres',
  name: 'Wrist Curl haltères',
  primary: 'forearms',
  eq: 'dumbbell',
  rest: 45,
});
add({
  slug: 'reverse-wrist-curl',
  name: 'Reverse Wrist Curl',
  primary: 'forearms',
  eq: 'barbell',
  comp: ['barbell', 'dumbbell'],
  rest: 45,
});
add({
  slug: 'reverse-curl-barre-ez',
  name: 'Reverse Curl barre EZ',
  primary: 'forearms',
  secondary: ['biceps'],
  eq: 'barbell',
  rest: 60,
});
add({
  slug: 'reverse-curl-poulie',
  name: 'Reverse Curl poulie',
  primary: 'forearms',
  secondary: ['biceps'],
  eq: 'cable',
  rest: 60,
});
add({
  slug: 'dead-hang',
  name: 'Dead Hang',
  primary: 'forearms',
  secondary: [],
  eq: 'bodyweight',
  mt: 'DURATION',
  rest: 60,
});

// Validate
const slugSet = new Set();
const normSet = new Set();
for (const ex of exercises) {
  if (slugSet.has(ex.slug)) throw new Error(`Duplicate slug: ${ex.slug}`);
  slugSet.add(ex.slug);
  const n = normalize(ex.name);
  if (normSet.has(n)) throw new Error(`Duplicate normalized name: ${ex.name}`);
  normSet.add(n);
  if (!MUSCLES.has(ex.primaryMuscleCode)) {
    throw new Error(`Bad primary ${ex.primaryMuscleCode} on ${ex.slug}`);
  }
  for (const s of ex.secondaryMuscleCodes) {
    if (!MUSCLES.has(s)) throw new Error(`Bad secondary ${s} on ${ex.slug}`);
  }
  if (!EQUIPMENT.has(ex.defaultEquipmentCode)) {
    throw new Error(`Bad eq ${ex.defaultEquipmentCode} on ${ex.slug}`);
  }
  for (const c of ex.compatibleEquipmentCodes) {
    if (!EQUIPMENT.has(c)) throw new Error(`Bad comp ${c} on ${ex.slug}`);
  }
  if (!MEASUREMENTS.has(ex.measurementType)) {
    throw new Error(`Bad mt ${ex.measurementType} on ${ex.slug}`);
  }
  if (!ex.compatibleEquipmentCodes.includes(ex.defaultEquipmentCode)) {
    throw new Error(`default not in compatible: ${ex.slug}`);
  }
}

fs.writeFileSync(OUT, `${JSON.stringify(exercises, null, 2)}\n`, 'utf8');
console.log(`Wrote ${exercises.length} exercises → ${OUT}`);
