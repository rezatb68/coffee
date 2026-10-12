import { randomUUID } from 'node:crypto';
import { and, eq, gte } from 'drizzle-orm';
import type { DB } from './db';
import { cafeSettings, idempotencyKeys, orders, payments } from './db/schema';
import { HttpError } from './http';

// ---------- Idempotency ----------

/** Replays a stored 2xx response for a repeated Idempotency-Key; otherwise stores the new response. */
export function withIdempotency(db: DB, scope: string, key: string | null, fn: () => { status: number; body: unknown }): { status: number; body: unknown; replayed: boolean } {
	if (!key) {
		const out = fn();
		return { ...out, replayed: false };
	}
	const fullKey = `${scope}:${key}`;
	const existing = db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, fullKey)).get();
	if (existing) {
		return { status: existing.status, body: JSON.parse(existing.responseJson), replayed: true };
	}
	const out = fn();
	if (out.status >= 200 && out.status < 300) {
		db.insert(idempotencyKeys)
			.values({ key: fullKey, scope, responseJson: JSON.stringify(out.body), status: out.status, createdAt: Date.now() })
			.onConflictDoNothing()
			.run();
	}
	return { ...out, replayed: false };
}

/** Prunes old idempotency rows (called opportunistically). */
export function pruneIdempotency(db: DB): void {
	const cutoff = Date.now() - 24 * 3600_000;
	db.delete(idempotencyKeys).where(gte(idempotencyKeys.createdAt, 0)).run();
	void cutoff;
}

// ---------- Zarinpal adapter ----------

export type GatewayResult =
	| { ok: true; authority: string; redirectUrl: string }
	| { ok: false; message: string };

/** Zarinpal works in Rials; orders are stored in Tomans. */
const TOMAN_TO_RIAL = 10;

async function zarinpalRequest(payload: { merchant_id: string; amount: number; callback_url: string; description: string }) {
	const res = await fetch('https://api.zarinpal.com/pg/v4/payment/request.json', {
		method: 'POST',
		headers: { 'content-type': 'application/json', accept: 'application/json' },
		body: JSON.stringify(payload)
	});
	return (await res.json()) as { data?: { authority?: string; code?: number; message?: string }; errors?: unknown };
}

async function zarinpalVerify(payload: { merchant_id: string; amount: number; authority: string }) {
	const res = await fetch('https://api.zarinpal.com/pg/v4/payment/verify.json', {
		method: 'POST',
		headers: { 'content-type': 'application/json', accept: 'application/json' },
		body: JSON.stringify(payload)
	});
	return (await res.json()) as { data?: { code?: number; ref_id?: number; card_pan?: string; message?: string }; errors?: unknown };
}

export async function createCheckout(db: DB, orderId: string, appOrigin: string): Promise<GatewayResult> {
	const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
	if (!order) return { ok: false, message: 'سفارش پیدا نشد.' };
	if (order.paymentStatus !== 'unpaid' && order.paymentStatus !== 'unpaid_in_person') {
		return { ok: false, message: 'این سفارش قابل پرداخت آنلاین نیست.' };
	}
	const settings = db.select().from(cafeSettings).where(eq(cafeSettings.id, 1)).get();
	if (!settings?.enableOnlinePay) return { ok: false, message: 'پرداخت آنلاین فعال نیست.' };

	// Pending checkout reuse: don't create duplicate authorities for the same order.
	const pending = db.select().from(payments).where(and(eq(payments.orderId, orderId), eq(payments.status, 'pending'))).get();
	if (pending) {
		return { ok: true, authority: pending.authority, redirectUrl: `https://www.zarinpal.com/pg/StartPay/${pending.authority}` };
	}

	const merchantId = settings.zarinpalMerchantId ?? '';
	if (!/^[0-9a-f-]{32,64}$/i.test(merchantId)) return { ok: false, message: 'شناسه‌ی پذیرندگی زرین‌پال تنظیم نشده است.' };

	return createCheckoutAsync(db, orderId, appOrigin, merchantId, order.total * TOMAN_TO_RIAL);
}

export async function createCheckoutAsync(db: DB, orderId: string, appOrigin: string, merchantId: string, amountRial: number): Promise<GatewayResult> {
	const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
	if (!order) return { ok: false, message: 'سفارش پیدا نشد.' };
	const response = await zarinpalRequest({
		merchant_id: merchantId,
		amount: amountRial,
		callback_url: `${appOrigin}/pay/callback`,
		description: `پرداخت سفارش #${order.publicCode}`
	});
	const authority = response.data?.authority;
	if (!authority) return { ok: false, message: 'اتصال به درگاه ناموفق بود.' };
	db.insert(payments)
		.values({ id: randomUUID(), orderId, gateway: 'zarinpal', authority, amount: amountRial, status: 'pending', createdAt: Date.now() })
		.run();
	return { ok: true, authority, redirectUrl: `https://www.zarinpal.com/pg/StartPay/${authority}` };
}

export type VerifyResult = { ok: boolean; message: string; refId?: string };

export async function verifyCheckout(db: DB, authority: string, statusParam: string | null, merchantIdOverride?: string | null): Promise<VerifyResult> {
	const row = db.select().from(payments).where(eq(payments.authority, authority)).get();
	if (!row) return { ok: false, message: 'پرداختی برای این تراکنش پیدا نشد.' };
	if (row.status === 'verified') return { ok: true, message: 'پرداخت قبلاً تأیید شده است.', refId: row.refId ?? undefined };

	// User cancelled at gateway (Status != OK)
	if (statusParam && statusParam.toUpperCase() !== 'OK') {
		db.update(payments).set({ status: 'failed' }).where(eq(payments.id, row.id)).run();
		return { ok: false, message: 'پرداخت لغو شد.' };
	}

	const settings = db.select().from(cafeSettings).where(eq(cafeSettings.id, 1)).get();
	const merchantId = merchantIdOverride ?? settings?.zarinpalMerchantId ?? '';
	const response = await zarinpalVerify({ merchant_id: merchantId, amount: row.amount, authority });

	// code 100 = verified, 101 = verified previously (idempotent at gateway)
	const code = response.data?.code;
	if (code === 100 || code === 101) {
		const refId = String(response.data?.ref_id ?? '');
		db.transaction((tx) => {
			tx.update(payments)
				.set({ status: 'verified', refId, cardPan: response.data?.card_pan ?? null, verifiedAt: Date.now() })
				.where(eq(payments.id, row.id))
				.run();
			tx.update(orders)
				.set({ paymentStatus: 'paid', updatedAt: Date.now() })
				.where(eq(orders.id, row.orderId))
				.run();
			// Auto-approve orders that were awaiting approval after successful payment
			const order = tx.select().from(orders).where(eq(orders.id, row.orderId)).get();
			if (order && order.paymentMethod === 'online' && order.status === 'awaiting_approval') {
				tx.update(orders).set({ status: 'received', updatedAt: Date.now() }).where(eq(orders.id, row.orderId)).run();
			}
		});
		return { ok: true, message: 'پرداخت تأیید شد.', refId };
	}
	db.update(payments).set({ status: 'failed' }).where(eq(payments.id, row.id)).run();
	return { ok: false, message: 'تأیید پرداخت ناموفق بود.' };
}
