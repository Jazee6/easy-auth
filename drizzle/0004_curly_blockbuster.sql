CREATE TABLE `security_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`actor_email` text NOT NULL,
	`target_user_id` text NOT NULL,
	`target_name` text NOT NULL,
	`target_email` text NOT NULL,
	`action` text NOT NULL,
	`details` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `securityActivity_createdAt_id_idx` ON `security_activity` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `securityActivity_action_createdAt_id_idx` ON `security_activity` (`action`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `securityActivity_targetUserId_createdAt_id_idx` ON `security_activity` (`target_user_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `securityActivity_actorUserId_createdAt_id_idx` ON `security_activity` (`actor_user_id`,`created_at`,`id`);