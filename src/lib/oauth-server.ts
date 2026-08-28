import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, desc, eq } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { oauthClient, oauthClientAudit, oauthConsent } from "@/db/schema";
import { auth } from "./auth";
import {
  deleteOAuthClientAtomically,
  setOAuthClientDisabledAtomically,
  updateOAuthClientAtomically,
} from "./oauth-management";
import {
  clientRegistrationSchema,
  clientUpdateSchema,
  hasAdministratorRole,
  oauthClientCreatePayload,
  parseRedirectUris,
  redactAuditSummary,
  validateOAuthRedirectUris,
} from "./oauth-policy";

const clientIdSchema = v.object({
  clientId: v.pipe(v.string(), v.trim(), v.nonEmpty("Client ID is required")),
});

const enabledSchema = v.object({
  clientId: clientIdSchema.entries.clientId,
  disabled: v.boolean(),
});

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function requireSession() {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
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
      disabled: oauthClient.disabled,
      createdAt: oauthClient.createdAt,
      updatedAt: oauthClient.updatedAt,
    })
    .from(oauthClient)
    .where(eq(oauthClient.userId, session.user.id))
    .orderBy(desc(oauthClient.createdAt), desc(oauthClient.clientId));
  return clients.map((client) => ({
    ...client,
    redirectUris: stringArray(client.redirectUris),
  }));
});

export const getOAuthClientDetail = createServerFn({ method: "GET" })
  .validator((input: unknown) => v.parse(clientIdSchema, input))
  .handler(async ({ data }) => {
    const { session } = await requireAdministrator();
    const client = await findOwnedClient(data.clientId, session.user.id);
    const activity = await db
      .select()
      .from(oauthClientAudit)
      .where(
        and(
          eq(oauthClientAudit.ownerUserId, session.user.id),
          eq(oauthClientAudit.clientId, data.clientId),
        ),
      )
      .orderBy(desc(oauthClientAudit.createdAt), desc(oauthClientAudit.id));

    return {
      client: {
        clientId: client.clientId,
        ownerUserId: client.userId,
        name: client.name,
        applicationType: client.applicationType,
        tokenEndpointAuthMethod: client.tokenEndpointAuthMethod,
        redirectUris: stringArray(client.redirectUris),
        disabled: client.disabled,
        requirePKCE: client.requirePKCE,
        grantTypes: stringArray(client.grantTypes),
        responseTypes: stringArray(client.responseTypes),
        scopes: stringArray(client.scopes),
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
      },
      activity,
    };
  });

export const createOAuthClient = createServerFn({ method: "POST" })
  .validator((input: unknown) => v.parse(clientRegistrationSchema, input))
  .handler(async ({ data }) => {
    const { headers, session } = await requireAdministrator();
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
    if (existing.tokenEndpointAuthMethod !== "none" && data.applicationType === "native") {
      throw new Error("Native applications must be public clients");
    }
    const redirectUris = parseRedirectUris(data.redirectUris);
    const redirectError = validateOAuthRedirectUris(redirectUris, data.applicationType);
    if (redirectError) throw new Error(redirectError);
    const changed = [
      existing.name !== data.name.trim() ? "name" : null,
      existing.applicationType !== data.applicationType ? "applicationType" : null,
      JSON.stringify(existing.redirectUris) !== JSON.stringify(redirectUris)
        ? "redirectUris"
        : null,
    ].filter((value): value is string => Boolean(value));
    const now = Date.now();

    await updateOAuthClientAtomically(db.$client, {
      clientId: data.clientId,
      ownerUserId: session.user.id,
      name: data.name.trim(),
      applicationType: data.applicationType,
      redirectUris,
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

    const random = crypto.getRandomValues(new Uint8Array(32));
    const rawSecret = Array.from(random, (value) => value.toString(16).padStart(2, "0")).join("");
    const digest = new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawSecret)),
    );
    const storedSecret = btoa(String.fromCharCode(...digest))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const database = db.$client;
    await database.batch([
      database
        .prepare(
          "UPDATE oauth_client SET client_secret = ?, updated_at = ? WHERE client_id = ? AND user_id = ?",
        )
        .bind(storedSecret, Date.now(), data.clientId, session.user.id),
      database
        .prepare(
          "INSERT INTO oauth_client_audit (id, actor_user_id, owner_user_id, client_id, client_name, action, summary, created_at) VALUES (?, ?, ?, ?, ?, 'rotate-secret', ?, ?)",
        )
        .bind(
          crypto.randomUUID(),
          session.user.id,
          session.user.id,
          data.clientId,
          existing.name ?? data.clientId,
          redactAuditSummary({ changed: ["clientSecret"] }),
          Date.now(),
        ),
    ]);
    return { clientId: data.clientId, clientSecret: `ea_cs_${rawSecret}` };
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
    .select()
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
    scopes: stringArray(authorization.scopes),
  }));
});

export const revokeApplicationAuthorization = createServerFn({ method: "POST" })
  .validator((input: unknown) => v.parse(clientIdSchema, input))
  .handler(async ({ data }) => {
    const { session } = await requireSession();
    const database = db.$client;
    await database.batch([
      database
        .prepare("DELETE FROM oauth_access_token WHERE user_id = ? AND client_id = ?")
        .bind(session.user.id, data.clientId),
      database
        .prepare("DELETE FROM oauth_refresh_token WHERE user_id = ? AND client_id = ?")
        .bind(session.user.id, data.clientId),
      database
        .prepare("DELETE FROM oauth_consent WHERE user_id = ? AND client_id = ?")
        .bind(session.user.id, data.clientId),
    ]);
    return { revoked: true };
  });
