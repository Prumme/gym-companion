import type { ExerciseListItem } from '@gym-companion/shared';

import { ExerciseCard } from './ExerciseCard';

type ExerciseListProps = {
  exercises: ExerciseListItem[];
};

export function ExerciseList({ exercises }: ExerciseListProps) {
  return (
    <ul className="flex flex-col gap-3">
      {exercises.map((exercise) => (
        <li key={exercise.id}>
          <ExerciseCard exercise={exercise} />
        </li>
      ))}
    </ul>
  );
}
