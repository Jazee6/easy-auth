# Require explicit external identity linking

Better Auth can implicitly link an OAuth identity to an existing account when their verified emails match. Easy Auth disables that behavior: matching verified emails are necessary but not sufficient, and an external identity may be linked only when the account already has a session and explicitly starts the linking flow. This adds friction when an external identity's first login collides with an existing login email, but avoids silently changing account ownership and creating a login method without the account's authenticated intent.

## Consequences

A new GitHub or Google identity with an unused verified email may create a user through open registration. If its email already belongs to a user, external identity login is rejected and the user is directed to log in through an existing method before linking that identity from the account panel. Linked identities must use the same verified email as the account's login email.
