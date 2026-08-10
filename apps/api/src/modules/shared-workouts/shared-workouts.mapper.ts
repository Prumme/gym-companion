import type {
  SharedWorkoutRoomDetail,
  SharedWorkoutRoomListItem,
  SharedWorkoutRoomMemberDto,
  SharedWorkoutRoomMemberRole,
  SharedWorkoutRoomStatus,
} from '@gym-companion/shared';

type MemberRow = {
  userId: string;
  role: string;
  joinedAt: Date;
  user: {
    profile: { displayName: string } | null;
  };
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

export function toSharedWorkoutRoomMemberDto(
  member: MemberRow,
): SharedWorkoutRoomMemberDto {
  return {
    userId: member.userId,
    role: member.role as SharedWorkoutRoomMemberRole,
    displayName: member.user.profile?.displayName ?? null,
    joinedAt: member.joinedAt.toISOString(),
  };
}

export function toSharedWorkoutRoomDetail(
  room: RoomRow,
  viewerUserId: string,
): SharedWorkoutRoomDetail {
  const ownerMember = room.members.find((member) => member.role === 'OWNER');
  return {
    id: room.id,
    name: room.name,
    status: room.status as SharedWorkoutRoomStatus,
    owner: {
      userId: room.ownerUserId,
      displayName:
        ownerMember?.user.profile?.displayName ??
        room.members.find((member) => member.userId === room.ownerUserId)?.user
          .profile?.displayName ??
        null,
    },
    members: room.members
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
  };
}

export function toSharedWorkoutRoomListItem(
  room: RoomRow,
): SharedWorkoutRoomListItem {
  const ownerMember = room.members.find((member) => member.role === 'OWNER');
  return {
    id: room.id,
    name: room.name,
    status: room.status as SharedWorkoutRoomStatus,
    memberCount: room.members.length,
    owner: {
      userId: room.ownerUserId,
      displayName: ownerMember?.user.profile?.displayName ?? null,
    },
    updatedAt: room.updatedAt.toISOString(),
    createdAt: room.createdAt.toISOString(),
  };
}
