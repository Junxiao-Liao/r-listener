CREATE TABLE `artists` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `artists_tenant_name_key_uq` ON `artists` (`tenant_id`, `name_key`);
CREATE INDEX `artists_tenant_name_key_idx` ON `artists` (`tenant_id`, `deleted_at`, `name_key`);

CREATE TABLE `track_artists` (
	`track_id` text NOT NULL,
	`artist_id` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY (`track_id`, `artist_id`),
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`artist_id`) REFERENCES `artists`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `track_artists_track_position_uq` ON `track_artists` (`track_id`, `position`);
CREATE INDEX `track_artists_artist_idx` ON `track_artists` (`artist_id`);

UPDATE `user_preferences`
SET `default_library_sort` = 'createdAt:desc'
WHERE `default_library_sort` = 'artist:asc';

DROP INDEX `tracks_tenant_artist_idx`;
ALTER TABLE `tracks` DROP COLUMN `artist`;
