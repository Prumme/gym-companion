import type { ExerciseMedia } from '@gym-companion/shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExerciseMediaButton } from '../components/ExerciseMediaButton';
import {
  EXERCISE_MEDIA_FRAME_INTERVAL_MS,
  getExerciseMediaFrameLabel,
  getNextExerciseMediaFrameIndex,
} from '../lib/exercise-media';

const media: ExerciseMedia = {
  kind: 'IMAGE_SEQUENCE',
  frames: ['/exercise-media/barbell-squat/0.webp', '/exercise-media/barbell-squat/1.webp'],
  attribution: {
    sourceName: 'Free Exercise DB',
    sourceUrl: 'https://github.com/yuhonas/free-exercise-db',
    license: 'Unlicense',
  },
};

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function loadAllFrames() {
  screen
    .getByRole('dialog')
    .querySelectorAll('img')
    .forEach((image) => fireEvent.load(image));
}

function visibleFrameAlt(): string | null {
  return (
    screen.getByRole('dialog').querySelector('img:not([aria-hidden])')?.getAttribute('alt') ?? null
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('exercise media helpers', () => {
  it('loops over frames', () => {
    expect(getNextExerciseMediaFrameIndex(0, 2)).toBe(1);
    expect(getNextExerciseMediaFrameIndex(1, 2)).toBe(0);
    expect(getNextExerciseMediaFrameIndex(0, 1)).toBe(0);
  });

  it('labels start, intermediate and end frames', () => {
    expect(getExerciseMediaFrameLabel(0, 3)).toBe('Départ');
    expect(getExerciseMediaFrameLabel(1, 3)).toBe('Étape 2');
    expect(getExerciseMediaFrameLabel(2, 3)).toBe('Fin');
  });
});

describe('ExerciseMediaButton', () => {
  it('renders nothing without media', () => {
    const { container } = render(<ExerciseMediaButton exerciseName="Squat" media={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens an accessible demonstration and closes it with Escape', async () => {
    mockReducedMotion(false);
    const user = userEvent.setup();
    render(<ExerciseMediaButton exerciseName="Squat barre" media={media} />);

    const trigger = screen.getByRole('button', { name: 'Voir la démonstration de Squat barre' });
    await user.click(trigger);
    loadAllFrames();

    const dialog = screen.getByRole('dialog', { name: 'Squat barre' });
    expect(dialog).toBeInTheDocument();
    expect(visibleFrameAlt()).toBe('Squat barre — départ du mouvement');
    expect(screen.getByRole('link', { name: 'Free Exercise DB' })).toHaveAttribute(
      'href',
      'https://github.com/yuhonas/free-exercise-db',
    );

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('animates frames automatically', () => {
    mockReducedMotion(false);
    vi.useFakeTimers();
    render(<ExerciseMediaButton exerciseName="Squat barre" media={media} />);
    fireEvent.click(screen.getByRole('button', { name: /Voir la démonstration/ }));
    loadAllFrames();

    expect(
      screen.getByRole('button', { name: 'Mettre la démonstration en pause' }),
    ).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(EXERCISE_MEDIA_FRAME_INTERVAL_MS);
    });
    expect(visibleFrameAlt()).toBe('Squat barre — fin du mouvement');
  });

  it('waits for every frame before animating', () => {
    mockReducedMotion(false);
    vi.useFakeTimers();
    render(<ExerciseMediaButton exerciseName="Squat barre" media={media} />);
    fireEvent.click(screen.getByRole('button', { name: /Voir la démonstration/ }));

    expect(screen.getByText('Chargement de la démonstration…')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(EXERCISE_MEDIA_FRAME_INTERVAL_MS * 2);
    });
    expect(visibleFrameAlt()).toBe('Squat barre — départ du mouvement');

    loadAllFrames();
    expect(screen.queryByText('Chargement de la démonstration…')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(EXERCISE_MEDIA_FRAME_INTERVAL_MS);
    });
    expect(visibleFrameAlt()).toBe('Squat barre — fin du mouvement');
  });

  it('does not autoplay when reduced motion is requested', () => {
    mockReducedMotion(true);
    vi.useFakeTimers();
    render(<ExerciseMediaButton exerciseName="Squat barre" media={media} />);
    fireEvent.click(screen.getByRole('button', { name: /Voir la démonstration/ }));
    loadAllFrames();

    expect(screen.getByRole('button', { name: 'Lire la démonstration' })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(EXERCISE_MEDIA_FRAME_INTERVAL_MS * 3);
    });
    expect(visibleFrameAlt()).toBe('Squat barre — départ du mouvement');

    fireEvent.click(screen.getByRole('button', { name: 'Fin' }));
    expect(visibleFrameAlt()).toBe('Squat barre — fin du mouvement');
    expect(screen.getByRole('button', { name: 'Fin' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows an explicit message when an image cannot be loaded', () => {
    mockReducedMotion(true);
    render(<ExerciseMediaButton exerciseName="Squat barre" media={media} />);
    fireEvent.click(screen.getByRole('button', { name: /Voir la démonstration/ }));

    const firstImage = screen.getByRole('dialog').querySelector('img');
    expect(firstImage).not.toBeNull();
    fireEvent.error(firstImage as HTMLImageElement);

    expect(screen.getByRole('alert')).toHaveTextContent('Impossible de charger la démonstration');
  });
});
