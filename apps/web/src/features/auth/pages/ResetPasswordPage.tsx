import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resetPassword } from '@/features/auth/api/auth-api';

const schema = z.object({
  password: z.string().min(8, '8 caractères minimum'),
});

type FormValues = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
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
      await resetPassword(token, values.password);
      navigate('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Réinitialisation impossible');
    }
  });

  return (
    <main className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Nouveau mot de passe</h1>
        <p className="text-[var(--muted)]">Choisissez un mot de passe sécurisé.</p>
      </div>
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Input
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <Button type="submit" disabled={isSubmitting || !token}>
          Mettre à jour
        </Button>
      </form>
      <Link className="text-sm text-[var(--muted)]" to="/login">
        Retour à la connexion
      </Link>
    </main>
  );
}
