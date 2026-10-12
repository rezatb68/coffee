import { redirect } from '@sveltejs/kit';
import { getPanelSnapshot } from '#lib/server/orders';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const user = locals.user;
	if (!user) redirect(303, '/login');
	return { role: user.role, snapshot: getPanelSnapshot(user.role) };
};
