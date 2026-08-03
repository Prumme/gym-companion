import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { register as registerAccount } from '@/features/auth/api/auth-api';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, '8 caractères minimum'),
  displayName: z.string().min(1, 'Nom requis'),
});

type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await registerAccount({
        ...values,
        acceptedTermsVersion: '2026-08',
      });
      navigate('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inscription impossible');
    }
  });

  return (
    <main className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Créer un compte</h1>
        <p className="text-[var(--muted)]">Commencez à suivre vos entraînements.</p>
      </div>
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Input label="Nom affiché" error={errors.displayName?.message} {...register('displayName')} />
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Input
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Création…' : 'Créer mon compte'}
        </Button>
      </form>
      <Link className="text-sm text-[var(--muted)]" to="/login">
        Déjà un compte ? Se connecter
      </Link>
    </main>
  );
}
