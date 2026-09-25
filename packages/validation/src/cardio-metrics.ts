/**
 * Métriques cardio dérivées et formatage.
 * Unités canoniques : durée en secondes, distance en mètres.
 * Allure et vitesse ne sont pas persistées.
 */

export type CardioDerivedMetrics = {
  averagePaceSecondsPerKm: number | null;
  averageSpeedKmh: number | null;
};

const MAX_DURATION_SECONDS = 86_400;
const MAX_DISTANCE_METERS = 1_000_000;

export function isFiniteNonNegative(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value >= 0;
}

export function formatDuration(totalSeconds: number | null | undefined): string | null {
  if (!isFiniteNonNegative(totalSeconds)) {
    return null;
  }
  const rounded = Math.floor(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function parseDurationParts(
  hours: number,
  minutes: number,
  seconds: number,
): number | null {
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours < 0 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }
  const total = hours * 3600 + minutes * 60 + seconds;
  if (total > MAX_DURATION_SECONDS) {
    return null;
  }
  return total;
}

export function splitDuration(totalSeconds: number | null | undefined): {
  hours: number;
  minutes: number;
  seconds: number;
} {
  if (!isFiniteNonNegative(totalSeconds)) {
    return { hours: 0, minutes: 0, seconds: 0 };
  }
  const rounded = Math.min(MAX_DURATION_SECONDS, Math.floor(totalSeconds));
  return {
    hours: Math.floor(rounded / 3600),
    minutes: Math.floor((rounded % 3600) / 60),
    seconds: rounded % 60,
  };
}

export function metersToKilometers(meters: number | null | undefined): number | null {
  if (!isFiniteNonNegative(meters)) {
    return null;
  }
  return meters / 1000;
}

export function kilometersToMeters(kilometers: number | null | undefined): number | null {
  if (!isFiniteNonNegative(kilometers)) {
    return null;
  }
  const meters = kilometers * 1000;
  if (meters > MAX_DISTANCE_METERS) {
    return null;
  }
  return Math.round(meters * 100) / 100;
}

export function formatDistanceMeters(meters: number | null | undefined): string | null {
  if (!isFiniteNonNegative(meters)) {
    return null;
  }
  if (meters >= 1000) {
    const km = meters / 1000;
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: km < 10 ? 1 : 0,
      maximumFractionDigits: 2,
    }).format(km);
    return `${formatted} km`;
  }
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(Math.round(meters));
  return `${formatted} m`;
}

/** Allure moyenne en secondes par kilomètre. Null si durée ou distance nulle. */
export function computeAveragePaceSecondsPerKm(
  distanceMeters: number | null | undefined,
  durationSeconds: number | null | undefined,
): number | null {
  if (!isFiniteNonNegative(distanceMeters) || !isFiniteNonNegative(durationSeconds)) {
    return null;
  }
  if (distanceMeters === 0 || durationSeconds === 0) {
    return null;
  }
  return (durationSeconds / distanceMeters) * 1000;
}

/** Vitesse moyenne en km/h. Null si durée ou distance nulle. */
export function computeAverageSpeedKmh(
  distanceMeters: number | null | undefined,
  durationSeconds: number | null | undefined,
): number | null {
  if (!isFiniteNonNegative(distanceMeters) || !isFiniteNonNegative(durationSeconds)) {
    return null;
  }
  if (distanceMeters === 0 || durationSeconds === 0) {
    return null;
  }
  const hours = durationSeconds / 3600;
  return distanceMeters / 1000 / hours;
}

export function computeCardioDerivedMetrics(
  distanceMeters: number | null | undefined,
  durationSeconds: number | null | undefined,
): CardioDerivedMetrics {
  return {
    averagePaceSecondsPerKm: computeAveragePaceSecondsPerKm(
      distanceMeters,
      durationSeconds,
    ),
    averageSpeedKmh: computeAverageSpeedKmh(distanceMeters, durationSeconds),
  };
}

export function formatPace(paceSecondsPerKm: number | null | undefined): string | null {
  if (!isFiniteNonNegative(paceSecondsPerKm) || paceSecondsPerKm === 0) {
    return null;
  }
  const rounded = Math.round(paceSecondsPerKm);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
}

export function formatSpeedKmh(speedKmh: number | null | undefined): string | null {
  if (!isFiniteNonNegative(speedKmh) || speedKmh === 0) {
    return null;
  }
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(speedKmh);
  return `${formatted} km/h`;
}

export const CARDIO_MEASUREMENT_TYPES = [
  'DURATION',
  'DISTANCE',
  'DISTANCE_DURATION',
] as const;

export type CardioMeasurementType = (typeof CARDIO_MEASUREMENT_TYPES)[number];

export function isCardioMeasurementType(
  measurementType: string,
): measurementType is CardioMeasurementType {
  return (CARDIO_MEASUREMENT_TYPES as readonly string[]).includes(measurementType);
}

export type CardioHistorySetInput = {
  status: string;
  actualDurationSeconds: number | null;
  actualDistanceMeters: number | null;
};

export type CardioHistorySessionInput = {
  workoutSessionId: string;
  localDate: string;
  sessionRpe: number | null;
  notes: string | null;
  sets: CardioHistorySetInput[];
};

export type CardioHistoryEntry = {
  workoutSessionId: string;
  localDate: string;
  durationSeconds: number | null;
  distanceMeters: number | null;
  averagePaceSecondsPerKm: number | null;
  averageSpeedKmh: number | null;
  sessionRpe: number | null;
  notes: string | null;
};

const PERFORMED = new Set(['COMPLETED', 'PARTIAL', 'FAILED']);

export function buildCardioHistoryEntries(
  sessions: CardioHistorySessionInput[],
): CardioHistoryEntry[] {
  return sessions
    .map((session) => {
      let durationSeconds = 0;
      let distanceMeters = 0;
      let hasDuration = false;
      let hasDistance = false;
      for (const set of session.sets) {
        if (!PERFORMED.has(set.status)) {
          continue;
        }
        if (isFiniteNonNegative(set.actualDurationSeconds)) {
          durationSeconds += set.actualDurationSeconds;
          hasDuration = true;
        }
        if (isFiniteNonNegative(set.actualDistanceMeters)) {
          distanceMeters += set.actualDistanceMeters;
          hasDistance = true;
        }
      }
      const duration = hasDuration ? durationSeconds : null;
      const distance = hasDistance ? distanceMeters : null;
      const derived = computeCardioDerivedMetrics(distance, duration);
      return {
        workoutSessionId: session.workoutSessionId,
        localDate: session.localDate,
        durationSeconds: duration,
        distanceMeters: distance,
        averagePaceSecondsPerKm: derived.averagePaceSecondsPerKm,
        averageSpeedKmh: derived.averageSpeedKmh,
        sessionRpe: session.sessionRpe,
        notes: session.notes,
      };
    })
    .filter(
      (entry) => entry.durationSeconds != null || entry.distanceMeters != null,
    );
}
