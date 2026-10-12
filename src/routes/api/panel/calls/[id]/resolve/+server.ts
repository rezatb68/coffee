import { requireStaff } from '#lib/server/auth';
import { apiRoute, HttpError, jsonResponse } from '#lib/server/http';
import { resolveCall } from '#lib/server/orders';

export const POST = apiRoute<{ id: string }>(async (event) => {
	requireStaff(event, ['owner', 'cashier']);
	const id = Number(event.params.id);
	if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'شناسه معتبر نیست.');
	return jsonResponse(resolveCall(id));
});
