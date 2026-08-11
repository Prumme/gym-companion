import type {
  EstimatedStrengthPoint,
  EstimatedStrengthSource,
  ExerciseStrengthSummary,
} from '@gym-companion/shared';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Link } from 'react-router-dom';

import { ButtonLink } from '@/components/ui/button';
import { formatPersonalRecordWeight } from '@/features/personal-records/lib/personal-record-labels';

import {
  buildProgressChartAxisLabels,
  createDedupedAxisTickFormatter,
  formatProgressChartDate,
} from '../lib/progress-filters';
import {
  formatEstimatedOneRepMaxKg,
  formatStrengthSourceSet,
} from '../lib/strength-format';

function formatSignedKg(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatEstimatedOneRepMaxKg(value)}`;
}

function formatSignedPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  const pct = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 1,
  }).format(value);
  return `${sign}${pct} %`;
}

type StrengthChartRow = {
  index: number;
  localDate: string;
  estimatedOneRepMaxKg: number;
  label: string;
  point: EstimatedStrengthPoint;
};

function StrengthTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: StrengthChartRow }>;
}) {
  if (!active || !payload?.[0]) {
    return null;
  }
  const row = payload[0].payload;
  const { sourceSet } = row.point;
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">
        {formatProgressChartDate(row.localDate, 'full')}
      </p>
      <p className="mt-1 font-semibold text-[var(--foreground)]">
        1RM estimé : {formatEstimatedOneRepMaxKg(row.estimatedOneRepMaxKg)}
      </p>
      <p className="text-[var(--muted)]">
        Série source : {formatStrengthSourceSet(sourceSet)}
      </p>
      {sourceSet.rir != null ? (
        <p className="text-[var(--muted)]">RIR : {sourceSet.rir}</p>
      ) : null}
      {sourceSet.rpe != null ? (
        <p className="text-[var(--muted)]">RPE : {sourceSet.rpe}</p>
      ) : null}
    </div>
  );
}

function SourceCard({
  title,
  valueKg,
  source,
}: {
  title: string;
  valueKg: number;
  source: EstimatedStrengthSource;
}) {
  return (
    <article className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
      <h3 className="text-sm font-medium text-[var(--muted)]">{title}</h3>
      <p className="mt-1 text-2xl font-bold tracking-tight">
        {formatEstimatedOneRepMaxKg(valueKg)}
      </p>
      <p className="mt-2 text-sm text-[var(--foreground)]">
        Calculé depuis : {formatStrengthSourceSet(source)}
      </p>
      <p className="text-sm text-[var(--muted)]">
        {formatProgressChartDate(source.localDate, 'full')}
      </p>
      <ButtonLink
        to={`/workouts/${source.workoutSessionId}`}
        variant="ghost"
        className="mt-2 h-auto px-0 text-sm font-semibold text-[var(--primary)]"
      >
        Voir la séance
      </ButtonLink>
    </article>
  );
}

type EstimatedStrengthSectionProps = {
  supported: boolean;
  formula: string;
  eligibility: { minReps: number; maxReps: number };
  summary: ExerciseStrengthSummary | null;
  points: EstimatedStrengthPoint[];
  longRange: boolean;
  maxWeightLatestKg: number | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

export function EstimatedStrengthSection({
  supported,
  formula,
  eligibility,
  summary,
  points,
  longRange,
  maxWeightLatestKg,
  isLoading,
  isError,
  onRetry,
}: EstimatedStrengthSectionProps) {
  if (!supported) {
    return null;
  }

  if (isLoading) {
    return (
      <section aria-labelledby="strength-heading" className="flex flex-col gap-3">
        <h2 id="strength-heading" className="text-lg font-semibold">
          Force estimée
        </h2>
        <p className="text-sm text-[var(--muted)]">Chargement de la force estimée…</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section aria-labelledby="strength-heading" className="flex flex-col gap-3">
        <h2 id="strength-heading" className="text-lg font-semibold">
          Force estimée
        </h2>
        <div
          className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <p className="text-sm text-[var(--danger)]">
            Impossible de charger la force estimée.
          </p>
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
            onClick={onRetry}
          >
            Réessayer
          </button>
        </div>
      </section>
    );
  }

  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const mode = longRange ? 'month' : 'short';
  const axisLabels = buildProgressChartAxisLabels(points, mode);
  const tickFormatter = createDedupedAxisTickFormatter();
  const chartData: StrengthChartRow[] = points.map((point, index) => ({
    index,
    localDate: point.localDate,
    estimatedOneRepMaxKg: point.estimatedOneRepMaxKg,
    label: axisLabels[index] ?? formatProgressChartDate(point.localDate, mode),
    point,
  }));

  return (
    <section
      aria-labelledby="strength-heading"
      className="flex flex-col gap-4 border-t border-[var(--border)] pt-6"
    >
      <div>
        <h2 id="strength-heading" className="text-lg font-semibold">
          Force estimée
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Le 1RM estimé est une estimation calculée à partir de la charge et du
          nombre de répétitions d’une série.
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Formule : Epley
          {formula === 'EPLEY_V1' ? ' (V1)' : ''}
          {' · '}
          Calcul utilisé pour les séries de {eligibility.minReps} à{' '}
          {eligibility.maxReps} répétitions.
        </p>
      </div>

      {points.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-sm font-medium text-[var(--foreground)]">
            Pas encore assez de données pour estimer ton 1RM.
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Une série terminée entre {eligibility.minReps} et{' '}
            {eligibility.maxReps} répétitions avec une charge enregistrée
            permettra de calculer une estimation.
          </p>
        </div>
      ) : null}

      {summary && summary.latestEstimatedOneRepMaxKg != null && summary.latestSource ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <SourceCard
            title="1RM estimé actuel"
            valueKg={summary.latestEstimatedOneRepMaxKg}
            source={summary.latestSource}
          />
          {summary.bestEstimatedOneRepMaxKg != null && summary.bestSource ? (
            <SourceCard
              title="Meilleure estimation"
              valueKg={summary.bestEstimatedOneRepMaxKg}
              source={summary.bestSource}
            />
          ) : null}
        </div>
      ) : null}

      {summary &&
      maxWeightLatestKg != null &&
      summary.latestEstimatedOneRepMaxKg != null ? (
        <div className="grid grid-cols-2 gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
          <div>
            <p className="text-xs font-medium text-[var(--muted)]">
              Charge maximale réelle
            </p>
            <p className="mt-1 text-lg font-semibold">
              {formatPersonalRecordWeight(maxWeightLatestKg)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--muted)]">
              1RM estimé
            </p>
            <p className="mt-1 text-lg font-semibold">
              {formatEstimatedOneRepMaxKg(summary.latestEstimatedOneRepMaxKg)}
            </p>
          </div>
        </div>
      ) : null}

      {summary && summary.pointCount < 2 ? (
        <p className="text-sm text-[var(--muted)]">
          Pas encore assez de données pour comparer l’évolution.
        </p>
      ) : null}

      {summary &&
      summary.absoluteChangeKg != null &&
      summary.pointCount >= 2 ? (
        <p className="text-sm font-medium text-[var(--foreground)]">
          Variation : {formatSignedKg(summary.absoluteChangeKg)}
          {summary.percentageChange != null
            ? ` · ${formatSignedPercent(summary.percentageChange)}`
            : ''}
        </p>
      ) : null}

      {points.length > 0 ? (
        <div
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4"
          role="img"
          aria-label="Graphique du 1RM estimé"
        >
          <h3 className="mb-2 text-sm font-semibold">1RM estimé</h3>
          <div className="h-64 w-full min-w-0 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: 'var(--muted)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                  interval="preserveStartEnd"
                  minTickGap={28}
                  tickFormatter={tickFormatter}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--muted)' }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  unit=" kg"
                  tickFormatter={(value: number) =>
                    new Intl.NumberFormat('fr-FR', {
                      maximumFractionDigits: 1,
                    }).format(value)
                  }
                />
                <Tooltip
                  content={<StrengthTooltip />}
                  cursor={{ stroke: 'var(--border)' }}
                />
                <Line
                  type="monotone"
                  dataKey="estimatedOneRepMaxKg"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--primary)' }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={!reduceMotion}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {points.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Historique du 1RM estimé</h3>
          <ol className="flex flex-col gap-2">
            {[...points].reverse().map((point) => (
              <li
                key={`${point.workoutSessionId}-${point.sourceSet.workoutSetId}`}
                className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">
                    {formatEstimatedOneRepMaxKg(point.estimatedOneRepMaxKg)}
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    {formatProgressChartDate(point.localDate, 'full')}
                  </p>
                </div>
                <p className="text-sm text-[var(--muted)]">
                  Série source : {formatStrengthSourceSet(point.sourceSet)}
                </p>
                <Link
                  to={`/workouts/${point.workoutSessionId}`}
                  className="mt-1 inline-block text-sm font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
                >
                  Voir la séance
                </Link>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
