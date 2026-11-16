// Per-network throttle for the sign-in endpoints (in memory, per backend process).
// It is only active when TRUST_PROXY is set: behind NGINX/Cloudflare without it, every request appears to come from
// the proxy, and a shared limit would block the whole company. Per-account lockout (in the database) always applies.
export class LoginRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly limit: number, private readonly windowMs: number, private readonly enabled: boolean) {}

  // Returns the seconds to wait, or 0 when the request may continue.
  hit(key: string | undefined, now = Date.now()) {
    if (!this.enabled || !key) return 0;
    const recent = (this.hits.get(key) || []).filter((time) => now - time < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return Math.ceil((this.windowMs - (now - recent[0])) / 1000);
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10000) this.prune(now);
    return 0;
  }

  private prune(now: number) {
    for (const [key, times] of this.hits) {
      if (!times.some((time) => now - time < this.windowMs)) this.hits.delete(key);
    }
  }
}
