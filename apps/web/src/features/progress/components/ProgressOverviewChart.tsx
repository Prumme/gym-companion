import type {
  ProgressOverviewBucket,
  ProgressOverviewMetric,
  ProgressOverviewPoint,
} from '@gym-companion/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  formatOverviewAxisTick,
  formatOverviewMetricValue,
  formatOverviewPeriodLabel,
} from '../lib/overview-filters';
import { getProgressOverviewMetricLabel } from '../lib/overview-labels';
import { formatProgressChartDate } from '../lib/progress-filters';

type OverviewChartProps = {
  points: ProgressOverviewPoint[];
  metric: ProgressOverviewMetric;
  bucket: ProgressOverviewBucket;
};

type ChartRow = {
  label: string;
  value: number;
  point: ProgressOverviewPoint;
};

function metricValue(point: ProgressOverviewPoint, metric: ProgressOverviewMetric): number {
  switch (metric) {
    case 'WORKOUT_COUNT':
      return point.workoutCount;
    case 'PERFORMED_SETS':
      return point.performedSetCount;
    case 'TOTAL_REPS':
      return point.totalReps;
    case 'WORKING_EXTERNAL_VOLUME':
      return point.workingExternalVolumeKg;
    case 'TOTAL_DURATION':
      return point.totalDurationSeconds;
    case 'TOTAL_DISTANCE':
      return point.totalDistanceMeters;
    default: {
      const _exhaustive: never = metric;
      return _exhaustive;
    }
  }
}

function OverviewTooltip({
  active,
  payload,
  metric,
  bucket,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
  metric: ProgressOverviewMetric;
  bucket: ProgressOverviewBucket;
}) {
  if (!active || !payload?.[0]) {
    return null;
  }
  const row = payload[0].payload;
  const { point } = row;
  const periodLabel =
    bucket === 'WEEK'
      ? `Semaine du ${formatProgressChartDate(point.periodStart, 'full')}`
      : bucket === 'MONTH'
        ? formatProgressChartDate(point.periodStart, 'month')
        : formatProgressChartDate(point.periodStart, 'full');

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{periodLabel}</p>
      <p className="mt-1 font-semibold">
        {formatOverviewMetricValue(metric, row.value)}
      </p>
      {metric !== 'WORKOUT_COUNT' ? (
        <p className="text-[var(--muted)]">
          {point.workoutCount} séance{point.workoutCount > 1 ? 's' : ''}
        </p>
      ) : null}
    </div>
  );
}

export function ProgressOverviewChart({
  points,
  metric,
  bucket,
}: OverviewChartProps) {
  const data: ChartRow[] = points.map((point) => ({
    label: formatOverviewPeriodLabel(point.periodStart, point.periodEnd, bucket),
    value: metricValue(point, metric),
    point,
  }));

  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const useBars = metric === 'WORKOUT_COUNT' || metric === 'PERFORMED_SETS';

  return (
    <div
      className="h-64 w-full min-w-0 sm:h-72"
      role="img"
      aria-label={`Graphique de ${getProgressOverviewMetricLabel(metric)}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        {useBars ? (
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--muted)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: 'var(--muted)' }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(value: number) =>
                formatOverviewAxisTick(metric, value)
              }
            />
            <Tooltip
              content={<OverviewTooltip metric={metric} bucket={bucket} />}
              cursor={{ fill: 'var(--border)', opacity: 0.35 }}
            />
            <Bar
              dataKey="value"
              fill="var(--primary)"
              radius={[4, 4, 0, 0]}
              isAnimationActive={!reduceMotion}
            />
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--muted)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 12, fill: 'var(--muted)' }}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(value: number) =>
                formatOverviewAxisTick(metric, value)
              }
            />
            <Tooltip
              content={<OverviewTooltip metric={metric} bucket={bucket} />}
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
        )}
      </ResponsiveContainer>
    </div>
  );
}
