import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, desc, eq } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { oauthClient, oauthClientAudit, oauthConsent } from "@/db/schema";
import { auth } from "./auth";
import { getAuthoritativeSession } from "./authoritative-session";
import {
  deleteOAuthClientAtomically,
  revokeApplicationAuthorizationAtomically,
  rotateOAuthClientSecretAtomically,
  setOAuthClientDisabledAtomically,
  updateOAuthClientAtomically,
} from "./oauth-management";
import {
  clientRegistrationSchema,
  clientUpdateSchema,
  hasAdministratorRole,
  normalizeOAuthRedirectUris,
  oauthClientCreatePayload,
  parseStoredStringArray,
  redactAuditSummary,
  validateOAuthPostLogoutRedirectUris,
  validateOAuthRedirectUris,
} from "./oauth-policy";

const clientIdSchema = v.object({
  clientId: v.pipe(v.string(), v.trim(), v.nonEmpty("Client ID is required")),
});

const enabledSchema = v.object({
  clientId: clientIdSchema.entries.clientId,
  disabled: v.boolean(),
});

async function requireSession() {
  const headers = getRequestHeaders();
  const session = await getAuthoritativeSession(auth.api, headers);
  if (!session) throw new Error("Authentication required");
  return { headers, session };
}

async function requireAdministrator() {
  const context = await requireSession();
  if (!hasAdministratorRole(context.session.user.role)) {
    throw new Error("Administrator access required");
  }
  return context;
}

async function findOwnedClient(clientId: string, ownerUserId: string) {
  const [client] = await db
    .select()
    .from(oauthClient)
    .where(and(eq(oauthClient.clientId, clientId), eq(oauthClient.userId, ownerUserId)))
    .limit(1);
  if (!client) throw new Error("OAuth client not found");
  return client;
}

async function appendAudit(input: {
  actorUserId: string;
  ownerUserId: string;
  clientId: string;
  clientName: string;
  action: "create" | "update" | "disable" | "enable" | "rotate-secret" | "delete";
  summary: Record<string, unknown>;
}) {
  await db.insert(oauthClientAudit).values({
    id: crypto.randomUUID(),
    actorUserId: input.actorUserId,
    ownerUserId: input.ownerUserId,
    clientId: input.clientId,
    clientName: input.clientName,
    action: input.action,
    summary: redactAuditSummary(input.summary),
  });
}

export const listOAuthClients = createServerFn({ method: "GET" }).handler(async () => {
  const { session } = await requireAdministrator();
  const clients = await db
    .select({
      clientId: oauthClient.clientId,
      name: oauthClient.name,
      applicationType: oauthClient.applicationType,
      tokenEndpointAuthMethod: oauthClient.tokenEndpointAuthMethod,
      redirectUris: oauthClient.redirectUris,
      postLogoutRedirectUris: oauthClient.postLogoutRedirectUris,
      disabled: oauthClient.disabled,
      createdAt: oauthClient.createdAt,
      updatedAt: oauthClient.updatedAt,
    })
    .from(oauthClient)
    .where(eq(oauthClient.userId, session.user.id))
    .orderBy(desc(oauthClient.createdAt), desc(oauthClient.clientId));
  return clients.map((client) => ({
    ...client,
    redirectUris: parseStoredStringArray(client.redirectUris),
    postLogoutRedirectUris: parseStoredStringArray(client.postLogoutRedirectUris),
  }));
});

export const getOAuthClientActivity = createServerFn({ method: "GET" })
  .validator((input: unknown) => v.parse(clientIdSchema, input))
  .handler(async ({ data }) => {
    const { session } = await requireAdministrator();
    await findOwnedClient(data.clientId, session.user.id);
    return db
      .select({
        id: oauthClientAudit.id,
        clientId: oauthClientAudit.clientId,
        clientName: oauthClientAudit.clientName,
        action: oauthClientAudit.action,
        summary: oauthClientAudit.summary,
        createdAt: oauthClientAudit.createdAt,
      })
      .from(oauthClientAudit)
      .where(
        and(
          eq(oauthClientAudit.ownerUserId, session.user.id),
          eq(oauthClientAudit.clientId, data.clientId),
        ),
      )
      .orderBy(desc(oauthClientAudit.createdAt), desc(oauthClientAudit.id));
  });

