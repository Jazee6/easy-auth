import { APIError } from "@better-auth/core/error";
import { createAuthMiddleware } from "@better-auth/core/api";
import { getAuthoritativeSessionFromCtx, isAPIError } from "better-auth/api";
import * as v from "valibot";

import { hasAdministratorRole } from "./admin-policy";
import {
  banAccountInputSchema,
  getBanDurationFromSeconds,
  type BanDuration,
} from "./admin-security";

export const ADMIN_AUTHENTICATION_REQUIRED = {
  code: "ADMIN_AUTHENTICATION_REQUIRED",
  message: "Authentication required",
} as const;

export const ADMINISTRATOR_ACCESS_REQUIRED = {
  code: "ADMINISTRATOR_ACCESS_REQUIRED",
  message: "Administrator access required",
} as const;

export const ADMINISTRATOR_TARGET_PROHIBITED = {
  code: "ADMINISTRATOR_TARGET_PROHIBITED",
  message: "Administrator Accounts are read-only",
} as const;

export const SECURITY_ACTION_INVALID_INPUT = {
  code: "SECURITY_ACTION_INVALID_INPUT",
  message: "Invalid Ban reason or duration",
} as const;

export const SECURITY_ACTION_INVALID_STATE = {
  code: "SECURITY_ACTION_INVALID_STATE",
  message: "Account is already banned and credential cleanup is complete",
} as const;

export const SECURITY_ACTION_TARGET_NOT_FOUND = {
  code: "SECURITY_ACTION_TARGET_NOT_FOUND",
  message: "Account not found",
} as const;

export const SECURITY_CLEANUP_FAILED = {
  code: "SECURITY_CLEANUP_FAILED",
  message: "Account restriction succeeded but credential cleanup is incomplete",
} as const;

interface SecurityIdentitySnapshot {
  id: string;
  name: string;
  email: string;
}

interface BanOperationContext {
  actor: SecurityIdentitySnapshot;
  target: SecurityIdentitySnapshot;
  reason: string;
  duration: BanDuration;
}

interface AccountSecurityRow {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: number | null;
  ban_expires: number | null;
}

interface ResidueRow {
  session_count: number;
  refresh_count: number;
  access_count: number;
}

interface BanStateRow {
  ban_expires: number | null;
}

interface EasyAuthSecurityContext {
  returned?: unknown;
  easyAuthBanOperation?: BanOperationContext;
  logger: { error(message: string, details?: unknown): void };
}

export interface SecurityActivityFailureEvent {
  activityId: string;
  code: "SECURITY_ACTIVITY_WRITE_FAILED";
  error: string;
}

export interface AdminSecurityPluginOptions {
  onSecurityActivityFailure?: (event: SecurityActivityFailureEvent) => void;
}

function isSuccessfulEndpointResult(result: unknown): boolean {
  if (result === undefined || result === null || isAPIError(result)) return false;
  return !(result instanceof Response) || (result.status >= 200 && result.status < 300);
}

async function getTargetResidue(database: D1Database, accountId: string): Promise<ResidueRow> {
  return (
    (await database
      .prepare(
        `SELECT
          (SELECT count(*) FROM session WHERE user_id = ?) AS session_count,
          (SELECT count(*) FROM oauth_refresh_token WHERE user_id = ?) AS refresh_count,
          (SELECT count(*) FROM oauth_access_token WHERE user_id = ?) AS access_count`,
      )
      .bind(accountId, accountId, accountId)
      .first<ResidueRow>()) ?? { session_count: 0, refresh_count: 0, access_count: 0 }
  );
}

function reportActivityFailure(
  context: EasyAuthSecurityContext,
  options: AdminSecurityPluginOptions,
  event: SecurityActivityFailureEvent,
): void {
  try {
    if (options.onSecurityActivityFailure) options.onSecurityActivityFailure(event);
    else context.logger.error("Security activity write failed", event);
  } catch {
    // Logging must never change the already completed security operation.
  }
}

