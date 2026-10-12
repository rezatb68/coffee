import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { ORDER_STATUSES, PAYMENT_STATUSES, ROLES } from '../../shared/status';

export const THEME_PRESETS = ['latte', 'espresso', 'matcha', 'rose', 'sahara', 'midnight', 'pistachio', 'cherry'] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];

export const cafeSettings = sqliteTable('cafe_settings', {
	id: integer('id').primaryKey(),
	name: text('name').notNull(),
	tagline: text('tagline'),
	primaryColor: text('primary_color').notNull().default('#6f4e37'),
	theme: text('theme').notNull().default('latte'),
	logoKey: text('logo_key'),
	coverKey: text('cover_key'),
	fontChoice: text('font_choice', { enum: ['vazirmatn', 'sahel', 'system'] }).notNull().default('vazirmatn'),
	menuLayout: text('menu_layout', { enum: ['list', 'grid'] }).notNull().default('list'),
	cornerStyle: text('corner_style', { enum: ['sharp', 'soft', 'round'] }).notNull().default('soft'),
	welcomeMessage: text('welcome_message'),
	faDigits: integer('fa_digits', { mode: 'boolean' }).notNull().default(true),
	secondLanguage: integer('second_language', { mode: 'boolean' }).notNull().default(false),
	workingHours: text('working_hours'),
	enableOnlinePay: integer('enable_online_pay', { mode: 'boolean' }).notNull().default(false),
	enableInPersonPay: integer('enable_in_person_pay', { mode: 'boolean' }).notNull().default(true),
	enableTakeaway: integer('enable_takeaway', { mode: 'boolean' }).notNull().default(false),
	enableRatings: integer('enable_ratings', { mode: 'boolean' }).notNull().default(true),
	zarinpalMerchantId: text('zarinpal_merchant_id'),
	soundStyle: text('sound_style', { enum: ['chime', 'bell', 'ding'] }).notNull().default('chime'),
	speakNewOrder: integer('speak_new_order', { mode: 'boolean' }).notNull().default(false),
	currencyUnit: text('currency_unit', { enum: ['toman', 'rial'] }).notNull().default('toman'),
	taxPercent: integer('tax_percent').notNull().default(0),
	servicePercent: integer('service_percent').notNull().default(0),
	orderingEnabled: integer('ordering_enabled', { mode: 'boolean' }).notNull().default(true),
	requireApproval: integer('require_approval', { mode: 'boolean' }).notNull().default(true),
	updatedAt: integer('updated_at').notNull()
});

export const staffUsers = sqliteTable('staff_users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	role: text('role', { enum: ROLES }).notNull(),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	failedAttempts: integer('failed_attempts').notNull().default(0),
	lockedUntil: integer('locked_until'),
	createdAt: integer('created_at').notNull()
});

export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		userId: integer('user_id')
			.notNull()
			.references(() => staffUsers.id, { onDelete: 'cascade' }),
		expiresAt: integer('expires_at').notNull(),
		createdAt: integer('created_at').notNull(),
		ip: text('ip'),
		userAgent: text('user_agent')
	},
	(t) => [index('sessions_user_idx').on(t.userId)]
);

export const categories = sqliteTable('categories', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	sortOrder: integer('sort_order').notNull().default(0),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true)
});

export const items = sqliteTable(
	'items',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		categoryId: integer('category_id')
			.notNull()
			.references(() => categories.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		description: text('description'),
		basePrice: integer('base_price').notNull(),
		isAvailable: integer('is_available', { mode: 'boolean' }).notNull().default(true),
		isNew: integer('is_new', { mode: 'boolean' }).notNull().default(false),
		isBestseller: integer('is_bestseller', { mode: 'boolean' }).notNull().default(false),
		sortOrder: integer('sort_order').notNull().default(0)
	},
	(t) => [index('items_category_idx').on(t.categoryId, t.sortOrder)]
);

export const itemTags = sqliteTable(
	'item_tags',
	{
		itemId: integer('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'cascade' }),
		tag: text('tag', { enum: ['vegan', 'gluten_free', 'spicy'] }).notNull()
	},
	(t) => [primaryKey({ columns: [t.itemId, t.tag] })]
);

export const itemAllergens = sqliteTable(
	'item_allergens',
	{
		itemId: integer('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'cascade' }),
		allergen: text('allergen').notNull()
	},
	(t) => [primaryKey({ columns: [t.itemId, t.allergen] })]
);

export const optionGroups = sqliteTable(
	'option_groups',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		itemId: integer('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		kind: text('kind', { enum: ['single', 'multi'] }).notNull(),
		required: integer('required', { mode: 'boolean' }).notNull().default(false),
		minSelect: integer('min_select').notNull().default(0),
		maxSelect: integer('max_select').notNull().default(1),
		sortOrder: integer('sort_order').notNull().default(0)
	},
	(t) => [index('option_groups_item_idx').on(t.itemId)]
);

export const options = sqliteTable(
	'options',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		groupId: integer('group_id')
			.notNull()
			.references(() => optionGroups.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		priceDelta: integer('price_delta').notNull().default(0),
		isAvailable: integer('is_available', { mode: 'boolean' }).notNull().default(true),
		sortOrder: integer('sort_order').notNull().default(0)
	},
	(t) => [index('options_group_idx').on(t.groupId)]
);

export const cafeTables = sqliteTable('cafe_tables', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	number: integer('number').notNull().unique(),
	label: text('label'),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true)
});

