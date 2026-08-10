/**
 * Rate limiter mémoire par utilisateur pour les explications IA.
 * Pas de Redis en 5.5.
 */
export class AiCoachRateLimiter {
  private readonly hits = new Map<string, number[]>();
  private limitPerMinute: number;

  constructor(limitPerMinute: number) {
    this.limitPerMinute = limitPerMinute;
  }

  /**
   * @returns true si la requête est autorisée
   */
  tryConsume(userId: string, nowMs = Date.now()): boolean {
    const windowStart = nowMs - 60_000;
    const previous = this.hits.get(userId) ?? [];
    const recent = previous.filter((ts) => ts >= windowStart);
    if (recent.length >= this.limitPerMinute) {
      this.hits.set(userId, recent);
      return false;
    }
    recent.push(nowMs);
    this.hits.set(userId, recent);
    return true;
  }

  /** Test helper */
  reset(): void {
    this.hits.clear();
  }

  /** Test helper */
  setLimitForTests(limitPerMinute: number): void {
    this.limitPerMinute = limitPerMinute;
    this.reset();
  }
}
