import { requireStaff } from '#lib/server/auth';
import { getDb } from '#lib/server/db';
import { apiRoute, HttpError } from '#lib/server/http';
import { getSettingsRow } from '#lib/server/menu';
import { buildQrSvg, buildTableCardSvg, ensureQrText, parseQrStyle, svgToPng } from '#lib/server/qr-design';
import { eq } from 'drizzle-orm';
import { cafeTables } from '#lib/server/db/schema';

/** GET /api/admin/tables/[id]/qr?dark=..&light=..&corner=..&eye=..&format=svg|png|card&size=.. */
export const GET = apiRoute<{ id: string }>(async (event) => {
	requireStaff(event, ['owner']);
	const tableId = Number(event.params.id);
	if (!Number.isInteger(tableId) || tableId < 1) throw new HttpError(400, 'شناسه‌ی میز معتبر نیست.');

	const db = getDb();
	const table = db.select().from(cafeTables).where(eq(cafeTables.id, tableId)).get();
	if (!table) throw new HttpError(404, 'میز پیدا نشد.');

	const q = event.url.searchParams;
	const format = q.get('format') ?? 'svg';
	const size = Math.min(2048, Math.max(128, Number(q.get('size')) || 512));
	const style = parseQrStyle(Object.fromEntries(q.entries()));

	ensureQrText(`/t/${table.number}`);
	const origin = event.url.origin;
	const qrSvg = buildQrSvg(`${origin}/t/${table.number}`, style, size);

	if (format === 'png') {
		const png = await svgToPng(qrSvg, size);
		return new Response(new Uint8Array(png), {
			headers: {
				'content-type': 'image/png',
				'content-disposition': `attachment; filename="table-${table.number}-qr.png"`,
				'cache-control': 'no-store'
			}
		});
	}

	if (format === 'card') {
		const s = getSettingsRow(db);
		const card = buildTableCardSvg(
			{
				cafeName: s.name,
				cafeTagline: s.tagline,
				tableNumber: table.number,
				instruction: 'با اسکن کردن QR، منو را ببینید و سفارش دهید.'
			},
			qrSvg.replace(/width="\d+" height="\d+"/, 'width="100%" height="100%"'),
			style.dark,
			style.light
		);
		return new Response(card, {
			headers: {
				'content-type': 'image/svg+xml; charset=utf-8',
				'content-disposition': `attachment; filename="table-${table.number}-card.svg"`,
				'cache-control': 'no-store'
			}
		});
	}

	return new Response(qrSvg, {
		headers: {
			'content-type': 'image/svg+xml; charset=utf-8',
			'content-disposition': `attachment; filename="table-${table.number}-qr.svg"`,
			'cache-control': 'no-store'
		}
	});
});
