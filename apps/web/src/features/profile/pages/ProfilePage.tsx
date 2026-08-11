import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  profileFormSchema,
  toUpdateProfilePayload,
  type ProfileFormValues,
} from '@gym-companion/validation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { LoadingState } from '@/components/common/LoadingState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { logout } from '@/features/auth/api/auth-api';
import { getMe, updateProfile, type MeResponse } from '@/features/profile/api/profile-api';
import { clearWorkoutOfflineDataForUser } from '@/features/workouts/offline/clear-user-data';
import { hasPendingCommandsForUser } from '@/features/workouts/offline/store';
import { getApiErrorMessage } from '@/lib/api/client';

function profileToFormValues(profile: MeResponse['data']['profile']): ProfileFormValues {
  return {
    displayName: profile.displayName,
    timezone: profile.timezone,
    weightUnit: profile.weightUnit,
    distanceUnit: profile.distanceUnit,
    primaryGoal: profile.primaryGoal,
    experienceLevel: profile.experienceLevel,
    effortTrackingMode: profile.effortTrackingMode,
    heightCm: profile.heightCm,
    currentWeightKg: profile.currentWeightKg,
  };
}

const GOAL_LABELS: Record<ProfileFormValues['primaryGoal'], string> = {
  GENERAL_FITNESS: 'Forme générale',
  HYPERTROPHY: 'Hypertrophie',
  STRENGTH: 'Force',
  ENDURANCE: 'Endurance',
};

const LEVEL_LABELS: Record<ProfileFormValues['experienceLevel'], string> = {
  BEGINNER: 'Débutant',
  INTERMEDIATE: 'Intermédiaire',
  ADVANCED: 'Avancé',
};

const EFFORT_LABELS: Record<ProfileFormValues['effortTrackingMode'], string> = {
  NONE: 'Aucun',
  RIR: 'RIR',
  RPE: 'RPE',
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <span className="text-sm text-[var(--danger)]">{message}</span>;
}

