# Constrain the product-facing Admin Plugin surface

Easy Auth only productizes identity-domain account browsing plus bans and session revocation for Standard Accounts from Better Auth's Admin Plugin. Administrator Accounts remain visible as basic read-only records, while their sessions and security actions stay operations-only. Account and session reads use administrator-protected Easy Auth projections, session tokens never reach the browser, and the direct Admin Plugin API is a strict mutation allowlist containing only ban, unban, and single/all-session revocation with a server-side Standard Account target guard; every other Admin Plugin endpoint is rejected. This keeps the product authority narrower than the plugin's default API while preserving the plugin's authorization and mutation semantics for the selected security actions.

## Consequences

Security activity is an immutable, permanent operational history written after successful plugin mutations, but it is not an authoritative atomic audit log: a mutation takes precedence and still reports success if the activity write fails, while the failure is recorded in server logs. OAuth client ownership and owner-scoped Management activity remain governed by ADR-0003 and are not broadened by the global account-management surface.
