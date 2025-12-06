# Easy Auth

English | [中文](./README.md)

## Deployment

### Environment Variables

| Name                           | Description                                 |
|--------------------------------|---------------------------------------------|
| BETTER_AUTH_SECRET             | Secret for encryption, signing, and hashing |
| BETTER_AUTH_URL                | Origin URL                                  |
| DATABASE_URL                   | Postgres connection string                  |
| GITHUB_CLIENT_ID               | GitHub OAuth client ID                      |
| GITHUB_CLIENT_SECRET           | GitHub OAuth client secret                  |
| TURNSTILE_SECRET_KEY           | Cloudflare Turnstile secret key             |
| NEXT_PUBLIC_TURNSTILE_SITE_KEY | Cloudflare Turnstile site key               |

### Promote an Admin

After registering an account, update the `role` column to `admin` in the corresponding row of the `user` table.
