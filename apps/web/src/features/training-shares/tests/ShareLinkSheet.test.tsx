import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShareLinkSheet } from '../components/ShareLinkSheet';

describe('ShareLinkSheet', () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockClear();
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText },
      share: undefined,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('copie le lien et propose le partage natif si disponible', async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText },
      share,
    });

    render(
      <ShareLinkSheet
        open
        onClose={() => undefined}
        title="Partager le programme"
        token="abc123token"
        expiresAt={new Date(Date.now() + 3_600_000).toISOString()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: /partager le programme/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/valide pendant 1 heure/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /copier le lien/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
    expect(await screen.findByText(/lien copié/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^partager$/i }));
    expect(share).toHaveBeenCalled();
  });

  it('reste utilisable sans navigator.share', async () => {
    render(
      <ShareLinkSheet
        open
        onClose={() => undefined}
        title="Partager la séance"
        token="abc123token"
        expiresAt={new Date(Date.now() + 3_600_000).toISOString()}
      />,
    );

    expect(
      screen.getByRole('button', { name: /copier le lien/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^partager$/i }),
    ).not.toBeInTheDocument();
  });

  it('désactive le double envoi pendant le loading', () => {
    render(
      <ShareLinkSheet
        open
        onClose={() => undefined}
        title="Partager le programme"
        token={null}
        expiresAt={null}
        loading
      />,
    );
    expect(screen.getByText(/génération du lien/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /copier le lien/i }),
    ).not.toBeInTheDocument();
  });
});
