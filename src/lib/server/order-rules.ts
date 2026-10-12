import { ACTION_RULES, ORDER_ACTIONS, type OrderAction, type OrderStatus, type PaymentStatus, type Role } from '../shared/status';
import type { CallKind, OrderChannel, PaymentMethod } from '../shared/types';
import { HttpError, isRecord } from './http';

export type LineInput = { itemId: number; qty: number; optionIds: number[]; note: string | null };

export type OrderInput = {
	tableNumber: number | null;
	channel: OrderChannel;
	paymentMethod: PaymentMethod;
	note: string | null;
	clientId: string;
	lines: LineInput[];
};

export type CatalogOption = { id: number; name: string; priceDelta: number; isAvailable: boolean };
export type CatalogGroup = {
	id: number;
	name: string;
	kind: 'single' | 'multi';
	required: boolean;
	minSelect: number;
	maxSelect: number;
	options: CatalogOption[];
};
export type CatalogItem = { id: number; name: string; basePrice: number; isAvailable: boolean; groups: CatalogGroup[] };

export type PricedLine = {
	itemId: number;
	itemName: string;
	unitPrice: number;
	qty: number;
	note: string | null;
	options: { name: string; priceDelta: number }[];
	lineTotal: number;
};

function parseInt01(value: unknown, min: number, max: number, message: string): number {
	if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
		throw new HttpError(400, message);
	}
	return value;
}

function parseNote(value: unknown): string | null {
	if (value === undefined || value === null) return null;
	if (typeof value !== 'string') throw new HttpError(400, 'یادداشت معتبر نیست.');
	const trimmed = value.trim();
	if (trimmed.length > 300) throw new HttpError(400, 'یادداشت بیش از ۳۰۰ نویسه است.');
	return trimmed.length > 0 ? trimmed : null;
}

export function parseOrderInput(body: unknown): OrderInput {
	if (!isRecord(body)) throw new HttpError(400, 'داده‌ی ارسالی معتبر نیست.');

	const clientId = body.clientId;
	if (typeof clientId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(clientId)) {
		throw new HttpError(400, 'شناسه‌ی دستگاه معتبر نیست.');
	}

	const channel: OrderChannel = body.channel === 'takeaway' ? 'takeaway' : 'dine_in';
	let tableNumber: number | null = null;
	if (channel === 'dine_in') {
		tableNumber = parseInt01(body.tableNumber, 1, 999, 'شماره میز معتبر نیست.');
	}

	if (body.paymentMethod !== 'in_person' && body.paymentMethod !== 'online') {
		throw new HttpError(400, 'روش پرداخت معتبر نیست.');
	}

	if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > 30) {
		throw new HttpError(400, 'سبد خرید خالی است یا بیش از حد بزرگ است.');
	}

	const lines: LineInput[] = body.lines.map((raw) => {
		if (!isRecord(raw)) throw new HttpError(400, 'یکی از آیتم‌ها معتبر نیست.');
		if (!Array.isArray(raw.optionIds) || raw.optionIds.length > 30) {
			throw new HttpError(400, 'گزینه‌های انتخاب‌شده معتبر نیستند.');
		}
		const optionIds = [...new Set(raw.optionIds.map((id) => parseInt01(id, 1, 2_147_483_647, 'گزینه‌ی معتبر نیست.')))];
		return {
			itemId: parseInt01(raw.itemId, 1, 2_147_483_647, 'آیتم معتبر نیست.'),
			qty: parseInt01(raw.qty, 1, 20, 'تعداد باید بین ۱ تا ۲۰ باشد.'),
			optionIds,
			note: parseNote(raw.note)
		};
	});

	return {
		tableNumber,
		channel,
		paymentMethod: body.paymentMethod,
		note: parseNote(body.note),
		clientId,
		lines
	};
}

export function parseCallInput(body: unknown): { tableNumber: number; kind: CallKind } {
	if (!isRecord(body)) throw new HttpError(400, 'داده‌ی ارسالی معتبر نیست.');
	if (body.kind !== 'waiter' && body.kind !== 'bill') throw new HttpError(400, 'نوع درخواست معتبر نیست.');
	return { tableNumber: parseInt01(body.tableNumber, 1, 999, 'شماره میز معتبر نیست.'), kind: body.kind };
}

export function parseOrderAction(value: unknown): OrderAction {
	if (typeof value === 'string' && (ORDER_ACTIONS as readonly string[]).includes(value)) {
		return value as OrderAction;
	}
	throw new HttpError(400, 'عملیات معتبر نیست.');
}

/** Prices every line from catalog data only. Client-sent prices are never read. */
export function priceLines(lines: LineInput[], catalog: Map<number, CatalogItem>): PricedLine[] {
	return lines.map((line) => {
		const item = catalog.get(line.itemId);
		if (!item) throw new HttpError(400, 'یکی از آیتم‌ها دیگر در منو نیست.');
		if (!item.isAvailable) throw new HttpError(409, `«${item.name}» الان موجود نیست.`);

		const allOptions = new Map<number, CatalogOption>();
		for (const group of item.groups) for (const option of group.options) allOptions.set(option.id, option);
		for (const id of line.optionIds) {
			if (!allOptions.has(id)) throw new HttpError(400, 'گزینه‌ی انتخاب‌شده برای این آیتم معتبر نیست.');
		}

		const chosen: { name: string; priceDelta: number }[] = [];
		for (const group of item.groups) {
			const picks = group.options.filter((o) => line.optionIds.includes(o.id));
			const min = group.required ? Math.max(1, group.minSelect) : group.minSelect;
			if (picks.length < min) throw new HttpError(400, `گزینه‌های «${group.name}» کامل نیست.`);
			if (picks.length > group.maxSelect) throw new HttpError(400, `بیش از حد مجاز در «${group.name}» انتخاب شده.`);
			for (const pick of picks) {
				if (!pick.isAvailable) throw new HttpError(409, `«${pick.name}» الان موجود نیست.`);
				chosen.push({ name: pick.name, priceDelta: pick.priceDelta });
			}
		}

		const unitPrice = item.basePrice + chosen.reduce((sum, o) => sum + o.priceDelta, 0);
		return {
			itemId: item.id,
			itemName: item.name,
			unitPrice,
			qty: line.qty,
			note: line.note,
			options: chosen,
			lineTotal: unitPrice * line.qty
		};
	});
}

export function computeTotals(subtotal: number, taxPercent: number, servicePercent: number) {
	const taxAmount = Math.round((subtotal * taxPercent) / 100);
	const serviceAmount = Math.round((subtotal * servicePercent) / 100);
	return { subtotal, taxAmount, serviceAmount, total: subtotal + taxAmount + serviceAmount };
}

export function assertAction(
	action: OrderAction,
	role: Role,
	status: OrderStatus,
	paymentStatus: PaymentStatus
): void {
	const rule = ACTION_RULES[action];
	if (!rule.roles.includes(role)) throw new HttpError(403, 'این کار برای نقش شما مجاز نیست.');
	if (!rule.from.includes(status)) throw new HttpError(409, 'وضعیت سفارش برای این کار مناسب نیست.');
	if (action === 'paid' && paymentStatus !== 'unpaid_in_person') {
		throw new HttpError(409, 'این سفارش در انتظار پرداخت حضوری نیست.');
	}
}
