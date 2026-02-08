# Easy Auth

[中文](./README.md) ｜ English

![banner](https://github.com/user-attachments/assets/857cc611-7ad4-4364-b4a4-32c70ce3ccca)

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

### Database

Postgres is used as the default database. Ensure that the `DATABASE_URL` environment variable correctly points to your
database.

Run `bun run push` to perform database migrations.

### Promote an Admin

After registering an account, update the `role` column to `admin` in the corresponding row of the `user` table.

### More Guides

Please refer to: [Easy Auth User Guide](https://jaze.top/posts/easy-auth)
