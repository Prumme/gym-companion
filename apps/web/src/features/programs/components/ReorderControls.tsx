import { ArrowDown, ArrowUp } from 'lucide-react';

import { Button } from '@/components/ui/button';

type ReorderControlsProps = {
  label: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  disabled?: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

export function ReorderControls({
  label,
  canMoveUp,
  canMoveDown,
  disabled = false,
  onMoveUp,
  onMoveDown,
}: ReorderControlsProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="secondary"
        className="min-h-10 px-3"
        disabled={disabled || !canMoveUp}
        onClick={onMoveUp}
        aria-label={`Monter ${label}`}
      >
        <ArrowUp className="size-4" aria-hidden="true" />
        <span className="sr-only">Monter</span>
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="min-h-10 px-3"
        disabled={disabled || !canMoveDown}
        onClick={onMoveDown}
        aria-label={`Descendre ${label}`}
      >
        <ArrowDown className="size-4" aria-hidden="true" />
        <span className="sr-only">Descendre</span>
      </Button>
    </div>
  );
}
