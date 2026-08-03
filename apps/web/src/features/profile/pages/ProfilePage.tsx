import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/common/LoadingState';
import { logout } from '@/features/auth/api/auth-api';
import { getMe, updateProfile } from '@/features/profile/api/profile-api';

type ProfileForm = {
  displayName: string;
  timezone: string;
  weightUnit: 'KG' | 'LB';
  distanceUnit: 'KM' | 'MI';
  primaryGoal: 'ENDURANCE' | 'HYPERTROPHY' | 'STRENGTH' | 'GENERAL_FITNESS';
  experienceLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  effortTrackingMode: 'NONE' | 'RIR' | 'RPE';
};

export function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
  });

  const form = useForm<ProfileForm>();

  useEffect(() => {
    if (meQuery.data) {
      const profile = meQuery.data.data.profile;
      form.reset({
        displayName: profile.displayName,
        timezone: profile.timezone,
        weightUnit: profile.weightUnit,
        distanceUnit: profile.distanceUnit,
        primaryGoal: profile.primaryGoal,
        experienceLevel: profile.experienceLevel,
        effortTrackingMode: profile.effortTrackingMode,
      });
    }
  }, [meQuery.data, form]);

  const saveMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
    },
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
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(async (values) => {
          await saveMutation.mutateAsync(values);
        })}
      >
        <Input label="Nom affiché" {...form.register('displayName')} />
        <Input label="Fuseau horaire" {...form.register('timezone')} />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Unité de poids</span>
          <select className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3" {...form.register('weightUnit')}>
            <option value="KG">kg</option>
            <option value="LB">lb</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Unité de distance</span>
          <select className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3" {...form.register('distanceUnit')}>
            <option value="KM">km</option>
            <option value="MI">mi</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Objectif principal</span>
          <select className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3" {...form.register('primaryGoal')}>
            <option value="GENERAL_FITNESS">Forme générale</option>
            <option value="HYPERTROPHY">Hypertrophie</option>
            <option value="STRENGTH">Force</option>
            <option value="ENDURANCE">Endurance</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Niveau</span>
          <select className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3" {...form.register('experienceLevel')}>
            <option value="BEGINNER">Débutant</option>
            <option value="INTERMEDIATE">Intermédiaire</option>
            <option value="ADVANCED">Avancé</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Suivi d&apos;effort</span>
          <select className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3" {...form.register('effortTrackingMode')}>
            <option value="NONE">Aucun</option>
            <option value="RIR">RIR</option>
            <option value="RPE">RPE</option>
          </select>
        </label>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </form>
      <Button
        variant="secondary"
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
