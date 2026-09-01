import { APIError } from "@better-auth/core/error";
import { createAuthMiddleware } from "@better-auth/core/api";
import { getAuthoritativeSessionFromCtx, isAPIError } from "better-auth/api";
import * as v from "valibot";

import { hasAdministratorRole, isAllowedDirectAdminPluginPath } from "./admin-policy";
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
  message: "Invalid security action input",
} as const;

export const SECURITY_ACTION_INVALID_STATE = {
  code: "SECURITY_ACTION_INVALID_STATE",
  message: "Account security state does not allow this operation",
} as const;

export const SECURITY_ACTION_TARGET_NOT_FOUND = {
  code: "SECURITY_ACTION_TARGET_NOT_FOUND",
  message: "Account not found",
} as const;

export const SECURITY_CLEANUP_FAILED = {
  code: "SECURITY_CLEANUP_FAILED",
  message: "Account restriction succeeded but credential cleanup is incomplete",
} as const;

export const SECURITY_CLEANUP_INCOMPLETE = {
  code: "SECURITY_CLEANUP_INCOMPLETE",
  message: "Credential cleanup must complete before this Account can be unrestricted",
} as const;

interface SecurityIdentitySnapshot {
  id: string;
  name: string;
  email: string;
}

interface SecurityOperationBase {
  actor: SecurityIdentitySnapshot;
  target: SecurityIdentitySnapshot;
}

interface BanOperationContext extends SecurityOperationBase {
  action: "ban";
  reason: string;
  duration: BanDuration;
}

interface UnbanOperationContext extends SecurityOperationBase {
  action: "unban";
}

type SecurityOperationContext = BanOperationContext | UnbanOperationContext;

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
  easyAuthSecurityOperation?: SecurityOperationContext;
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

const accountIdSchema = v.pipe(v.string(), v.trim(), v.nonEmpty());

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

function hasCredentialResidue(residue: ResidueRow): boolean {
  return residue.session_count > 0 || residue.refresh_count > 0 || residue.access_count > 0;
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
            return isAllowedDirectAdminPluginPath(ctx.path);
          },
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getAuthoritativeSessionFromCtx(ctx);
            if (!session) throw APIError.from("UNAUTHORIZED", ADMIN_AUTHENTICATION_REQUIRED);
            if (!hasAdministratorRole(session.user.role)) {
              throw APIError.from("FORBIDDEN", ADMINISTRATOR_ACCESS_REQUIRED);
            }

            const accountId = v.safeParse(accountIdSchema, ctx.body?.userId);
            if (!accountId.success) {
              throw APIError.from("BAD_REQUEST", SECURITY_ACTION_INVALID_INPUT);
            }
            const target = await database
              .prepare("SELECT id, name, email, role, banned, ban_expires FROM user WHERE id = ?")
              .bind(accountId.output)
              .first<AccountSecurityRow>();
            if (!target) throw APIError.from("NOT_FOUND", SECURITY_ACTION_TARGET_NOT_FOUND);
            if (hasAdministratorRole(target.role)) {
              throw APIError.from("FORBIDDEN", ADMINISTRATOR_TARGET_PROHIBITED);
            }

            const actor = {
              id: session.user.id,
              name: session.user.name,
              email: session.user.email,
            };
            const targetSnapshot = { id: target.id, name: target.name, email: target.email };
            const securityContext = ctx.context as typeof ctx.context & EasyAuthSecurityContext;
            ctx.body.userId = accountId.output;

            if (ctx.path === "/admin/ban-user") {
              const duration = getBanDurationFromSeconds(ctx.body?.banExpiresIn);
              const parsed = v.safeParse(banAccountInputSchema, {
                accountId: accountId.output,
                reason: ctx.body?.banReason,
                duration,
              });
              if (!parsed.success) {
                throw APIError.from("BAD_REQUEST", SECURITY_ACTION_INVALID_INPUT);
              }

              const now = Date.now();
              const effectivelyBanned =
                target.banned === 1 && (target.ban_expires === null || target.ban_expires > now);
              if (effectivelyBanned) {
                const residue = await getTargetResidue(database, target.id);
                if (!hasCredentialResidue(residue)) {
                  throw APIError.from("CONFLICT", SECURITY_ACTION_INVALID_STATE);
                }
              }

              ctx.body.banReason = parsed.output.reason;
              securityContext.easyAuthSecurityOperation = {
                action: "ban",
                actor,
                target: targetSnapshot,
                reason: parsed.output.reason,
                duration: parsed.output.duration,
              };
              return;
            }

            if (target.banned !== 1) {
              throw APIError.from("CONFLICT", SECURITY_ACTION_INVALID_STATE);
            }
            const residue = await getTargetResidue(database, target.id);
            if (hasCredentialResidue(residue)) {
              throw APIError.from("CONFLICT", SECURITY_CLEANUP_INCOMPLETE);
            }
            securityContext.easyAuthSecurityOperation = {
              action: "unban",
              actor,
              target: targetSnapshot,
            };
          }),
        },
      ],
      after: [
        {
          matcher(ctx: { path?: string }) {
            return isAllowedDirectAdminPluginPath(ctx.path);
          },
          handler: createAuthMiddleware(async (ctx) => {
            const securityContext = ctx.context as typeof ctx.context & EasyAuthSecurityContext;
            const operation = securityContext.easyAuthSecurityOperation;
            if (!operation || !isSuccessfulEndpointResult(securityContext.returned)) return;

            if (operation.action === "ban") {
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
            }

            const activityId = crypto.randomUUID();
            try {
              let details = "{}";
              if (operation.action === "ban") {
                const state = await database
                  .prepare("SELECT ban_expires FROM user WHERE id = ?")
                  .bind(operation.target.id)
                  .first<BanStateRow>();
                details = JSON.stringify({
                  reason: operation.reason,
                  duration: operation.duration,
                  expiresAt: state?.ban_expires ?? null,
                });
              }
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
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .bind(
                  activityId,
                  operation.actor.id,
                  operation.actor.name,
                  operation.actor.email,
                  operation.target.id,
                  operation.target.name,
                  operation.target.email,
                  operation.action,
                  details,
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
