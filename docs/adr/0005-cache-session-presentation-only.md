# Limit cached Sessions to presentation

Easy Auth may use Better Auth's five-minute Session Cookie Cache for route-shell presentation and navigation, but every protected data request, authorization decision, and operation must validate the Session against the authoritative store. This deliberately permits a revoked account to see a stale page shell while preserving the identity domain rule that bans and revocations remove authorization immediately; the cache must never become an authorization source.

## Exception: OAuth authorization endpoints

`@better-auth/oauth-provider` reads the Session for `/oauth2/authorize` and `/oauth2/consent` through the Cookie Cache, and Easy Auth does not override that. For up to five minutes after a ban or Session revocation, a browser holding the old cookie can still be redirected back to a trusted application with a new authorization code. This is accepted because the code-review check of 2026-11-11 showed such a code cannot be redeemed: exchanging it at the token endpoint returned 400, codes issued before the ban could not be redeemed either, and no ID token, access token or refresh token remained for the banned Account. The application only receives an authorization code that fails at the token exchange. Re-verify this after upgrading `@better-auth/oauth-provider`.
