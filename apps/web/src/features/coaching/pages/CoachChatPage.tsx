import type {
  AiCoachChatReference,
  AiCoachConversationDetail,
  AiCoachConversationMessage,
} from '@gym-companion/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { LoadingState } from '@/components/common/LoadingState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, ButtonLink } from '@/components/ui/button';
import { getMe } from '@/features/profile/api/profile-api';
import {
  getApiErrorMessage,
  type ApiRequestError,
} from '@/lib/api/client';

import {
  createAiCoachConversation,
  sendAiCoachMessage,
} from '../api/coaching-api';
import { CoachProposalCard } from '../components/CoachProposalCard';
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

function getErrorCode(error: unknown): string | null {
  const apiError = error as ApiRequestError | undefined;
  if (apiError && typeof apiError === 'object' && 'code' in apiError) {
    return String(apiError.code ?? '') || null;
  }
  return null;
}

function chatErrorMessage(error: unknown): string {
  const code = getErrorCode(error);
  if (code === 'AI_COACH_RATE_LIMITED') {
    return 'Trop de demandes en peu de temps. Réessaie dans un moment.';
  }
  if (code === 'AI_COACH_CONVERSATION_BUSY') {
    return 'Le Coach traite déjà une réponse. Réessaie dans un instant.';
  }
  return getApiErrorMessage(error, 'Le Coach n’a pas pu répondre.');
}

