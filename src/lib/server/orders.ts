import { and, asc, desc, eq, gte, inArray, or } from 'drizzle-orm';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { hashToken, type SessionUser } from './auth';
import { getTrialStatus } from './license';
import type { DB } from './db';
import { getDb } from './db';
import { cafeTables, callRequests, items, optionGroups, options, orderEvents, orderItems, orders } from './db/schema';
import { HttpError, isRecord } from './http';
import { findActiveTable, getSettingsRow } from './menu';
import {
	assertAction,
	computeTotals,
	parseCallInput,
	parseOrderAction,
	parseOrderInput,
	priceLines,
	type CatalogItem,
	type OrderInput
} from './order-rules';
import { hitRateLimit } from './rate-limit';
import { publish } from './realtime';
import { ACTION_RULES, type OrderStatus, type Role } from '../shared/status';
import type { OrderDetail, OrderDetailOption, PanelCall, PanelSnapshot } from '../shared/types';

type OrderRow = typeof orders.$inferSelect;
type LineRow = typeof orderItems.$inferSelect;
type EventRow = typeof orderEvents.$inferSelect;

const CODE_WINDOW_MS = 12 * 60 * 60 * 1000;
const PANEL_WINDOW_MS = 24 * 60 * 60 * 1000;
const TEN_MINUTES = 10 * 60 * 1000;

function loadCatalog(db: DB, itemIds: number[]): Map<number, CatalogItem> {
	const catalog = new Map<number, CatalogItem>();
	if (itemIds.length === 0) return catalog;

	const itemRows = db.select().from(items).where(inArray(items.id, itemIds)).all();
	const groupRows = db.select().from(optionGroups).where(inArray(optionGroups.itemId, itemIds)).all();
	const groupIds = groupRows.map((g) => g.id);
	const optionRows =
		groupIds.length > 0 ? db.select().from(options).where(inArray(options.groupId, groupIds)).all() : [];

	for (const it of itemRows) {
		catalog.set(it.id, {
			id: it.id,
			name: it.name,
			basePrice: it.basePrice,
			isAvailable: it.isAvailable,
			groups: groupRows
				.filter((g) => g.itemId === it.id)
				.map((g) => ({
					id: g.id,
					name: g.name,
					kind: g.kind,
					required: g.required,
					minSelect: g.minSelect,
					maxSelect: g.maxSelect,
					options: optionRows
						.filter((o) => o.groupId === g.id)
						.map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta, isAvailable: o.isAvailable }))
				}))
		});
	}
	return catalog;
}

function newPublicCode(db: DB): string {
	const since = Date.now() - CODE_WINDOW_MS;
	for (let attempt = 0; attempt < 20; attempt++) {
		const code = String(randomInt(1000, 10000));
		const taken = db
			.select({ id: orders.id })
			.from(orders)
			.where(and(eq(orders.publicCode, code), gte(orders.createdAt, since)))
			.get();
		if (!taken) return code;
	}
	throw new HttpError(503, 'ثبت سفارش در این لحظه ممکن نیست. دوباره تلاش کنید.');
}

function parseStoredOptions(json: string): OrderDetailOption[] {
	try {
		const parsed: unknown = JSON.parse(json);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isRecord).map((o) => ({
			name: String(o.name ?? ''),
			priceDelta: Number(o.priceDelta ?? 0)
		}));
	} catch {
		return [];
	}
}

/** Builds order DTOs for many orders with a fixed number of queries. */
export function loadDetails(db: DB, rows: OrderRow[]): OrderDetail[] {
	if (rows.length === 0) return [];
	const ids = rows.map((r) => r.id);
	const tableIds = [...new Set(rows.map((r) => r.tableId).filter((x): x is number => x !== null))];

	const tableNumbers = new Map<number, number>();
	if (tableIds.length > 0) {
		for (const t of db
			.select({ id: cafeTables.id, number: cafeTables.number })
			.from(cafeTables)
			.where(inArray(cafeTables.id, tableIds))
			.all()) {
			tableNumbers.set(t.id, t.number);
		}
	}

	const linesByOrder = new Map<string, LineRow[]>();
	for (const l of db.select().from(orderItems).where(inArray(orderItems.orderId, ids)).orderBy(asc(orderItems.id)).all()) {
		linesByOrder.set(l.orderId, [...(linesByOrder.get(l.orderId) ?? []), l]);
	}

	const eventsByOrder = new Map<string, EventRow[]>();
	for (const e of db.select().from(orderEvents).where(inArray(orderEvents.orderId, ids)).orderBy(asc(orderEvents.id)).all()) {
		eventsByOrder.set(e.orderId, [...(eventsByOrder.get(e.orderId) ?? []), e]);
	}

	return rows.map((r) => ({
		id: r.id,
		publicCode: r.publicCode,
		status: r.status,
		channel: r.channel,
		tableNumber: r.tableId === null ? null : (tableNumbers.get(r.tableId) ?? null),
		paymentMethod: r.paymentMethod,
		paymentStatus: r.paymentStatus,
		subtotal: r.subtotal,
		taxAmount: r.taxAmount,
		serviceAmount: r.serviceAmount,
		total: r.total,
		note: r.note,
		createdAt: r.createdAt,
		updatedAt: r.updatedAt,
		items: (linesByOrder.get(r.id) ?? []).map((l) => ({
			id: l.id,
			name: l.itemName,
			qty: l.qty,
			unitPrice: l.unitPrice,
			lineTotal: l.lineTotal,
			note: l.note,
			options: parseStoredOptions(l.optionsJson)
		})),
		events: (eventsByOrder.get(r.id) ?? []).map((e) => ({ toStatus: e.toStatus, at: e.at }))
	}));
}

