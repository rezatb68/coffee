CREATE TABLE `cafe_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tagline` text,
	`primary_color` text DEFAULT '#6f4e37' NOT NULL,
	`theme` text DEFAULT 'latte' NOT NULL,
	`currency_unit` text DEFAULT 'toman' NOT NULL,
	`tax_percent` integer DEFAULT 0 NOT NULL,
	`service_percent` integer DEFAULT 0 NOT NULL,
	`ordering_enabled` integer DEFAULT true NOT NULL,
	`require_approval` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cafe_tables` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` integer NOT NULL,
	`label` text,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cafe_tables_number_unique` ON `cafe_tables` (`number`);--> statement-breakpoint
CREATE TABLE `call_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`table_id` integer NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`table_id`) REFERENCES `cafe_tables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `call_requests_status_idx` ON `call_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `item_allergens` (
	`item_id` integer NOT NULL,
	`allergen` text NOT NULL,
	PRIMARY KEY(`item_id`, `allergen`),
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `item_tags` (
	`item_id` integer NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`item_id`, `tag`),
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`base_price` integer NOT NULL,
	`is_available` integer DEFAULT true NOT NULL,
	`is_new` integer DEFAULT false NOT NULL,
	`is_bestseller` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `items_category_idx` ON `items` (`category_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `option_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`min_select` integer DEFAULT 0 NOT NULL,
	`max_select` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `option_groups_item_idx` ON `option_groups` (`item_id`);--> statement-breakpoint
CREATE TABLE `options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`name` text NOT NULL,
	`price_delta` integer DEFAULT 0 NOT NULL,
	`is_available` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `option_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `options_group_idx` ON `options` (`group_id`);--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`actor_user_id` integer,
	`at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `staff_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `order_events_order_idx` ON `order_events` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`item_id` integer,
	`item_name` text NOT NULL,
	`unit_price` integer NOT NULL,
	`qty` integer NOT NULL,
	`options_json` text DEFAULT '[]' NOT NULL,
	`note` text,
	`line_total` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`public_code` text NOT NULL,
	`token_hash` text NOT NULL,
	`table_id` integer,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`payment_method` text NOT NULL,
	`payment_status` text NOT NULL,
	`subtotal` integer NOT NULL,
	`tax_amount` integer NOT NULL,
	`service_amount` integer NOT NULL,
	`total` integer NOT NULL,
	`note` text,
	`client_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`table_id`) REFERENCES `cafe_tables`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_code_idx` ON `orders` (`public_code`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_table_idx` ON `orders` (`table_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`ip` text,
	`user_agent` text,
	FOREIGN KEY (`user_id`) REFERENCES `staff_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `staff_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_users_username_unique` ON `staff_users` (`username`);