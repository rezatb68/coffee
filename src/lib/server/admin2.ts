import { asc, eq } from 'drizzle-orm';
import type { DB } from './db';
import { cafeTables, staffUsers } from './db/schema';
import { HttpError, isRecord } from './http';
import { hashPassword } from './auth';

function requireOwner(user: { role: string } | null | undefined): void {
	if (!user || user.role !== 'owner') throw new HttpError(403, 'فقط مدیر کافه به این بخش دسترسی دارد.');
}

// ---------- Tables ----------

export function listTables(db: DB) {
	return db.select().from(cafeTables).orderBy(asc(cafeTables.number)).all();
}

export function upsertTable(db: DB, body: unknown, user: { role: string } | null) {
	requireOwner(user);
	if (!isRecord(body)) throw new HttpError(400, 'داده‌ی ارسالی معتبر نیست.');
	const number = typeof body.number === 'number' && Number.isInteger(body.number) && body.number > 0 && body.number < 1000 ? body.number : null;
	if (!number) throw new HttpError(400, 'شماره میز معتبر نیست.');
	const isActive = body.isActive === undefined ? true : body.isActive === true;
	const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim() : null;
	const existing = db.select().from(cafeTables).where(eq(cafeTables.number, number)).get();
	if (existing) {
		return db.update(cafeTables).set({ isActive, label: label ?? existing.label }).where(eq(cafeTables.id, existing.id)).returning().get();
	}
	return db.insert(cafeTables).values({ number, isActive, label }).returning().get();
}

// ---------- Users management ----------

export function listUsers(db: DB, user: { role: string } | null) {
	requireOwner(user);
	return db
		.select({ id: staffUsers.id, name: staffUsers.name, username: staffUsers.username, role: staffUsers.role, isActive: staffUsers.isActive })
		.from(staffUsers)
		.orderBy(asc(staffUsers.id))
		.all();
}

export async function createUser(db: DB, body: unknown, user: { role: string } | null, password: string) {
	requireOwner(user);
	if (!isRecord(body)) throw new HttpError(400, 'داده‌ی ارسالی معتبر نیست.');
	const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;
	const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : null;
	const role = body.role === 'owner' || body.role === 'cashier' || body.role === 'kitchen' ? body.role : null;
	if (!name || !username || !role) throw new HttpError(400, 'نام، نام کاربری و نقش لازم است.');
	if (!/^[a-z0-9_-]{3,32}$/.test(username)) throw new HttpError(400, 'نام کاربری باید ۳ تا ۳۲ نویسه‌ی لاتین/عدد باشد.');
	if (password.length < 8) throw new HttpError(400, 'رمز عبور حداقل ۸ نویسه باشد.');
	const exists = db.select().from(staffUsers).where(eq(staffUsers.username, username)).get();
	if (exists) throw new HttpError(409, 'این نام کاربری قبلاً ثبت شده است.');
	const passwordHash = await hashPassword(password);
	return db
		.insert(staffUsers)
		.values({ name, username, role, passwordHash, isActive: true, createdAt: Date.now() })
		.returning()
		.get();
}

export async function setPassword(db: DB, userId: number, password: string, user: { role: string } | null) {
	requireOwner(user);
	if (password.length < 8) throw new HttpError(400, 'رمز عبور حداقل ۸ نویسه باشد.');
	const passwordHash = await hashPassword(password);
	return db.update(staffUsers).set({ passwordHash, failedAttempts: 0, lockedUntil: null }).where(eq(staffUsers.id, userId)).returning().get();
}

export function toggleUserActive(db: DB, userId: number, isActive: boolean, user: { role: string } | null) {
	requireOwner(user);
	return db.update(staffUsers).set({ isActive }).where(eq(staffUsers.id, userId)).returning().get();
}

// ---------- CSV menu import ----------

export type ImportRow = { categoryId: number | null; categoryName: string; name: string; description: string | null; basePrice: number; tags: string[]; allergens: string[] };

/** Parses a CSV: header را می‌پذیریم: name,category,price,description,tags,allergens */
export function parseMenuCsv(text: string): ImportRow[] {
	const lines = text.split(/\r?\n/).filter((l) => l.trim());
	if (lines.length === 0) return [];
	let start = 0;
	const first = lines[0];
	if (/name|نام/i.test(first) && /,/.test(first)) start = 1;
	const rows: ImportRow[] = [];
	for (const line of lines.slice(start)) {
		const cols = line.split(',').map((c) => c.trim());
		if (cols.length < 2) continue;
		const [name, category, price, description, tags, allergens] = cols;
		if (!name) continue;
		const priceNum = parseInt(price?.replace(/[^\d]/g, '') ?? '0', 10) || 0;
		rows.push({
			categoryId: null,
			categoryName: category || 'بدون دسته',
			name,
			description: description || null,
			basePrice: priceNum,
			tags: tags ? tags.split(/[|;]/).map((t) => t.trim()).filter(Boolean) : [],
			allergens: allergens ? allergens.split(/[|;]/).map((a) => a.trim()).filter(Boolean) : []
		});
	}
	return rows;
}