const STARTER_PROMPTS = [
  'Pourquoi ma progression aux tractions stagne ?',
  'Comment évolue mon développé couché ?',
  'Quels records ai-je battus récemment ?',
  'Quelle était ma dernière séance Push ?',
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
      createAiCoachConversation(exerciseId ? { exerciseId } : {}),
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
        proposal: null,
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

  function startNewConversation() {
    navigate(
      exerciseId
        ? `/coach/chat?exerciseId=${encodeURIComponent(exerciseId)}`
        : '/coach/chat',
      { replace: true },
    );
    setLocalMessages([]);
    setDraft('');
  }

  if (meQuery.isLoading) {
    return <LoadingState label="Chargement…" />;
  }

  if (!aiAvailable) {
    return (
      <main className="flex flex-1 flex-col gap-[var(--space-4)]">
        <PageHeader
          title="Coach IA"
          description="Explications et questions sur ton entraînement."
          backTo="/coach"
          backLabel="Coach"
          className="mb-0"
        />
        <p className="text-sm text-[var(--muted-foreground)]">
          Indisponible sur cet environnement. L’analyse Coach déterministe reste
          disponible sans IA.
        </p>
        <ButtonLink to="/coach" variant="secondary" className="w-fit">
          Retour au Coach
        </ButtonLink>
      </main>
    );
  }

  const conversation = conversationQuery.data as
    | AiCoachConversationDetail
    | undefined;
  const messages = localMessages;
  const conversations = conversationsQuery.data?.data ?? [];

  return (
    <main className="flex min-h-[70vh] flex-1 flex-col gap-[var(--space-4)]">
      <PageHeader
        title="Coach IA"
        description="Pose une question sur ton entraînement"
        backTo="/coach"
        backLabel="Coach"
        className="mb-0"
        actions={
          <button
            type="button"
            className="min-h-11 text-sm text-[var(--muted-foreground)] underline-offset-2 hover:underline"
            onClick={startNewConversation}
          >
            Nouvelle conversation
          </button>
        }
      />
      <p className="text-xs text-[var(--muted-foreground)]">
        Le Coach peut consulter certaines données de ton historique en lecture
        seule. Il ne modifie pas ton programme ni tes séances.
      </p>
      {conversation?.contextExercise ? (
        <p className="text-sm">
          Contexte :{' '}
          <Link
            className="font-medium underline-offset-2 hover:underline"
            to={`/progress/exercises/${conversation.contextExercise.id}`}
          >
            {conversation.contextExercise.name}
          </Link>
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        {conversations.length > 0 ? (
          <aside aria-label="Conversations récentes" className="hidden lg:block">
            <p className="section-title mb-2">Conversations</p>
            <ul className="flex flex-col">
              {conversations.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/coach/chat?c=${item.id}`}
                    className={`flex min-h-11 items-center justify-between gap-2 border-b border-[var(--border)] py-2 text-sm ${
                      item.id === conversationId
                        ? 'font-semibold text-[var(--foreground)]'
                        : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    <span className="min-w-0 truncate">
                      {item.title ?? 'Conversation'}
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}

        <section
          className="flex min-h-[24rem] flex-1 flex-col border-t border-[var(--border)] lg:border-t-0"
          aria-label="Fil de discussion"
        >
          <div
            id={listId}
            className="flex-1 space-y-4 overflow-y-auto py-3"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {!conversationId && messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted-foreground)]">
                  Choisis une suggestion ou pose ta question.
                </p>
                <ul className="flex flex-col gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <li key={prompt}>
                      <button
                        type="button"
                        className="flex min-h-11 w-full items-center justify-between gap-2 border-b border-[var(--border)] py-2 text-left text-sm"
                        disabled={offline || sendMutation.isPending}
                        onClick={() => void ensureConversationThenSend(prompt)}
                      >
                        <span>{prompt}</span>
                        <ChevronRight
                          className="size-4 shrink-0 text-[var(--muted-foreground)]"
                          aria-hidden="true"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {messages.map((message) => (
              <article
                key={message.id}
                className={
                  message.role === 'USER'
                    ? 'ml-4 border-l-2 border-[var(--border)] pl-3 text-sm'
                    : 'text-sm'
                }
                aria-label={
                  message.role === 'USER'
                    ? 'Message utilisateur'
                    : 'Message Coach IA'
                }
              >
                <p className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
                  {message.role === 'USER' ? 'Toi' : 'Coach IA'}
                </p>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </p>
                {message.proposal && conversationId ? (
                  <div className="mt-3">
                    <CoachProposalCard
                      proposal={message.proposal}
                      conversationId={conversationId}
                    />
                  </div>
                ) : null}
                {message.references.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-[var(--muted-foreground)]">
                      Données consultées
                    </p>
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
                  <ul className="mt-3 flex flex-col gap-1">
                    {message.suggestedFollowUps.map((followUp) => (
                      <li key={followUp}>
                        <button
                          type="button"
                          className="min-h-10 text-left text-sm text-[var(--muted-foreground)] underline-offset-2 hover:underline"
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
              <p className="text-sm text-[var(--muted-foreground)]" role="status">
                Coach réfléchit…
              </p>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <div
            className="sticky bottom-0 border-t border-[var(--border)] bg-[var(--background)] pt-3"
            style={{
              paddingBottom:
                'calc(var(--space-3) + env(safe-area-inset-bottom, 0px))',
            }}
          >
            {offline ? (
              <p className="mb-2 text-sm text-[var(--muted-foreground)]" role="status">
                Une connexion est nécessaire pour discuter avec le Coach.
              </p>
            ) : null}
            {sendMutation.isError ? (
              <p className="mb-2 text-sm text-[var(--danger)]" role="alert">
                {chatErrorMessage(sendMutation.error)}
              </p>
            ) : null}
            {createMutation.isError ? (
              <p className="mb-2 text-sm text-[var(--danger)]" role="alert">
                {chatErrorMessage(createMutation.error)}
              </p>
            ) : null}
            <form
              className="flex items-end gap-2"
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
                className="max-h-32 min-h-11 w-full flex-1 resize-none rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm"
                rows={1}
                maxLength={1500}
                value={draft}
                disabled={offline || sendMutation.isPending}
                onChange={(event) => {
                  setDraft(event.target.value);
                  const el = event.target;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void ensureConversationThenSend(draft);
                  }
                }}
                placeholder="Pose une question sur ton entraînement…"
              />
              <Button
                type="submit"
                className="min-h-11 shrink-0"
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
