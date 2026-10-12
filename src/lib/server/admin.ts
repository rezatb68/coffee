import { asc, eq, max } from 'drizzle-orm';
import type { DB } from './db';
import { cafeSettings, cafeTables, categories, itemAllergens, itemTags, items, optionGroups, options } from './db/schema';
import { HttpError, isRecord } from './http';
import { getSettingsRow } from './menu';

const MAX_TEXT = 120;
const MAX_DESC = 400;
const MAX_PRICE = 9_999_999_999;
const TAGS = ['vegan', 'gluten_free', 'spicy'] as const;
type Tag = (typeof TAGS)[number];

function str(value: unknown, field: string, maxLen = MAX_TEXT, optional = false): string | null {
	if (value === undefined || value === null) {
		if (optional) return null;
		throw new HttpError(400, `«${field}» لازم است.`);
	}
	if (typeof value !== 'string') throw new HttpError(400, `«${field}» معتبر نیست.`);
	const trimmed = value.trim();
	if (!optional && !trimmed) throw new HttpError(400, `«${field}» نمی‌تواند خالی باشد.`);
	if (trimmed.length > maxLen) throw new HttpError(400, `«${field}» بیش از ${maxLen} نویسه است.`);
	return trimmed.length > 0 ? trimmed : null;
}

function int(value: unknown, field: string, min: number, maxV: number): number {
	if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > maxV) {
		throw new HttpError(400, `«${field}» باید عددی بین ${min} تا ${maxV} باشد.`);
	}
	return value;
}

function bool(value: unknown, field: string, fallback = false): boolean {
	if (value === undefined || value === null) return fallback;
	if (typeof value !== 'boolean') throw new HttpError(400, `«${field}» معتبر نیست.`);
	return value;
}

function requireOwner(user: { role: string } | null | undefined): void {
	if (!user || user.role !== 'owner') throw new HttpError(403, 'فقط مدیر کافه به این بخش دسترسی دارد.');
}

// ---------- Settings ----------

export type SettingsInput = Partial<{
	name: string;
	tagline: string | null;
	primaryColor: string;
	theme: 'latte' | 'espresso' | 'matcha' | 'rose' | 'sahara' | 'midnight' | 'pistachio' | 'cherry';
	currencyUnit: 'toman' | 'rial';
	taxPercent: number;
	servicePercent: number;
	orderingEnabled: boolean;
	requireApproval: boolean;
	menuLayout: 'list' | 'grid';
	cornerStyle: 'sharp' | 'soft' | 'round';
	welcomeMessage: string | null;
	faDigits: boolean;
	secondLanguage: boolean;
	workingHours: string | null;
	enableOnlinePay: boolean;
	enableInPersonPay: boolean;
	enableTakeaway: boolean;
	enableRatings: boolean;
	zarinpalMerchantId: string | null;
	soundStyle: 'chime' | 'bell' | 'ding';
	speakNewOrder: boolean;
}>;

