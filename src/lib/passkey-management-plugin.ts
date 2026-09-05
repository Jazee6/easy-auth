import { APIError } from "@better-auth/core/error";
import { createAuthMiddleware } from "@better-auth/core/api";
import { getAuthoritativeSessionFromCtx } from "better-auth/api";

import { PASSKEY_SESSION_FRESH_AGE_MS } from "./passkey-policy";

interface PasskeyUserSecurityRow {
  id: string;
  banned: number | null;
  ban_expires: number | null;
  email_verified: number;
}

export function createPasskeyManagementPlugin(database: D1Database) {
  return {
    id: "easy-auth-passkey-management",
    hooks: {
      before: [
        {
          matcher(ctx: { path?: string }) {
            return (
              ctx.path === "/passkey/generate-register-options" ||
              ctx.path === "/passkey/verify-registration" ||
              ctx.path === "/passkey/delete-passkey" ||
              ctx.path === "/passkey/update-passkey" ||
              ctx.path === "/passkey/list-user-passkeys" ||
              ctx.path === "/unlink-account"
            );
          },
          handler: createAuthMiddleware(async (ctx) => {
            const method = ctx.request?.method ?? "GET";
            if (method === "POST") {
              const origin = ctx.headers?.get("origin");
              if (origin) {
                const isTrusted =
                  typeof ctx.context.isTrustedOrigin === "function"
                    ? ctx.context.isTrustedOrigin(origin)
                    : origin === ctx.context.baseURL;
                if (!isTrusted) {
                  throw APIError.from("FORBIDDEN", {
                    code: "INVALID_ORIGIN",
                    message: "Invalid origin",
                  });
                }
              }
            }

            const authSession = await getAuthoritativeSessionFromCtx(ctx);
            if (!authSession?.session || !authSession.user) {
              throw APIError.from("UNAUTHORIZED", {
                code: "SESSION_REQUIRED",
                message: "Authentication required",
              });
            }

            const now = Date.now();
            const userSecurity = await database
              .prepare("SELECT id, banned, ban_expires, email_verified FROM user WHERE id = ?")
              .bind(authSession.user.id)
              .first<PasskeyUserSecurityRow>();

            if (!userSecurity) {
              throw APIError.from("UNAUTHORIZED", {
                code: "USER_NOT_FOUND",
                message: "User not found",
              });
            }

            const isBanned =
              userSecurity.banned === 1 &&
              (userSecurity.ban_expires === null || userSecurity.ban_expires > now);
            if (isBanned) {
              throw APIError.from("FORBIDDEN", {
                code: "ACCOUNT_BANNED",
                message: "This account has been banned",
              });
            }

            const isRegistrationPath =
              ctx.path === "/passkey/generate-register-options" ||
              ctx.path === "/passkey/verify-registration";

            if (isRegistrationPath && userSecurity.email_verified !== 1) {
              throw APIError.from("FORBIDDEN", {
                code: "EMAIL_NOT_VERIFIED",
                message: "Please verify your email address to continue.",
              });
            }

            const sessionAge = now - new Date(authSession.session.createdAt).getTime();
            const isFreshSessionRequired =
              isRegistrationPath || ctx.path === "/passkey/delete-passkey";

            if (isFreshSessionRequired && sessionAge >= PASSKEY_SESSION_FRESH_AGE_MS) {
              throw APIError.from("FORBIDDEN", {
                code: "SESSION_NOT_FRESH",
                message: "Recent sign-in required. Please sign in again to continue.",
              });
            }

            if (isRegistrationPath) {
              const query = ctx.query as { name?: unknown } | undefined;
              const body = ctx.body as { name?: unknown } | undefined;
              const rawName = query?.name ?? body?.name;
              if (typeof rawName === "string" && rawName.trim().length > 64) {
                throw APIError.from("BAD_REQUEST", {
                  code: "INVALID_INPUT",
                  message: "Passkey name must be at most 64 characters",
                });
              }
            }

            if (ctx.path === "/passkey/delete-passkey") {
              const body = ctx.body as { id?: unknown };
              const targetId = typeof body?.id === "string" ? body.id.trim() : "";
              if (!targetId) {
                throw APIError.from("BAD_REQUEST", {
                  code: "INVALID_INPUT",
                  message: "Passkey ID is required",
                });
              }

              const deleteResult = await database
                .prepare(
                  `DELETE FROM passkey
                   WHERE id = ? AND user_id = ?
                     AND (
                       EXISTS (SELECT 1 FROM passkey WHERE user_id = ? AND id != ?)
                       OR EXISTS (SELECT 1 FROM account WHERE user_id = ? AND (password IS NOT NULL OR provider_id IN ('google', 'github')))
                     )`,
                )
                .bind(
                  targetId,
                  authSession.user.id,
                  authSession.user.id,
                  targetId,
                  authSession.user.id,
                )
                .run();

              const changes = deleteResult.meta.changes ?? 0;
              if (changes === 0) {
                const existing = await database
                  .prepare("SELECT id FROM passkey WHERE id = ? AND user_id = ?")
                  .bind(targetId, authSession.user.id)
                  .first();

                if (!existing) {
                  throw APIError.from("NOT_FOUND", {
                    code: "PASSKEY_NOT_FOUND",
                    message: "Passkey not found",
                  });
                }

                throw APIError.from("BAD_REQUEST", {
                  code: "CANNOT_DELETE_LAST_METHOD",
                  message: "You cannot remove your final sign-in method.",
                });
              }

              return ctx.json({ status: true });
            }

            if (ctx.path === "/unlink-account") {
              const body = ctx.body as { accountId?: unknown };
              const accountId = typeof body?.accountId === "string" ? body.accountId.trim() : "";
              if (!accountId) {
                throw APIError.from("BAD_REQUEST", {
                  code: "INVALID_INPUT",
                  message: "Account ID is required",
                });
              }

              const deleteResult = await database
                .prepare(
                  `DELETE FROM account
                   WHERE id = ? AND user_id = ? AND provider_id IN ('google', 'github')
                     AND (
                       EXISTS (
                         SELECT 1 FROM account
                         WHERE user_id = ? AND id != ?
                           AND (password IS NOT NULL OR provider_id IN ('google', 'github'))
                       )
                       OR EXISTS (SELECT 1 FROM passkey WHERE user_id = ?)
                     )`,
                )
                .bind(
                  accountId,
                  authSession.user.id,
                  authSession.user.id,
                  accountId,
                  authSession.user.id,
                )
                .run();

              const changes = deleteResult.meta.changes ?? 0;
              if (changes === 0) {
                const existing = await database
                  .prepare("SELECT id, provider_id FROM account WHERE id = ? AND user_id = ?")
                  .bind(accountId, authSession.user.id)
                  .first<{ id: string; provider_id: string }>();

                if (
                  !existing ||
                  (existing.provider_id !== "google" && existing.provider_id !== "github")
                ) {
                  throw APIError.from("BAD_REQUEST", {
                    code: "ACCOUNT_NOT_FOUND",
                    message: "Account not found",
                  });
                }

                throw APIError.from("BAD_REQUEST", {
                  code: "FAILED_TO_UNLINK_LAST_ACCOUNT",
                  message: "Add another sign-in method before unlinking your final sign-in method.",
                });
              }

              return ctx.json({ status: true });
            }

            if (ctx.path === "/passkey/update-passkey") {
              const body = ctx.body as { id?: unknown; name?: unknown };
              const id = typeof body?.id === "string" ? body.id.trim() : "";
              const name = typeof body?.name === "string" ? body.name.trim() : "";
              if (!id || !name) {
                throw APIError.from("BAD_REQUEST", {
                  code: "INVALID_INPUT",
                  message: "Passkey ID and name are required",
                });
              }

              if (name.length > 64) {
                throw APIError.from("BAD_REQUEST", {
                  code: "INVALID_INPUT",
                  message: "Passkey name must be at most 64 characters",
                });
              }

              // Let official updatePasskey endpoint execute with consistent validation and response
              return;
            }
          }),
        },
      ],
      after: [
        {
          matcher(ctx: { path?: string }) {
            return ctx.path === "/passkey/generate-authenticate-options";
          },
          handler: createAuthMiddleware(async (ctx) => {
            const returned = ctx.context.returned;
            if (returned instanceof Response) {
              if (returned.status < 200 || returned.status >= 300) {
                return;
              }
              try {
                const data = (await returned.clone().json()) as Record<string, unknown>;
                const modified = { ...data, userVerification: "required" };
                const headers = new Headers(returned.headers);
                headers.set("content-type", "application/json");
                return new Response(JSON.stringify(modified), {
                  status: returned.status,
                  statusText: returned.statusText,
                  headers,
                });
              } catch {
                return;
              }
            } else if (typeof returned === "object" && returned !== null) {
              if ("error" in returned && Boolean((returned as { error: unknown }).error)) {
                return;
              }
              return ctx.json({
                ...(returned as Record<string, unknown>),
                userVerification: "required",
              });
            }
          }),
        },
      ],
    },
  };
}
