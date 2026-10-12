import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { getCafeInfo } from '#lib/server/menu';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const tableNumber = Number(params.table);
	if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 999) error(404, 'میز پیدا نشد.');
	if (!/^\d{4}$/.test(params.code)) error(404, 'سفارش پیدا نشد.');
	const db = getDb();
	return { tableNumber, code: params.code, cafe: getCafeInfo(db) };
};