export function parseSettingsInput(body: unknown): SettingsInput {
	if (!isRecord(body)) throw new HttpError(400, 'داده‌ی ارسالی معتبر نیست.');
	const out: SettingsInput = {};
	if (body.name !== undefined) {
		const name = str(body.name, 'نام کافه', 60);
		if (!name) throw new HttpError(400, '«نام کافه» نمی‌تواند خالی باشد.');
		out.name = name;
	}
	if (body.tagline !== undefined) out.tagline = str(body.tagline ?? null, 'شعار', 120, true);
	if (body.primaryColor !== undefined) {
		if (typeof body.primaryColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(body.primaryColor)) {
			throw new HttpError(400, 'رنگ اصلی باید کد رنگ هگز معتبر باشد.');
		}
		out.primaryColor = body.primaryColor.toUpperCase();
	}
	if (body.currencyUnit !== undefined) {
		if (body.currencyUnit !== 'toman' && body.currencyUnit !== 'rial') throw new HttpError(400, 'واحد پول معتبر نیست.');
		out.currencyUnit = body.currencyUnit;
	}
	if (body.taxPercent !== undefined) out.taxPercent = int(body.taxPercent, 'مالیات', 0, 50);
	if (body.servicePercent !== undefined) out.servicePercent = int(body.servicePercent, 'حق خدمات', 0, 50);
	if (body.orderingEnabled !== undefined) out.orderingEnabled = bool(body.orderingEnabled, 'فعال بودن سفارش‌گیری');
	if (body.requireApproval !== undefined) out.requireApproval = bool(body.requireApproval, 'نیاز به تأیید سفارش');
	if (body.theme !== undefined) {
		const THEMES = ['latte', 'espresso', 'matcha', 'rose', 'sahara', 'midnight', 'pistachio', 'cherry'];
		if (typeof body.theme !== 'string' || !THEMES.includes(body.theme)) throw new HttpError(400, 'تم معتبر نیست.');
		out.theme = body.theme as SettingsInput['theme'];
	}
	if (body.menuLayout !== undefined) {
		if (body.menuLayout !== 'list' && body.menuLayout !== 'grid') throw new HttpError(400, 'چیدمان معتبر نیست.');
		out.menuLayout = body.menuLayout;
	}
	if (body.cornerStyle !== undefined) {
		if (body.cornerStyle !== 'sharp' && body.cornerStyle !== 'soft' && body.cornerStyle !== 'round') throw new HttpError(400, 'گردی گوشه معتبر نیست.');
		out.cornerStyle = body.cornerStyle;
	}
	if (body.welcomeMessage !== undefined) out.welcomeMessage = str(body.welcomeMessage ?? null, 'پیام خوشامد', 200, true);
	if (body.faDigits !== undefined) out.faDigits = bool(body.faDigits, 'ارقام فارسی');
	if (body.secondLanguage !== undefined) out.secondLanguage = bool(body.secondLanguage, 'زبان دوم');
	if (body.workingHours !== undefined) out.workingHours = str(body.workingHours ?? null, 'ساعت کاری', 200, true);
	if (body.enableOnlinePay !== undefined) out.enableOnlinePay = bool(body.enableOnlinePay, 'پرداخت آنلاین');
	if (body.enableInPersonPay !== undefined) out.enableInPersonPay = bool(body.enableInPersonPay, 'پرداخت حضوری');
	if (body.enableTakeaway !== undefined) out.enableTakeaway = bool(body.enableTakeaway, 'بیرون‌بر');
	if (body.enableRatings !== undefined) out.enableRatings = bool(body.enableRatings, 'نظرسنجی');
	if (body.zarinpalMerchantId !== undefined) {
		if (body.zarinpalMerchantId === null) out.zarinpalMerchantId = null;
		else if (typeof body.zarinpalMerchantId === 'string' && /^[0-9a-f]{32,64}$/i.test(body.zarinpalMerchantId.trim())) out.zarinpalMerchantId = body.zarinpalMerchantId.trim();
		else throw new HttpError(400, 'شناسه‌ی پذیرندگی باید ۳۲ تا ۶۴ نویسه‌ی هگز باشد.');
	}
	if (body.soundStyle !== undefined) {
		if (body.soundStyle !== 'chime' && body.soundStyle !== 'bell' && body.soundStyle !== 'ding') throw new HttpError(400, 'صدای معتبر نیست.');
		out.soundStyle = body.soundStyle;
	}
	if (body.speakNewOrder !== undefined) out.speakNewOrder = bool(body.speakNewOrder, 'پیام صوتی سفارش جدید');
	return out;
}

export function updateSettings(db: DB, input: SettingsInput, user: { role: string } | null) {
	requireOwner(user);
	const row = db
		.update(cafeSettings)
		.set({ ...input, updatedAt: Date.now() })
		.where(eq(cafeSettings.id, 1))
		.returning()
		.get();
	if (!row) throw new HttpError(500, 'تنظیمات پیدا نشد.');
	return getSettingsRow(db);
}

// ---------- Categories ----------

export type CategoryInput = { name: string; sortOrder?: number; isActive?: boolean };

export function parseCategoryInput(body: unknown): CategoryInput {
	if (!isRecord(body)) throw new HttpError(400, 'داده‌ی ارسالی معتبر نیست.');
	const name = str(body.name, 'نام دسته');
	if (!name) throw new HttpError(400, '«نام دسته» نمی‌تواند خالی باشد.');

	return {
		name,
		sortOrder: body.sortOrder === undefined ? undefined : int(body.sortOrder, 'ترتیب', 0, 9999),
		isActive: bool(body.isActive, 'فعال', true)
	};
}

// ---------- Items ----------

export type OptionInput = { id?: number; name: string; priceDelta: number; isAvailable: boolean };
export type GroupInput = { name: string; kind: 'single' | 'multi'; required: boolean; minSelect: number; maxSelect: number; options: OptionInput[] };

