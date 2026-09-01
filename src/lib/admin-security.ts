import * as v from "valibot";

import { escapeLikePattern } from "./sql";

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

export const SECURITY_ACTIVITY_ACTIONS = [
  "ban",
  "unban",
  "revoke-session",
  "revoke-all-sessions",
] as const;

export type SecurityActivityAction = (typeof SECURITY_ACTIVITY_ACTIONS)[number];

export const SECURITY_ACTIVITY_ACTION_LABELS: Record<SecurityActivityAction, string> = {
  ban: "Ban",
  unban: "Unban",
  "revoke-session": "Revoke Session",
  "revoke-all-sessions": "Revoke all Sessions",
};

export interface SecurityActivityItem {
  activityId: string;
  actorAccountId: string;
  actorName: string;
  actorEmail: string;
  targetAccountId: string;
  targetName: string;
  targetEmail: string;
  action: SecurityActivityAction;
  details: SecurityActivityDetails;
  createdAt: number;
}

export const SECURITY_ACTIVITY_PAGE_SIZE = 20;

export interface SecurityActivitySearch {
  q: string;
  action?: SecurityActivityAction;
  start?: string;
  end?: string;
  page: number;
}

export interface SecurityActivityListResult {
  activity: SecurityActivityItem[];
  total: number;
  page: number;
  pageSize: typeof SECURITY_ACTIVITY_PAGE_SIZE;
  totalPages: number;
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

function projectSecurityActivity(row: SecurityActivityRow): SecurityActivityItem {
  return {
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
  };
}

const securityActivityColumns = `id AS activity_id,
  actor_user_id AS actor_account_id,
  actor_name,
  actor_email,
  target_user_id AS target_account_id,
  target_name,
  target_email,
  action,
  details,
  created_at`;

function validDateOnly(value: unknown, field: "start" | "end"): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid Security activity ${field} date`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid Security activity ${field} date`);
  }
  return value;
}

export function normalizeSecurityActivitySearch(
  input: Record<string, unknown>,
): SecurityActivitySearch {
  const action = SECURITY_ACTIVITY_ACTIONS.find((value) => value === input.action);
  let start = validDateOnly(input.start, "start");
  let end = validDateOnly(input.end, "end");
  if (start && end && start > end) [start, end] = [end, start];
  const page =
    typeof input.page === "number" && Number.isSafeInteger(input.page) && input.page > 0
      ? input.page
      : 1;

  return {
    q: typeof input.q === "string" ? input.q.trim() : "",
    ...(action ? { action } : {}),
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
    page,
  };
}

function dateStart(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export async function listGlobalSecurityActivity(
  database: D1Database,
  search: SecurityActivitySearch,
): Promise<SecurityActivityListResult> {
  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (search.action) {
    conditions.push("action = ?");
    bindings.push(search.action);
  }
  if (search.q) {
    const term = `%${escapeLikePattern(search.q.toLowerCase())}%`;
    conditions.push(`(lower(actor_name) LIKE ? ESCAPE '\\'
      OR lower(actor_email) LIKE ? ESCAPE '\\'
      OR lower(target_name) LIKE ? ESCAPE '\\'
      OR lower(target_email) LIKE ? ESCAPE '\\')`);
    bindings.push(term, term, term, term);
  }
  if (search.start) {
    conditions.push("created_at >= ?");
    bindings.push(dateStart(search.start));
  }
  if (search.end) {
    conditions.push("created_at < ?");
    bindings.push(dateStart(search.end) + 86_400_000);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const count = await database
    .prepare(`SELECT count(*) AS total FROM security_activity ${where}`)
    .bind(...bindings)
    .first<number>("total");
  const total = count ?? 0;
  const totalPages = Math.ceil(total / SECURITY_ACTIVITY_PAGE_SIZE);
  const page = Math.min(search.page, Math.max(totalPages, 1));
  const rows = await database
    .prepare(
      `SELECT ${securityActivityColumns}
      FROM security_activity
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?`,
    )
    .bind(...bindings, SECURITY_ACTIVITY_PAGE_SIZE, (page - 1) * SECURITY_ACTIVITY_PAGE_SIZE)
    .all<SecurityActivityRow>();

  return {
    activity: rows.results.map(projectSecurityActivity),
    total,
    page,
    pageSize: SECURITY_ACTIVITY_PAGE_SIZE,
    totalPages,
  };
}

export async function listRecentSecurityActivity(
  database: D1Database,
  limit: number,
): Promise<SecurityActivityItem[]> {
  const rows = await database
    .prepare(
      `SELECT ${securityActivityColumns}
      FROM security_activity
      ORDER BY created_at DESC, id DESC
      LIMIT ?`,
    )
    .bind(limit)
    .all<SecurityActivityRow>();

  return rows.results.map(projectSecurityActivity);
}

export async function listAccountSecurityActivity(
  database: D1Database,
  targetAccountId: string,
  limit = SECURITY_ACTIVITY_PAGE_SIZE,
): Promise<SecurityActivityItem[]> {
  const rows = await database
    .prepare(
      `SELECT ${securityActivityColumns}
      FROM security_activity
      WHERE target_user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?`,
    )
    .bind(targetAccountId, limit)
    .all<SecurityActivityRow>();

  return rows.results.map(projectSecurityActivity);
}

function errorText(error: unknown): string {
  if (typeof error === "string") return error.toLowerCase();
  if (typeof error !== "object" || error === null) return "";
  const candidate = error as { code?: unknown; message?: unknown };
  return `${String(candidate.code ?? "")} ${String(candidate.message ?? "")}`.toLowerCase();
}

export function translateUnbanAccountError(error: unknown): string {
  const text = errorText(error);
  if (text.includes("security_cleanup_incomplete")) {
    return "Credential cleanup is incomplete. Retry the Ban action before Unbanning this Account.";
  }
  if (text.includes("security_action_invalid_state")) {
    return "This Account is already unrestricted.";
  }
  if (text.includes("administrator_target_prohibited")) {
    return "Administrator security is operations-only.";
  }
  return "Unable to Unban this Account. Refresh its security state and try again.";
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
