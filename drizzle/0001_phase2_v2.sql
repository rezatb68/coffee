CREATE TABLE `app_assets` (
	`key` text PRIMARY KEY NOT NULL,
	`mime` text NOT NULL,
	`bytes` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `feedback_ratings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`stars` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `feedback_order_idx` ON `feedback_ratings` (`order_id`);--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`key` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`response_json` text NOT NULL,
	`http_status` integer DEFAULT 200 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idempotency_created_idx` ON `idempotency_keys` (`created_at`);--> statement-breakpoint
CREATE TABLE `item_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`file_key` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`blur_hash` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `item_images_item_idx` ON `item_images` (`item_id`);--> statement-breakpoint
CREATE TABLE `license_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`mode` text DEFAULT 'trial' NOT NULL,
	`trial_started_at` integer NOT NULL,
	`trial_ends_at` integer NOT NULL,
	`license_key` text,
	`license_holder` text,
	`license_domain` text,
	`license_expires_at` integer,
	`last_checked_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`gateway` text DEFAULT 'zarinpal' NOT NULL,
	`authority` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`ref_id` text,
	`card_pan` text,
	`created_at` integer NOT NULL,
	`verified_at` integer,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payments_order_idx` ON `payments` (`order_id`);--> statement-breakpoint
CREATE INDEX `payments_authority_idx` ON `payments` (`authority`);--> statement-breakpoint
CREATE TABLE `table_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`table_id` integer NOT NULL,
	`opened_at` integer NOT NULL,
	`closed_at` integer,
	FOREIGN KEY (`table_id`) REFERENCES `cafe_tables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `table_sessions_table_idx` ON `table_sessions` (`table_id`,`opened_at`);--> statement-breakpoint
ALTER TABLE `cafe_settings` ADD `logo_key` text;--> statement-breakpoint
ALTER TABLE `cafe_settings` ADD `cover_key` text;--> statement-breakpoint
ALTER TABLE `cafe_settings` ADD `font_choice` text DEFAULT 'vazirmatn' NOT NULL;--> statement-breakpoint
ALTER TABLE `cafe_settings` ADD `menu_layout` text DEFAULT 'list' NOT NULL;--> statement-breakpoint
ALTER TABLE `cafe_settings` ADD `corner_style` text DEFAULT 'soft' NOT NULL;--> statement-breakpoint
ALTER TABLE `cafe_settings` ADD `welcome_message` text;--> statement-breakpoint
ALTER TABLE `cafe_settings` ADD `fa_digits` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `cafe_settings` ADD `second_language` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `cafe_settings` ADD `working_hours` text;--> statement-breakpoint
ALTER TABLE `cafe_settings` ADD `enable_online_pay` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `cafe_settings` ADD `enable_in_person_pay` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `cafe_settings` ADD `enable_takeaway` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `cafe_settings` ADD `enable_ratings` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `cafe_settings` ADD `zarinpal_merchant_id` text;--> statement-breakpoint
ALTER TABLE `cafe_settings` ADD `sound_style` text DEFAULT 'chime' NOT NULL;--> statement-breakpoint
ALTER TABLE `cafe_settings` ADD `speak_new_order` integer DEFAULT false NOT NULL;