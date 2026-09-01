import Bowser from "bowser";

import { hasAdministratorRole } from "./admin-policy";

export interface SessionDeviceDescription {
  browser: string;
  operatingSystem: string;
  deviceType: string;
}

export interface SafeAccountSession extends SessionDeviceDescription {
  sessionId: string;
  ipAddress: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

interface SessionProjectionRow {
  session_id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: number;
  updated_at: number;
  expires_at: number;
}

interface SessionTokenRow {
  token: string;
}

interface AccountRoleRow {
  role: string | null;
}

function description(
  name: string | undefined,
  version: string | undefined,
  fallback: string,
): string {
  if (!name) return fallback;
  return version ? `${name} ${version}` : name;
}

function titleCase(value: string): string {
  return value
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function describeSessionDevice(
  userAgent: string | null | undefined,
): SessionDeviceDescription {
  if (!userAgent?.trim()) {
    return {
      browser: "Unknown browser",
      operatingSystem: "Unknown operating system",
      deviceType: "Unknown device",
    };
  }

  try {
    const result = Bowser.parse(userAgent);
    return {
      browser: description(result.browser.name, result.browser.version, "Unknown browser"),
      operatingSystem: description(
        result.os.name,
        result.os.versionName ?? result.os.version,
        "Unknown operating system",
      ),
      deviceType: result.platform.type ? titleCase(result.platform.type) : "Unknown device",
    };
  } catch {
    return {
      browser: "Unknown browser",
      operatingSystem: "Unknown operating system",
      deviceType: "Unknown device",
    };
  }
}

async function assertStandardAccount(database: D1Database, accountId: string): Promise<void> {
  const account = await database
    .prepare("SELECT role FROM user WHERE id = ?")
    .bind(accountId)
    .first<AccountRoleRow>();
  if (!account) throw new Error("Account not found");
  if (hasAdministratorRole(account.role)) {
    throw new Error("Administrator Sessions are operations-only");
  }
}

export async function listActiveAccountSessions(
  database: D1Database,
  accountId: string,
  now = Date.now(),
): Promise<SafeAccountSession[]> {
  await assertStandardAccount(database, accountId);
  const rows = await database
    .prepare(
      `SELECT id AS session_id, ip_address, user_agent, created_at, updated_at, expires_at
      FROM session
      WHERE user_id = ? AND expires_at > ?
      ORDER BY created_at DESC, id DESC`,
    )
    .bind(accountId, now)
    .all<SessionProjectionRow>();

  return rows.results.map((row) => ({
    sessionId: row.session_id,
    ...describeSessionDevice(row.user_agent),
    ipAddress: row.ip_address ?? "Unknown",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  }));
}

export async function resolveActiveSessionToken(
  database: D1Database,
  accountId: string,
  sessionId: string,
  now = Date.now(),
): Promise<string | null> {
  await assertStandardAccount(database, accountId);
  const row = await database
    .prepare("SELECT token FROM session WHERE id = ? AND user_id = ? AND expires_at > ?")
    .bind(sessionId, accountId, now)
    .first<SessionTokenRow>();
  return row?.token ?? null;
}
