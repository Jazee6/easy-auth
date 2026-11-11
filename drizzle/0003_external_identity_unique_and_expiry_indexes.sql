CREATE UNIQUE INDEX `account_providerId_accountId_uidx` ON `account` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `session_expiresAt_idx` ON `session` (`expires_at`);--> statement-breakpoint
CREATE INDEX `verification_expiresAt_idx` ON `verification` (`expires_at`);