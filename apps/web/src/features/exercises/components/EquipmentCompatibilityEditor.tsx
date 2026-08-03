import type { EquipmentTypeReference } from '@gym-companion/shared';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import type { CompatibleEquipmentFormValue } from '../lib/exercise-form';
import {
  ensureSinglePreferred,
  reconcileDefaultEquipment,
} from '../lib/exercise-form';

type EquipmentCompatibilityEditorProps = {
  equipmentTypes: EquipmentTypeReference[];
  value: CompatibleEquipmentFormValue[];
  defaultEquipmentTypeId: string;
  onChange: (
    compatible: CompatibleEquipmentFormValue[],
    defaultEquipmentTypeId: string,
  ) => void;
  error?: string;
  defaultError?: string;
  disabled?: boolean;
};

export function EquipmentCompatibilityEditor({
  equipmentTypes,
  value,
  defaultEquipmentTypeId,
  onChange,
  error,
  defaultError,
  disabled = false,
}: EquipmentCompatibilityEditorProps) {
  const [pendingId, setPendingId] = useState('');
  const selectedIds = new Set(value.map((item) => item.equipmentTypeId));
  const available = equipmentTypes.filter((item) => !selectedIds.has(item.id));

  function nameOf(id: string) {
    return equipmentTypes.find((item) => item.id === id)?.name ?? id;
  }

  function emit(
    nextCompatible: CompatibleEquipmentFormValue[],
    nextDefault = defaultEquipmentTypeId,
  ) {
    const normalized = ensureSinglePreferred(nextCompatible);
    onChange(
      normalized,
      reconcileDefaultEquipment(
        nextDefault,
        normalized.map((item) => item.equipmentTypeId),
      ),
    );
  }

  function addEquipment() {
    if (!pendingId || selectedIds.has(pendingId)) {
      return;
    }
    emit([
      ...value,
      { equipmentTypeId: pendingId, isPreferred: false, notes: '' },
    ]);
    setPendingId('');
  }

  function removeEquipment(equipmentTypeId: string) {
    emit(
      value.filter((item) => item.equipmentTypeId !== equipmentTypeId),
      defaultEquipmentTypeId === equipmentTypeId ? '' : defaultEquipmentTypeId,
    );
  }

  function updateItem(
    equipmentTypeId: string,
    patch: Partial<CompatibleEquipmentFormValue>,
  ) {
    let next = value.map((item) =>
      item.equipmentTypeId === equipmentTypeId ? { ...item, ...patch } : item,
    );
    if (patch.isPreferred === true) {
      next = ensureSinglePreferred(next, equipmentTypeId);
    }
    emit(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-medium">Équipements compatibles</h3>
        <p className="text-xs text-[var(--muted)]">
          Optionnel. Tu peux indiquer lequel est recommandé pour cet exercice.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="add-compatible-equipment">
          Ajouter un équipement compatible
        </label>
        <select
          id="add-compatible-equipment"
          className="min-h-11 flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
          value={pendingId}
          disabled={disabled || available.length === 0}
          onChange={(event) => setPendingId(event.target.value)}
        >
          <option value="">Ajouter un équipement…</option>
          {available.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="secondary"
          className="gap-2"
          disabled={disabled || !pendingId}
          onClick={addEquipment}
        >
          <Plus className="size-4" aria-hidden="true" />
          Ajouter
        </Button>
      </div>

      {value.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Aucun équipement compatible.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {value.map((item) => (
            <li
              key={item.equipmentTypeId}
              className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{nameOf(item.equipmentTypeId)}</p>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-9 gap-1 px-2"
                  disabled={disabled}
                  onClick={() => removeEquipment(item.equipmentTypeId)}
                  aria-label={`Retirer ${nameOf(item.equipmentTypeId)}`}
                >
                  <X className="size-4" aria-hidden="true" />
                  Retirer
                </Button>
              </div>

              <label className="mt-2 flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="radio"
                  name="preferred-equipment"
                  className="size-4"
                  checked={item.isPreferred}
                  disabled={disabled}
                  onChange={() =>
                    updateItem(item.equipmentTypeId, { isPreferred: true })
                  }
                />
                <span>Équipement recommandé pour cet exercice</span>
              </label>

              <label
                className="mt-2 flex flex-col gap-1.5 text-sm"
                htmlFor={`notes-${item.equipmentTypeId}`}
              >
                Note (facultatif)
                <input
                  id={`notes-${item.equipmentTypeId}`}
                  type="text"
                  maxLength={500}
                  className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 text-sm"
                  value={item.notes}
                  disabled={disabled}
                  onChange={(event) =>
                    updateItem(item.equipmentTypeId, {
                      notes: event.target.value,
                    })
                  }
                />
              </label>
            </li>
          ))}
        </ul>
      )}

      {value.some((item) => item.isPreferred) ? (
        <Button
          type="button"
          variant="ghost"
          className="w-fit px-0"
          disabled={disabled}
          onClick={() =>
            emit(value.map((item) => ({ ...item, isPreferred: false })))
          }
        >
          Retirer la recommandation
        </Button>
      ) : null}

      {error ? (
        <p className="text-xs text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="default-equipment">
          Équipement par défaut
        </label>
        <p id="default-equipment-desc" className="text-xs text-[var(--muted)]">
          Limité aux équipements compatibles sélectionnés. Laisse vide si aucun.
        </p>
        <select
          id="default-equipment"
          className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
          value={defaultEquipmentTypeId}
          disabled={disabled || value.length === 0}
          aria-describedby="default-equipment-desc"
          aria-invalid={Boolean(defaultError)}
          onChange={(event) => emit(value, event.target.value)}
        >
          <option value="">Aucun</option>
          {value.map((item) => (
            <option key={item.equipmentTypeId} value={item.equipmentTypeId}>
              {nameOf(item.equipmentTypeId)}
            </option>
          ))}
        </select>
        {defaultError ? (
          <p className="text-xs text-[var(--danger)]" role="alert">
            {defaultError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
