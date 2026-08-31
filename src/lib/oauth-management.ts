export interface OAuthClientAuditWrite {
  id: string;
  actorUserId: string;
  clientName: string;
  action: "update" | "disable" | "enable" | "delete";
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
  },
): Promise<void> {
  await database.batch([
    database
      .prepare(
        "UPDATE oauth_client SET name = ?, redirect_uris = ?, updated_at = ? WHERE client_id = ? AND user_id = ?",
      )
      .bind(
        mutation.name,
        JSON.stringify(mutation.redirectUris),
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
