# Easy Auth

Easy Auth is a development-stage, self-hosted authentication foundation and OAuth 2.1/OpenID Connect Authorization Server for an identity domain on the Cloudflare stack. End-to-end OAuth/OIDC is available for development and integration testing; production operational guarantees are not yet available.

## Runtime bindings

Configure local values in `.env.local`. Configure deployed secrets with Wrangler rather than committing them.

| Binding                   | Scope         | Purpose                                                                   |
| ------------------------- | ------------- | ------------------------------------------------------------------------- |
| `DB`                      | Server        | Cloudflare D1 database binding                                            |
| `BETTER_AUTH_URL`         | Server        | Public Easy Auth base URL                                                 |
| `BETTER_AUTH_SECRET`      | Server secret | Better Auth signing secret (at least 32 random characters)                |
| `RESEND_API_KEY`          | Server secret | Resend API credential                                                     |
| `EMAIL_FROM`              | Server        | Full verified sender identity, for example `Easy Auth <auth@example.com>` |
| `TURNSTILE_SECRET_KEY`    | Server secret | Cloudflare Turnstile server verification key                              |
| `VITE_TURNSTILE_SITE_KEY` | Browser       | Cloudflare Turnstile managed-widget site key                              |
| `GITHUB_CLIENT_ID`        | Server        | GitHub OAuth App client ID                                                |
| `GITHUB_CLIENT_SECRET`    | Server secret | GitHub OAuth App client secret                                            |
| `GOOGLE_CLIENT_ID`        | Server        | Google OAuth 2.0 Web application client ID                                |
| `GOOGLE_CLIENT_SECRET`    | Server secret | Google OAuth 2.0 Web application client secret                            |

Configure the Google OAuth client as a Web application and register
`<BETTER_AUTH_URL>/api/auth/callback/google` as an authorized redirect URI. External identities
must provide a verified email; matching an existing login email does not implicitly link accounts.
