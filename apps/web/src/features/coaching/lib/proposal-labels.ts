import type {
  AiCoachProposalKind,
  AiCoachProposalStatus,
} from '@gym-companion/shared';

export function getProposalKindLabel(kind: AiCoachProposalKind): string {
  return kind === 'PROGRAM' ? 'Proposition de programme' : 'Proposition de séance';
}

export function getProposalStatusLabel(status: AiCoachProposalStatus): string {
  switch (status) {
    case 'PENDING':
      return 'En attente de ta décision';
    case 'ACCEPTED':
      return 'Acceptée';
    case 'DISMISSED':
      return 'Refusée';
    case 'INVALID':
      return 'Plus valide';
    default:
      return status;
  }
}
