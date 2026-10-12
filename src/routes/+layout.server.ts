import { getDb } from '#lib/server/db';
import { getCafeInfo } from '#lib/server/menu';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => {
	const db = getDb();
	const cafe = getCafeInfo(db);
	return { cafe, theme: cafe.theme, mode: 'auto' as const };
};
