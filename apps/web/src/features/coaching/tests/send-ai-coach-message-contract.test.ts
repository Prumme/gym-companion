import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetch = vi.fn();

vi.mock('@/lib/api/client', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

describe('sendAiCoachMessage contract', () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue({
      data: {
        userMessage: {
          id: 'm1',
          role: 'USER',
          content: 'Bonjour',
          references: [],
          suggestedFollowUps: [],
          proposal: null,
          createdAt: '2026-08-11T10:00:00.000Z',
        },
        assistantMessage: null,
      },
    });
  });

  it('sérialise uniquement content + clientCommandId (jamais conversationId)', async () => {
    const { sendAiCoachMessage } = await import('../api/coaching-api');
    const leakyCallerPayload = {
      content: 'Bonjour',
      clientCommandId: '22222222-2222-2222-2222-222222222222',
      conversationId: '11111111-1111-1111-1111-111111111111',
    };
    await sendAiCoachMessage(
      '11111111-1111-1111-1111-111111111111',
      leakyCallerPayload,
    );

    expect(apiFetch).toHaveBeenCalledTimes(1);
    const [url, init] = apiFetch.mock.calls[0] as [
      string,
      { method: string; body: string },
    ];
    expect(url).toContain(
      '/api/v1/coaching/conversations/11111111-1111-1111-1111-111111111111/messages',
    );
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body).toEqual({
      content: 'Bonjour',
      clientCommandId: '22222222-2222-2222-2222-222222222222',
    });
    expect(body).not.toHaveProperty('conversationId');
  });
});
