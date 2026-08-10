import type { PersonalRecord } from '@gym-companion/shared';
import { Link } from 'react-router-dom';

import {
  formatPersonalRecordContext,
  formatPersonalRecordDate,
  formatPersonalRecordValue,
  getPersonalRecordTypeLabel,
} from '../lib/personal-record-labels';

type PersonalRecordCardProps = {
  record: PersonalRecord;
  showExerciseLink?: boolean;
};

export function PersonalRecordCard({
  record,
  showExerciseLink = true,
}: PersonalRecordCardProps) {
  const contextParts = formatPersonalRecordContext(record);
  const typeLabel = getPersonalRecordTypeLabel(record.recordType);
  const valueLabel = formatPersonalRecordValue(record);

  return (
    <article
      className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4"
      aria-label={`${typeLabel} : ${valueLabel}`}
    >
      <h3 className="text-sm font-semibold text-[var(--foreground)]">
        {typeLabel}
      </h3>
      <p className="mt-1 text-2xl font-bold tracking-tight">{valueLabel}</p>
      {contextParts.length > 0 ? (
        <p className="mt-1 text-sm text-[var(--muted)]">
          {contextParts.join(' · ')}
        </p>
      ) : null}
      {record.equipment.name ? (
        <p className="mt-2 text-sm text-[var(--muted)]">
          Équipement : {record.equipment.name}
        </p>
      ) : null}
      <p className="mt-2 text-sm text-[var(--muted)]">
        {formatPersonalRecordDate(record.achievedOn)}
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-sm font-medium">
        <Link
          to={`/workouts/${record.source.workoutSessionId}`}
          className="text-[var(--primary)] underline-offset-2 hover:underline"
        >
          Voir la séance
        </Link>
        {showExerciseLink ? (
          <Link
            to={`/exercises/${record.exerciseId}`}
            className="text-[var(--primary)] underline-offset-2 hover:underline"
          >
            Voir l’exercice
          </Link>
        ) : null}
      </div>
    </article>
  );
}
