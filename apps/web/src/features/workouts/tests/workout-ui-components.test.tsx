import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ExerciseNavigator } from '../components/ExerciseNavigator';
import { WorkoutProgressBanner } from '../components/WorkoutProgressBanner';
import { WorkoutSetCard } from '../components/WorkoutSetCard';
import { ActiveWorkoutHeader } from '../components/ActiveWorkoutHeader';
import { RestTimer } from '../components/RestTimer';
import { computeWorkoutProgress } from '../lib/workout-progress';
import { createWorkoutSessionDetail, createWorkoutSet } from './fixtures';

describe('composants séance (3.4)', () => {
  it('affiche l’en-tête actif avec pause', () => {
    const session = createWorkoutSessionDetail();
    render(
      <ActiveWorkoutHeader
        session={session}
        progress={computeWorkoutProgress(session)}
        onPause={() => undefined}
        onOpenComplete={() => undefined}
        onOpenCancel={() => undefined}
      />,
    );
    expect(screen.getByText(/Statut : En cours/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mettre en pause/i })).toBeInTheDocument();
  });

  it('affiche l’en-tête en pause avec reprise', () => {
    const session = createWorkoutSessionDetail({
      status: 'PAUSED',
      pausedAt: '2026-08-04T10:10:00.000Z',
      permissions: {
        canPause: false,
        canResume: true,
        canComplete: true,
        canCancel: true,
        canRecordSets: false,
      },
    });
    render(
      <ActiveWorkoutHeader
        session={session}
        progress={computeWorkoutProgress(session)}
        onResume={() => undefined}
        onOpenComplete={() => undefined}
        onOpenCancel={() => undefined}
      />,
    );
    expect(screen.getByText(/Statut : En pause/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Reprendre la séance/i }),
    ).toBeInTheDocument();
  });

  it('affiche la progression', () => {
    render(
      <WorkoutProgressBanner
        progress={{
          totalSets: 12,
          recordedSets: 5,
          pendingSets: 7,
          completedSets: 3,
          partialSets: 1,
          failedSets: 0,
          skippedSets: 1,
          totalExercises: 4,
          treatedExercises: 2,
        }}
      />,
    );
    expect(screen.getByText(/5 séries enregistrées sur 12/i)).toBeInTheDocument();
    expect(screen.getByText(/2 exercices traités sur 4/i)).toBeInTheDocument();
  });

  it('navigue entre exercices', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    const session = createWorkoutSessionDetail({
      exercises: [
        {
          id: 'wse-1',
          position: 0,
          sourceExerciseId: 'ex-1',
          exerciseName: 'Développé couché',
          measurementType: 'WEIGHT_REPS',
          primaryMuscleGroupName: 'Pectoraux',
          sourceExerciseArchivedAtCreation: false,
          equipment: { id: 'eq-1', code: 'barbell', name: 'Barre' },
          notes: null,
          restSeconds: 90,
          sets: [createWorkoutSet()],
        },
        {
          id: 'wse-2',
          position: 1,
          sourceExerciseId: 'ex-2',
          exerciseName: 'Élévations',
          measurementType: 'WEIGHT_REPS',
          primaryMuscleGroupName: 'Épaules',
          sourceExerciseArchivedAtCreation: false,
          equipment: { id: 'eq-2', code: 'dumbbell', name: 'Haltères' },
          notes: null,
          restSeconds: 60,
          sets: [createWorkoutSet({ id: 'ws-2' })],
        },
      ],
    });

    render(
      <ExerciseNavigator
        exercises={session.exercises}
        selectedExerciseId="wse-1"
        onSelect={onSelect}
        onPrevious={onPrevious}
        onNext={onNext}
        hasPrevious={false}
        hasNext
      />,
    );

    expect(screen.getByRole('button', { name: /Exercice précédent/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Exercice suivant/i }));
    expect(onNext).toHaveBeenCalled();
    await user.click(screen.getByRole('tab', { name: /Élévations/i }));
    expect(onSelect).toHaveBeenCalledWith('wse-2');
  });

  it('met en évidence la prochaine série et affiche les statuts', () => {
    const pending = createWorkoutSet({ status: 'PENDING' });
    const completed = createWorkoutSet({
      id: 'ws-2',
      status: 'COMPLETED',
      actualWeightKg: 60,
      actualReps: 9,
      actualRir: 1,
    });
    const partial = createWorkoutSet({ id: 'ws-3', status: 'PARTIAL', actualReps: 5 });
    const failed = createWorkoutSet({ id: 'ws-4', status: 'FAILED', actualReps: 2 });
    const skipped = createWorkoutSet({ id: 'ws-5', status: 'SKIPPED' });

    const { rerender } = render(
      <ul>
        <WorkoutSetCard
          set={pending}
          canRecord
          isNext
          onEdit={() => undefined}
          onSkip={() => undefined}
          onMarkFailed={() => undefined}
        />
      </ul>,
    );
    expect(screen.getByText('Prochaine série')).toBeInTheDocument();
    expect(screen.getByText(/Statut : À faire/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Saisir la série/i })).toBeInTheDocument();

    rerender(
      <ul>
        <WorkoutSetCard set={completed} canRecord isNext={false} onEdit={() => undefined} />
      </ul>,
    );
    expect(screen.getByText(/Statut : Terminée/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Modifier$/i })).toBeInTheDocument();

    rerender(
      <ul>
        <WorkoutSetCard set={partial} canRecord={false} isNext={false} onEdit={() => undefined} />
      </ul>,
    );
    expect(screen.getByText(/Statut : Partielle/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Saisir|Modifier/i })).not.toBeInTheDocument();

    rerender(
      <ul>
        <WorkoutSetCard set={failed} canRecord={false} isNext={false} onEdit={() => undefined} />
      </ul>,
    );
    expect(screen.getByText(/Statut : Échouée/i)).toBeInTheDocument();

    rerender(
      <ul>
        <WorkoutSetCard set={skipped} canRecord={false} isNext={false} onEdit={() => undefined} />
      </ul>,
    );
    expect(screen.getByText(/Statut : Ignorée/i)).toBeInTheDocument();
  });

  it('affiche les commandes de minuterie', async () => {
    const user = userEvent.setup();
    const onPause = vi.fn();
    const onAdd = vi.fn();
    render(
      <RestTimer
        remainingSeconds={90}
        isRunning
        isPaused={false}
        justExpired={false}
        onPause={onPause}
        onResume={() => undefined}
        onStop={() => undefined}
        onAdd={onAdd}
        onDismissExpired={() => undefined}
      />,
    );
    expect(screen.getByRole('timer')).toHaveTextContent('01:30');
    await user.click(screen.getByRole('button', { name: /Mettre le repos en pause/i }));
    expect(onPause).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Ajouter 15 secondes/i }));
    expect(onAdd).toHaveBeenCalledWith(15);
  });

  it('affiche Repos terminé', () => {
    render(
      <RestTimer
        remainingSeconds={0}
        isRunning={false}
        isPaused={false}
        justExpired
        onPause={() => undefined}
        onResume={() => undefined}
        onStop={() => undefined}
        onAdd={() => undefined}
        onDismissExpired={() => undefined}
      />,
    );
    expect(screen.getByText('Repos terminé')).toBeInTheDocument();
  });
});
