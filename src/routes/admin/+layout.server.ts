import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.user) redirect(303, '/login');
	if (locals.user.role !== 'owner') redirect(303, '/panel');
	return { user: { name: locals.user.name, role: locals.user.role } };
}

