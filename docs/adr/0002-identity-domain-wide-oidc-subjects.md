# Use identity-domain-wide public OIDC subjects

Easy Auth uses Better Auth's default public subject identifier: the same internal User ID is emitted as `sub` to every OAuth client in the identity domain. This preserves a unified account identity across trusted applications and avoids a permanent pairwise secret, at the cost of allowing those applications to correlate the same account; changing to pairwise subjects later would break relying-party account mappings.
