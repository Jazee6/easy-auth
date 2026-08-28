# OAuth/OIDC operations (0.3.0)

Easy Auth 0.3.0 is a **development-stage** OAuth 2.1 Authorization Server and OpenID Connect issuer. It supports end-to-end development and integration testing; it does not provide production availability, monitoring, disaster recovery, deployment automation, or security certification.

## Protocol surface

For `BETTER_AUTH_URL=https://auth.example.com`:

- Issuer: `https://auth.example.com/api/auth`
- OIDC discovery: `https://auth.example.com/.well-known/openid-configuration` and the issuer-path endpoint
- OAuth metadata: `https://auth.example.com/.well-known/oauth-authorization-server`, `https://auth.example.com/.well-known/oauth-authorization-server/api/auth`, and the issuer-path endpoint
- JWKS: `https://auth.example.com/api/auth/jwks`
- Authorization: `https://auth.example.com/api/auth/oauth2/authorize`
- Token, UserInfo, introspection, and revocation live below `/api/auth/oauth2/`.

Supported scopes are `openid`, `profile`, `email`, and `offline_access`. Only Authorization Code and refresh-token grants are enabled. Every code flow requires S256 PKCE. Web confidential clients use `client_secret_basic`; Web public and Native public clients use no secret. Opaque credentials use the `ea_cs_`, `ea_at_`, and `ea_rt_` prefixes.

## Database lifecycle

Application startup never migrates D1. Apply committed migrations explicitly:

```bash
bun run db:migrate:local
bun run db:migrate
```

Schema generation is version-locked to Better Auth 1.7.2:

```bash
bun run auth:generate
bun run db:generate
```

The generated schema contains every Admin, JWT, and OAuth Provider model. Application-owned audit state is added after generation.

## Assign an Administrator

New accounts default to `user`. Administrator authority is operations-only and cannot be assigned through application APIs. After the account exists, update D1 directly:

```bash
wrangler d1 execute DB --remote \
  --command "UPDATE user SET role = 'admin' WHERE email = 'operator@example.com'"
```

Use `--local` for local D1. Confirm exactly one intended row before and after the update. Direct role changes are intentionally outside the application audit trail.

## Transfer OAuth client ownership

OAuth clients remain owned by their creating Administrator. Before demoting or deleting an owner, transfer each client directly in D1 to an existing Administrator:

```bash
wrangler d1 execute DB --remote \
  --command "UPDATE oauth_client SET user_id = 'NEW_ADMIN_USER_ID' WHERE client_id = 'CLIENT_ID' AND user_id = 'OLD_ADMIN_USER_ID'"
```

Verify the new owner has `role = 'admin'`, back up D1, update one client at a time, and confirm the new owner can open the client before changing the old owner. Direct ownership transfer is intentionally outside the application audit trail.

## Redirect and credential policy

Redirect URIs are exact and provider-validated. Web clients should use HTTPS. Native clients may use claimed HTTPS, safe loopback redirects, or authority-free reverse-domain private-use schemes according to provider validation. Credentials, fragments, wildcards, malformed URLs, routable HTTP, and normalized near matches are rejected.

Confidential secrets are shown once, stored one-way hashed, and never returned by list/detail pages. Rotation immediately invalidates the old secret; there is no dual-secret overlap or automatic expiration in 0.3.0.

## Reference client

Web clients require HTTPS redirects on non-loopback hostnames. Map the reserved development hostname locally, create a temporary certificate, and register a **Web public** client with the exact redirect URI `https://reference-client.test:4000/callback`:

```bash
grep -q 'reference-client.test' /etc/hosts || \
  echo '127.0.0.1 reference-client.test' | sudo tee -a /etc/hosts
mkdir -p /tmp/easy-auth-reference-client
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout /tmp/easy-auth-reference-client/key.pem \
  -out /tmp/easy-auth-reference-client/cert.pem \
  -days 7 -subj "/CN=reference-client.test" \
  -addext "subjectAltName=DNS:reference-client.test"

ISSUER=http://localhost:3000/api/auth \
CLIENT_ID=your_client_id \
REFERENCE_CLIENT_KEY=/tmp/easy-auth-reference-client/key.pem \
REFERENCE_CLIENT_CERT=/tmp/easy-auth-reference-client/cert.pem \
bun fixtures/reference-client/server.ts
```

Open `https://reference-client.test:4000`, inspect and accept the temporary certificate warning, then start the flow. The fixture validates state, uses S256 PKCE, exchanges the code, validates the ID token against JWKS, and exercises UserInfo, refresh, and revocation. It is qualification infrastructure and is not included by the production application entry point or deployment bundle.
