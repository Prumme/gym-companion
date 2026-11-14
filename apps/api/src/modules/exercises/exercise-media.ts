import type { ExerciseMedia, ExerciseSource } from '@gym-companion/shared';
import { z } from 'zod';

import rawManifest from './exercise-media-manifest.json';

/**
 * Démonstrations visuelles des exercices système.
 *
 * Les images sont des assets statiques de l’app web (`apps/web/public/exercise-media`),
 * issues de Free Exercise DB (Unlicense). Le manifeste associe un `slug` système
 * à un dossier d’assets ; aucune donnée n’est stockée en base.
 */
const ASSET_KEY_PATTERN = /^[a-z0-9-]+$/;

const exerciseMediaManifestSchema = z
  .object({
    source: z
      .object({
        sourceName: z.string().min(1),
        sourceUrl: z.string().url(),
        license: z.string().min(1),
      })
      .strict(),
    basePath: z.string().regex(/^\/[a-z0-9-]+$/),
    items: z.record(
      z.string().min(1),
      z
        .object({
          assetKey: z.string().regex(ASSET_KEY_PATTERN),
          sourceId: z.string().min(1),
          frameCount: z.number().int().min(1).max(8),
        })
        .strict(),
    ),
  })
  .strict();

export type ExerciseMediaManifest = z.infer<typeof exerciseMediaManifestSchema>;

export const EXERCISE_MEDIA_MANIFEST: ExerciseMediaManifest =
  exerciseMediaManifestSchema.parse(rawManifest);

export function resolveExerciseMedia(
  source: ExerciseSource,
  slug: string | null | undefined,
  manifest: ExerciseMediaManifest = EXERCISE_MEDIA_MANIFEST,
): ExerciseMedia | null {
  // Les exercices personnels n’ont pas de démonstration (pas de slug système).
  if (source !== 'SYSTEM' || !slug) {
    return null;
  }

  const item = manifest.items[slug];
  if (!item) {
    return null;
  }

  const frames = Array.from(
    { length: item.frameCount },
    (_, index) => `${manifest.basePath}/${item.assetKey}/${index}.webp`,
  );

  return {
    kind: 'IMAGE_SEQUENCE',
    frames,
    attribution: { ...manifest.source },
  };
}
