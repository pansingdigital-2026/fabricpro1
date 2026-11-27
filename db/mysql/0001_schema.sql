-- =====================================================================
-- Fabric-Pro CMS — MySQL schema (Hostinger)
-- Import once:  mysql -h HOST -u USER -p DBNAME < db/mysql/0001_schema.sql
-- or paste into phpMyAdmin → SQL.
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------------- admins
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `email` VARCHAR(190) NOT NULL UNIQUE,
  `full_name` VARCHAR(190) NULL,
  `role` ENUM('administrator','editor','author') NOT NULL DEFAULT 'administrator',
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------- authors
CREATE TABLE IF NOT EXISTS `authors` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `user_id` CHAR(36) NULL,
  `name` VARCHAR(190) NOT NULL,
  `slug` VARCHAR(190) NOT NULL UNIQUE,
  `bio` TEXT NULL,
  `job_title` VARCHAR(190) NULL,
  `photo_url` TEXT NULL,
  `social_links` JSON NULL,
  `seo` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------- content types
CREATE TABLE IF NOT EXISTS `content_types` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `slug` VARCHAR(190) NOT NULL UNIQUE,
  `name` VARCHAR(190) NOT NULL,
  `plural_name` VARCHAR(190) NOT NULL,
  `description` TEXT NULL,
  `is_video` TINYINT(1) NOT NULL DEFAULT 0,
  `archive_path` VARCHAR(190) NULL,
  `position` INT NOT NULL DEFAULT 0,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `seo` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------ taxonomy
CREATE TABLE IF NOT EXISTS `categories` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `parent_id` CHAR(36) NULL,
  `name` VARCHAR(190) NOT NULL,
  `slug` VARCHAR(190) NOT NULL UNIQUE,
  `description` TEXT NULL,
  `image_url` TEXT NULL,
  `heading` VARCHAR(255) NULL,
  `seo` JSON NULL,
  `position` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_categories_parent` FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tags` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `name` VARCHAR(190) NOT NULL,
  `slug` VARCHAR(190) NOT NULL UNIQUE,
  `description` TEXT NULL,
  `seo` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------- media
