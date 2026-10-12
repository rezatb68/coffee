import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { DB } from './db';
import { feedbackRatings, orderItems, orders } from './db/schema';

export type Bucket = 'day' | 'week' | 'month';

const RANGE_MS: Record<Bucket, number> = {
	day: 30 * 86_400_000,
	week: 12 * 7 * 86_400_000,
	month: 12 * 30 * 86_400_000
};

/**为什么不直接用 SQL date(): sqlite strftime('%Y-%m-%d', created_at/1000,'unixepoch') — clean and index-friendly enough for a small DB. */
function bucketExpr(bucket: Bucket) {
	if (bucket === 'day') return sql`strftime('%Y-%m-%d', ${orders.createdAt} / 1000, 'unixepoch', 'localtime')`;
	if (bucket === 'week') return sql`strftime('%Y-%W', ${orders.createdAt} / 1000, 'unixepoch', 'localtime')`;
	return sql`strftime('%Y-%m', ${orders.createdAt} / 1000, 'unixepoch', 'localtime')`;
}

export type SalesSeries = { bucket: string; orders: number; revenue: number };

export function salesSeries(db: DB, bucket: Bucket): SalesSeries[] {
	const since = Date.now() - RANGE_MS[bucket];
	const paidOnly = sql`${orders.paymentStatus} = 'paid' OR ${orders.paymentStatus} = 'unpaid_in_person' AND ${orders.status} = 'served'`;
	const rows = db
		.select({
			bucket: sql<string>`${bucketExpr(bucket)}`,
			orders: sql<number>`count(*)`,
			revenue: sql<number>`coalesce(sum(${orders.total}), 0)`
		})
		.from(orders)
		.where(and(gte(orders.createdAt, since), sql`${orders.status} != 'cancelled'`, paidOnly))
		.groupBy(bucketExpr(bucket))
		.orderBy(sql`1 desc`)
		.all();
	return rows.map((r) => {
		const b = r.bucket as unknown;
		return { bucket: typeof b === 'string' ? b : String(b), orders: Number(r.orders), revenue: Number(r.revenue) };
	});
}

export type Bestseller = { itemId: number | null; name: string; qty: number; revenue: number };

export function bestsellers(db: DB, days = 30): Bestseller[] {
	const since = Date.now() - days * 86_400_000;
	const rows = db
		.select({
			itemId: orderItems.itemId,
			name: orderItems.itemName,
			qty: sql<number>`sum(${orderItems.qty})`,
			revenue: sql<number>`sum(${orderItems.lineTotal})`
		})
		.from(orderItems)
		.innerJoin(orders, eq(orderItems.orderId, orders.id))
		.where(and(gte(orders.createdAt, since), sql`${orders.status} != 'cancelled'`))
		.groupBy(orderItems.itemId, orderItems.itemName)
		.orderBy(sql`3 desc`)
		.limit(10)
		.all();
	return rows.map((r) => ({ itemId: r.itemId, name: r.name, qty: Number(r.qty), revenue: Number(r.revenue) }));
}

export type HourCount = { hour: number; orders: number };

export function busyHours(db: DB, days = 30): HourCount[] {
	const since = Date.now() - days * 86_400_000;
	const rows = db
		.select({ hour: sql<number>`cast(strftime('%H', ${orders.createdAt} / 1000, 'unixepoch', 'localtime') as integer)`, orders: sql<number>`count(*)` })
		.from(orders)
		.where(gte(orders.createdAt, since))
		.groupBy(sql`1`)
		.orderBy(sql`1`)
		.all();
	return rows.map((r) => ({ hour: Number(r.hour), orders: Number(r.orders) }));
}

export function paymentSplit(db: DB, days = 30) {
	const since = Date.now() - days * 86_400_000;
	const rows = db
		.select({ method: orders.paymentMethod, orders: sql<number>`count(*)`, revenue: sql<number>`coalesce(sum(${orders.total}),0)` })
		.from(orders)
		.where(and(gte(orders.createdAt, since), sql`${orders.status} != 'cancelled'`))
		.groupBy(orders.paymentMethod)
		.all();
	return rows.map((r) => ({ method: r.method, orders: Number(r.orders), revenue: Number(r.revenue) }));
}

export function avgRating(db: DB, days = 30) {
	const since = Date.now() - days * 86_400_000;
	const row = db
		.select({ avg: sql<number>`coalesce(avg(${feedbackRatings.stars}), 0)`, count: sql<number>`count(*)` })
		.from(feedbackRatings)
		.where(gte(feedbackRatings.createdAt, since))
		.get();
	return { avg: Number(row?.avg ?? 0), count: Number(row?.count ?? 0) };
}

export function csvEscape(value: string): string {
	if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
	return value;
}
