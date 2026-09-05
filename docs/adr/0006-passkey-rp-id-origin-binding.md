# Derive Passkey Relying Party ID and Origin from configured URL

WebAuthn credentials (Passkeys) cryptographically bind to a Relying Party Identifier (RP ID) and a ceremony Origin. Easy Auth derives both the RP ID and the allowed Origin strictly from the configured `BETTER_AUTH_URL` environment variable: the RP ID is the configured hostname (or `localhost` in local development), and the Origin is the configured URL origin with `rpName` set statically to `Easy Auth`. Easy Auth explicitly rejects trusting incoming request `Host` or `Origin` headers to determine the RP identity.

## Consequences

Development, preview, and production environments remain strictly isolated because each environment runs on a distinct hostname and cannot share or spoof Passkey credentials. If an Easy Auth deployment migrates to a different domain name or origin in the future, existing Passkeys previously registered under the old RP ID will no longer be offered or recognized by client authenticators; users must re-authenticate using an alternative method (such as local password recovery or linked GitHub) to register a new Passkey under the updated domain.
