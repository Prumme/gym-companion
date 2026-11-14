import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { EXERCISE_MEDIA_MANIFEST, resolveExerciseMedia } from './exercise-media';
import seedExercises from './exercises-seed-data.json';

const WEB_PUBLIC_DIR = resolve(__dirname, '../../../../web/public');

describe('resolveExerciseMedia', () => {
  it('returns an image sequence for a mapped system exercise', () => {
    expect(resolveExerciseMedia('SYSTEM', 'squat-barre')).toEqual({
      kind: 'IMAGE_SEQUENCE',
      frames: ['/exercise-media/barbell-squat/0.webp', '/exercise-media/barbell-squat/1.webp'],
      attribution: {
        sourceName: 'Free Exercise DB',
        sourceUrl: 'https://github.com/yuhonas/free-exercise-db',
        license: 'Unlicense',
      },
    });
  });

  it('returns null for user exercises even with a known slug', () => {
    expect(resolveExerciseMedia('USER', 'squat-barre')).toBeNull();
  });

  it('returns null without slug or for an unmapped system exercise', () => {
    expect(resolveExerciseMedia('SYSTEM', null)).toBeNull();
    expect(resolveExerciseMedia('SYSTEM', undefined)).toBeNull();
    expect(resolveExerciseMedia('SYSTEM', 'dead-hang')).toBeNull();
  });
});

describe('EXERCISE_MEDIA_MANIFEST', () => {
  const seedSlugs = new Set(seedExercises.map((exercise) => exercise.slug));

  it('only references slugs of the system exercise seed', () => {
    const unknown = Object.keys(EXERCISE_MEDIA_MANIFEST.items).filter(
      (slug) => !seedSlugs.has(slug),
    );
    expect(unknown).toEqual([]);
  });

  it('points to frames that exist in the web public assets', () => {
    const missing: string[] = [];
    for (const slug of Object.keys(EXERCISE_MEDIA_MANIFEST.items)) {
      const media = resolveExerciseMedia('SYSTEM', slug);
      for (const frame of media?.frames ?? []) {
        if (!existsSync(resolve(WEB_PUBLIC_DIR, `.${frame}`))) {
          missing.push(frame);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
