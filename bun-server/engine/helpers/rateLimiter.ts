export class RateLimiter {
  private counters = new Map<string, number>();
  private day = this.currentDay();

  private currentDay() {
    return new Date().toISOString().slice(0, 10);
  }

  private rollIfNeeded() {
    const now = this.currentDay();
    if (now !== this.day) {
      this.day = now;
      this.counters.clear();
    }
  }

  canPerform(action: string, dailyLimit: number) {
    this.rollIfNeeded();
    const used = this.counters.get(action) ?? 0;
    return used < dailyLimit;
  }

  record(action: string) {
    this.rollIfNeeded();
    const used = this.counters.get(action) ?? 0;
    this.counters.set(action, used + 1);
  }

  snapshot() {
    this.rollIfNeeded();
    return Object.fromEntries(this.counters.entries());
  }
}