export function createAdminSecurityPlugin(
  database: D1Database,
  options: AdminSecurityPluginOptions = {},
) {
  return {
    id: "easy-auth-admin-security",
    hooks: {
      before: [
        {
          matcher(ctx: { path?: string }) {
            return ctx.path === "/admin/ban-user";
          },
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getAuthoritativeSessionFromCtx(ctx);
            if (!session) throw APIError.from("UNAUTHORIZED", ADMIN_AUTHENTICATION_REQUIRED);
            if (!hasAdministratorRole(session.user.role)) {
              throw APIError.from("FORBIDDEN", ADMINISTRATOR_ACCESS_REQUIRED);
            }

            const duration = getBanDurationFromSeconds(ctx.body?.banExpiresIn);
            const parsed = v.safeParse(banAccountInputSchema, {
              accountId: ctx.body?.userId,
              reason: ctx.body?.banReason,
              duration,
            });
            if (!parsed.success) {
              throw APIError.from("BAD_REQUEST", SECURITY_ACTION_INVALID_INPUT);
            }

            const target = await database
              .prepare("SELECT id, name, email, role, banned, ban_expires FROM user WHERE id = ?")
              .bind(parsed.output.accountId)
              .first<AccountSecurityRow>();
            if (!target) throw APIError.from("NOT_FOUND", SECURITY_ACTION_TARGET_NOT_FOUND);
            if (hasAdministratorRole(target.role)) {
              throw APIError.from("FORBIDDEN", ADMINISTRATOR_TARGET_PROHIBITED);
            }

            const now = Date.now();
            const effectivelyBanned =
              target.banned === 1 && (target.ban_expires === null || target.ban_expires > now);
            if (effectivelyBanned) {
              const residue = await getTargetResidue(database, target.id);
              if (
                residue.session_count === 0 &&
                residue.refresh_count === 0 &&
                residue.access_count === 0
              ) {
                throw APIError.from("CONFLICT", SECURITY_ACTION_INVALID_STATE);
              }
            }

            ctx.body.userId = parsed.output.accountId;
            ctx.body.banReason = parsed.output.reason;
            const securityContext = ctx.context as typeof ctx.context & EasyAuthSecurityContext;
            securityContext.easyAuthBanOperation = {
              actor: {
                id: session.user.id,
                name: session.user.name,
                email: session.user.email,
              },
              target: { id: target.id, name: target.name, email: target.email },
              reason: parsed.output.reason,
              duration: parsed.output.duration,
            };
          }),
        },
      ],
      after: [
        {
          matcher(ctx: { path?: string }) {
            return ctx.path === "/admin/ban-user";
          },
          handler: createAuthMiddleware(async (ctx) => {
            const securityContext = ctx.context as typeof ctx.context & EasyAuthSecurityContext;
            const operation = securityContext.easyAuthBanOperation;
            if (!operation || !isSuccessfulEndpointResult(securityContext.returned)) return;

            try {
              await database.batch([
                database
                  .prepare("DELETE FROM oauth_access_token WHERE user_id = ?")
                  .bind(operation.target.id),
                database
                  .prepare("DELETE FROM oauth_refresh_token WHERE user_id = ?")
                  .bind(operation.target.id),
              ]);
            } catch {
              throw APIError.from("INTERNAL_SERVER_ERROR", SECURITY_CLEANUP_FAILED);
            }

            const activityId = crypto.randomUUID();
            try {
              const state = await database
                .prepare("SELECT ban_expires FROM user WHERE id = ?")
                .bind(operation.target.id)
                .first<BanStateRow>();
              await database
                .prepare(
                  `INSERT INTO security_activity (
                    id,
                    actor_user_id,
                    actor_name,
                    actor_email,
                    target_user_id,
                    target_name,
                    target_email,
                    action,
                    details,
                    created_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ban', ?, ?)`,
                )
                .bind(
                  activityId,
                  operation.actor.id,
                  operation.actor.name,
                  operation.actor.email,
                  operation.target.id,
                  operation.target.name,
                  operation.target.email,
                  JSON.stringify({
                    reason: operation.reason,
                    duration: operation.duration,
                    expiresAt: state?.ban_expires ?? null,
                  }),
                  Date.now(),
                )
                .run();
            } catch (error) {
              reportActivityFailure(securityContext, options, {
                activityId,
                code: "SECURITY_ACTIVITY_WRITE_FAILED",
                error: error instanceof Error ? error.message : "Unknown persistence error",
              });
            }
          }),
        },
      ],
    },
  };
}