export function loadOrderDetail(db: DB, orderId: string): OrderDetail {
	const row = db.select().from(orders).where(eq(orders.id, orderId)).get();
	if (!row) throw new HttpError(404, 'سفارش پیدا نشد.');
	return loadDetails(db, [row])[0];
}

export function placeOrder(body: unknown, ip: string): { id: string; publicCode: string; token: string; status: OrderStatus; total: number } {
	const input: OrderInput = parseOrderInput(body);
	const db = getDb();
	const settings = getSettingsRow(db);

	if (!settings.orderingEnabled) {
		throw new HttpError(403, 'سفارش‌گیری الان غیرفعال است. لطفاً به گارسون اطلاع دهید.');
	}
	if (getTrialStatus(db).mode === 'trial_expired') {
		throw new HttpError(403, 'دوره‌ی آزمایشی به پایان رسیده است. برای فعال‌سازی، مدیر کافه لایسنس را وارد کند.');
	}
	if (input.paymentMethod === 'online' && !settings.enableOnlinePay) {
		throw new HttpError(400, 'پرداخت آنلاین فعلاً فعال نیست. پرداخت حضوری را انتخاب کنید.');
	}
	if (input.paymentMethod === 'in_person' && !settings.enableInPersonPay) {
		throw new HttpError(400, 'پرداخت حضوری فعلاً فعال نیست.');
	}
	if (!hitRateLimit(`order:client:${input.clientId}`, 5, TEN_MINUTES) || !hitRateLimit(`order:ip:${ip}`, 120, TEN_MINUTES)) {
		throw new HttpError(429, 'سفارش‌های زیادی ثبت شده. چند دقیقه دیگر دوباره امتحان کنید.');
	}

	let tableId: number | null = null;
	if (input.tableNumber !== null) {
		const table = findActiveTable(db, input.tableNumber);
		if (!table) throw new HttpError(404, 'این میز پیدا نشد.');
		tableId = table.id;
	}

	const catalog = loadCatalog(db, [...new Set(input.lines.map((l) => l.itemId))]);
	const priced = priceLines(input.lines, catalog);
	const subtotal = priced.reduce((sum, l) => sum + l.lineTotal, 0);
	const totals = computeTotals(subtotal, settings.taxPercent, settings.servicePercent);

	const status: OrderStatus = !settings.requireApproval || input.paymentMethod === 'online' ? 'received' : 'awaiting_approval';
	const id = randomUUID();
	const token = randomBytes(24).toString('base64url');
	const now = Date.now();
	const publicCode = newPublicCode(db);

	db.transaction((tx) => {
		tx.insert(orders)
			.values({
				id,
				publicCode,
				tokenHash: hashToken(token),
				tableId,
				channel: input.channel,
				status,
			paymentMethod: input.paymentMethod,
			paymentStatus: input.paymentMethod === 'online' ? 'unpaid' : 'unpaid_in_person',
				subtotal: totals.subtotal,
				taxAmount: totals.taxAmount,
				serviceAmount: totals.serviceAmount,
				total: totals.total,
				note: input.note,
				clientId: input.clientId,
				createdAt: now,
				updatedAt: now
			})
			.run();
		tx.insert(orderItems)
			.values(
				priced.map((l) => ({
					orderId: id,
					itemId: l.itemId,
					itemName: l.itemName,
					unitPrice: l.unitPrice,
					qty: l.qty,
					optionsJson: JSON.stringify(l.options),
					note: l.note,
					lineTotal: l.lineTotal
				}))
			)
			.run();
		tx.insert(orderEvents).values({ orderId: id, fromStatus: null, toStatus: status, actorUserId: null, at: now }).run();
	});

	publish('panel', { type: 'order.upsert', data: loadOrderDetail(db, id) });
	return { id, publicCode, token, status, total: totals.total };
}