export const createOAuthClient = createServerFn({ method: "POST" })
  .validator((input: unknown) => v.parse(clientRegistrationSchema, input))
  .handler(async ({ data }) => {
    const { headers, session } = await requireAdministrator();
    const redirectError =
      validateOAuthRedirectUris(data.redirectUris, data.applicationType) ??
      validateOAuthPostLogoutRedirectUris(
        normalizeOAuthRedirectUris(data.postLogoutRedirectUris),
        data.applicationType,
      );
    if (redirectError) throw new Error(redirectError);

    const payload = oauthClientCreatePayload(data);
    const created = await auth.api.adminCreateOAuthClient({
      headers,
      body: {
        ...payload,
        grant_types: [...payload.grant_types],
        response_types: [...payload.response_types],
      },
    });

    try {
      await appendAudit({
        actorUserId: session.user.id,
        ownerUserId: session.user.id,
        clientId: created.client_id,
        clientName: created.client_name ?? data.name.trim(),
        action: "create",
        summary: {
          applicationType: data.applicationType,
          authentication: data.authentication,
          redirectUris: payload.redirect_uris,
          postLogoutRedirectUris: payload.post_logout_redirect_uris ?? [],
        },
      });
    } catch (error) {
      await db.delete(oauthClient).where(eq(oauthClient.clientId, created.client_id));
      throw error;
    }

    return {
      clientId: created.client_id,
      clientSecret: created.client_secret,
      name: created.client_name ?? data.name.trim(),
    };
  });

export const updateOAuthClient = createServerFn({ method: "POST" })
  .validator((input: unknown) => v.parse(clientUpdateSchema, input))
  .handler(async ({ data }) => {
    const { session } = await requireAdministrator();
    const existing = await findOwnedClient(data.clientId, session.user.id);
    const existingApplicationType = existing.applicationType === "native" ? "native" : "web";
    const existingAuthentication =
      existing.tokenEndpointAuthMethod === "none" ? "public" : "confidential";
    if (existingApplicationType !== data.applicationType) {
      throw new Error("Application type cannot be changed after registration");
    }
    if (existingAuthentication !== data.authentication) {
      throw new Error("Authentication capability cannot be changed after registration");
    }
    const redirectUris = normalizeOAuthRedirectUris(data.redirectUris);
    const postLogoutRedirectUris = normalizeOAuthRedirectUris(data.postLogoutRedirectUris);
    const redirectError =
      validateOAuthRedirectUris(redirectUris, existingApplicationType) ??
      validateOAuthPostLogoutRedirectUris(postLogoutRedirectUris, existingApplicationType);
    if (redirectError) throw new Error(redirectError);
    const existingRedirectUris = parseStoredStringArray(existing.redirectUris);
    const existingPostLogoutRedirectUris = parseStoredStringArray(existing.postLogoutRedirectUris);
    const changed = [
      existing.name !== data.name.trim() ? "name" : null,
      JSON.stringify(existingRedirectUris) !== JSON.stringify(redirectUris) ? "redirectUris" : null,
      JSON.stringify(existingPostLogoutRedirectUris) !== JSON.stringify(postLogoutRedirectUris)
        ? "postLogoutRedirectUris"
        : null,
    ].filter((value): value is string => Boolean(value));
    if (changed.length === 0) return { updated: false };

    const now = Date.now();
    await updateOAuthClientAtomically(db.$client, {
      clientId: data.clientId,
      ownerUserId: session.user.id,
      name: data.name.trim(),
      redirectUris,
      postLogoutRedirectUris,
      audit: {
        id: crypto.randomUUID(),
        actorUserId: session.user.id,
        clientName: data.name.trim(),
        action: "update",
        summary: redactAuditSummary({ changed }),
        createdAt: now,
      },
    });
    return { updated: true };
  });

