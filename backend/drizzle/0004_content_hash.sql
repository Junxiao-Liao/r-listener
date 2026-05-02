ALTER TABLE `tracks` ADD COLUMN `audio_hash` TEXT;
CREATE INDEX `tracks_audio_hash_idx` ON `tracks` (`audio_hash`);
