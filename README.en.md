# Easy Auth

[中文](./README.md) ｜ English

<img width="3588" height="1865" alt="Easy Auth interface preview" src="https://github.com/user-attachments/assets/40277e51-b2f9-4483-9288-b6a78c1e13b8" />

Easy Auth is a self-hosted unified identity entry point and OAuth 2.1 / OpenID Connect Authorization Server for Cloudflare.

Live Demo: <https://account.jaze.top>

## Features

- Open registration, login email verification, password reset, and Account Profile management
- Local password, GitHub, Google, and Passkey Sign-in Methods
- Explicit Linked Identity management without implicit account merging by matching email
- TOTP-based Two-Factor Authentication, Backup Codes, Trusted Devices, and an operations recovery procedure
- Account Session inspection, single-Session revocation, and all-Session revocation
- OAuth 2.1 / OpenID Connect Authorization Code flow, PKCE, refresh tokens, and authorization revocation
- Public and Confidential OAuth Clients with Web and Native Redirect URI management
- Administrator interfaces for Accounts, OAuth Clients, Management activity, and Security activity
- Cloudflare Turnstile, D1-backed rate limiting, and a deployment model designed for Cloudflare Free Tier

## Stack

- TanStack Start, React, TanStack Router, and TanStack Query
- Better Auth, OAuth Provider, and Passkey
- Cloudflare Workers, D1, and Turnstile
- Drizzle ORM, Tailwind CSS, and shadcn/ui
- Resend, Bun, and TypeScript

## External identity providers

Register these callback URLs with their respective providers:

- GitHub: `<BETTER_AUTH_URL>/api/auth/callback/github`
- Google: `<BETTER_AUTH_URL>/api/auth/callback/google`

## Runtime bindings

| Binding                   | Scope         | Purpose                                                                   |
| ------------------------- | ------------- | ------------------------------------------------------------------------- |
| `DB`                      | Server        | Cloudflare D1 database binding                                            |
| `BETTER_AUTH_URL`         | Server        | Public Easy Auth base URL                                                 |
| `BETTER_AUTH_SECRET`      | Server secret | Better Auth signing secret with at least 32 random characters             |
| `RESEND_API_KEY`          | Server secret | Resend API credential                                                     |
| `EMAIL_FROM`              | Server        | Full verified sender identity, for example `Easy Auth <auth@example.com>` |
| `TURNSTILE_SECRET_KEY`    | Server secret | Cloudflare Turnstile server verification key                              |
| `VITE_TURNSTILE_SITE_KEY` | Browser build | Cloudflare Turnstile Managed Widget site key                              |
| `GITHUB_CLIENT_ID`        | Server        | GitHub OAuth App client ID                                                |
| `GITHUB_CLIENT_SECRET`    | Server secret | GitHub OAuth App client secret                                            |
| `GOOGLE_CLIENT_ID`        | Server        | Google OAuth 2.0 Web application client ID                                |
| `GOOGLE_CLIENT_SECRET`    | Server secret | Google OAuth 2.0 Web application client secret                            |

## Bootstrap an Administrator

First create an Account through normal registration and email verification. An operator with D1 access must then set that Account's `user.role` to `admin`. For example, in a local environment:

```bash
bunx wrangler d1 execute DB --local --command "UPDATE user SET role = 'admin' WHERE email = 'admin@example.com'"
```

## Security and operations

- Choose a stable `BETTER_AUTH_URL` before registering the first Passkey. Passkeys bind to that URL's hostname and origin; existing Passkeys stop working after a domain change.
- Review and adapt the Privacy Policy and Terms of Service pages for the actual operator before deployment.
- Two-Factor Authentication Recovery is restricted to authorized operators; see [`docs/two-factor-recovery.md`](./docs/two-factor-recovery.md).

## Sponsor

[Click Me](https://jaze.top/sponsor)
