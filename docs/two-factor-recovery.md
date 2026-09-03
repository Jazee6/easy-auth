# Two-Factor Authentication recovery operations

Easy Auth Two-Factor Authentication Recovery is an operations-only procedure for an Account that has lost both its Authenticator App and every usable Backup Code. It is not an Account API, Admin API, email recovery path, or Administrator capability.

An authorized operator must complete out-of-band human identity verification before running the wizard. The wizard asks the operator to attest that verification is complete; it does not perform, automate, or validate identity proofing.

## Authority and effects

The wizard first locates an Account by login email, then binds every preview, mutation, and verification query to the selected immutable User ID. It removes only:

- the User's Two-Factor enabled flag and `two_factor` record;
- attributable pending Two-Factor challenge and attempt records;
- all Trusted Device records for the Account;
- every Easy Auth Session for the Account;
- stored OAuth refresh tokens and opaque access tokens for the Account.

It preserves the Account and role, local password, Linked Identities and their provider tokens, OAuth Clients, Application Authorizations, Management activity, and Security activity. The procedure does not write application Security activity; use the surrounding operational incident process for any required record.

Recovery can revoke only credentials represented in Easy Auth storage. Already delivered ID tokens, stateless artifacts, and relying-party local Sessions cannot be recalled and expire according to their own policies.

## Before running

1. Complete the organization's out-of-band human identity-verification process.
2. Stop if the Account cannot be identified unambiguously.
3. Run from the repository root with the version of the schema deployed to the selected D1 database.
4. Ensure Bun and the project-local Wrangler are available.
5. For remote recovery, authenticate Wrangler and confirm the intended Cloudflare account before proceeding.

The wizard has exactly six stages: Preflight, Locate Account, Impact Preview, Recovery Point, Final Confirmation and Execute, and Verify. Ctrl-C before execution leaves database state unchanged. Credential-sensitive temporary query and SQL files are removed when the wizard exits.

## Local recovery

Local D1 is the default:

```bash
scripts/recover-two-factor.sh
```

The wizard exports the complete local D1 database to `.scratch/recovery/` before mutation. The export is mode `0600` and contains credentials; store it as sensitive material and remove it under the operational retention policy when it is no longer required.

The printed local restore command imports the export into an **empty** local D1 state. Do not import a full export over populated tables. Preserve or move the current local Wrangler state first if investigation requires both versions.

## Remote recovery

Remote D1 must be selected explicitly:

```bash
scripts/recover-two-factor.sh --remote
```

Remote mode presents an additional destructive warning, verifies `wrangler whoami --json`, displays the available Cloudflare accounts, and requires the exact intended Cloudflare Account ID before setting `CLOUDFLARE_ACCOUNT_ID`. It then captures a D1 Time Travel bookmark before mutation. The wizard prints the exact bookmark restore command. Workers Free Tier retains Time Travel restore points for seven days; older bookmarks cannot be restored. See Cloudflare's [D1 Time Travel documentation](https://developers.cloudflare.com/d1/reference/time-travel/).

Never exercise destructive remote recovery against a shared database during routine qualification. Manual qualification should stop before mutation after checking authentication detection, bookmark capture, the printed restore command, and every confirmation gate.

## Confirmation and execution

Before mutation, review the count-only impact preview. It does not print TOTP secrets, Backup Codes, passwords, Session tokens, OAuth token values, challenge cookies, or Trusted Device identifiers.

Execution requires both:

1. the complete immutable User ID displayed by Locate Account; and
2. the exact phrase `RECOVER TWO-FACTOR ACCESS`.

The wizard then submits one constrained SQL file through `wrangler d1 execute`. A failed D1 file import returns the database to its original state and can be retried. Verification requires the Account to remain present and proves that Two-Factor Authentication is Disabled and every selected record count is zero.

A completed recovery is safely repeatable: subsequent execution remains scoped to the same newly resolved immutable User ID and zero selected records remain zero. Never reuse a prior User ID without locating the Account again.

## Handoff

Give the identity-verified Account this next step: sign in with an existing Sign-in Method, then enroll in Two-Factor Authentication again from Account Security. Do not send recovery exports, bookmarks, SQL, or credential values to the Account.
