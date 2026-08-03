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

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/common/LoadingState';
import { logout } from '@/features/auth/api/auth-api';
import { getMe, updateProfile, type MeResponse } from '@/features/profile/api/profile-api';
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

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <span className="text-sm text-[var(--danger)]">{message}</span>;
}

export function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      setSuccessMessage('Profil enregistré avec succès.');
      setSubmitError(null);
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
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(error, 'Impossible d’enregistrer le profil. Réessayez.'),
      );
    }
  });

  if (meQuery.isLoading) {
    return <LoadingState />;
  }

  if (meQuery.isError || !meQuery.data) {
    return <p className="text-[var(--danger)]">Impossible de charger le profil.</p>;
  }

  return (
    <main className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Profil</h1>
        <p className="text-[var(--muted)]">{meQuery.data.data.email}</p>
      </div>

      {successMessage ? (
        <p
          role="status"
          className="rounded-[var(--radius)] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {successMessage}
        </p>
      ) : null}

      {submitError ? (
        <p
          role="alert"
          className="rounded-[var(--radius)] border border-red-200 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]"
        >
          {submitError}
        </p>
      ) : null}

      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Input
          label="Nom affiché"
          error={errors.displayName?.message}
          {...register('displayName')}
        />
        <Input
          label="Fuseau horaire"
          error={errors.timezone?.message}
          {...register('timezone')}
        />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Unité de poids</span>
          <select
            className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3"
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
            className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3"
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
            className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3"
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
            className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3"
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
            className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3"
            aria-invalid={Boolean(errors.effortTrackingMode)}
            {...register('effortTrackingMode')}
          >
            <option value="NONE">Aucun</option>
            <option value="RIR">RIR</option>
            <option value="RPE">RPE</option>
          </select>
          <FieldError message={errors.effortTrackingMode?.message} />
        </label>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </form>
      <Button
        variant="secondary"
        type="button"
        onClick={async () => {
          await logout();
          navigate('/login');
        }}
      >
        Se déconnecter
      </Button>
    </main>
  );
}
