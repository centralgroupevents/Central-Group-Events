import { createHmac } from "node:crypto";
import { eq, lt, sql } from "drizzle-orm";
import type { Store } from "express-rate-limit";
import { db } from "./db";
import { assistantRateLimits } from "@shared/schema";

export class AssistantRateStore implements Store {
  localKeys = false;
  private lastCleanup = 0;
  constructor(public prefix: string, private windowMs: number) {}
  private hash(ip: string) {
    const secret = process.env.SESSION_SECRET;
    if (!secret) throw new Error("Rate limiter secret not configured");
    return `${this.prefix}:${createHmac("sha256", secret).update(ip).digest("hex")}`;
  }
  async increment(ip: string) {
    const now = new Date();
    const resetAt = new Date(now.getTime() + this.windowMs);
    const [row] = await db.insert(assistantRateLimits).values({
      key: this.hash(ip), hits: 1, resetAt,
    }).onConflictDoUpdate({
      target: assistantRateLimits.key,
      set: {
        hits: sql`CASE WHEN ${assistantRateLimits.resetAt} <= ${now} THEN 1 ELSE ${assistantRateLimits.hits} + 1 END`,
        resetAt: sql`CASE WHEN ${assistantRateLimits.resetAt} <= ${now} THEN ${resetAt} ELSE ${assistantRateLimits.resetAt} END`,
      },
    }).returning();
    // Retain no raw IPs; lazily discard old, expired hashes once per hour.
    if (now.getTime() - this.lastCleanup > 3600000) {
      this.lastCleanup = now.getTime();
      void db.delete(assistantRateLimits).where(lt(assistantRateLimits.resetAt, new Date(now.getTime() - 86400000)))
        .catch(() => console.warn("[assistant] Rate-limit cleanup failed"));
    }
    return { totalHits: row.hits, resetTime: row.resetAt };
  }
  async decrement(ip: string) {
    await db.update(assistantRateLimits).set({ hits: sql`GREATEST(0, ${assistantRateLimits.hits} - 1)` })
      .where(eq(assistantRateLimits.key, this.hash(ip)));
  }
  async resetKey(ip: string) {
    await db.delete(assistantRateLimits).where(eq(assistantRateLimits.key, this.hash(ip)));
  }
}
