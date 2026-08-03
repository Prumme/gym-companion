import type { InfiniteData } from '@tanstack/react-query';
import type {
  ExerciseDetail,
  ExerciseListItem,
  ExerciseListResponse,
  ExerciseUserPreference,
} from '@gym-companion/shared';

export type ExerciseInfiniteData = InfiniteData<ExerciseListResponse, string | undefined>;

export function applyPreferenceToListItem(
  item: ExerciseListItem,
  preference: ExerciseUserPreference,
): ExerciseListItem {
  return {
    ...item,
    userPreference: preference,
  };
}

export function applyPreferenceToDetail(
  detail: ExerciseDetail,
  preference: ExerciseUserPreference,
): ExerciseDetail {
  return {
    ...detail,
    userPreference: preference,
  };
}

/**
 * Met à jour ou retire un exercice dans toutes les pages d’une liste infinie.
 * Retourner `null` depuis `updater` retire l’élément.
 */
export function updateExerciseInInfiniteData(
  data: ExerciseInfiniteData,
  exerciseId: string,
  updater: (item: ExerciseListItem) => ExerciseListItem | null,
): ExerciseInfiniteData {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      data: page.data.flatMap((item) => {
        if (item.id !== exerciseId) {
          return [item];
        }
        const next = updater(item);
        return next ? [next] : [];
      }),
    })),
  };
}

export function removeExerciseFromInfiniteData(
  data: ExerciseInfiniteData,
  exerciseId: string,
): ExerciseInfiniteData {
  return updateExerciseInInfiniteData(data, exerciseId, () => null);
}

export function detailToListItem(detail: ExerciseDetail): ExerciseListItem {
  return {
    id: detail.id,
    source: detail.source,
    name: detail.name,
    measurementType: detail.measurementType,
    primaryMuscleGroup: detail.primaryMuscleGroup,
    defaultEquipmentType: detail.defaultEquipmentType,
    defaultRestSeconds: detail.defaultRestSeconds,
    archivedAt: detail.archivedAt,
    permissions: detail.permissions,
    userPreference: detail.userPreference,
  };
}

export function mergeDetailIntoListItem(
  item: ExerciseListItem,
  detail: ExerciseDetail,
): ExerciseListItem {
  return {
    ...detailToListItem(detail),
    // Préférences déjà présentes dans la liste priment si le détail
    // n’apporte pas de différence (évite une régression visuelle).
    userPreference: detail.userPreference ?? item.userPreference,
  };
}
