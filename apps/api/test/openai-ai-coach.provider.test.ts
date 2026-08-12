import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AI_COACH_CHAT_PROMPT_VERSION,
  AI_COACH_CHAT_SCHEMA_VERSION,
  AI_COACH_TOOL_DEFINITIONS,
  AI_COACH_WIRE_OUTPUT_JSON_SCHEMA,
} from '@gym-companion/validation';

import { AiCoachProviderError } from '../src/modules/coaching/ai/ai-coach-provider';
import { OpenAiCoachProvider } from '../src/modules/coaching/ai/openai-ai-coach.provider';

const baseTurnInput = {
  schemaVersion: AI_COACH_CHAT_SCHEMA_VERSION,
  promptVersion: AI_COACH_CHAT_PROMPT_VERSION,
  locale: 'fr-FR' as const,
  history: [],
  userMessage: 'Bonjour',
  contextExercise: null,
};

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

describe('OpenAiCoachProvider (Responses API)', () => {
  const fetchMock = vi.fn();

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  function provider() {
    vi.stubGlobal('fetch', fetchMock);
    return new OpenAiCoachProvider('sk-test', 'https://api.openai.com/v1');
  }

  it('A — body minimal : model + input + instructions (endpoint /responses)', () => {
    const p = provider();
    const body = p.buildConversationBody({
      input: baseTurnInput,
      tools: [],
      timeoutMs: 10_000,
      model: 'gpt-5.4-mini',
      forceFinalAnswer: true,
    });
    expect(body.model).toBe('gpt-5.4-mini');
    expect(body.instructions).toBeTruthy();
    expect(Array.isArray(body.input)).toBe(true);
    expect(body.tools).toBeUndefined();
    expect((body.text as { format: { type: string } }).format.type).toBe(
      'json_schema',
    );
  });

  it('C — Structured Output wire compact strict', () => {
    const p = provider();
    const body = p.buildConversationBody({
      input: baseTurnInput,
      tools: [],
      timeoutMs: 10_000,
      model: 'gpt-5.4-mini',
      forceFinalAnswer: true,
    });
    const format = (
      body.text as {
        format: {
          type: string;
          name: string;
          strict: boolean;
          schema: unknown;
        };
      }
    ).format;
    expect(format).toEqual({
      type: 'json_schema',
      name: 'coach_wire_response',
      strict: true,
      schema: AI_COACH_WIRE_OUTPUT_JSON_SCHEMA,
    });
    expect(JSON.stringify(format.schema)).not.toContain('$ref');
    expect(JSON.stringify(format.schema)).toContain('"t"');
  });

  it('D — tools Responses (flat name/parameters, strict:false)', () => {
    const p = provider();
    const body = p.buildConversationBody({
      input: baseTurnInput,
      tools: AI_COACH_TOOL_DEFINITIONS,
      timeoutMs: 10_000,
      model: 'gpt-5.4-mini',
    });
    const tools = body.tools as Array<Record<string, unknown>>;
    expect(tools.length).toBe(AI_COACH_TOOL_DEFINITIONS.length);
    expect(tools[0]).toMatchObject({
      type: 'function',
      name: 'get_exercise_coach_summary',
      strict: false,
    });
    expect(tools[0]?.function).toBeUndefined();
    expect(body.text).toBeTruthy();
  });

  it('Bonjour → discussion via Responses output_text', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        200,
        {
          id: 'resp_bonjour',
          status: 'completed',
          output_text: JSON.stringify({
            t: 'd',
            x: 'Bonjour ! Comment puis-je t’aider ?',
            d: null,
            rf: [],
            fu: [],
          }),
          output: [],
          usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
        },
        { 'x-request-id': 'req_bonjour' },
      ),
    );
    const p = provider();
    const result = await p.generateConversationTurn({
      input: baseTurnInput,
      tools: AI_COACH_TOOL_DEFINITIONS,
      timeoutMs: 10_000,
      model: 'gpt-5.4-mini',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.kind).toBe('answer');
    if (result.kind === 'answer') {
      expect(result.answer.type).toBe('discussion');
      expect(result.answer.text).toContain('Bonjour');
    }
  });

  it('tool call loop → function_call puis answer', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'resp_tools',
          status: 'completed',
          output: [
            {
              type: 'function_call',
              id: 'fc_1',
              call_id: 'call_1',
              name: 'get_personal_records',
              arguments: '{}',
            },
          ],
          usage: { input_tokens: 5, output_tokens: 5, total_tokens: 10 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'resp_final',
          status: 'completed',
          output_text: JSON.stringify({
            t: 'd',
            x: 'Voici tes records.',
            d: null,
            rf: [],
            fu: [],
          }),
          output: [],
        }),
      );

    const p = provider();
    const first = await p.generateConversationTurn({
      input: { ...baseTurnInput, userMessage: 'Quels sont mes derniers records ?' },
      tools: AI_COACH_TOOL_DEFINITIONS,
      timeoutMs: 10_000,
      model: 'gpt-5.4-mini',
    });
    expect(first.kind).toBe('tool_calls');
    if (first.kind !== 'tool_calls') return;
    expect(first.toolCalls[0]?.id).toBe('call_1');

    const second = await p.generateConversationTurn({
      input: { ...baseTurnInput, userMessage: 'Quels sont mes derniers records ?' },
      tools: AI_COACH_TOOL_DEFINITIONS,
      timeoutMs: 10_000,
      model: 'gpt-5.4-mini',
      pendingToolLoop: [
        {
          type: 'function_call',
          id: 'fc_1',
          call_id: 'call_1',
          name: 'get_personal_records',
          arguments: '{}',
        },
        {
          type: 'function_call_output',
          call_id: 'call_1',
          output: JSON.stringify({ records: [] }),
        },
      ],
      forceFinalAnswer: true,
    });
    expect(second.kind).toBe('answer');
  });

  it('incomplete → AI_COACH_INVALID_RESPONSE (phase incomplete_output)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        id: 'resp_inc',
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
        output: [],
      }),
    );
    const p = provider();
    await expect(
      p.generateConversationTurn({
        input: baseTurnInput,
        tools: [],
        timeoutMs: 10_000,
        model: 'gpt-5.4-mini',
        forceFinalAnswer: true,
      }),
    ).rejects.toMatchObject({
      code: 'AI_COACH_INVALID_RESPONSE',
      phase: 'incomplete_output',
    } satisfies Partial<AiCoachProviderError>);
  });

  it('malformed wire → AI_COACH_INVALID_RESPONSE', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        id: 'resp_bad',
        status: 'completed',
        output_text: '{"hello":"world"}',
        output: [],
      }),
    );
    const p = provider();
    await expect(
      p.generateConversationTurn({
        input: baseTurnInput,
        tools: [],
        timeoutMs: 10_000,
        model: 'gpt-5.4-mini',
        forceFinalAnswer: true,
      }),
    ).rejects.toMatchObject({
      code: 'AI_COACH_INVALID_RESPONSE',
      phase: 'wire_validation',
    });
  });

  it.each([
    [400, 'AI_COACH_UNAVAILABLE'],
    [401, 'AI_COACH_UNAVAILABLE'],
    [429, 'AI_COACH_RATE_LIMITED'],
    [500, 'AI_COACH_UNAVAILABLE'],
  ] as const)(
    'OpenAI HTTP %s → %s avec phase openai_request',
    async (status, code) => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          status,
          {
            error: {
              message: `fail ${status}`,
              type: 'invalid_request_error',
              code: 'bad_schema',
            },
          },
          { 'x-request-id': `req_${status}` },
        ),
      );
      const p = provider();
      await expect(
        p.generateConversationTurn({
          input: baseTurnInput,
          tools: [],
          timeoutMs: 10_000,
          model: 'gpt-5.4-mini',
          forceFinalAnswer: true,
        }),
      ).rejects.toMatchObject({
        code,
        phase: 'openai_request',
        httpStatus: status,
        openaiRequestId: `req_${status}`,
        providerCode: 'bad_schema',
      });
    },
  );

  it('TURN 2 : historique assistant rejoué en wire JSON + text.format + tools + instructions', () => {
    const p = provider();
    const body = p.buildConversationBody({
      input: {
        ...baseTurnInput,
        history: [
          { role: 'USER', content: 'Bonjour' },
          {
            role: 'ASSISTANT',
            content: 'Bonjour ! Comment puis-je t’aider ?',
            proposalKind: null,
          },
        ],
        userMessage: 'Peux-tu préciser ?',
      },
      tools: AI_COACH_TOOL_DEFINITIONS,
      timeoutMs: 10_000,
      model: 'gpt-5.4-mini',
    });

    expect(body.previous_response_id).toBeUndefined();
    expect(body.instructions).toBeTruthy();
    expect((body.text as { format: { type: string; strict: boolean } }).format).toMatchObject({
      type: 'json_schema',
      strict: true,
    });
    expect(Array.isArray(body.tools)).toBe(true);

    const input = body.input as Array<{ role: string; content: string }>;
    const assistant = input.find((item) => item.role === 'assistant');
    expect(assistant).toBeTruthy();
    const parsed = JSON.parse(assistant!.content) as {
      t: string;
      x: string;
    };
    expect(parsed.t).toBe('d');
    expect(parsed.x).toContain('Bonjour');
    // Ne jamais envoyer un UUID interne Nest/Prisma comme previous_response_id
    expect(JSON.stringify(body)).not.toMatch(
      /"previous_response_id"\s*:\s*"[0-9a-f-]{36}"/i,
    );
  });

  it('multi-turn mock : Bonjour puis Peux-tu préciser', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'resp_t1',
          status: 'completed',
          output_text: JSON.stringify({
            t: 'd',
            x: 'Bonjour !',
            d: null,
            rf: [],
            fu: [],
          }),
          output: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'resp_t2',
          status: 'completed',
          output_text: JSON.stringify({
            t: 'd',
            x: 'Bien sûr, sur quel exercice ?',
            d: null,
            rf: [],
            fu: [],
          }),
          output: [],
        }),
      );

    const p = provider();
    const t1 = await p.generateConversationTurn({
      input: baseTurnInput,
      tools: AI_COACH_TOOL_DEFINITIONS,
      timeoutMs: 10_000,
      model: 'gpt-5.4-mini',
    });
    expect(t1.kind).toBe('answer');

    const t2 = await p.generateConversationTurn({
      input: {
        ...baseTurnInput,
        history: [
          { role: 'USER', content: 'Bonjour' },
          { role: 'ASSISTANT', content: 'Bonjour !', proposalKind: null },
        ],
        userMessage: 'Peux-tu préciser ?',
      },
      tools: AI_COACH_TOOL_DEFINITIONS,
      timeoutMs: 10_000,
      model: 'gpt-5.4-mini',
    });
    expect(t2.kind).toBe('answer');
    if (t2.kind === 'answer') {
      expect(t2.answer.text).toContain('exercice');
    }

    const secondBody = JSON.parse(
      (fetchMock.mock.calls[1]?.[1] as { body: string }).body,
    ) as {
      instructions: string;
      text: { format: { type: string } };
      tools: unknown[];
      input: Array<{ role: string; content: string }>;
      previous_response_id?: string;
    };
    expect(secondBody.previous_response_id).toBeUndefined();
    expect(secondBody.instructions.length).toBeGreaterThan(20);
    expect(secondBody.text.format.type).toBe('json_schema');
    expect(secondBody.tools.length).toBeGreaterThan(0);
    const histAssistant = secondBody.input.find((i) => i.role === 'assistant');
    expect(JSON.parse(histAssistant!.content).t).toBe('d');
  });

  it('n’appelle jamais /chat/completions', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        id: 'resp_ok',
        status: 'completed',
        output_text: JSON.stringify({
          t: 'd',
          x: 'OK',
          d: null,
          rf: [],
          fu: [],
        }),
        output: [],
      }),
    );
    const p = provider();
    await p.generateConversationTurn({
      input: baseTurnInput,
      tools: [],
      timeoutMs: 10_000,
      model: 'gpt-5.4-mini',
      forceFinalAnswer: true,
    });
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('/responses');
    expect(url).not.toContain('/chat/completions');
  });
});
