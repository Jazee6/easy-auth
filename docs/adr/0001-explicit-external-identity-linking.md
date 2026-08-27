# Require explicit external identity linking

Better Auth can implicitly link an OAuth identity to an existing user when their verified emails match. Easy Auth disables that behavior: matching verified emails are necessary but not sufficient, and an external identity may be linked only when the user already has a session and explicitly starts the linking flow. This adds friction when GitHub first login collides with an existing login email, but avoids silently changing user ownership and creating a login method without the user's authenticated intent.

## Consequences

A new GitHub identity with an unused verified email may create a user through open registration. If its email already belongs to a user, GitHub login is rejected and the user is directed to log in through an existing method before linking GitHub from the user panel. Linked identities must use the same verified email as the user's login email.
