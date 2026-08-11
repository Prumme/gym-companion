import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ExerciseNavigator } from '../components/ExerciseNavigator';
import { WorkoutProgressBanner } from '../components/WorkoutProgressBanner';
import { WorkoutSetCard } from '../components/WorkoutSetCard';
import { ActiveWorkoutHeader } from '../components/ActiveWorkoutHeader';
import { RestTimer } from '../components/RestTimer';
import { computeWorkoutProgress } from '../lib/workout-progress';
import { createWorkoutSessionDetail, createWorkoutSet } from './fixtures';

describe('composants séance (UX-2)', () => {
  it('affiche l’en-tête focus avec menu pause', async () => {
    const user = userEvent.setup();
    const session = createWorkoutSessionDetail();
    render(
      <MemoryRouter>
        <ActiveWorkoutHeader
          session={session}
          progress={computeWorkoutProgress(session)}
          currentExerciseIndex={0}
          totalExercises={1}
          onPause={() => undefined}
          onOpenComplete={() => undefined}
          onOpenCancel={() => undefined}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Séance Push' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Quitter la séance sans la terminer/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Statut : En cours/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Actions de séance/i }));
    expect(
      screen.getByRole('menuitem', { name: /Mettre en pause/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /Détails de la séance/i }),
    ).toBeInTheDocument();
  });

  it('affiche la reprise en pause via le menu', async () => {
    const user = userEvent.setup();
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
      <MemoryRouter>
        <ActiveWorkoutHeader
          session={session}
          progress={computeWorkoutProgress(session)}
          currentExerciseIndex={0}
          totalExercises={1}
          onResume={() => undefined}
          onOpenComplete={() => undefined}
          onOpenCancel={() => undefined}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: /Actions de séance/i }));
    expect(
      screen.getByRole('menuitem', { name: /Reprendre la séance/i }),
    ).toBeInTheDocument();
  });

  it('affiche la progression compacte', () => {
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
    expect(screen.getByText(/5 \/ 12 séries/i)).toBeInTheDocument();
    expect(screen.getByText(/42 %/i)).toBeInTheDocument();
    expect(screen.getByText(/Exercice 2 \/ 4/i)).toBeInTheDocument();
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

    expect(
      screen.getByRole('button', { name: /Aller à l'exercice précédent/i }),
    ).toBeDisabled();
    expect(screen.getByText(/Exercice 1 \/ 2/i)).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: /Aller à l'exercice suivant/i }),
    );
    expect(onNext).toHaveBeenCalled();
    await user.click(screen.getByRole('tab', { name: /Élévations/i }));
    expect(onSelect).toHaveBeenCalledWith('wse-2');
  });

  it('met en évidence la série courante et les statuts compactés', () => {
    const pending = createWorkoutSet({ status: 'PENDING' });
    const completed = createWorkoutSet({
      id: 'ws-2',
      status: 'COMPLETED',
      actualWeightKg: 60,
      actualReps: 9,
      actualRir: 1,
    });
    const partial = createWorkoutSet({
      id: 'ws-3',
      status: 'PARTIAL',
      actualReps: 5,
    });
    const failed = createWorkoutSet({
      id: 'ws-4',
      status: 'FAILED',
      actualReps: 2,
    });
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
    expect(screen.getByText('Courante')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /série courante/i }),
    ).toBeInTheDocument();

    rerender(
      <ul>
        <WorkoutSetCard
          set={completed}
          canRecord
          isNext={false}
          onEdit={() => undefined}
        />
      </ul>,
    );
    expect(screen.getByRole('button', { name: /Terminée/i })).toBeInTheDocument();
    expect(screen.getByText(/9 reps/i)).toBeInTheDocument();

    rerender(
      <ul>
        <WorkoutSetCard
          set={partial}
          canRecord={false}
          isNext={false}
          onEdit={() => undefined}
        />
      </ul>,
    );
    expect(
      screen.getByRole('button', { name: /Partielle/i }),
    ).toBeDisabled();

    rerender(
      <ul>
        <WorkoutSetCard
          set={failed}
          canRecord={false}
          isNext={false}
          onEdit={() => undefined}
        />
      </ul>,
    );
    expect(screen.getByRole('button', { name: /Échouée/i })).toBeDisabled();

    rerender(
      <ul>
        <WorkoutSetCard
          set={skipped}
          canRecord={false}
          isNext={false}
          onEdit={() => undefined}
        />
      </ul>,
    );
    expect(screen.getByRole('button', { name: /Ignorée/i })).toBeDisabled();
  });

  it('affiche les commandes de minuterie compactes', async () => {
    const user = userEvent.setup();
    const onPause = vi.fn();
    const onAdd = vi.fn();
    const onStop = vi.fn();
    render(
      <RestTimer
        remainingSeconds={90}
        isRunning
        isPaused={false}
        justExpired={false}
        onPause={onPause}
        onResume={() => undefined}
        onStop={onStop}
        onAdd={onAdd}
        onDismissExpired={() => undefined}
      />,
    );
    expect(screen.getByRole('timer')).toHaveTextContent('01:30');
    await user.click(
      screen.getByRole('button', { name: /Mettre le repos en pause/i }),
    );
    expect(onPause).toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: /Ajouter 15 secondes/i }),
    );
    expect(onAdd).toHaveBeenCalledWith(15);
    await user.click(
      screen.getByRole('button', { name: /Retirer 15 secondes/i }),
    );
    expect(onAdd).toHaveBeenCalledWith(-15);
    await user.click(screen.getByRole('button', { name: /Passer le repos/i }));
    expect(onStop).toHaveBeenCalled();
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
    expect(screen.getByText('Repos')).toBeInTheDocument();
    expect(screen.getByText('Terminé')).toBeInTheDocument();
  });

  it('expose Exercice suivant comme action principale pendant le repos', async () => {
    const user = userEvent.setup();
    const onPrimary = vi.fn();
    render(
      <RestTimer
        remainingSeconds={60}
        isRunning
        isPaused={false}
        justExpired={false}
        onPause={() => undefined}
        onResume={() => undefined}
        onStop={() => undefined}
        onAdd={() => undefined}
        onDismissExpired={() => undefined}
        primaryActionLabel="Exercice suivant"
        onPrimaryAction={onPrimary}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: /^Exercice suivant$/i }),
    );
    expect(onPrimary).toHaveBeenCalled();
  });
});