export const orders = sqliteTable(
	'orders',
	{
		id: text('id').primaryKey(),
		publicCode: text('public_code').notNull(),
		tokenHash: text('token_hash').notNull(),
		tableId: integer('table_id').references(() => cafeTables.id),
		channel: text('channel', { enum: ['dine_in', 'takeaway'] }).notNull(),
		status: text('status', { enum: ORDER_STATUSES }).notNull(),
		paymentMethod: text('payment_method', { enum: ['in_person', 'online'] }).notNull(),
		paymentStatus: text('payment_status', { enum: PAYMENT_STATUSES }).notNull(),
		subtotal: integer('subtotal').notNull(),
		taxAmount: integer('tax_amount').notNull(),
		serviceAmount: integer('service_amount').notNull(),
		total: integer('total').notNull(),
		note: text('note'),
		clientId: text('client_id').notNull(),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull()
	},
	(t) => [
		index('orders_status_idx').on(t.status, t.createdAt),
		index('orders_code_idx').on(t.publicCode, t.createdAt),
		index('orders_table_idx').on(t.tableId, t.createdAt)
	]
);

export const orderItems = sqliteTable(
	'order_items',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		orderId: text('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		itemId: integer('item_id').references(() => items.id, { onDelete: 'set null' }),
		itemName: text('item_name').notNull(),
		unitPrice: integer('unit_price').notNull(),
		qty: integer('qty').notNull(),
		optionsJson: text('options_json').notNull().default('[]'),
		note: text('note'),
		lineTotal: integer('line_total').notNull()
	},
	(t) => [index('order_items_order_idx').on(t.orderId)]
);

export const orderEvents = sqliteTable(
	'order_events',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		orderId: text('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		fromStatus: text('from_status'),
		toStatus: text('to_status', { enum: ORDER_STATUSES }).notNull(),
		actorUserId: integer('actor_user_id').references(() => staffUsers.id, { onDelete: 'set null' }),
		at: integer('at').notNull()
	},
	(t) => [index('order_events_order_idx').on(t.orderId)]
);

export const callRequests = sqliteTable(
	'call_requests',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		tableId: integer('table_id')
			.notNull()
			.references(() => cafeTables.id, { onDelete: 'cascade' }),
		kind: text('kind', { enum: ['waiter', 'bill'] }).notNull(),
		status: text('status', { enum: ['open', 'done'] }).notNull().default('open'),
		createdAt: integer('created_at').notNull(),
		resolvedAt: integer('resolved_at')
	},
	(t) => [index('call_requests_status_idx').on(t.status, t.createdAt)]
);

// ---------- Phase 2: licensing, payments, extras ----------

export const licenseState = sqliteTable('license_state', {
	id: integer('id').primaryKey(),
	mode: text('mode', { enum: ['trial', 'licensed', 'trial_expired'] }).notNull().default('trial'),
	trialStartedAt: integer('trial_started_at').notNull(),
	trialEndsAt: integer('trial_ends_at').notNull(),
	licenseKey: text('license_key'),
	licenseHolder: text('license_holder'),
	licenseDomain: text('license_domain'),
	licenseExpiresAt: integer('license_expires_at'),
	lastCheckedAt: integer('last_checked_at'),
	updatedAt: integer('updated_at').notNull()
});

export const idempotencyKeys = sqliteTable(
	'idempotency_keys',
	{
		key: text('key').primaryKey(),
		scope: text('scope').notNull(),
		responseJson: text('response_json').notNull(),
		status: integer('http_status').notNull().default(200),
		createdAt: integer('created_at').notNull()
	},
	(t) => [index('idempotency_created_idx').on(t.createdAt)]
);

export const payments = sqliteTable(
	'payments',
	{
		id: text('id').primaryKey(),
		orderId: text('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		gateway: text('gateway').notNull().default('zarinpal'),
		authority: text('authority').notNull(),
		amount: integer('amount').notNull(),
		status: text('status', { enum: ['pending', 'verified', 'failed', 'expired'] }).notNull().default('pending'),
		refId: text('ref_id'),
		cardPan: text('card_pan'),
		createdAt: integer('created_at').notNull(),
		verifiedAt: integer('verified_at')
	},
	(t) => [index('payments_order_idx').on(t.orderId), index('payments_authority_idx').on(t.authority)]
);

export const itemImages = sqliteTable(
	'item_images',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		itemId: integer('item_id')
			.notNull()
			.references(() => items.id, { onDelete: 'cascade' }),
		fileKey: text('file_key').notNull(),
		width: integer('width').notNull(),
		height: integer('height').notNull(),
		blurHash: text('blur_hash'),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: integer('created_at').notNull()
	},
	(t) => [index('item_images_item_idx').on(t.itemId)]
);

export const feedbackRatings = sqliteTable(
	'feedback_ratings',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		orderId: text('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		stars: integer('stars').notNull(),
		note: text('note'),
		createdAt: integer('created_at').notNull()
	},
	(t) => [index('feedback_order_idx').on(t.orderId)]
);

export const appAssets = sqliteTable('app_assets', {
	key: text('key').primaryKey(),
	mime: text('mime').notNull(),
	bytes: text('bytes').notNull(),
	updatedAt: integer('updated_at').notNull()
});

export const tableSessions = sqliteTable(
	'table_sessions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		tableId: integer('table_id')
			.notNull()
			.references(() => cafeTables.id, { onDelete: 'cascade' }),
		openedAt: integer('opened_at').notNull(),
		closedAt: integer('closed_at')
	},
	(t) => [index('table_sessions_table_idx').on(t.tableId, t.openedAt)]
);
