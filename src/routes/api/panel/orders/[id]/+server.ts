import { requireStaff } from '#lib/server/auth';
import { apiRoute, jsonResponse, readJson } from '#lib/server/http';
import { transitionOrder } from '#lib/server/orders';

export const PATCH = apiRoute<{ id: string }>(async (event) => {
	const user = requireStaff(event);
	const body = await readJson(event.request);
	return jsonResponse(transitionOrder(event.params.id, body, user));
});
