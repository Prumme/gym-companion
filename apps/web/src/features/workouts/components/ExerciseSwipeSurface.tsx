import { useRef, useState, type PointerEvent, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import {
  isInteractiveSwipeTarget,
  resolveSwipeAxis,
  resolveSwipeNavigation,
  type SwipeAxis,
  type SwipeNavigation,
} from '../lib/exercise-swipe';

const DRAG_LIMIT_PX = 48;
const EDGE_LIMIT_PX = 16;
const ENTER_OFFSET_PX = 28;
const MOTION_MS = 200;

type ExerciseSwipeSurfaceProps = {
  enabled?: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  /** Change quand l’exercice affiché change, pour rejouer l’entrée. */
  exerciseKey: string;
  children: ReactNode;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startedAt: number;
  axis: SwipeAxis;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function ExerciseSwipeSurface({
  enabled = true,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  exerciseKey,
  children,
}: ExerciseSwipeSurfaceProps) {
  const dragRef = useRef<DragState | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [enterFrom, setEnterFrom] = useState<SwipeNavigation | null>(null);

  function clampDrag(dx: number): number {
    const towardNext = dx < 0;
    const allowed = towardNext ? hasNext : hasPrevious;
    const limit = allowed ? DRAG_LIMIT_PX : EDGE_LIMIT_PX;
    return Math.max(-limit, Math.min(limit, dx));
  }

  function finish(navigation: SwipeNavigation | null) {
    dragRef.current = null;
    setDragging(false);
    if (!navigation) {
      setOffsetX(0);
      return;
    }
    if (prefersReducedMotion()) {
      setOffsetX(0);
      if (navigation === 'next') {
        onNext();
      } else {
        onPrevious();
      }
      return;
    }
    setEnterFrom(navigation);
    setOffsetX(navigation === 'next' ? ENTER_OFFSET_PX : -ENTER_OFFSET_PX);
    if (navigation === 'next') {
      onNext();
    } else {
      onPrevious();
    }
    requestAnimationFrame(() => {
      setOffsetX(0);
    });
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || event.button > 0) {
      return;
    }
    if (isInteractiveSwipeTarget(event.target)) {
      return;
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: event.timeStamp,
      axis: 'undecided',
    };
    setEnterFrom(null);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (drag.axis === 'undecided') {
      drag.axis = resolveSwipeAxis(dx, dy);
    }
    if (drag.axis !== 'horizontal') {
      if (drag.axis === 'vertical') {
        dragRef.current = null;
        setDragging(false);
        setOffsetX(0);
      }
      return;
    }
    const surface = event.currentTarget;
    if (
      typeof surface.hasPointerCapture === 'function' &&
      typeof surface.setPointerCapture === 'function' &&
      !surface.hasPointerCapture(event.pointerId)
    ) {
      surface.setPointerCapture(event.pointerId);
    }
    if (!dragging) {
      setDragging(true);
    }
    setOffsetX(prefersReducedMotion() ? 0 : clampDrag(dx));
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const navigation = resolveSwipeNavigation({
      dx,
      dy,
      elapsedMs: event.timeStamp - drag.startedAt,
      hasPrevious,
      hasNext,
    });
    finish(navigation);
  }

  function onPointerCancel() {
    dragRef.current = null;
    setDragging(false);
    setOffsetX(0);
  }

  const reduced = prefersReducedMotion();

  return (
    <div
      className="touch-pan-y"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div
        key={exerciseKey}
        className={cn('flex flex-col gap-4', enterFrom && 'will-change-transform')}
        style={{
          transform: reduced ? undefined : `translateX(${offsetX}px)`,
          transition:
            reduced || dragging
              ? 'none'
              : `transform ${MOTION_MS}ms ease`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
