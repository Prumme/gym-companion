import type {
  AiCoachChatReference,
  AiCoachConversationDetail,
  AiCoachConversationMessage,
} from '@gym-companion/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { LoadingState } from '@/components/common/LoadingState';
import { Button, ButtonLink } from '@/components/ui/button';
import { getMe } from '@/features/profile/api/profile-api';
import { getApiErrorMessage } from '@/lib/api/client';

import {
  createAiCoachConversation,
  sendAiCoachMessage,
} from '../api/coaching-api';
import {
  aiCoachConversationQueryOptions,
  aiCoachConversationsQueryOptions,
} from '../api/coaching-query-options';
import { coachingQueryKeys } from '../api/coaching-query-keys';

function referenceHref(reference: AiCoachChatReference): string {
  if (reference.type === 'WORKOUT') {
    return `/workouts/${reference.workoutSessionId}`;
  }
  if (reference.type === 'PROGRESS') {
    return `/progress/exercises/${reference.exerciseId}`;
  }
  return `/exercises/${reference.exerciseId}`;
}

function createClientCommandId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `cmd-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const STARTER_PROMPTS = [
  'Comment évoluent mes entraînements ?',
  'Parle-moi de ma progression récente.',
  'Quels exercices dois-je surveiller ?',
];

export function CoachChatPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const exerciseId = searchParams.get('exerciseId');
  const conversationId = searchParams.get('c');
  const [draft, setDraft] = useState('');
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );
  const [localMessages, setLocalMessages] = useState<
    AiCoachConversationMessage[]
  >([]);
  const listId = useId();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    staleTime: 60_000,
  });
  const aiAvailable = meQuery.data?.data.ai.available === true;

  const conversationsQuery = useQuery({
    ...aiCoachConversationsQueryOptions(),
    enabled: aiAvailable,
  });

  const conversationQuery = useQuery({
    ...aiCoachConversationQueryOptions(conversationId ?? ''),
    enabled: aiAvailable && Boolean(conversationId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createAiCoachConversation(
        exerciseId ? { exerciseId } : {},
      ),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: coachingQueryKeys.conversations(),
      });
      navigate(`/coach/chat?c=${data.id}`, { replace: true });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (input: {
      conversationId: string;
      content: string;
      clientCommandId: string;
    }) => sendAiCoachMessage(input.conversationId, input),
    onMutate: async (input) => {
      const optimistic: AiCoachConversationMessage = {
        id: `local-${input.clientCommandId}`,
        role: 'USER',
        content: input.content,
        references: [],
        suggestedFollowUps: [],
        createdAt: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...prev, optimistic]);
      setDraft('');
    },
    onSuccess: (data, variables) => {
      setLocalMessages((prev) => {
        const withoutOptimistic = prev.filter(
          (message) => !message.id.startsWith('local-'),
        );
        const next = [...withoutOptimistic, data.userMessage];
        if (data.assistantMessage) next.push(data.assistantMessage);
        return next;
      });
      void queryClient.invalidateQueries({
        queryKey: coachingQueryKeys.conversation(variables.conversationId),
      });
      void queryClient.invalidateQueries({
        queryKey: coachingQueryKeys.conversations(),
      });
      inputRef.current?.focus();
    },
    onError: () => {
      inputRef.current?.focus();
    },
  });

  useEffect(() => {
    if (!conversationQuery.data) return;
    if (sendMutation.isPending) return;
    setLocalMessages(conversationQuery.data.messages);
  }, [conversationQuery.data, sendMutation.isPending]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [localMessages, conversationQuery.isFetching]);

  async function ensureConversationThenSend(content: string) {
    const trimmed = content.trim();
    if (!trimmed || sendMutation.isPending || createMutation.isPending) return;
    if (offline || !aiAvailable) return;

    let activeId = conversationId;
    if (!activeId) {
      const created = await createMutation.mutateAsync();
      activeId = created.id;
      navigate(`/coach/chat?c=${created.id}`, { replace: true });
    }
    sendMutation.mutate({
      conversationId: activeId,
      content: trimmed,
      clientCommandId: createClientCommandId(),
    });
  }

  if (meQuery.isLoading) {
    return <LoadingState label="Chargement…" />;
  }

  if (!aiAvailable) {
    return (
      <main className="space-y-4">
        <h1 className="text-2xl font-bold">Chat Coach</h1>
        <p className="text-sm text-[var(--muted)]">
          Les explications IA ne sont pas activées.
        </p>
        <ButtonLink to="/coach" variant="secondary">
          Retour au Coach
        </ButtonLink>
      </main>
    );
  }

  const conversation = conversationQuery.data as
    | AiCoachConversationDetail
    | undefined;
  const messages = localMessages;

  return (
    <main className="flex min-h-[70vh] flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chat Coach</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Pose des questions sur ta progression. Le Coach lit tes données via
            des outils sécurisés, sans modifier ton programme.
          </p>
          {conversation?.contextExercise ? (
            <p className="mt-2 text-sm">
              Contexte :{' '}
              <Link
                className="font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
                to={`/progress/exercises/${conversation.contextExercise.id}`}
              >
                {conversation.contextExercise.name}
              </Link>
            </p>
          ) : null}
        </div>
        <ButtonLink to="/coach" variant="secondary" className="min-h-10">
          Vue Coach
        </ButtonLink>
      </header>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3"
          aria-label="Conversations récentes"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Conversations</p>
            <Button
              type="button"
              variant="secondary"
              className="min-h-9 px-3 text-xs"
              disabled={createMutation.isPending || offline}
              onClick={() => createMutation.mutate()}
            >
              Nouvelle
            </Button>
          </div>
          {conversationsQuery.isLoading ? (
            <p className="text-sm text-[var(--muted)]">Chargement…</p>
          ) : null}
          <ul className="space-y-2">
            {(conversationsQuery.data?.data ?? []).map((item) => (
              <li key={item.id}>
                <Link
                  to={`/coach/chat?c=${item.id}`}
                  className={`block rounded-[var(--radius)] px-2 py-2 text-sm ${
                    item.id === conversationId
                      ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                      : 'hover:bg-[var(--muted)]/20'
                  }`}
                >
                  <span className="font-medium">
                    {item.title ?? 'Conversation'}
                  </span>
                  {item.lastMessagePreview ? (
                    <span className="mt-0.5 block truncate opacity-80">
                      {item.lastMessagePreview}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <section
          className="flex min-h-[28rem] flex-col rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]"
          aria-label="Fil de discussion"
        >
          <div
            id={listId}
            className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {!conversationId && messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold">Nouvelle conversation</p>
                <p className="text-sm text-[var(--muted)]">
                  Choisis une suggestion ou pose ta question.
                </p>
                <ul className="flex flex-wrap gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <li key={prompt}>
                      <button
                        type="button"
                        className="min-h-10 rounded-[var(--radius)] border border-[var(--border)] px-3 text-left text-sm"
                        disabled={offline || sendMutation.isPending}
                        onClick={() => void ensureConversationThenSend(prompt)}
                      >
                        {prompt}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {messages.map((message) => (
              <article
                key={message.id}
                className={`max-w-[95%] rounded-[var(--radius)] px-3 py-2 text-sm ${
                  message.role === 'USER'
                    ? 'ml-auto bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'mr-auto border border-[var(--border)] bg-[var(--background)]'
                }`}
                aria-label={
                  message.role === 'USER' ? 'Message utilisateur' : 'Message Coach'
                }
              >
                <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                  {message.role === 'USER' ? 'Toi' : 'Coach'}
                </p>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </p>
                {message.references.length > 0 ? (
                  <div className="mt-3 border-t border-white/20 pt-2">
                    <p className="text-xs font-semibold">Sources utilisées</p>
                    <ul className="mt-1 space-y-1">
                      {message.references.map((reference) => (
                        <li key={`${reference.type}-${reference.label}`}>
                          <Link
                            to={referenceHref(reference)}
                            className="underline-offset-2 hover:underline"
                          >
                            {reference.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {message.suggestedFollowUps.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {message.suggestedFollowUps.map((followUp) => (
                      <li key={followUp}>
                        <button
                          type="button"
                          className="min-h-9 rounded-[var(--radius)] border border-current/30 px-2 text-xs"
                          disabled={offline || sendMutation.isPending}
                          onClick={() =>
                            void ensureConversationThenSend(followUp)
                          }
                        >
                          {followUp}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}

            {sendMutation.isPending ? (
              <p className="text-sm text-[var(--muted)]" role="status">
                Le Coach prépare une réponse…
              </p>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-[var(--border)] p-3">
            {offline ? (
              <p className="mb-2 text-sm text-[var(--muted)]" role="status">
                Une connexion est nécessaire pour discuter avec le Coach.
              </p>
            ) : null}
            {sendMutation.isError ? (
              <p className="mb-2 text-sm text-[var(--danger)]" role="alert">
                {getApiErrorMessage(
                  sendMutation.error,
                  'Le Coach n’a pas pu répondre.',
                )}
              </p>
            ) : null}
            {createMutation.isError ? (
              <p className="mb-2 text-sm text-[var(--danger)]" role="alert">
                {getApiErrorMessage(
                  createMutation.error,
                  'Impossible de créer la conversation.',
                )}
              </p>
            ) : null}
            <form
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                void ensureConversationThenSend(draft);
              }}
            >
              <label className="sr-only" htmlFor="coach-chat-input">
                Message pour le Coach
              </label>
              <textarea
                ref={inputRef}
                id="coach-chat-input"
                className="min-h-11 w-full flex-1 resize-y rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                rows={2}
                maxLength={1500}
                value={draft}
                disabled={offline || sendMutation.isPending}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Écris ta question…"
              />
              <Button
                type="submit"
                className="min-h-11 sm:min-w-28"
                disabled={
                  offline ||
                  sendMutation.isPending ||
                  createMutation.isPending ||
                  draft.trim().length === 0
                }
                aria-busy={sendMutation.isPending}
              >
                Envoyer
              </Button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
