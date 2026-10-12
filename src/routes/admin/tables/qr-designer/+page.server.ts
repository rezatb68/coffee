import { getDb } from '#lib/server/db';
import { listTables } from '#lib/server/admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return { tables: listTables(getDb()) };
};
