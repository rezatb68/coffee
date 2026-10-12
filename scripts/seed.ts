// Usage: npx tsx scripts/seed.ts            (fails if data exists)
//        npx tsx scripts/seed.ts --reset    (clears menu, orders and staff, then seeds)
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { getDb } from '../src/lib/server/db';
import * as s from '../src/lib/server/db/schema';
import { hashPassword } from '../src/lib/server/auth';

const db = getDb();
const reset = process.argv.includes('--reset');

if (db.select().from(s.staffUsers).all().length > 0 || db.select().from(s.items).all().length > 0) {
	if (!reset) {
		console.error('داده از قبل وجود دارد. برای بازسازی از --reset استفاده کنید.');
		process.exit(1);
	}
	db.transaction((tx) => {
		tx.delete(s.callRequests).run();
		tx.delete(s.orderEvents).run();
		tx.delete(s.orderItems).run();
		tx.delete(s.orders).run();
		tx.delete(s.sessions).run();
		tx.delete(s.staffUsers).run();
		tx.delete(s.options).run();
		tx.delete(s.optionGroups).run();
		tx.delete(s.itemTags).run();
		tx.delete(s.itemAllergens).run();
		tx.delete(s.items).run();
		tx.delete(s.categories).run();
		tx.delete(s.cafeTables).run();
	});
}

const now = Date.now();

db.update(s.cafeSettings)
	.set({
		name: 'کافه ماهور',
		tagline: 'قهوه‌ی تازه، هر روز',
		primaryColor: '#6f4e37',
		currencyUnit: 'toman',
		taxPercent: 0,
		servicePercent: 0,
		orderingEnabled: true,
		requireApproval: true,
		updatedAt: now
	})
	.where(eq(s.cafeSettings.id, 1))
	.run();

type OptionDef = { name: string; priceDelta?: number };
type GroupDef = { name: string; kind: 'single' | 'multi'; required?: boolean; min?: number; max?: number; options: OptionDef[] };
type ItemDef = {
	name: string;
	description: string;
	price: number;
	isNew?: boolean;
	isBestseller?: boolean;
	isAvailable?: boolean;
	tags?: ('vegan' | 'gluten_free' | 'spicy')[];
	allergens?: string[];
	groups?: GroupDef[];
};
type CategoryDef = { name: string; items: ItemDef[] };

const SIZE: GroupDef = {
	name: 'سایز',
	kind: 'single',
	required: true,
	options: [
		{ name: 'کوچک', priceDelta: 0 },
		{ name: 'متوسط', priceDelta: 20000 },
		{ name: 'بزرگ', priceDelta: 35000 }
	]
};
const MILK: GroupDef = {
	name: 'نوع شیر',
	kind: 'single',
	required: true,
	options: [
		{ name: 'شیر معمولی', priceDelta: 0 },
		{ name: 'شیر بادام', priceDelta: 30000 },
		{ name: 'شیر سویا', priceDelta: 25000 },
		{ name: 'شیر یولاف', priceDelta: 30000 }
	]
};
const SUGAR: GroupDef = {
	name: 'میزان شکر',
	kind: 'single',
	options: [{ name: 'بدون شکر' }, { name: 'کم' }, { name: 'معمولی' }, { name: 'زیاد' }]
};
const EXTRAS: GroupDef = {
	name: 'افزودنی',
	kind: 'multi',
	min: 0,
	max: 3,
	options: [
		{ name: 'شات وانیل', priceDelta: 20000 },
		{ name: 'شات کارامل', priceDelta: 20000 },
		{ name: 'خامه‌ی روی فنجان', priceDelta: 15000 }
	]
};

