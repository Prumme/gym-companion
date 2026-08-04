type WorkoutSyncBroadcastEvent = {
  type: 'sync-started' | 'sync-finished' | 'state-changed';
  userId: string;
  workoutSessionId: string;
};

const CHANNEL_NAME = 'gym-companion-workout-sync';

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
}

export function broadcastWorkoutSync(event: WorkoutSyncBroadcastEvent): void {
  try {
    getChannel()?.postMessage(event);
  } catch {
    // ignore
  }
}

export function subscribeWorkoutSync(
  listener: (event: WorkoutSyncBroadcastEvent) => void,
): () => void {
  const ch = getChannel();
  if (!ch) {
    return () => undefined;
  }
  const handler = (message: MessageEvent<WorkoutSyncBroadcastEvent>) => {
    if (message.data?.type) {
      listener(message.data);
    }
  };
  ch.addEventListener('message', handler);
  return () => ch.removeEventListener('message', handler);
}
