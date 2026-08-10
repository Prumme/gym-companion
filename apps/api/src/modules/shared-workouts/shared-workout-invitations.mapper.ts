import type {
  SharedWorkoutRoomInvitationDto,
  SharedWorkoutRoomInvitationStatus,
  SharedWorkoutRoomStatus,
} from '@gym-companion/shared';

type ProfileUser = {
  profile: { displayName: string } | null;
};

type InvitationRow = {
  id: string;
  status: string;
  createdAt: Date;
  respondedAt: Date | null;
  cancelledAt: Date | null;
  room: {
    id: string;
    name: string;
    status: string;
  };
  invitedBy: ProfileUser;
  invitee: ProfileUser;
};

export function toSharedWorkoutRoomInvitationDto(
  invitation: InvitationRow,
): SharedWorkoutRoomInvitationDto {
  return {
    id: invitation.id,
    room: {
      id: invitation.room.id,
      name: invitation.room.name,
      status: invitation.room.status as SharedWorkoutRoomStatus,
    },
    inviter: {
      displayName: invitation.invitedBy.profile?.displayName ?? null,
    },
    invitee: {
      displayName: invitation.invitee.profile?.displayName ?? null,
    },
    status: invitation.status as SharedWorkoutRoomInvitationStatus,
    createdAt: invitation.createdAt.toISOString(),
    respondedAt: invitation.respondedAt?.toISOString() ?? null,
    cancelledAt: invitation.cancelledAt?.toISOString() ?? null,
  };
}
