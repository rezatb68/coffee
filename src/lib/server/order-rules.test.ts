import { describe, expect, it } from 'vitest';
import {
	assertAction,
	computeTotals,
	parseCallInput,
	parseOrderInput,
	priceLines,
	type CatalogItem
} from './order-rules';

const catalog = new Map<number, CatalogItem>([
	[
		1,
		{
			id: 1,
			name: 'کاپوچینو',
			basePrice: 145000,
			isAvailable: true,
			groups: [
				{
					id: 10,
					name: 'سایز',
					kind: 'single',
					required: true,
					minSelect: 1,
					maxSelect: 1,
					options: [
						{ id: 100, name: 'کوچک', priceDelta: 0, isAvailable: true },
						{ id: 101, name: 'بزرگ', priceDelta: 35000, isAvailable: true }
					]
				},
				{
					id: 11,
					name: 'افزودنی',
					kind: 'multi',
					required: false,
					minSelect: 0,
					maxSelect: 2,
					options: [
						{ id: 110, name: 'شات وانیل', priceDelta: 20000, isAvailable: true },
						{ id: 111, name: 'خامه', priceDelta: 15000, isAvailable: false }
					]
				}
			]
		}
	],
	[2, { id: 2, name: 'کلد برو', basePrice: 140000, isAvailable: false, groups: [] }]
]);

const validBody = {
	clientId: 'device-abc-123',
	tableNumber: 5,
	channel: 'dine_in',
	paymentMethod: 'in_person',
	lines: [{ itemId: 1, qty: 2, optionIds: [101, 110], note: '  کم‌آب  ' }]
};

describe('parseOrderInput', () => {
	it('accepts a valid dine-in order and trims notes', () => {
		const input = parseOrderInput(validBody);
		expect(input.tableNumber).toBe(5);
		expect(input.lines[0].note).toBe('کم‌آب');
	});

	it('rejects a dine-in order without a table', () => {
		expect(() => parseOrderInput({ ...validBody, tableNumber: undefined })).toThrow('شماره میز معتبر نیست.');
	});

	it('rejects quantities outside 1..20', () => {
		const body = { ...validBody, lines: [{ itemId: 1, qty: 0, optionIds: [] }] };
		expect(() => parseOrderInput(body)).toThrow('تعداد باید بین ۱ تا ۲۰ باشد.');
	});

	it('rejects an empty cart', () => {
		expect(() => parseOrderInput({ ...validBody, lines: [] })).toThrow();
	});

	it('rejects a malformed client id', () => {
		expect(() => parseOrderInput({ ...validBody, clientId: 'x' })).toThrow('شناسه‌ی دستگاه معتبر نیست.');
	});

	it('rejects notes longer than 300 characters', () => {
		const lines = [{ itemId: 1, qty: 1, optionIds: [101], note: 'الف'.repeat(301) }];
		expect(() => parseOrderInput({ ...validBody, lines })).toThrow('یادداشت بیش از ۳۰۰ نویسه است.');
	});
});

describe('priceLines', () => {
	it('computes base price plus selected option deltas and ignores any client price', () => {
		const [line] = priceLines(
			[{ itemId: 1, qty: 2, optionIds: [101, 110], note: null }],
			catalog
		);
		expect(line.unitPrice).toBe(145000 + 35000 + 20000);
		expect(line.lineTotal).toBe((145000 + 35000 + 20000) * 2);
	});

	it('rejects a missing required group selection', () => {
		expect(() => priceLines([{ itemId: 1, qty: 1, optionIds: [110], note: null }], catalog)).toThrow(
			'گزینه‌های «سایز» کامل نیست.'
		);
	});

	it('rejects selecting more options than the group allows', () => {
		expect(() =>
			priceLines([{ itemId: 1, qty: 1, optionIds: [100, 101], note: null }], catalog)
		).toThrow('بیش از حد مجاز در «سایز» انتخاب شده.');
	});

	it('rejects unavailable items and unavailable options', () => {
		expect(() => priceLines([{ itemId: 2, qty: 1, optionIds: [], note: null }], catalog)).toThrow(
			'«کلد برو» الان موجود نیست.'
		);
		expect(() => priceLines([{ itemId: 1, qty: 1, optionIds: [100, 111], note: null }], catalog)).toThrow(
			'«خامه» الان موجود نیست.'
		);
	});

	it('rejects options that belong to another item', () => {
		expect(() => priceLines([{ itemId: 1, qty: 1, optionIds: [100, 999], note: null }], catalog)).toThrow(
			'گزینه‌ی انتخاب‌شده برای این آیتم معتبر نیست.'
		);
	});
});

describe('computeTotals', () => {
	it('applies tax and service on the subtotal and rounds to whole units', () => {
		expect(computeTotals(100000, 9, 10)).toEqual({
			subtotal: 100000,
			taxAmount: 9000,
			serviceAmount: 10000,
			total: 119000
		});
		expect(computeTotals(333, 9, 0).taxAmount).toBe(30);
	});
});

describe('assertAction', () => {
	it('lets cashiers approve but not kitchen staff', () => {
		expect(() => assertAction('approve', 'cashier', 'awaiting_approval', 'unpaid_in_person')).not.toThrow();
		expect(() => assertAction('approve', 'kitchen', 'awaiting_approval', 'unpaid_in_person')).toThrow(
			'این کار برای نقش شما مجاز نیست.'
		);
	});

	it('lets kitchen staff start and finish preparation', () => {
		expect(() => assertAction('start', 'kitchen', 'received', 'unpaid_in_person')).not.toThrow();
		expect(() => assertAction('ready', 'kitchen', 'preparing', 'unpaid_in_person')).not.toThrow();
	});

	it('rejects transitions from the wrong status', () => {
		expect(() => assertAction('served', 'owner', 'preparing', 'unpaid_in_person')).toThrow(
			'وضعیت سفارش برای این کار مناسب نیست.'
		);
		expect(() => assertAction('start', 'owner', 'cancelled', 'unpaid_in_person')).toThrow();
	});

	it('only marks in-person payment once', () => {
		expect(() => assertAction('paid', 'cashier', 'received', 'unpaid_in_person')).not.toThrow();
		expect(() => assertAction('paid', 'cashier', 'received', 'paid')).toThrow(
			'این سفارش در انتظار پرداخت حضوری نیست.'
		);
	});
});

describe('parseCallInput', () => {
	it('accepts waiter and bill requests only', () => {
		expect(parseCallInput({ tableNumber: 3, kind: 'waiter' })).toEqual({ tableNumber: 3, kind: 'waiter' });
		expect(() => parseCallInput({ tableNumber: 3, kind: 'drinks' })).toThrow('نوع درخواست معتبر نیست.');
	});
});
