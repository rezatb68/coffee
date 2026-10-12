import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.user) redirect(303, '/login');
	if (locals.user.role === 'kitchen') redirect(303, '/kitchen');
	return { user: { name: locals.user.name, role: locals.user.role } };
};