CREATE TABLE IF NOT EXISTS `media` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `storage_path` VARCHAR(255) NOT NULL,
  `public_url` TEXT NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(190) NULL,
  `size_bytes` BIGINT NULL,
  `width` INT NULL,
  `height` INT NULL,
  `alt_text` TEXT NULL,
  `caption` TEXT NULL,
  `title` VARCHAR(255) NULL,
  `folder` VARCHAR(32) NULL,
  `uploaded_by` CHAR(36) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `media_folder_idx` (`folder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------- media_files
CREATE TABLE IF NOT EXISTS `media_files` (
  `storage_path` VARCHAR(255) NOT NULL PRIMARY KEY,
  `mime_type` VARCHAR(190) NOT NULL DEFAULT 'application/octet-stream',
  `size_bytes` BIGINT NOT NULL DEFAULT 0,
  `data` LONGBLOB NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------------- content
CREATE TABLE IF NOT EXISTS `content` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `type_slug` VARCHAR(190) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(190) NOT NULL UNIQUE,
  `excerpt` TEXT NULL,
  `body_html` LONGTEXT NULL,
  `body_markdown` LONGTEXT NULL,
  `editor_mode` VARCHAR(20) NOT NULL DEFAULT 'rich',
  `featured_image_url` TEXT NULL,
  `featured_image_alt` TEXT NULL,
  `featured_image_caption` TEXT NULL,
  `author_id` CHAR(36) NULL,
  `category_id` CHAR(36) NULL,
  `status` ENUM('draft','scheduled','published','archived') NOT NULL DEFAULT 'draft',
  `is_featured` TINYINT(1) NOT NULL DEFAULT 0,
  `is_editors_pick` TINYINT(1) NOT NULL DEFAULT 0,
  `video_provider` VARCHAR(50) NULL,
  `video_url` TEXT NULL,
  `video_thumbnail_url` TEXT NULL,
  `reading_minutes` INT NULL,
  `view_count` INT NOT NULL DEFAULT 0,
  `seo` JSON NULL,
  `related_ids` JSON NULL,
  `published_at` DATETIME NULL,
  `scheduled_for` DATETIME NULL,
  `created_by` CHAR(36) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `content_status_idx` (`status`, `published_at`),
  KEY `content_type_idx` (`type_slug`),
  KEY `content_category_idx` (`category_id`),
  CONSTRAINT `fk_content_author` FOREIGN KEY (`author_id`) REFERENCES `authors`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_content_category` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `content_tags` (
  `content_id` CHAR(36) NOT NULL,
  `tag_id` CHAR(36) NOT NULL,
  PRIMARY KEY (`content_id`, `tag_id`),
  CONSTRAINT `fk_ct_content` FOREIGN KEY (`content_id`) REFERENCES `content`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ct_tag` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `content_revisions` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `content_id` CHAR(36) NOT NULL,
  `snapshot` JSON NOT NULL,
  `created_by` CHAR(36) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_rev_content` FOREIGN KEY (`content_id`) REFERENCES `content`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------- pages
CREATE TABLE IF NOT EXISTS `pages` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(190) NOT NULL UNIQUE,
  `status` ENUM('draft','scheduled','published','archived') NOT NULL DEFAULT 'draft',
  `sections` JSON NULL,
  `seo` JSON NULL,
  `published_at` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------- homepage sections
CREATE TABLE IF NOT EXISTS `homepage_sections` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `block_type` VARCHAR(60) NOT NULL,
  `title` VARCHAR(255) NULL,
  `subtitle` VARCHAR(255) NULL,
  `position` INT NOT NULL DEFAULT 0,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `settings` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------- menus
CREATE TABLE IF NOT EXISTS `menus` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `slug` VARCHAR(190) NOT NULL UNIQUE,
  `name` VARCHAR(190) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `menu_items` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `menu_id` CHAR(36) NOT NULL,
  `parent_id` CHAR(36) NULL,
  `label` VARCHAR(190) NOT NULL,
  `url` VARCHAR(255) NOT NULL,
  `target` VARCHAR(20) NOT NULL DEFAULT '_self',
  `position` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_menu_items_menu` FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------- settings
CREATE TABLE IF NOT EXISTS `site_settings` (
  `key` VARCHAR(190) NOT NULL PRIMARY KEY,
  `value` JSON NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------ redirects
CREATE TABLE IF NOT EXISTS `redirects` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `source_path` VARCHAR(255) NOT NULL UNIQUE,
  `destination_path` VARCHAR(255) NOT NULL,
  `kind` ENUM('301','302') NOT NULL DEFAULT '301',
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------- contact/newsletter
CREATE TABLE IF NOT EXISTS `contact_submissions` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `name` VARCHAR(190) NOT NULL,
  `email` VARCHAR(190) NOT NULL,
  `subject` VARCHAR(255) NULL,
  `message` TEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `newsletter_subscribers` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `email` VARCHAR(190) NOT NULL UNIQUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------- news automation
CREATE TABLE IF NOT EXISTS `automation_events` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `step` VARCHAR(40) NOT NULL,
  `outcome` ENUM('success','error','reused') NOT NULL,
  `draft_id` CHAR(36) NULL,
  `media_id` CHAR(36) NULL,
  `title` VARCHAR(255) NULL,
  `source_url` TEXT NULL,
  `result_state` VARCHAR(40) NULL,
  `result_url` TEXT NULL,
  `error_message` TEXT NULL,
  `idempotency_key` VARCHAR(190) NULL,
  `details` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `automation_events_created_idx` (`created_at`),
  KEY `automation_events_draft_idx` (`draft_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