export type ItemInput = {
	categoryId: number;
	name: string;
	description: string | null;
	basePrice: number;
	isAvailable: boolean;
	isNew: boolean;
	isBestseller: boolean;
	tags: Tag[];
	allergens: string[];
	groups: GroupInput[];
};

export function parseItemInput(body: unknown): ItemInput {
	if (!isRecord(body)) throw new HttpError(400, 'داده‌ی ارسالی معتبر نیست.');
	const categoryId = int(body.categoryId, 'دسته', 1, 2_147_483_647);
	const name = str(body.name, 'نام آیتم');
	if (!name) throw new HttpError(400, '«نام آیتم» نمی‌تواند خالی باشد.');
	const description = str(body.description, 'توضیح', MAX_DESC, true);
	const basePrice = int(body.basePrice, 'قیمت پایه', 0, MAX_PRICE);
	const isAvailable = bool(body.isAvailable, 'موجود', true);
	const isNew = bool(body.isNew, 'جدید');
	const isBestseller = bool(body.isBestseller, 'پرفروش');

	if (!Array.isArray(body.tags)) throw new HttpError(400, 'برچسب‌ها معتبر نیستند.');
	const tags = [...new Set(body.tags)] as Tag[];
	for (const tag of tags) if (!TAGS.includes(tag)) throw new HttpError(400, 'برچسب معتبر نیست.');

	if (body.allergens !== undefined && !Array.isArray(body.allergens)) throw new HttpError(400, 'آلرژن‌ها معتبر نیستند.');
	const allergens = [
		...new Set(
			(body.allergens ?? []).map((a) => {
				const v = str(a, 'آلرژن', 60);
				if (!v) throw new HttpError(400, 'آلرژن نمی‌تواند خالی باشد.');
				return v;
			})
		)
	];

	if (!Array.isArray(body.groups)) throw new HttpError(400, 'گروه‌های گزینه معتبر نیستند.');
	if (body.groups.length > 12) throw new HttpError(400, 'حداکثر ۱۲ گروه گزینه مجاز است.');
	const groups: GroupInput[] = body.groups.map((raw) => {
		if (!isRecord(raw)) throw new HttpError(400, 'گروه گزینه معتبر نیست.');
		const gname = str(raw.name, 'نام گروه');
		if (!gname) throw new HttpError(400, '«نام گروه» نمی‌تواند خالی باشد.');
		const kind = raw.kind === 'multi' ? 'multi' : raw.kind === 'single' ? 'single' : null;
		if (!kind) throw new HttpError(400, 'نوع گروه معتبر نیست.');
		const required = bool(raw.required, 'الزامی');
		const minSelect = raw.minSelect === undefined ? (required ? 1 : 0) : int(raw.minSelect, 'حداقل', 0, 30);
		const maxSelect = raw.maxSelect === undefined ? 10 : int(raw.maxSelect, 'حداکثر', 1, 30);
		if (maxSelect < minSelect) throw new HttpError(400, '«حداکثر» نمی‌تواند از «حداقل» کمتر باشد.');
		if (!Array.isArray(raw.options)) throw new HttpError(400, 'گزینه‌های گروه معتبر نیستند.');
		if (raw.options.length < 1 || raw.options.length > 30) throw new HttpError(400, 'هر گروه به حداقل یک گزینه نیاز دارد.');
		const opts = raw.options.map((o) => {
			if (!isRecord(o)) throw new HttpError(400, 'گزینه معتبر نیست.');
			const oname = str(o.name, 'نام گزینه');
			if (!oname) throw new HttpError(400, '«نام گزینه» نمی‌تواند خالی باشد.');
			return {
				id: o.id === undefined ? undefined : int(o.id, 'شناسه گزینه', 1, 2_147_483_647),
				name: oname,
				priceDelta: o.priceDelta === undefined ? 0 : int(o.priceDelta, 'اختلاف قیمت', -MAX_PRICE, MAX_PRICE),
				isAvailable: bool(o.isAvailable, 'موجود بودن گزینه', true)
			};
		});
		return { name: gname, kind, required, minSelect, maxSelect, options: opts };
	});

	return { categoryId, name, description, basePrice, isAvailable, isNew, isBestseller, tags, allergens, groups };
}

// ---------- Writers ----------

export function createCategory(db: DB, input: CategoryInput, user: { role: string } | null) {
	requireOwner(user);
	const next = db.select({ m: max(categories.sortOrder) }).from(categories).get()?.m ?? 0;
	const row = db
		.insert(categories)
		.values({ name: input.name, sortOrder: input.sortOrder ?? next + 1, isActive: input.isActive })
		.returning()
		.get();
	return row;
}

