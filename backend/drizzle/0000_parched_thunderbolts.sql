CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`tenant_id` text,
	`meta` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_logs_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_idx` ON `audit_logs` (`actor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_tenant_idx` ON `audit_logs` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_action_idx` ON `audit_logs` (`action`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_target_idx` ON `audit_logs` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_user_tenant_uq` ON `memberships` (`user_id`,`tenant_id`) WHERE "memberships"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX `memberships_tenant_idx` ON `memberships` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `playback_history` (
	`user_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`track_id` text NOT NULL,
	`last_playlist_id` text,
	`last_played_at` integer NOT NULL,
	`last_position_ms` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `tenant_id`, `track_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`last_playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `playback_recent_idx` ON `playback_history` (`user_id`,`tenant_id`,`last_played_at`);--> statement-breakpoint
CREATE TABLE `playlist_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`playlist_id` text NOT NULL,
	`track_id` text NOT NULL,
	`position_frac` real NOT NULL,
	`added_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `playlist_tracks_uq` ON `playlist_tracks` (`playlist_id`,`track_id`) WHERE "playlist_tracks"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX `playlist_tracks_position_idx` ON `playlist_tracks` (`playlist_id`,`deleted_at`,`position_frac`);--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `playlists_tenant_name_uq` ON `playlists` (`tenant_id`,`name`) WHERE "playlists"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX `playlists_tenant_idx` ON `playlists` (`tenant_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `queue_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`track_id` text NOT NULL,
	`position_frac` real NOT NULL,
	`is_current` integer DEFAULT false NOT NULL,
	`added_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `queue_items_user_tenant_position_idx` ON `queue_items` (`user_id`,`tenant_id`,`deleted_at`,`position_frac`);--> statement-breakpoint
CREATE INDEX `queue_items_track_idx` ON `queue_items` (`track_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `queue_items_one_current_uq` ON `queue_items` (`user_id`,`tenant_id`,`is_current`) WHERE "queue_items"."deleted_at" IS NULL AND "queue_items"."is_current" = 1;--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`active_tenant_id` text,
	`expires_at` integer NOT NULL,
	`last_refreshed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`user_agent` text,
	`ip` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`active_tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_name_uq` ON `tenants` (`name`) WHERE "tenants"."deleted_at" IS NULL;--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`uploader_id` text NOT NULL,
	`title` text NOT NULL,
	`artist` text,
	`album` text,
	`duration_ms` integer,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`track_number` integer,
	`genre` text,
	`year` integer,
	`lyrics_lrc` text,
	`lyrics_status` text DEFAULT 'none' NOT NULL,
	`audio_r2_key` text NOT NULL,
	`cover_r2_key` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploader_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tracks_tenant_idx` ON `tracks` (`tenant_id`,`deleted_at`,`status`);--> statement-breakpoint
CREATE INDEX `tracks_tenant_created_idx` ON `tracks` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `tracks_tenant_title_idx` ON `tracks` (`tenant_id`,`title`);--> statement-breakpoint
CREATE INDEX `tracks_tenant_artist_idx` ON `tracks` (`tenant_id`,`artist`);--> statement-breakpoint
CREATE INDEX `tracks_tenant_album_idx` ON `tracks` (`tenant_id`,`album`);--> statement-breakpoint
CREATE INDEX `tracks_pending_cleanup_idx` ON `tracks` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`auto_play_next` integer DEFAULT true NOT NULL,
	`show_mini_player` integer DEFAULT true NOT NULL,
	`prefer_synced_lyrics` integer DEFAULT true NOT NULL,
	`default_library_sort` text DEFAULT 'createdAt:desc' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_active_tenant_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`last_active_tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_uq` ON `users` (`username`) WHERE "users"."deleted_at" IS NULL;
