import { zodResolver } from '@hookform/resolvers/zod';
import { activateProgramSchema } from '@gym-companion/validation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/client';

import { useActivateProgramMutation } from '../hooks/use-program-mutations';
import { todayLocalDateString } from '../lib/schedule-utils';
import { ConfirmDialog } from './ConfirmDialog';

const activateFormSchema = activateProgramSchema.extend({
  confirmReplace: z.boolean().optional(),
});

type ActivateFormValues = z.infer<typeof activateFormSchema>;

type ActivateProgramDialogProps = {
  open: boolean;
  programId: string;
  programName: string;
  currentProgramId: string | null;
  currentProgramName: string | null;
  onSuccess: (message: string) => void;
  onCancel: () => void;
};

export function ActivateProgramDialog({
  open,
  programId,
  programName,
  currentProgramId,
  currentProgramName,
  onSuccess,
  onCancel,
}: ActivateProgramDialogProps) {
  const activateMutation = useActivateProgramMutation();
  const needsReplace = currentProgramName != null;

  const form = useForm<ActivateFormValues>({
    resolver: zodResolver(activateFormSchema),
    defaultValues: {
      startedOn: todayLocalDateString(),
      replaceCurrentProgram: false,
      confirmReplace: false,
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

  function handleClose() {
    if (activateMutation.isPending) {
      return;
    }
    reset({
      startedOn: todayLocalDateString(),
      replaceCurrentProgram: false,
      confirmReplace: false,
    });
    onCancel();
  }

  async function onSubmit(values: ActivateFormValues) {
    if (needsReplace && !values.confirmReplace) {
      form.setError('confirmReplace', {
        message: 'Confirme le remplacement du programme courant.',
      });
      return;
    }

    try {
      await activateMutation.mutateAsync({
        programId,
        input: {
          startedOn: values.startedOn,
          replaceCurrentProgram: needsReplace,
        },
        previousProgramId: currentProgramId,
      });
      reset({
        startedOn: todayLocalDateString(),
        replaceCurrentProgram: false,
        confirmReplace: false,
      });
      onSuccess(`« ${programName} » est maintenant ton programme courant.`);
    } catch (err) {
      form.setError('root', {
        message: getApiErrorMessage(
          err,
          'Impossible d’activer ce programme.',
        ),
      });
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="activate-program-title"
        className="w-full max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="activate-program-title" className="text-lg font-semibold">
          Utiliser ce programme
        </h3>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Définis la date de début pour « {programName} ».
        </p>

        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        >
          <div>
            <label htmlFor="startedOn" className="text-sm font-medium">
              Date de début
            </label>
            <input
              id="startedOn"
              type="date"
              className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              {...register('startedOn')}
            />
            {errors.startedOn ? (
              <p className="mt-1 text-sm text-[var(--danger)]" role="alert">
                {errors.startedOn.message}
              </p>
            ) : null}
          </div>

          {needsReplace ? (
            <div className="rounded-[var(--radius)] border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-950">
                « {currentProgramName} » est actuellement ton programme courant.
                L’activer le remplacera.
              </p>
              <label className="mt-3 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 rounded border-[var(--border)]"
                  {...register('confirmReplace')}
                />
                <span>Je confirme remplacer le programme courant</span>
              </label>
              {errors.confirmReplace ? (
                <p className="mt-1 text-sm text-[var(--danger)]" role="alert">
                  {errors.confirmReplace.message}
                </p>
              ) : null}
            </div>
          ) : null}

          {errors.root ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {errors.root.message}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={activateMutation.isPending}
              onClick={handleClose}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={activateMutation.isPending}>
              {activateMutation.isPending ? 'Activation…' : 'Activer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

type DeactivateProgramDialogProps = {
  open: boolean;
  programName: string;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeactivateProgramDialog({
  open,
  programName,
  pending,
  error,
  onConfirm,
  onCancel,
}: DeactivateProgramDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title="Désactiver le programme courant ?"
      description={`« ${programName} » ne sera plus ton programme courant. Tu pourras le réactiver plus tard.`}
      confirmLabel="Désactiver"
      destructive
      pending={pending}
      error={error}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
