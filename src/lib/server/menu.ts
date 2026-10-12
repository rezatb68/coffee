import { and, asc, eq, inArray } from 'drizzle-orm';
import type { DB } from './db';
import { cafeSettings, cafeTables, categories, itemAllergens, itemTags, items, optionGroups, options } from './db/schema';
import type { CafeInfo, MenuCategory, MenuGroup, MenuItem, MenuOption } from '../shared/types';
import { ensureTrial } from './license';

export function getSettingsRow(db: DB) {
	ensureTrial(db);
	const row = db.select().from(cafeSettings).where(eq(cafeSettings.id, 1)).get();
	if (!row) throw new Error('cafe_settings row is missing');
	return row;
}

export function getCafeInfo(db: DB): CafeInfo {
	const s = getSettingsRow(db);
	return {
		name: s.name,
		tagline: s.tagline,
		primaryColor: s.primaryColor,
		theme: s.theme as CafeInfo['theme'],
		currencyUnit: s.currencyUnit,
		orderingEnabled: s.orderingEnabled,
		requireApproval: s.requireApproval,
		taxPercent: s.taxPercent,
		servicePercent: s.servicePercent,
		menuLayout: s.menuLayout as CafeInfo['menuLayout'],
		cornerStyle: s.cornerStyle as CafeInfo['cornerStyle'],
		welcomeMessage: s.welcomeMessage,
		faDigits: s.faDigits,
		secondLanguage: s.secondLanguage,
		workingHours: s.workingHours,
		enableOnlinePay: s.enableOnlinePay,
		enableInPersonPay: s.enableInPersonPay,
		enableTakeaway: s.enableTakeaway,
		enableRatings: s.enableRatings
	};
}

export function findActiveTable(db: DB, number: number): { id: number; number: number } | null {
	return (
		db
			.select({ id: cafeTables.id, number: cafeTables.number })
			.from(cafeTables)
			.where(and(eq(cafeTables.number, number), eq(cafeTables.isActive, true)))
			.get() ?? null
	);
}

export function getMenu(db: DB): MenuCategory[] {
	const cats = db
		.select()
		.from(categories)
		.where(eq(categories.isActive, true))
		.orderBy(asc(categories.sortOrder), asc(categories.id))
		.all();
	const activeCatIds = new Set(cats.map((c) => c.id));
	const itemRows = db
		.select()
		.from(items)
		.orderBy(asc(items.sortOrder), asc(items.id))
		.all()
		.filter((i) => activeCatIds.has(i.categoryId));

	const itemIds = itemRows.map((i) => i.id);
	const tagsByItem = new Map<number, string[]>();
	const allergensByItem = new Map<number, string[]>();
	const groupsByItem = new Map<number, MenuGroup[]>();

	if (itemIds.length > 0) {
		for (const t of db.select().from(itemTags).where(inArray(itemTags.itemId, itemIds)).all()) {
			tagsByItem.set(t.itemId, [...(tagsByItem.get(t.itemId) ?? []), t.tag]);
		}
		for (const a of db.select().from(itemAllergens).where(inArray(itemAllergens.itemId, itemIds)).all()) {
			allergensByItem.set(a.itemId, [...(allergensByItem.get(a.itemId) ?? []), a.allergen]);
		}

		const groupRows = db
			.select()
			.from(optionGroups)
			.where(inArray(optionGroups.itemId, itemIds))
			.orderBy(asc(optionGroups.sortOrder), asc(optionGroups.id))
			.all();
		const groupIds = groupRows.map((g) => g.id);
		const optionRows =
			groupIds.length > 0
				? db
						.select()
						.from(options)
						.where(inArray(options.groupId, groupIds))
						.orderBy(asc(options.sortOrder), asc(options.id))
						.all()
				: [];

		const optionsByGroup = new Map<number, MenuOption[]>();
		for (const o of optionRows) {
			const list = optionsByGroup.get(o.groupId) ?? [];
			list.push({ id: o.id, name: o.name, priceDelta: o.priceDelta, isAvailable: o.isAvailable });
			optionsByGroup.set(o.groupId, list);
		}
		for (const g of groupRows) {
			const list = groupsByItem.get(g.itemId) ?? [];
			list.push({
				id: g.id,
				name: g.name,
				kind: g.kind,
				required: g.required,
				minSelect: g.minSelect,
				maxSelect: g.maxSelect,
				options: optionsByGroup.get(g.id) ?? []
			});
			groupsByItem.set(g.itemId, list);
		}
	}

	const toMenuItem = (i: (typeof itemRows)[number]): MenuItem => ({
		id: i.id,
		name: i.name,
		description: i.description,
		basePrice: i.basePrice,
		isAvailable: i.isAvailable,
		isNew: i.isNew,
		isBestseller: i.isBestseller,
		tags: tagsByItem.get(i.id) ?? [],
		allergens: allergensByItem.get(i.id) ?? [],
		groups: groupsByItem.get(i.id) ?? []
	});

	return cats.map((c) => ({
		id: c.id,
		name: c.name,
		items: itemRows.filter((i) => i.categoryId === c.id).map(toMenuItem)
	}));
}
