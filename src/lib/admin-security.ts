import * as v from "valibot";

export const BAN_REASON_PRESETS = [
  "Suspicious activity",
  "Compromised account",
  "Policy violation",
  "Abuse",
] as const;

export const BAN_DURATIONS = [
  "one-hour",
  "24-hours",
  "seven-days",
  "30-days",
  "permanent",
] as const;

export type BanDuration = (typeof BAN_DURATIONS)[number];

export const banReasonSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty("Ban reason is required"),
  v.maxLength(500, "Ban reason must be 500 characters or fewer"),
);

export const banAccountInputSchema = v.object({
  accountId: v.pipe(v.string(), v.trim(), v.nonEmpty("Account ID is required")),
  reason: banReasonSchema,
  duration: v.picklist(BAN_DURATIONS, "Select a supported Ban duration"),
});

export type BanAccountInput = v.InferOutput<typeof banAccountInputSchema>;

const durationSeconds: Record<Exclude<BanDuration, "permanent">, number> = {
  "one-hour": 60 * 60,
  "24-hours": 24 * 60 * 60,
  "seven-days": 7 * 24 * 60 * 60,
  "30-days": 30 * 24 * 60 * 60,
};

export function getBanDurationSeconds(duration: BanDuration): number | undefined {
  return duration === "permanent" ? undefined : durationSeconds[duration];
}

export function getBanDurationFromSeconds(value: unknown): BanDuration | null {
  if (value === undefined) return "permanent";
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return (
    (Object.entries(durationSeconds).find(([, seconds]) => seconds === value)?.[0] as
      | BanDuration
      | undefined) ?? null
  );
}

export function formatBanDuration(duration: BanDuration): string {
  switch (duration) {
    case "one-hour":
      return "1 hour";
    case "24-hours":
      return "24 hours";
    case "seven-days":
      return "7 days";
    case "30-days":
      return "30 days";
    case "permanent":
      return "Permanent";
  }
}

export interface BanSecurityActivityDetails {
  reason: string;
  duration: BanDuration;
  expiresAt: number | null;
}

export interface SecurityActivityDetails {
  reason?: string;
  duration?: BanDuration;
  expiresAt?: number | null;
  sessionId?: string;
  scope?: "all";
}

export interface SecurityActivityItem {
  activityId: string;
  actorAccountId: string;
  actorName: string;
  actorEmail: string;
  targetAccountId: string;
  targetName: string;
  targetEmail: string;
  action: "ban" | "unban" | "revoke-session" | "revoke-all-sessions";
  details: SecurityActivityDetails;
  createdAt: number;
}

interface SecurityActivityRow {
  activity_id: string;
  actor_account_id: string;
  actor_name: string;
  actor_email: string;
  target_account_id: string;
  target_name: string;
  target_email: string;
  action: SecurityActivityItem["action"];
  details: string;
  created_at: number;
}

function parseDetails(value: string): SecurityActivityDetails {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (typeof parsed !== "object" || parsed === null) return {};
    const duration = BAN_DURATIONS.find((candidate) => candidate === parsed.duration);
    return {
      ...(typeof parsed.reason === "string" ? { reason: parsed.reason } : {}),
      ...(duration ? { duration } : {}),
      ...(typeof parsed.expiresAt === "number" || parsed.expiresAt === null
        ? { expiresAt: parsed.expiresAt }
        : {}),
      ...(typeof parsed.sessionId === "string" ? { sessionId: parsed.sessionId } : {}),
      ...(parsed.scope === "all" ? { scope: "all" as const } : {}),
    };
  } catch {
    return {};
  }
}

export async function listAccountSecurityActivity(
  database: D1Database,
  targetAccountId: string,
  limit = 20,
): Promise<SecurityActivityItem[]> {
  const rows = await database
    .prepare(
      `SELECT id AS activity_id,
        actor_user_id AS actor_account_id,
        actor_name,
        actor_email,
        target_user_id AS target_account_id,
        target_name,
        target_email,
        action,
        details,
        created_at
      FROM security_activity
      WHERE target_user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?`,
    )
    .bind(targetAccountId, limit)
    .all<SecurityActivityRow>();

  return rows.results.map((row) => ({
    activityId: row.activity_id,
    actorAccountId: row.actor_account_id,
    actorName: row.actor_name,
    actorEmail: row.actor_email,
    targetAccountId: row.target_account_id,
    targetName: row.target_name,
    targetEmail: row.target_email,
    action: row.action,
    details: parseDetails(row.details),
    createdAt: row.created_at,
  }));
}

function errorText(error: unknown): string {
  if (typeof error === "string") return error.toLowerCase();
  if (typeof error !== "object" || error === null) return "";
  const candidate = error as { code?: unknown; message?: unknown };
  return `${String(candidate.code ?? "")} ${String(candidate.message ?? "")}`.toLowerCase();
}

export function translateBanAccountError(error: unknown): string {
  const text = errorText(error);
  if (text.includes("security_action_invalid_state")) {
    return "This Account is already banned and its credentials are contained.";
  }
  if (text.includes("security_cleanup_failed")) {
    return "The Account was restricted, but credential cleanup is incomplete. Retry the Ban action.";
  }
  if (text.includes("administrator_target_prohibited")) {
    return "Administrator security is operations-only.";
  }
  if (text.includes("security_action_invalid_input")) {
    return "Check the Ban reason and duration, then try again.";
  }
  return "Unable to Ban this Account. Refresh its security state and try again.";
}
