import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { findActiveTable, getCafeInfo } from '#lib/server/menu';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const tableNumber = Number(params.table);
	if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 999) error(404, 'میز پیدا نشد.');

	const db = getDb();
	if (!findActiveTable(db, tableNumber)) error(404, 'این میز فعال نیست.');

	return { tableNumber, cafe: getCafeInfo(db) };
};
