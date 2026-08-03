import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { forgotPassword } from '@/features/auth/api/auth-api';

const schema = z.object({
  email: z.string().email(),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async (values) => {
    const result = await forgotPassword(values.email);
    setMessage(result.data.message);
  });

  return (
    <main className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Mot de passe oublié</h1>
        <p className="text-[var(--muted)]">
          Saisissez votre email pour recevoir un lien de réinitialisation.
        </p>
      </div>
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
        <Button type="submit" disabled={isSubmitting}>
          Envoyer le lien
        </Button>
      </form>
      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
      <Link className="text-sm text-[var(--muted)]" to="/login">
        Retour à la connexion
      </Link>
    </main>
  );
}
