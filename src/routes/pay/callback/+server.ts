import { redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db';
import { verifyCheckout } from '#lib/server/payments';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const authority = event.url.searchParams.get('Authority') ?? event.url.searchParams.get('authority');
	const status = event.url.searchParams.get('Status') ?? event.url.searchParams.get('status');
	if (!authority) redirect(303, '/');
	const db = getDb();
	const result = await verifyCheckout(db, authority, status);
	// find the order to redirect to (we know it via the payment row, but avoid leaking internals: redirect to home with flag)
	const flag = result.ok ? 'ok' : 'failed';
	redirect(303, `/pay/result?state=${flag}`);
};
