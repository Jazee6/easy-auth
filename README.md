# Easy Auth

Easy Auth is a development-stage, self-hosted authentication foundation for an identity domain on the Cloudflare stack. OIDC Provider protocols and production deployment are not yet available.

## Local development

Requirements: [Bun](https://bun.sh/) and [Wrangler](https://developers.cloudflare.com/workers/wrangler/).

```bash
bun install
bun run db:migrate:local
bun run dev
```

Database migrations are explicit. Application startup never changes the D1 schema. After an authentication schema change, run `bun run auth:generate`, `bun run db:generate`, and then apply the generated migration.

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

Resend and Turnstile configuration is required. Missing bindings do not disable verification: Turnstile fails closed and email delivery failures are caught and logged in the background without changing the public registration response.

Local automation must explicitly configure Cloudflare's official always-pass Turnstile test pair: site key `1x00000000000000000000AA` and secret key `1x0000000000000000000000000000000AA`. Manual development and production use environment-provided credentials. Never deploy the test keys. Automated tests inject a deterministic email sender and do not call Resend or production Turnstile.

## Commands

- `bun run test` — automated policy and service-seam tests
- `bun run typecheck` — TypeScript checking
- `bun run lint` — Oxlint
- `bun run fmt:check` — formatting check
- `bun run build` — production build
- `bun run db:migrate:local` — apply migrations to local D1