export const setOAuthClientDisabled = createServerFn({ method: "POST" })
  .validator((input: unknown) => v.parse(enabledSchema, input))
  .handler(async ({ data }) => {
    const { session } = await requireAdministrator();
    const existing = await findOwnedClient(data.clientId, session.user.id);
    const now = Date.now();
    await setOAuthClientDisabledAtomically(db.$client, {
      clientId: data.clientId,
      ownerUserId: session.user.id,
      disabled: data.disabled,
      audit: {
        id: crypto.randomUUID(),
        actorUserId: session.user.id,
        clientName: existing.name ?? data.clientId,
        action: data.disabled ? "disable" : "enable",
        summary: redactAuditSummary({ disabled: data.disabled }),
        createdAt: now,
      },
    });
    return { disabled: data.disabled };
  });

export const rotateOAuthClientSecret = createServerFn({ method: "POST" })
  .validator((input: unknown) => v.parse(clientIdSchema, input))
  .handler(async ({ data }) => {
    const { session } = await requireAdministrator();
    const existing = await findOwnedClient(data.clientId, session.user.id);
    if (existing.tokenEndpointAuthMethod === "none") {
      throw new Error("Public clients do not have a client secret");
    }

    const clientSecret = await rotateOAuthClientSecretAtomically(db.$client, {
      clientId: data.clientId,
      ownerUserId: session.user.id,
      audit: {
        id: crypto.randomUUID(),
        actorUserId: session.user.id,
        clientName: existing.name ?? data.clientId,
        action: "rotate-secret",
        summary: redactAuditSummary({ changed: ["clientSecret"] }),
        createdAt: Date.now(),
      },
    });
    return { clientId: data.clientId, clientSecret };
  });

export const deleteOAuthClient = createServerFn({ method: "POST" })
  .validator((input: unknown) => v.parse(clientIdSchema, input))
  .handler(async ({ data }) => {
    const { session } = await requireAdministrator();
    const existing = await findOwnedClient(data.clientId, session.user.id);
    await deleteOAuthClientAtomically(db.$client, {
      clientId: data.clientId,
      ownerUserId: session.user.id,
      audit: {
        id: crypto.randomUUID(),
        actorUserId: session.user.id,
        clientName: existing.name ?? data.clientId,
        action: "delete",
        summary: redactAuditSummary({ deleted: true }),
        createdAt: Date.now(),
      },
    });
    return { deleted: true };
  });

export const listManagementActivity = createServerFn({ method: "GET" }).handler(async () => {
  const { session } = await requireAdministrator();
  return db
    .select({
      id: oauthClientAudit.id,
      clientId: oauthClientAudit.clientId,
      clientName: oauthClientAudit.clientName,
      action: oauthClientAudit.action,
      summary: oauthClientAudit.summary,
      createdAt: oauthClientAudit.createdAt,
    })
    .from(oauthClientAudit)
    .where(eq(oauthClientAudit.ownerUserId, session.user.id))
    .orderBy(desc(oauthClientAudit.createdAt), desc(oauthClientAudit.id));
});

export const getConsentClient = createServerFn({ method: "GET" })
  .validator((input: unknown) => v.parse(clientIdSchema, input))
  .handler(async ({ data }) => {
    const { headers } = await requireSession();
    const client = await auth.api.getOAuthClientPublic({
      headers,
      query: { client_id: data.clientId },
    });
    return { clientId: client.client_id, name: client.client_name ?? "Trusted application" };
  });

export const listApplicationAuthorizations = createServerFn({ method: "GET" }).handler(async () => {
  const { session } = await requireSession();
  const authorizations = await db
    .select({
      consentId: oauthConsent.id,
      clientId: oauthConsent.clientId,
      clientName: oauthClient.name,
      scopes: oauthConsent.scopes,
      authorizedAt: oauthConsent.createdAt,
    })
    .from(oauthConsent)
    .leftJoin(oauthClient, eq(oauthConsent.clientId, oauthClient.clientId))
    .where(eq(oauthConsent.userId, session.user.id))
    .orderBy(desc(oauthConsent.createdAt), desc(oauthConsent.id));
  return authorizations.map((authorization) => ({
    ...authorization,
    scopes: parseStoredStringArray(authorization.scopes),
  }));
});

export const revokeApplicationAuthorization = createServerFn({ method: "POST" })
  .validator((input: unknown) => v.parse(clientIdSchema, input))
  .handler(async ({ data }) => {
    const { session } = await requireSession();
    await revokeApplicationAuthorizationAtomically(db.$client, {
      accountId: session.user.id,
      clientId: data.clientId,
    });
    return { revoked: true };
  });
