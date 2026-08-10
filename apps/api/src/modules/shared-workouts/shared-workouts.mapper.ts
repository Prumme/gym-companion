import type {
  SharedWorkoutRoomDetail,
  SharedWorkoutRoomListItem,
  SharedWorkoutRoomMemberDto,
  SharedWorkoutRoomMemberRole,
  SharedWorkoutRoomMemberWorkoutSummary,
  SharedWorkoutRoomStatus,
  WorkoutStatus,
} from '@gym-companion/shared';

type LinkedWorkoutRow = {
  id: string;
  name: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
};

type MemberRow = {
  id: string;
  userId: string;
  role: string;
  joinedAt: Date;
  leftAt: Date | null;
  user: {
    profile: { displayName: string } | null;
  };
  memberSession: {
    workoutSessionId: string;
    workoutSession: LinkedWorkoutRow;
  } | null;
};

type RoomRow = {
  id: string;
  name: string;
  status: string;
  ownerUserId: string;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  members: MemberRow[];
};

function activeMembers(members: MemberRow[]): MemberRow[] {
  return members.filter((member) => member.leftAt == null);
}

function toMemberWorkoutSummary(
  member: MemberRow,
): SharedWorkoutRoomMemberWorkoutSummary {
  const session = member.memberSession?.workoutSession;
  if (!session) {
    return {
      status: 'NOT_STARTED',
      workoutName: null,
      startedAt: null,
      completedAt: null,
    };
  }
  const status = session.status as WorkoutStatus;
  if (
    status !== 'ACTIVE' &&
    status !== 'PAUSED' &&
    status !== 'COMPLETED' &&
    status !== 'CANCELLED'
  ) {
    return {
      status: 'NOT_STARTED',
      workoutName: session.name,
      startedAt: session.startedAt.toISOString(),
      completedAt: null,
    };
  }
  return {
    status,
    workoutName: session.name,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
  };
}

export function toSharedWorkoutRoomMemberDto(
  member: MemberRow,
): SharedWorkoutRoomMemberDto {
  return {
    userId: member.userId,
    role: member.role as SharedWorkoutRoomMemberRole,
    displayName: member.user.profile?.displayName ?? null,
    joinedAt: member.joinedAt.toISOString(),
    memberWorkout: toMemberWorkoutSummary(member),
  };
}

export function toSharedWorkoutRoomDetail(
  room: RoomRow,
  viewerUserId: string,
): SharedWorkoutRoomDetail {
  const members = activeMembers(room.members);
  const ownerMember = members.find((member) => member.role === 'OWNER');
  const viewerMember = members.find((member) => member.userId === viewerUserId);
  return {
    id: room.id,
    name: room.name,
    status: room.status as SharedWorkoutRoomStatus,
    owner: {
      userId: room.ownerUserId,
      displayName:
        ownerMember?.user.profile?.displayName ??
        members.find((member) => member.userId === room.ownerUserId)?.user
          .profile?.displayName ??
        null,
    },
    members: members
      .slice()
      .sort((a, b) => {
        if (a.role === 'OWNER' && b.role !== 'OWNER') return -1;
        if (b.role === 'OWNER' && a.role !== 'OWNER') return 1;
        return a.joinedAt.getTime() - b.joinedAt.getTime();
      })
      .map(toSharedWorkoutRoomMemberDto),
    startedAt: room.startedAt?.toISOString() ?? null,
    completedAt: room.completedAt?.toISOString() ?? null,
    cancelledAt: room.cancelledAt?.toISOString() ?? null,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
    isOwner: room.ownerUserId === viewerUserId,
    myWorkoutSessionId:
      viewerMember?.memberSession?.workoutSessionId ?? null,
  };
}

export function toSharedWorkoutRoomListItem(
  room: RoomRow,
): SharedWorkoutRoomListItem {
  const members = activeMembers(room.members);
  const ownerMember = members.find((member) => member.role === 'OWNER');
  return {
    id: room.id,
    name: room.name,
    status: room.status as SharedWorkoutRoomStatus,
    memberCount: members.length,
    owner: {
      userId: room.ownerUserId,
      displayName: ownerMember?.user.profile?.displayName ?? null,
    },
    updatedAt: room.updatedAt.toISOString(),
    createdAt: room.createdAt.toISOString(),
  };
}
