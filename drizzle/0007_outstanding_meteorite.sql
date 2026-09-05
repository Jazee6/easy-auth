DROP INDEX `account_userId_github_uidx`;--> statement-breakpoint
CREATE UNIQUE INDEX `account_userId_providerId_uidx` ON `account` (`user_id`,`provider_id`);