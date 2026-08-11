import type { ExerciseListItem } from '@gym-companion/shared';

import { ExerciseCard } from './ExerciseCard';

type ExerciseListProps = {
  exercises: ExerciseListItem[];
  onFeedback?: (message: string | null) => void;
};

export function ExerciseList({ exercises, onFeedback }: ExerciseListProps) {
  return (
    <ul className="flex flex-col">
      {exercises.map((exercise) => (
        <li key={exercise.id}>
          <ExerciseCard exercise={exercise} onFeedback={onFeedback} />
        </li>
      ))}
    </ul>
  );
}
