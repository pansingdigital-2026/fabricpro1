-- Persistent binary storage for uploaded images and responsive variants.
-- Safe to run more than once. The app also creates this table automatically
-- on first upload or read when MySQL is configured.
CREATE TABLE IF NOT EXISTS `media_files` (
  `storage_path` VARCHAR(255) NOT NULL PRIMARY KEY,
  `mime_type` VARCHAR(190) NOT NULL DEFAULT 'application/octet-stream',
  `size_bytes` BIGINT NOT NULL DEFAULT 0,
  `data` LONGBLOB NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;