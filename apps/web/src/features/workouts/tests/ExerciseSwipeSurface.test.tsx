import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ExerciseNavigator } from '../components/ExerciseNavigator';
import { ExerciseSwipeSurface } from '../components/ExerciseSwipeSurface';
import { createWorkoutSessionDetail, createWorkoutSet } from './fixtures';

function renderSurface(options?: {
  hasPrevious?: boolean;
  hasNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const onPrevious = options?.onPrevious ?? vi.fn();
  const onNext = options?.onNext ?? vi.fn();
  const session = createWorkoutSessionDetail({
    exercises: [
      {
        id: 'wse-1',
        position: 0,
        sourceExerciseId: 'ex-1',
        exerciseName: 'Chest Press',
        measurementType: 'WEIGHT_REPS',
        primaryMuscleGroupName: 'Pectoraux',
        sourceExerciseArchivedAtCreation: false,
        equipment: { id: null, code: null, name: null },
        notes: null,
        restSeconds: 90,
        sets: [createWorkoutSet({ actualWeightKg: 50, actualReps: 10 })],
      },
      {
        id: 'wse-2',
        position: 1,
        sourceExerciseId: 'ex-2',
        exerciseName: 'Incline Press',
        measurementType: 'WEIGHT_REPS',
        primaryMuscleGroupName: 'Pectoraux',
        sourceExerciseArchivedAtCreation: false,
        equipment: { id: null, code: null, name: null },
        notes: null,
        restSeconds: 90,
        sets: [createWorkoutSet({ id: 'ws-2' })],
      },
    ],
  });

  render(
    <ExerciseSwipeSurface
      hasPrevious={options?.hasPrevious ?? true}
      hasNext={options?.hasNext ?? true}
      onPrevious={onPrevious}
      onNext={onNext}
      exerciseKey="wse-1"
    >
      <ExerciseNavigator
        exercises={session.exercises}
        selectedExerciseId="wse-1"
        onSelect={vi.fn()}
        onPrevious={onPrevious}
        onNext={onNext}
        hasPrevious={options?.hasPrevious ?? true}
        hasNext={options?.hasNext ?? true}
      />
      <p>50 kg × 10</p>
      <input aria-label="Charge" defaultValue="50" />
    </ExerciseSwipeSurface>,
  );

  return { onPrevious, onNext };
}

class TestPointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;

  constructor(
    type: string,
    init: MouseEventInit & { pointerId?: number; pointerType?: string },
  ) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'touch';
  }
}

function swipe(target: HTMLElement, dx: number, dy: number) {
  const shared = { bubbles: true, button: 0, pointerId: 1, pointerType: 'touch' };
  act(() => {
    target.dispatchEvent(
      new TestPointerEvent('pointerdown', { ...shared, clientX: 200, clientY: 200 }),
    );
    target.dispatchEvent(
      new TestPointerEvent('pointermove', {
        ...shared,
        clientX: 200 + dx,
        clientY: 200 + dy,
      }),
    );
    target.dispatchEvent(
      new TestPointerEvent('pointerup', {
        ...shared,
        clientX: 200 + dx,
        clientY: 200 + dy,
      }),
    );
  });
}

describe('ExerciseSwipeSurface', () => {
  it('réutilise goToNext pour le swipe gauche et le bouton suivant', async () => {
    const user = userEvent.setup();
    const { onNext, onPrevious } = renderSurface();
    swipe(screen.getByText('50 kg × 10'), -100, 8);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrevious).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', { name: /Aller à l'exercice suivant/i }),
    );
    expect(onNext).toHaveBeenCalledTimes(2);
  });

  it('swipe droite appelle la même fonction que la flèche précédente', async () => {
    const user = userEvent.setup();
    const { onPrevious } = renderSurface();
    swipe(screen.getByText('50 kg × 10'), 110, 6);
    expect(onPrevious).toHaveBeenCalledTimes(1);
    await user.click(
      screen.getByRole('button', { name: /Aller à l'exercice précédent/i }),
    );
    expect(onPrevious).toHaveBeenCalledTimes(2);
  });

  it('ignore un swipe commencé sur un champ de saisie', () => {
    const { onNext } = renderSurface();
    swipe(screen.getByLabelText('Charge'), -120, 4);
    expect(onNext).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Charge')).toHaveValue('50');
  });

  it('ne change pas d’exercice au bord de la liste', () => {
    const { onNext, onPrevious } = renderSurface({
      hasPrevious: false,
      hasNext: false,
    });
    swipe(screen.getByText('50 kg × 10'), -120, 4);
    swipe(screen.getByText('50 kg × 10'), 120, 4);
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrevious).not.toHaveBeenCalled();
  });
});
