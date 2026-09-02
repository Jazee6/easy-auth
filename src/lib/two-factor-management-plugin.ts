import { APIError } from "@better-auth/core/error";
import { createAuthMiddleware } from "@better-auth/core/api";
import { getAuthoritativeSessionFromCtx, isAPIError } from "better-auth/api";

import {
  TWO_FACTOR_ALREADY_ENABLED,
  TWO_FACTOR_NOT_ENABLED,
  TWO_FACTOR_SESSION_FRESH_AGE_MS,
  TWO_FACTOR_SESSION_NOT_FRESH,
} from "./two-factor-management";

const TWO_FACTOR_ENABLE_PATH = "/two-factor/enable";
const TWO_FACTOR_DISABLE_PATH = "/two-factor/disable";
const TWO_FACTOR_VERIFY_TOTP_PATH = "/two-factor/verify-totp";

interface TwoFactorStateRow {
  enabled: number;
  verified: number | null;
}

interface SessionStateRow {
  created_at: number;
}

interface TwoFactorCleanupOperation {
  action: "enable" | "disable";
  accountId: string;
}

interface EasyAuthTwoFactorContext {
  easyAuthTwoFactorOperation?: TwoFactorCleanupOperation;
  returned?: unknown;
  newSession?: {
    session: { id: string; userId: string };
    user: { id: string };
  } | null;
  logger: { error(message: string, context?: unknown): void };
}

export interface TwoFactorCleanupFailureEvent {
  code: "TWO_FACTOR_SESSION_CLEANUP_FAILED";
  operation: "enable" | "disable";
  accountId: string;
}

export interface TwoFactorManagementPluginOptions {
  onCleanupFailure?: (event: TwoFactorCleanupFailureEvent) => void;
}

function isManagementPath(path?: string): boolean {
  return (
    path === TWO_FACTOR_ENABLE_PATH ||
    path === TWO_FACTOR_DISABLE_PATH ||
    path === TWO_FACTOR_VERIFY_TOTP_PATH
  );
}

function isSuccessfulEndpointResult(result: unknown): boolean {
  if (result === undefined || result === null || isAPIError(result)) return false;
  return !(result instanceof Response) || (result.status >= 200 && result.status < 300);
}

async function readTwoFactorState(
  database: D1Database,
  accountId: string,
): Promise<TwoFactorStateRow | null> {
  return database
    .prepare(
      `SELECT
        coalesce(user.two_factor_enabled, 0) AS enabled,
        two_factor.verified
      FROM user
      LEFT JOIN two_factor ON two_factor.user_id = user.id
      WHERE user.id = ?`,
    )
    .bind(accountId)
    .first<TwoFactorStateRow>();
}

async function assertFreshSession(
  database: D1Database,
  accountId: string,
  sessionId: string,
): Promise<void> {
  const session = await database
    .prepare("SELECT created_at FROM session WHERE id = ? AND user_id = ? AND expires_at > ?")
    .bind(sessionId, accountId, Date.now())
    .first<SessionStateRow>();

  if (!session || Date.now() - session.created_at >= TWO_FACTOR_SESSION_FRESH_AGE_MS) {
    throw APIError.from("FORBIDDEN", TWO_FACTOR_SESSION_NOT_FRESH);
  }
}

function reportCleanupFailure(
  context: EasyAuthTwoFactorContext,
  options: TwoFactorManagementPluginOptions,
  operation: TwoFactorCleanupOperation,
): void {
  const event: TwoFactorCleanupFailureEvent = {
    code: "TWO_FACTOR_SESSION_CLEANUP_FAILED",
    operation: operation.action,
    accountId: operation.accountId,
  };

  try {
    if (options.onCleanupFailure) options.onCleanupFailure(event);
    else context.logger.error("Two-Factor Session cleanup failed", event);
  } catch {
    // Diagnostics must not change an already-authoritative Two-Factor mutation.
  }
}

async function responseWithCleanupWarning(ctx: {
  context: EasyAuthTwoFactorContext;
  json(value: unknown): unknown;
}): Promise<unknown> {
  const returned = ctx.context.returned;
  try {
    if (returned instanceof Response) {
      const payload = (await returned.clone().json()) as Record<string, unknown>;
      return ctx.json({ ...payload, sessionCleanupRequired: true });
    }
    if (typeof returned === "object" && returned !== null) {
      return ctx.json({
        ...(returned as Record<string, unknown>),
        sessionCleanupRequired: true,
      });
    }
  } catch {
    // The stable warning must survive an unexpected successful response shape.
  }
  return ctx.json({ status: true, sessionCleanupRequired: true });
}

export function createTwoFactorManagementPlugin(
  database: D1Database,
  options: TwoFactorManagementPluginOptions = {},
) {
  return {
    id: "easy-auth-two-factor-management",
    hooks: {
      before: [
        {
          matcher(ctx: { path?: string }) {
            return isManagementPath(ctx.path);
          },
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getAuthoritativeSessionFromCtx(ctx);
            if (!session) return;

            const state = await readTwoFactorState(database, session.user.id);
            if (!state) return;

            if (ctx.path === TWO_FACTOR_ENABLE_PATH) {
              if (state.enabled === 1) {
                throw APIError.from("CONFLICT", TWO_FACTOR_ALREADY_ENABLED);
              }
              return;
            }

            const context = ctx.context as typeof ctx.context & EasyAuthTwoFactorContext;
            if (ctx.path === TWO_FACTOR_DISABLE_PATH) {
              if (state.enabled !== 1) {
                throw APIError.from("CONFLICT", TWO_FACTOR_NOT_ENABLED);
              }
              await assertFreshSession(database, session.user.id, session.session.id);
              context.easyAuthTwoFactorOperation = {
                action: "disable",
                accountId: session.user.id,
              };
              return;
            }

            if (state.enabled !== 1 && state.verified === 0) {
              context.easyAuthTwoFactorOperation = {
                action: "enable",
                accountId: session.user.id,
              };
            }
          }),
        },
      ],
      after: [
        {
          matcher(ctx: { path?: string }) {
            return ctx.path === TWO_FACTOR_DISABLE_PATH || ctx.path === TWO_FACTOR_VERIFY_TOTP_PATH;
          },
          handler: createAuthMiddleware(async (ctx) => {
            const context = ctx.context as typeof ctx.context & EasyAuthTwoFactorContext;
            const operation = context.easyAuthTwoFactorOperation;
            if (!operation || !isSuccessfulEndpointResult(context.returned)) return;

            try {
              const state = await readTwoFactorState(database, operation.accountId);
              const transitionCompleted =
                operation.action === "enable" ? state?.enabled === 1 : state?.enabled === 0;
              if (!transitionCompleted) return;

              const current = context.newSession;
              if (!current || current.user.id !== operation.accountId) {
                throw new Error("Authoritative Session rotation was not observed");
              }

              await database
                .prepare("DELETE FROM session WHERE user_id = ? AND id <> ?")
                .bind(operation.accountId, current.session.id)
                .run();
              const residue = await database
                .prepare("SELECT count(*) AS count FROM session WHERE user_id = ? AND id <> ?")
                .bind(operation.accountId, current.session.id)
                .first<number>("count");
              if ((residue ?? 0) !== 0) {
                throw new Error("Other Sessions remain after cleanup");
              }
            } catch {
              reportCleanupFailure(context, options, operation);
              return responseWithCleanupWarning(ctx);
            }
          }),
        },
      ],
    },
  };
}
