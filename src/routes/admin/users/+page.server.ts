import { getDb } from '#lib/server/db';
import { listUsers } from '#lib/server/admin2';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const db = getDb();
	return { users: listUsers(db, locals.user) };
};
