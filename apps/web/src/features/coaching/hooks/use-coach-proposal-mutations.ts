import { useMutation, useQueryClient } from '@tanstack/react-query';

import { acceptAiCoachProposal, dismissAiCoachProposal } from '../api/coaching-api';
import { coachingQueryKeys } from '../api/coaching-query-keys';

function invalidateConversation(
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string,
) {
  void queryClient.invalidateQueries({
    queryKey: coachingQueryKeys.conversation(conversationId),
  });
}

/**
 * Jalon 8 — accepter une proposition ne renvoie jamais le payload au serveur :
 * seul `proposalId` (+ `programId` pour une séance) est transmis, le backend
 * revalide et crée de façon déterministe.
 */
export function useAcceptAiCoachProposalMutation(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      proposalId,
      programId,
    }: {
      proposalId: string;
      programId?: string;
    }) => acceptAiCoachProposal(proposalId, programId ? { programId } : {}),
    onSuccess: () => invalidateConversation(queryClient, conversationId),
  });
}

export function useDismissAiCoachProposalMutation(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => dismissAiCoachProposal(proposalId),
    onSuccess: () => invalidateConversation(queryClient, conversationId),
  });
}
