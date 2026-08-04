import { clearRestTimerStorage } from '../lib/rest-timer-storage';
import { clearAllForUser } from './store';

export async function clearWorkoutOfflineDataForUser(
  userId: string,
): Promise<void> {
  const sessionIds = await clearAllForUser(userId);
  for (const sessionId of sessionIds) {
    clearRestTimerStorage(sessionId);
  }
}
