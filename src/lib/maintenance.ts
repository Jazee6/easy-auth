/**
 * Rate-limit rows only need to outlive the longest rate-limit window (60 seconds);
 * a day keeps a wide margin.
 */
export const RATE_LIMIT_ROW_RETENTION_MS = 24 * 60 * 60 * 1000;

export interface ExpiredAuthDataPurgeResult {
  sessions: number;
  verifications: number;
  rateLimits: number;
}

/**
 * Deletes rows Better Auth only removes lazily, when they happen to be read.
 * Runs from the daily Cron Trigger. Deleting a Session sets `session_id` to NULL
 * on OAuth tokens (ON DELETE SET NULL), so issued tokens are unaffected.
 */
export async function purgeExpiredAuthData(
  database: D1Database,
  now: number,
): Promise<ExpiredAuthDataPurgeResult> {
  const [sessions, verifications, rateLimits] = await database.batch([
    database.prepare("DELETE FROM session WHERE expires_at < ?").bind(now),
    database.prepare("DELETE FROM verification WHERE expires_at < ?").bind(now),
    database
      .prepare("DELETE FROM rate_limit WHERE last_request < ?")
      .bind(now - RATE_LIMIT_ROW_RETENTION_MS),
  ]);

  return {
    sessions: sessions.meta.changes,
    verifications: verifications.meta.changes,
    rateLimits: rateLimits.meta.changes,
  };
}
