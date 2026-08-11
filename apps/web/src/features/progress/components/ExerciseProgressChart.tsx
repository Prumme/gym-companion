import type {
  ExerciseProgressMetric,
  ExerciseProgressPoint,
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

import {
  buildProgressChartAxisLabels,
  createDedupedAxisTickFormatter,
  formatProgressAxisTick,
  formatProgressChartDate,
  formatProgressMetricValue,
} from '../lib/progress-filters';
import { getExerciseProgressMetricLabel } from '../lib/progress-labels';

type ProgressChartProps = {
  points: ExerciseProgressPoint[];
  metric: ExerciseProgressMetric;
  longRange: boolean;
};

type ChartRow = {
  index: number;
  localDate: string;
  startedAt: string;
  value: number;
  workoutSessionId: string;
  label: string;
  point: ExerciseProgressPoint;
};

function ProgressTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
  metric: ExerciseProgressMetric;
}) {
  if (!active || !payload?.[0]) {
    return null;
  }
  const row = payload[0].payload;
  const { point } = row;
  const contextLines: string[] = [];

  if (metric === 'MAX_WEIGHT' && point.context.maxReps != null) {
    contextLines.push(
      `${point.context.maxReps} répétition${point.context.maxReps > 1 ? 's' : ''}`,
    );
  }
  if (metric === 'MAX_REPS' && point.context.maxWeightKg != null) {
    contextLines.push(formatProgressMetricValue('MAX_WEIGHT', point.context.maxWeightKg));
  }
  if (point.context.equipmentName) {
    contextLines.push(point.context.equipmentName);
  }
  contextLines.push(
    `${point.context.performedSetCount} série${point.context.performedSetCount > 1 ? 's' : ''} réalisée${point.context.performedSetCount > 1 ? 's' : ''}`,
  );

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{formatProgressChartDate(row.localDate, 'full')}</p>
      <p className="mt-1 font-semibold text-[var(--foreground)]">
        {formatProgressMetricValue(metric, row.value)}
      </p>
      {contextLines.map((line) => (
        <p key={line} className="text-[var(--muted)]">
          {line}
        </p>
      ))}
    </div>
  );
}

export function ExerciseProgressChart({
  points,
  metric,
  longRange,
}: ProgressChartProps) {
  const mode = longRange ? 'month' : 'short';
  const axisLabels = buildProgressChartAxisLabels(points, mode);
  const tickFormatter = createDedupedAxisTickFormatter();
  const data: ChartRow[] = points.map((point, index) => ({
    index,
    localDate: point.localDate,
    startedAt: point.startedAt,
    value: point.value,
    workoutSessionId: point.workoutSessionId,
    label: axisLabels[index] ?? formatProgressChartDate(point.localDate, mode),
    point,
  }));

  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      className="h-64 w-full min-w-0 sm:h-72"
      role="img"
      aria-label={`Graphique de ${getExerciseProgressMetricLabel(metric)}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
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
            tickFormatter={(value: number) =>
              formatProgressAxisTick(metric, value)
            }
          />
          <Tooltip
            content={<ProgressTooltip metric={metric} />}
            cursor={{ stroke: 'var(--border)' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--primary)' }}
            activeDot={{ r: 5 }}
            isAnimationActive={!reduceMotion}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