export function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: '',
      timezone: 'Europe/Paris',
      weightUnit: 'KG',
      distanceUnit: 'KM',
      primaryGoal: 'GENERAL_FITNESS',
      experienceLevel: 'BEGINNER',
      effortTrackingMode: 'NONE',
      heightCm: null,
      currentWeightKg: null,
    },
  });

  useEffect(() => {
    if (meQuery.data) {
      form.reset(profileToFormValues(meQuery.data.data.profile));
    }
  }, [meQuery.data, form]);

  const saveMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (response) => {
      queryClient.setQueryData(['me'], response);
      form.reset(profileToFormValues(response.data.profile));
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const isSaving = isSubmitting || saveMutation.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setSuccessMessage(null);
    setSubmitError(null);
    try {
      await saveMutation.mutateAsync(toUpdateProfilePayload(values));
      setEditing(false);
      setSuccessMessage('Profil enregistré avec succès.');
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(error, 'Impossible d’enregistrer le profil. Réessayez.'),
      );
    }
  });

  async function handleLogout(force = false) {
    const userId = meQuery.data?.data.id;
    if (!force && userId && (await hasPendingCommandsForUser(userId))) {
      setLogoutConfirmOpen(true);
      return;
    }
    if (userId) {
      await clearWorkoutOfflineDataForUser(userId);
    }
    await logout();
    navigate('/login');
  }

  if (meQuery.isLoading) {
    return <LoadingState />;
  }

  if (meQuery.isError || !meQuery.data) {
    return <p className="text-[var(--danger)]">Impossible de charger le profil.</p>;
  }

  const { email, profile } = meQuery.data.data;

  return (
    <main className="flex flex-1 flex-col gap-[var(--space-6)]">
      <PageHeader title="Profil" className="mb-0" />

      {successMessage ? (
        <p
          role="status"
          className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        >
          {successMessage}
        </p>
      ) : null}

      {submitError ? (
        <p
          role="alert"
          className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--danger)]"
        >
          {submitError}
        </p>
      ) : null}

      {!editing ? (
        <>
          <section>
            <h2 className="section-title mb-3">Identité</h2>
            <p className="text-lg font-semibold text-[var(--foreground)]">
              {profile.displayName}
            </p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{email}</p>
          </section>

          <section>
            <h2 className="section-title mb-2">Préférences</h2>
            <ul className="flex flex-col text-sm">
              <li className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--border)] py-2">
                <span className="text-[var(--muted-foreground)]">Fuseau horaire</span>
                <span className="font-medium">{profile.timezone}</span>
              </li>
              <li className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--border)] py-2">
                <span className="text-[var(--muted-foreground)]">Unité de poids</span>
                <span className="font-medium">
                  {profile.weightUnit === 'KG' ? 'kg' : 'lb'}
                </span>
              </li>
              <li className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--border)] py-2">
                <span className="text-[var(--muted-foreground)]">Unité de distance</span>
                <span className="font-medium">
                  {profile.distanceUnit === 'KM' ? 'km' : 'mi'}
                </span>
              </li>
              <li className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--border)] py-2">
                <span className="text-[var(--muted-foreground)]">Objectif</span>
                <span className="font-medium">{GOAL_LABELS[profile.primaryGoal]}</span>
              </li>
              <li className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--border)] py-2">
                <span className="text-[var(--muted-foreground)]">Niveau</span>
                <span className="font-medium">
                  {LEVEL_LABELS[profile.experienceLevel]}
                </span>
              </li>
              <li className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--border)] py-2">
                <span className="text-[var(--muted-foreground)]">Suivi d’effort</span>
                <span className="font-medium">
                  {EFFORT_LABELS[profile.effortTrackingMode]}
                </span>
              </li>
            </ul>
          </section>

          <Button
            type="button"
            variant="secondary"
            className="w-fit"
            onClick={() => {
              setSuccessMessage(null);
              setSubmitError(null);
              setEditing(true);
            }}
          >
            Modifier
          </Button>
        </>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <section className="flex flex-col gap-4">
            <h2 className="section-title">Identité</h2>
            <Input
              label="Nom affiché"
              error={errors.displayName?.message}
              {...register('displayName')}
            />
            <p className="text-sm text-[var(--muted-foreground)]">{email}</p>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="section-title">Préférences</h2>
            <Input
              label="Fuseau horaire"
              error={errors.timezone?.message}
              {...register('timezone')}
            />
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Unité de poids</span>
              <select
                className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3"
                aria-invalid={Boolean(errors.weightUnit)}
                {...register('weightUnit')}
              >
                <option value="KG">kg</option>
                <option value="LB">lb</option>
              </select>
              <FieldError message={errors.weightUnit?.message} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Unité de distance</span>
              <select
                className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3"
                aria-invalid={Boolean(errors.distanceUnit)}
                {...register('distanceUnit')}
              >
                <option value="KM">km</option>
                <option value="MI">mi</option>
              </select>
              <FieldError message={errors.distanceUnit?.message} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Objectif principal</span>
              <select
                className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3"
                aria-invalid={Boolean(errors.primaryGoal)}
                {...register('primaryGoal')}
              >
                <option value="GENERAL_FITNESS">Forme générale</option>
                <option value="HYPERTROPHY">Hypertrophie</option>
                <option value="STRENGTH">Force</option>
                <option value="ENDURANCE">Endurance</option>
              </select>
              <FieldError message={errors.primaryGoal?.message} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Niveau</span>
              <select
                className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3"
                aria-invalid={Boolean(errors.experienceLevel)}
                {...register('experienceLevel')}
              >
                <option value="BEGINNER">Débutant</option>
                <option value="INTERMEDIATE">Intermédiaire</option>
                <option value="ADVANCED">Avancé</option>
              </select>
              <FieldError message={errors.experienceLevel?.message} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Suivi d&apos;effort</span>
              <select
                className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3"
                aria-invalid={Boolean(errors.effortTrackingMode)}
                {...register('effortTrackingMode')}
              >
                <option value="NONE">Aucun</option>
                <option value="RIR">RIR</option>
                <option value="RPE">RPE</option>
              </select>
              <FieldError message={errors.effortTrackingMode?.message} />
            </label>
          </section>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isSaving}
              onClick={() => {
                if (meQuery.data) {
                  form.reset(profileToFormValues(meQuery.data.data.profile));
                }
                setSubmitError(null);
                setEditing(false);
              }}
            >
              Annuler
            </Button>
          </div>
        </form>
      )}

      <button
        type="button"
        className="min-h-11 self-start text-sm text-[var(--muted-foreground)] underline-offset-2 hover:underline"
        onClick={() => {
          void handleLogout(false);
        }}
      >
        Se déconnecter
      </button>

      {logoutConfirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--foreground)]/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => setLogoutConfirmOpen(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-md rounded-[var(--radius-surface)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Déconnexion</h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Des modifications de séance ne sont pas encore synchronisées.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setLogoutConfirmOpen(false)}
              >
                Rester connecté
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  void handleLogout(true);
                }}
              >
                Se déconnecter et supprimer les modifications locales
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
