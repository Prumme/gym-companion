import { describe, expect, it } from 'vitest';

import {
  AI_COACH_WIRE_OUTPUT_JSON_SCHEMA,
  estimateWireSavingsChars,
  mapAiCoachWireResponse,
  parseAiCoachOpenAiWireResponse,
  parseAiCoachWireResponse,
} from './ai-coach-wire';

const EXERCISE_ID = '11111111-1111-1111-1111-111111111111';

function wireSet(overrides: Record<string, unknown> = {}) {
  return {
    st: 'WORKING',
    r: [8, 10],
    sec: null,
    m: null,
    kg: 60,
    pct: null,
    rir: 2,
    rpe: null,
    rest: 90,
    ...overrides,
  };
}

function wireWorkout() {
  return {
    n: 'Push A',
    dur: 45,
    e: [
      {
        id: EXERCISE_ID,
        eq: null,
        note: null,
        s: [wireSet()],
      },
    ],
  };
}

describe('ai-coach-wire', () => {
  it('wire discussion → canonical discussion', () => {
    const canonical = parseAiCoachOpenAiWireResponse({
      t: 'd',
      x: 'Tu progresses bien.',
      d: null,
      rf: [],
      fu: [],
    });
    expect(canonical).toEqual({
      type: 'discussion',
      text: 'Tu progresses bien.',
      data: null,
      references: [],
      suggestedFollowUps: [],
    });
    expect(JSON.stringify(canonical)).not.toMatch(/"t":|"x":|"rf":/);
  });

  it('wire workout → canonical workout avec r:[8,10] → repsMin/Max', () => {
    const canonical = parseAiCoachOpenAiWireResponse({
      t: 'p',
      x: 'Séance push courte.',
      d: { k: 'wk', wk: wireWorkout(), pg: null },
      rf: [{ t: 'ex', id: EXERCISE_ID, l: 'Développé' }],
      fu: [],
    });
    expect(canonical.type).toBe('proposal');
    expect(canonical.data?.kind).toBe('workout');
    const set = canonical.data?.workout?.exercises[0]?.sets[0];
    expect(set?.targetRepMin).toBe(8);
    expect(set?.targetRepMax).toBe(10);
    expect(set?.targetRir).toBe(2);
    expect(set?.targetWeightKg).toBe(60);
    expect(canonical.references[0]).toEqual({
      type: 'EXERCISE',
      exerciseId: EXERCISE_ID,
      label: 'Développé',
    });
  });

  it('wire program → canonical program', () => {
    const canonical = parseAiCoachOpenAiWireResponse({
      t: 'p',
      x: 'Upper/Lower 4 jours.',
      d: {
        k: 'pg',
        wk: null,
        pg: {
          n: 'UL',
          desc: null,
          goal: 'HYPERTROPHY',
          w: [wireWorkout(), wireWorkout()],
          sch: [
            { day: 'MONDAY', wi: 0, pos: 0 },
            { day: 'THURSDAY', wi: 1, pos: 0 },
          ],
        },
      },
      rf: [],
      fu: [],
    });
    expect(canonical.data?.kind).toBe('program');
    expect(canonical.data?.program?.workouts).toHaveLength(2);
    expect(canonical.data?.program?.schedule?.[0]).toEqual({
      weekday: 'MONDAY',
      workoutIndex: 0,
      position: 0,
    });
  });

  it('refuse r range invalide', () => {
    expect(() =>
      parseAiCoachWireResponse({
        t: 'p',
        x: 'x',
        d: {
          k: 'wk',
          wk: {
            n: 'A',
            dur: null,
            e: [
              {
                id: EXERCISE_ID,
                eq: null,
                note: null,
                s: [wireSet({ r: [12, 8] })],
              },
            ],
          },
          pg: null,
        },
        rf: [],
        fu: [],
      }),
    ).toThrow();
  });

  it('refuse enum invalide', () => {
    expect(() =>
      parseAiCoachWireResponse({
        t: 'z',
        x: 'x',
        d: null,
        rf: [],
        fu: [],
      }),
    ).toThrow();
  });

  it('refuse champ manquant', () => {
    expect(() =>
      parseAiCoachWireResponse({
        t: 'd',
        d: null,
        rf: [],
        fu: [],
      }),
    ).toThrow();
  });

  it('mapAiCoachWireResponse n’expose aucune clé wire', () => {
    const wire = parseAiCoachWireResponse({
      t: 'p',
      x: 'Séance.',
      d: { k: 'wk', wk: wireWorkout(), pg: null },
      rf: [],
      fu: [],
    });
    const canonical = mapAiCoachWireResponse(wire);
    const keys = JSON.stringify(canonical);
    for (const compact of ['"t":', '"x":', '"wk":', '"pg":', '"rf":', '"fu":']) {
      expect(keys).not.toContain(compact);
    }
    expect(keys).toContain('"type":"proposal"');
    expect(keys).toContain('"exerciseId"');
  });

  it('wire schema OpenAI : strict, sans $ref, clés compactes', () => {
    const serialized = JSON.stringify(AI_COACH_WIRE_OUTPUT_JSON_SCHEMA);
    expect(serialized).not.toContain('$ref');
    expect(serialized).toContain('"t"');
    expect(serialized).toContain('"x"');
    expect(serialized).not.toContain('"discussion"');
    expect(serialized).not.toContain('"exerciseId"');

    const visit = (node: unknown): void => {
      if (Array.isArray(node)) {
        for (const item of node) visit(item);
        return;
      }
      if (node && typeof node === 'object') {
        const obj = node as Record<string, unknown>;
        if (obj.type === 'object') {
          expect(obj.additionalProperties).toBe(false);
        }
        for (const value of Object.values(obj)) visit(value);
      }
    };
    visit(AI_COACH_WIRE_OUTPUT_JSON_SCHEMA);
  });

  it('économie de caractères sur fixture program (proxy tokens)', () => {
    const wire = {
      t: 'p',
      x: 'Upper/Lower 4 jours.',
      d: {
        k: 'pg',
        wk: null,
        pg: {
          n: 'UL',
          desc: null,
          goal: 'HYPERTROPHY',
          w: [wireWorkout(), wireWorkout(), wireWorkout(), wireWorkout()],
          sch: null,
        },
      },
      rf: [],
      fu: [],
    };
    const canonical = parseAiCoachOpenAiWireResponse(wire);
    const savings = estimateWireSavingsChars(
      JSON.stringify(canonical),
      JSON.stringify(wire),
    );
    expect(savings.wireChars).toBeLessThan(savings.canonicalChars);
    expect(savings.savedRatio).toBeGreaterThan(0.15);
  });
});
