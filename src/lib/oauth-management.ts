export interface OAuthClientAuditWrite {
  id: string;
  actorUserId: string;
  clientName: string;
  action: "update" | "disable" | "enable" | "rotate-secret" | "delete";
  summary: string;
  createdAt: number;
}

interface OwnedOAuthClientMutation {
  clientId: string;
  ownerUserId: string;
  audit: OAuthClientAuditWrite;
}

function auditStatement(
  database: D1Database,
  mutation: OwnedOAuthClientMutation,
): D1PreparedStatement {
  return database
    .prepare(
      "INSERT INTO oauth_client_audit (id, actor_user_id, owner_user_id, client_id, client_name, action, summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      mutation.audit.id,
      mutation.audit.actorUserId,
      mutation.ownerUserId,
      mutation.clientId,
      mutation.audit.clientName,
      mutation.audit.action,
      mutation.audit.summary,
      mutation.audit.createdAt,
    );
}

export async function updateOAuthClientAtomically(
  database: D1Database,
  mutation: OwnedOAuthClientMutation & {
    name: string;
    redirectUris: string[];
    postLogoutRedirectUris: string[];
  },
): Promise<void> {
  await database.batch([
    database
      .prepare(
        "UPDATE oauth_client SET name = ?, redirect_uris = ?, post_logout_redirect_uris = ?, updated_at = ? WHERE client_id = ? AND user_id = ?",
      )
      .bind(
        mutation.name,
        JSON.stringify(mutation.redirectUris),
        mutation.postLogoutRedirectUris.length > 0
          ? JSON.stringify(mutation.postLogoutRedirectUris)
          : null,
        mutation.audit.createdAt,
        mutation.clientId,
        mutation.ownerUserId,
      ),
    auditStatement(database, mutation),
  ]);
}

export async function setOAuthClientDisabledAtomically(
  database: D1Database,
  mutation: OwnedOAuthClientMutation & { disabled: boolean },
): Promise<void> {
  await database.batch([
    database
      .prepare(
        "UPDATE oauth_client SET disabled = ?, updated_at = ? WHERE client_id = ? AND user_id = ?",
      )
      .bind(
        mutation.disabled ? 1 : 0,
        mutation.audit.createdAt,
        mutation.clientId,
        mutation.ownerUserId,
      ),
    auditStatement(database, mutation),
  ]);
}

export const OAUTH_CLIENT_SECRET_PREFIX = "ea_cs_";

/**
 * Mirrors the oauth-provider `storeClientSecret: "hashed"` format: an unpadded
 * base64url SHA-256 digest of the secret without its prefix.
 */
async function hashOAuthClientSecret(rawSecret: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawSecret)),
  );
  return btoa(String.fromCharCode(...digest))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function rotateOAuthClientSecretAtomically(
  database: D1Database,
  mutation: OwnedOAuthClientMutation,
): Promise<string> {
  const random = crypto.getRandomValues(new Uint8Array(32));
  const rawSecret = Array.from(random, (value) => value.toString(16).padStart(2, "0")).join("");
  await database.batch([
    database
      .prepare(
        "UPDATE oauth_client SET client_secret = ?, updated_at = ? WHERE client_id = ? AND user_id = ?",
      )
      .bind(
        await hashOAuthClientSecret(rawSecret),
        mutation.audit.createdAt,
        mutation.clientId,
        mutation.ownerUserId,
      ),
    auditStatement(database, mutation),
  ]);
  return `${OAUTH_CLIENT_SECRET_PREFIX}${rawSecret}`;
}

export async function deleteOAuthClientAtomically(
  database: D1Database,
  mutation: OwnedOAuthClientMutation,
): Promise<void> {
  await database.batch([
    auditStatement(database, mutation),
    database
      .prepare(
        "DELETE FROM verification WHERE json_valid(value) AND json_extract(value, '$.type') = 'authorization_code' AND json_extract(value, '$.query.client_id') = ?",
      )
      .bind(mutation.clientId),
    database.prepare("DELETE FROM oauth_access_token WHERE client_id = ?").bind(mutation.clientId),
    database.prepare("DELETE FROM oauth_refresh_token WHERE client_id = ?").bind(mutation.clientId),
    database.prepare("DELETE FROM oauth_consent WHERE client_id = ?").bind(mutation.clientId),
    database
      .prepare("DELETE FROM oauth_client_resource WHERE client_id = ?")
      .bind(mutation.clientId),
    database
      .prepare("DELETE FROM oauth_client WHERE client_id = ? AND user_id = ?")
      .bind(mutation.clientId, mutation.ownerUserId),
  ]);
}

export async function revokeApplicationAuthorizationAtomically(
  database: D1Database,
  input: { accountId: string; clientId: string },
): Promise<void> {
  await database.batch([
    database
      .prepare(
        "DELETE FROM verification WHERE json_valid(value) AND json_extract(value, '$.type') = 'authorization_code' AND json_extract(value, '$.userId') = ? AND json_extract(value, '$.query.client_id') = ?",
      )
      .bind(input.accountId, input.clientId),
    database
      .prepare("DELETE FROM oauth_access_token WHERE user_id = ? AND client_id = ?")
      .bind(input.accountId, input.clientId),
    database
      .prepare("DELETE FROM oauth_refresh_token WHERE user_id = ? AND client_id = ?")
      .bind(input.accountId, input.clientId),
    database
      .prepare("DELETE FROM oauth_consent WHERE user_id = ? AND client_id = ?")
      .bind(input.accountId, input.clientId),
  ]);
}
