# Keep OAuth clients owned by their creating administrator

An OAuth client remains bound to the administrator who created it, following Better Auth's default User ID ownership checks, rather than becoming shared across all administrators. This avoids a custom shared-owner authorization model, but means another administrator cannot manage the client; operations must reassign `oauthClient.userId` directly in D1 before removing the owner's administrator role or account.