export function updateCategory(db: DB, id: number, input: CategoryInput, user: { role: string } | null) {
	requireOwner(user);
	const row = db
		.update(categories)
		.set({ name: input.name, ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}), isActive: input.isActive })
		.where(eq(categories.id, id))
		.returning()
		.get();
	if (!row) throw new HttpError(404, 'دسته پیدا نشد.');
	return row;
}

function writeChildren(tx: Parameters<Parameters<DB['transaction']>[0]>[0], itemId: number, tags: Tag[], allergens: string[], groups: GroupInput[]): void {
	tx.delete(itemTags).where(eq(itemTags.itemId, itemId)).run();
	if (tags.length) tx.insert(itemTags).values(tags.map((t) => ({ itemId, tag: t }))).run();

	tx.delete(itemAllergens).where(eq(itemAllergens.itemId, itemId)).run();
	if (allergens.length) tx.insert(itemAllergens).values(allergens.map((a) => ({ itemId, allergen: a }))).run();

	// Replace option groups (and their options, via cascade) wholesale, then re-insert.
	tx.delete(optionGroups).where(eq(optionGroups.itemId, itemId)).run();
	let groupSort = 0;
	for (const group of groups) {
		const spec = tx
			.insert(optionGroups)
			.values({ itemId, name: group.name, kind: group.kind, required: group.required, minSelect: group.minSelect, maxSelect: group.maxSelect, sortOrder: groupSort++ })
			.returning()
			.get();
		let optionSort = 0;
		tx.insert(options)
			.values(group.options.map((o) => ({ groupId: spec.id, name: o.name, priceDelta: o.priceDelta, isAvailable: o.isAvailable, sortOrder: optionSort++ })))
			.run();
	}
}

// ---------- Items ----------

export function createItem(db: DB, input: ItemInput, user: { role: string } | null) {
	requireOwner(user);
	const cat = db.select().from(categories).where(eq(categories.id, input.categoryId)).get();
	if (!cat) throw new HttpError(404, 'دسته‌ی والد پیدا نشد.');
	const next = db.select({ m: max(items.sortOrder) }).from(items).where(eq(items.categoryId, input.categoryId)).get()?.m ?? 0;

	const row = db.transaction((tx) => {
		const item = tx
			.insert(items)
			.values({
				categoryId: input.categoryId,
				name: input.name,
				description: input.description,
				basePrice: input.basePrice,
				isAvailable: input.isAvailable,
				isNew: input.isNew,
				isBestseller: input.isBestseller,
				sortOrder: next + 1
			})
			.returning()
			.get();
		writeChildren(tx, item.id, input.tags, input.allergens, input.groups);
		return item;
	});
	return row;
}

export function updateItem(db: DB, id: number, input: ItemInput, user: { role: string } | null) {
	requireOwner(user);
	const existing = db.select().from(items).where(eq(items.id, id)).get();
	if (!existing) throw new HttpError(404, 'آیتم پیدا نشد.');
	const cat = db.select().from(categories).where(eq(categories.id, input.categoryId)).get();
	if (!cat) throw new HttpError(404, 'دسته‌ی والد پیدا نشد.');

	const row = db.transaction((tx) => {
		const item = tx
			.update(items)
			.set({
				categoryId: input.categoryId,
				name: input.name,
				description: input.description,
				basePrice: input.basePrice,
				isAvailable: input.isAvailable,
				isNew: input.isNew,
				isBestseller: input.isBestseller
			})
			.where(eq(items.id, id))
			.returning()
			.get();
		writeChildren(tx, id, input.tags, input.allergens, input.groups);
		return item;
	});
	return row;
}

export function deleteItem(db: DB, id: number, user: { role: string } | null) {
	requireOwner(user);
	const result = db.delete(items).where(eq(items.id, id)).run();
	if (result.changes === 0) throw new HttpError(404, 'آیتم پیدا نشد.');
	return { ok: true };
}

export function deleteCategory(db: DB, id: number, user: { role: string } | null) {
	requireOwner(user);
	const hasItems = db.select({ id: items.id }).from(items).where(eq(items.categoryId, id)).get();
	if (hasItems) throw new HttpError(409, 'اول آیتم‌های این دسته را حذف یا جابه‌جا کنید.');
	const result = db.delete(categories).where(eq(categories.id, id)).run();
	if (result.changes === 0) throw new HttpError(404, 'دسته پیدا نشد.');
	return { ok: true };
}

