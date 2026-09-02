import { APIError } from "@better-auth/core/error";

import type { createEasyAuth } from "./auth-factory";

export const TWO_FACTOR_ALREADY_ENABLED = {
  code: "TWO_FACTOR_ALREADY_ENABLED",
  message: "Two-Factor Authentication is already enabled",
} as const;

export const TWO_FACTOR_NOT_ENABLED = {
  code: "TWO_FACTOR_NOT_ENABLED",
  message: "Two-Factor Authentication is not enabled",
} as const;

export const TWO_FACTOR_SESSION_NOT_FRESH = {
  code: "SESSION_NOT_FRESH",
  message: "Sign in again before changing Two-Factor Authentication",
} as const;

export const TWO_FACTOR_AUTHENTICATION_REQUIRED = {
  code: "AUTHENTICATION_REQUIRED",
  message: "Authentication required",
} as const;

export const TWO_FACTOR_SESSION_FRESH_AGE_MS = 24 * 60 * 60 * 1_000;

export interface TwoFactorAccountStatus {
  enabled: boolean;
  hasLocalPassword: boolean;
}

type TwoFactorStatusAuthApi = Pick<ReturnType<typeof createEasyAuth>["api"], "getSession">;

interface TwoFactorStatusRow {
  enabled: number;
  has_local_password: number;
}

export async function getOwnTwoFactorStatus({
  database,
  authApi,
  headers,
}: {
  database: D1Database;
  authApi: TwoFactorStatusAuthApi;
  headers: Headers;
}): Promise<TwoFactorAccountStatus> {
  const session = await authApi.getSession({ headers });
  if (!session) {
    throw APIError.from("UNAUTHORIZED", TWO_FACTOR_AUTHENTICATION_REQUIRED);
  }

  const status = await database
    .prepare(
      `SELECT
        coalesce(user.two_factor_enabled, 0) AS enabled,
        EXISTS (
          SELECT 1
          FROM account
          WHERE account.user_id = user.id
            AND account.provider_id = 'credential'
            AND account.password IS NOT NULL
        ) AS has_local_password
      FROM user
      WHERE user.id = ?`,
    )
    .bind(session.user.id)
    .first<TwoFactorStatusRow>();

  if (!status) {
    throw APIError.from("UNAUTHORIZED", TWO_FACTOR_AUTHENTICATION_REQUIRED);
  }

  return {
    enabled: status.enabled === 1,
    hasLocalPassword: status.has_local_password === 1,
  };
}