export function findOrderByAccess(db: DB, publicCode: string, token: string): OrderRow | null {
	return (
		db
			.select()
			.from(orders)
			.where(and(eq(orders.publicCode, publicCode), eq(orders.tokenHash, hashToken(token))))
			.orderBy(desc(orders.createdAt))
			.get() ?? null
	);
}

export function transitionOrder(orderId: string, body: unknown, actor: SessionUser): OrderDetail {
	const action = parseOrderAction(isRecord(body) ? body.action : undefined);
	const db = getDb();
	const row = db.select().from(orders).where(eq(orders.id, orderId)).get();
	if (!row) throw new HttpError(404, 'سفارش پیدا نشد.');

	assertAction(action, actor.role, row.status, row.paymentStatus);

	const rule = ACTION_RULES[action];
	const nextStatus = rule.to;
	const now = Date.now();
	// Guard against concurrent changes: the update only applies to the state we just read.
	const where = and(
		eq(orders.id, orderId),
		eq(orders.status, row.status),
		eq(orders.paymentStatus, row.paymentStatus)
	);

	db.transaction((tx) => {
		const result = nextStatus
			? tx.update(orders).set({ status: nextStatus, updatedAt: now }).where(where).run()
			: tx.update(orders).set({ paymentStatus: 'paid', updatedAt: now }).where(where).run();
		if (result.changes === 0) {
			throw new HttpError(409, 'وضعیت سفارش همزمان تغییر کرده است. صفحه را تازه کنید.');
		}
		if (nextStatus) {
			tx.insert(orderEvents)
				.values({ orderId, fromStatus: row.status, toStatus: nextStatus, actorUserId: actor.id, at: now })
				.run();
		}
	});

	const detail = loadOrderDetail(db, orderId);
	publish('panel', { type: 'order.upsert', data: detail });
	publish(`order:${orderId}`, { type: 'order.update', data: detail });
	return detail;
}

export function createCall(body: unknown, ip: string): PanelCall {
	const input = parseCallInput(body);
	if (!hitRateLimit(`call:ip:${ip}`, 60, TEN_MINUTES) || !hitRateLimit(`call:table:${input.tableNumber}:${input.kind}`, 3, 5 * 60 * 1000)) {
		throw new HttpError(429, 'درخواست شما ثبت شده است. کمی صبر کنید.');
	}

	const db = getDb();
	const table = findActiveTable(db, input.tableNumber);
	if (!table) throw new HttpError(404, 'این میز پیدا نشد.');

	const open = db
		.select()
		.from(callRequests)
		.where(and(eq(callRequests.tableId, table.id), eq(callRequests.kind, input.kind), eq(callRequests.status, 'open')))
		.get();
	if (open) return { id: open.id, tableNumber: table.number, kind: open.kind, createdAt: open.createdAt };

	const row = db
		.insert(callRequests)
		.values({ tableId: table.id, kind: input.kind, status: 'open', createdAt: Date.now() })
		.returning()
		.get();
	const call: PanelCall = { id: row.id, tableNumber: table.number, kind: row.kind, createdAt: row.createdAt };
	publish('panel', { type: 'call.created', data: call });
	return call;
}

export function resolveCall(id: number): { id: number } {
	const result = getDb()
		.update(callRequests)
		.set({ status: 'done', resolvedAt: Date.now() })
		.where(and(eq(callRequests.id, id), eq(callRequests.status, 'open')))
		.run();
	if (result.changes === 0) throw new HttpError(404, 'این درخواست پیدا نشد یا قبلاً انجام شده.');
	publish('panel', { type: 'call.resolved', data: { id } });
	return { id };
}

export function getPanelSnapshot(role: Role): PanelSnapshot {
	const db = getDb();
	const since = Date.now() - PANEL_WINDOW_MS;
	const rows = db
		.select()
		.from(orders)
		.where(or(gte(orders.createdAt, since), inArray(orders.status, ['awaiting_approval', 'received', 'preparing', 'ready'])))
		.orderBy(asc(orders.createdAt))
		.limit(300)
		.all();

	let calls: PanelCall[] = [];
	if (role !== 'kitchen') {
		calls = db
			.select({ id: callRequests.id, tableNumber: cafeTables.number, kind: callRequests.kind, createdAt: callRequests.createdAt })
			.from(callRequests)
			.innerJoin(cafeTables, eq(callRequests.tableId, cafeTables.id))
			.where(eq(callRequests.status, 'open'))
			.orderBy(asc(callRequests.createdAt))
			.all();
	}

	return { orders: loadDetails(db, rows), calls };
}