// ---------- Options quick edit ----------

export function updateOption(db: DB, id: number, body: unknown, user: { role: string } | null) {
	requireOwner(user);
	if (!isRecord(body)) throw new HttpError(400, 'داده‌ی ارسالی معتبر نیست.');
	const patch: { name?: string; priceDelta?: number; isAvailable?: boolean } = {};
	if (body.name !== undefined) patch.name = str(body.name, 'نام گزینه') ?? '';
	if (body.priceDelta !== undefined) patch.priceDelta = int(body.priceDelta, 'اختلاف قیمت', -MAX_PRICE, MAX_PRICE);
	if (body.isAvailable !== undefined) patch.isAvailable = bool(body.isAvailable, 'موجود بودن گزینه');
	if (Object.keys(patch).length === 0) throw new HttpError(400, 'چیزی برای تغییر ارسال نشده است.');
	const row = db.update(options).set(patch).where(eq(options.id, id)).returning().get();
	if (!row) throw new HttpError(404, 'گزینه پیدا نشد.');
	return row;
}

// ---------- Admin reads ----------

export type AdminOption = { id: number; name: string; priceDelta: number; isAvailable: boolean };
export type AdminGroup = { id: number; name: string; kind: string; required: boolean; minSelect: number; maxSelect: number; options: AdminOption[] };
export type AdminItem = {
	id: number;
	categoryId: number;
	name: string;
	description: string | null;
	basePrice: number;
	isAvailable: boolean;
	isNew: boolean;
	isBestseller: boolean;
	tags: string[];
	allergens: string[];
	groups: AdminGroup[];
};
export type AdminCategory = { id: number; name: string; sortOrder: number; isActive: boolean; items: AdminItem[] };

export function getAdminMenu(db: DB): AdminCategory[] {
	const cats = db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id)).all();
	const allItems = db.select().from(items).orderBy(asc(items.sortOrder), asc(items.id)).all();
	const groups = db.select().from(optionGroups).orderBy(asc(optionGroups.sortOrder), asc(optionGroups.id)).all();
	const opts = db.select().from(options).orderBy(asc(options.sortOrder), asc(options.id)).all();
	const tags = db.select().from(itemTags).all();
	const allergens = db.select().from(itemAllergens).all();

	const optsByGroup = new Map<number, AdminOption[]>();
	for (const o of opts) {
		const list = optsByGroup.get(o.groupId) ?? [];
		list.push({ id: o.id, name: o.name, priceDelta: o.priceDelta, isAvailable: o.isAvailable });
		optsByGroup.set(o.groupId, list);
	}
	const groupsByItem = new Map<number, AdminGroup[]>();
	for (const g of groups) {
		const list = groupsByItem.get(g.itemId) ?? [];
		list.push({ id: g.id, name: g.name, kind: g.kind, required: g.required, minSelect: g.minSelect, maxSelect: g.maxSelect, options: optsByGroup.get(g.id) ?? [] });
		groupsByItem.set(g.itemId, list);
	}
	const tagsByItem = new Map<number, string[]>();
	for (const t of tags) {
		const list = tagsByItem.get(t.itemId) ?? [];
		list.push(t.tag);
		tagsByItem.set(t.itemId, list);
	}
	const allergensByItem = new Map<number, string[]>();
	for (const a of allergens) {
		const list = allergensByItem.get(a.itemId) ?? [];
		list.push(a.allergen);
		allergensByItem.set(a.itemId, list);
	}

	return cats.map((c) => ({
		id: c.id,
		name: c.name,
		sortOrder: c.sortOrder,
		isActive: c.isActive,
		items: allItems
			.filter((i) => i.categoryId === c.id)
			.map((i) => ({
				id: i.id,
				categoryId: i.categoryId,
				name: i.name,
				description: i.description,
				basePrice: i.basePrice,
				isAvailable: i.isAvailable,
				isNew: i.isNew,
				isBestseller: i.isBestseller,
				tags: tagsByItem.get(i.id) ?? [],
				allergens: allergensByItem.get(i.id) ?? [],
				groups: groupsByItem.get(i.id) ?? []
			}))
	}));
}

// ---------- Tables ----------

export function listTables(db: DB) {
	return db.select().from(cafeTables).orderBy(asc(cafeTables.number)).all();
}
