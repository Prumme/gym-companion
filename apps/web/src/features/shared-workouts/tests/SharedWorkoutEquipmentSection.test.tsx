import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SharedWorkoutEquipmentSection } from '../components/SharedWorkoutEquipmentSection';

const getSharedWorkoutEquipmentCoordination = vi.fn();
const getMySharedEquipment = vi.fn();
const requestMySharedEquipment = vi.fn();
const releaseMySharedEquipment = vi.fn();
const cancelMySharedEquipmentWaiting = vi.fn();

vi.mock('../api/shared-workouts-api', () => ({
  getSharedWorkoutEquipmentCoordination: (...args: unknown[]) =>
    getSharedWorkoutEquipmentCoordination(...args),
  getMySharedEquipment: (...args: unknown[]) => getMySharedEquipment(...args),
  requestMySharedEquipment: (...args: unknown[]) =>
    requestMySharedEquipment(...args),
  releaseMySharedEquipment: (...args: unknown[]) =>
    releaseMySharedEquipment(...args),
  cancelMySharedEquipmentWaiting: (...args: unknown[]) =>
    cancelMySharedEquipmentWaiting(...args),
}));

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SharedWorkoutEquipmentSection
        roomId="room-1"
        offline={false}
        enabled
      />
    </QueryClientProvider>,
  );
}

describe('SharedWorkoutEquipmentSection', () => {
  beforeEach(() => {
    getSharedWorkoutEquipmentCoordination.mockReset();
    getMySharedEquipment.mockReset();
    requestMySharedEquipment.mockReset();
    releaseMySharedEquipment.mockReset();
    cancelMySharedEquipmentWaiting.mockReset();
  });

  it('affiche un équipement libre avec Utiliser', async () => {
    getMySharedEquipment.mockResolvedValue({
      state: 'AVAILABLE',
      equipment: { id: 'eq-1', code: 'barbell', name: 'Barre' },
      queuePosition: null,
      occupiedBy: null,
    });
    getSharedWorkoutEquipmentCoordination.mockResolvedValue({
      roomId: 'room-1',
      equipment: [],
    });
    renderSection();

    expect(await screen.findByText(/disponible/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^utiliser$/i }),
    ).toBeInTheDocument();
  });

  it('affiche USING soi avec Libérer', async () => {
    getMySharedEquipment.mockResolvedValue({
      state: 'USING',
      equipment: { id: 'eq-1', code: 'barbell', name: 'Barre' },
      queuePosition: null,
      occupiedBy: null,
    });
    getSharedWorkoutEquipmentCoordination.mockResolvedValue({
      roomId: 'room-1',
      equipment: [
        {
          equipment: { id: 'eq-1', code: 'barbell', name: 'Barre' },
          using: { userId: 'me', displayName: 'Moi' },
          waiting: [],
        },
      ],
    });
    renderSection();

    expect(
      await screen.findByText(/tu l’utilises actuellement/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^libérer$/i }),
    ).toBeInTheDocument();
  });

  it('affiche WAITING avec position et Quitter la file', async () => {
    getMySharedEquipment.mockResolvedValue({
      state: 'WAITING',
      equipment: { id: 'eq-1', code: 'barbell', name: 'Barre' },
      queuePosition: 2,
      occupiedBy: { userId: 'u2', displayName: 'Thomas' },
    });
    getSharedWorkoutEquipmentCoordination.mockResolvedValue({
      roomId: 'room-1',
      equipment: [
        {
          equipment: { id: 'eq-1', code: 'barbell', name: 'Barre' },
          using: { userId: 'u2', displayName: 'Thomas' },
          waiting: [
            { userId: 'u3', displayName: 'Camille', position: 1 },
            { userId: 'me', displayName: 'Moi', position: 2 },
          ],
        },
      ],
    });
    renderSection();

    expect(await screen.findByText(/ta position : 2/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /quitter la file/i }),
    ).toBeInTheDocument();
  });

  it('demande un équipement libre', async () => {
    const user = userEvent.setup();
    getMySharedEquipment.mockResolvedValue({
      state: 'AVAILABLE',
      equipment: { id: 'eq-1', code: 'barbell', name: 'Barre' },
      queuePosition: null,
      occupiedBy: null,
    });
    getSharedWorkoutEquipmentCoordination.mockResolvedValue({
      roomId: 'room-1',
      equipment: [],
    });
    requestMySharedEquipment.mockResolvedValue({
      state: 'USING',
      equipment: { id: 'eq-1', code: 'barbell', name: 'Barre' },
      queuePosition: null,
      occupiedBy: null,
    });
    renderSection();

    await user.click(await screen.findByRole('button', { name: /^utiliser$/i }));
    await waitFor(() => expect(requestMySharedEquipment).toHaveBeenCalled());
  });
});
