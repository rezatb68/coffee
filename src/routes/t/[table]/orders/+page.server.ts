import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const tableNumber = Number(params.table);
	if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 999) error(404, 'میز پیدا نشد.');
	return { tableNumber };
};