const MENU: CategoryDef[] = [
	{
		name: 'قهوه‌های گرم',
		items: [
			{
				name: 'اسپرسو',
				description: 'شات اسپرسوی تازه‌دم با طعم کاراملی ملایم',
				price: 85000,
				groups: [
					{
						name: 'تعداد شات',
						kind: 'single',
						required: true,
						options: [{ name: 'تک شات' }, { name: 'دوبل', priceDelta: 25000 }]
					}
				]
			},
			{
				name: 'کاپوچینو',
				description: 'اسپرسو با شیر بخارداده و فوم نرم',
				price: 145000,
				isBestseller: true,
				allergens: ['لبنیات'],
				groups: [SIZE, MILK, SUGAR, EXTRAS]
			},
			{
				name: 'لته',
				description: 'اسپرسو با شیر تازه و فوم کم',
				price: 155000,
				isNew: true,
				allergens: ['لبنیات'],
				groups: [SIZE, MILK, SUGAR]
			},
			{
				name: 'موکا',
				description: 'اسپرسو، شکلات تلخ و شیر',
				price: 170000,
				allergens: ['لبنیات'],
				groups: [SIZE, MILK]
			},
			{
				name: 'قهوه‌ی ترک',
				description: 'دم‌شده در فنجان سنتی، شکر جدا',
				price: 95000,
				tags: ['vegan'],
				groups: [SUGAR]
			}
		]
	},
	{
		name: 'قهوه‌های سرد',
		items: [
			{
				name: 'آیس لته',
				description: 'اسپرسو، شیر سرد و یخ',
				price: 165000,
				isBestseller: true,
				allergens: ['لبنیات'],
				groups: [SIZE, MILK]
			},
			{
				name: 'کلد برو',
				description: 'دم سرد ۱۶ ساعته با طعم شکلاتی و ملایم',
				price: 140000,
				tags: ['vegan'],
				groups: [SIZE]
			},
			{
				name: 'فراپه‌ی کارامل',
				description: 'اسپرسو، شیر، یخ خرد و سس کارامل',
				price: 185000,
				isNew: true,
				allergens: ['لبنیات'],
				groups: [SIZE, MILK]
			}
		]
	},
	{
		name: 'چای و دمنوش',
		items: [
			{ name: 'چای سیاه ایرانی', description: 'دم‌شده در قوری، با نعنا یا بدون آن', price: 65000, tags: ['vegan'], groups: [SUGAR] },
			{ name: 'چای سبز نعناع', description: 'چای سبز با برگ نعناع تازه', price: 75000, tags: ['vegan'] },
			{ name: 'دمنوش بابونه', description: 'بابونه‌ی خشک‌شده با عسل طبیعی', price: 85000, tags: ['vegan'] },
			{ name: 'دمنوش به‌لیمو', description: 'به‌لیمو خشک با طعم ملایم', price: 85000, tags: ['vegan'], isAvailable: false }
		]
	},
	{
		name: 'نوشیدنی‌های بدون کافئین',
		items: [
			{ name: 'لیموناد نعنا', description: 'لیمو تازه، نعنا و یخ', price: 110000, isNew: true, tags: ['vegan', 'gluten_free'] },
			{ name: 'آب‌پرتقال طبیعی', description: 'پرتقال تازه‌فشرده، بدون شکر اضافه', price: 150000, tags: ['vegan', 'gluten_free'] },
			{ name: 'شیرکاکائوی داغ', description: 'کاکائوی تلخ با شیر و خامه', price: 135000, allergens: ['لبنیات'] }
		]
	},
	{
		name: 'کیک و دسر',
		items: [
			{ name: 'چیزکیک نیویورکی', description: 'پای ساده با سس توت‌فرنگی', price: 195000, isBestseller: true, allergens: ['گلوتن', 'لبنیات', 'تخم‌مرغ'] },
			{ name: 'براونی شکلاتی', description: 'با گردو، سرو گرم', price: 145000, allergens: ['گلوتن', 'آجیل', 'تخم‌مرغ'] },
			{ name: 'کیک هویج', description: 'با کرم پنیر و گردو', price: 160000, allergens: ['گلوتن', 'لبنیات', 'آجیل'] },
			{ name: 'موس شکلات', description: 'موس شکلات تلخ، بدون گلوتن', price: 190000, tags: ['gluten_free'], allergens: ['لبنیات'] }
		]
	},
	{
		name: 'صبحانه',
		items: [
			{
				name: 'صبحانه‌ی ایرانی',
				description: 'پنیر، گردو، کره، عسل، نان تازه و گوجه',
				price: 240000,
				isBestseller: true,
				allergens: ['گلوتن', 'لبنیات', 'آجیل']
			},
			{
				name: 'شکشوکه',
				description: 'تخم‌مرغ با گوجه، فلفل تند و نان',
				price: 135000,
				tags: ['spicy'],
				allergens: ['تخم‌مرغ', 'گلوتن']
			}
		]
	}
];

db.transaction((tx) => {
	MENU.forEach((cat, ci) => {
		const catId = tx.insert(s.categories).values({ name: cat.name, sortOrder: ci }).returning().get().id;
		cat.items.forEach((it, ii) => {
			const itemId = tx
				.insert(s.items)
				.values({
					categoryId: catId,
					name: it.name,
					description: it.description,
					basePrice: it.price,
					isAvailable: it.isAvailable ?? true,
					isNew: it.isNew ?? false,
					isBestseller: it.isBestseller ?? false,
					sortOrder: ii
				})
				.returning()
				.get().id;

			for (const tag of it.tags ?? []) tx.insert(s.itemTags).values({ itemId, tag }).run();
			for (const allergen of it.allergens ?? []) tx.insert(s.itemAllergens).values({ itemId, allergen }).run();

			(it.groups ?? []).forEach((g, gi) => {
				const groupId = tx
					.insert(s.optionGroups)
					.values({
						itemId,
						name: g.name,
						kind: g.kind,
						required: g.required ?? false,
						minSelect: g.min ?? (g.required ? 1 : 0),
						maxSelect: g.max ?? 1,
						sortOrder: gi
					})
					.returning()
					.get().id;
				g.options.forEach((o, oi) => {
					tx.insert(s.options)
						.values({ groupId, name: o.name, priceDelta: o.priceDelta ?? 0, sortOrder: oi })
						.run();
				});
			});
		});
	});

	for (let n = 1; n <= 12; n++) tx.insert(s.cafeTables).values({ number: n }).run();
});

function generatePassword(): string {
	return randomBytes(9).toString('base64url');
}

const staff = [
	{ username: 'admin', name: 'مدیر کافه', role: 'owner' as const },
	{ username: 'sandoogh', name: 'صندوق', role: 'cashier' as const },
	{ username: 'bar', name: 'بار', role: 'kitchen' as const }
];

const printed: string[] = [];
for (const user of staff) {
	const password = generatePassword();
	db.insert(s.staffUsers)
		.values({
			username: user.username,
			name: user.name,
			role: user.role,
			passwordHash: await hashPassword(password),
			createdAt: now
		})
		.run();
	printed.push(`${user.role.padEnd(8)} ${user.username.padEnd(10)} ${password}`);
}

const itemCount = MENU.reduce((n, c) => n + c.items.length, 0);
console.log(`منوی نمونه ساخته شد: ${MENU.length} دسته، ${itemCount} آیتم، ۱۲ میز.`);
console.log('حساب‌های کارکنان (این رمزها فقط یک‌بار نمایش داده می‌شوند):');
console.log(printed.join('\n'));
