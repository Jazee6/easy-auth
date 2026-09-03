# Limit cached Sessions to presentation

Easy Auth may use Better Auth's five-minute Session Cookie Cache for route-shell presentation and navigation, but every protected data request, authorization decision, and operation must validate the Session against the authoritative store. This deliberately permits a revoked account to see a stale page shell while preserving the identity domain rule that bans and revocations remove authorization immediately; the cache must never become an authorization source.
