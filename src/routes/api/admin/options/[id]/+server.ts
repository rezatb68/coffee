import { requireStaff } from '#lib/server/auth';
import { getDb } from '#lib/server/db';
import { apiRoute, HttpError, jsonResponse, readJson } from '#lib/server/http';
import { updateOption } from '#lib/server/admin';

export const PATCH = apiRoute<{ id: string }>(async (event) => {
	const user = requireStaff(event, ['owner']);
	const body = await readJson(event.request);
	const id = Number(event.params.id);
	if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'شناسه معتبر نیست.');
	return jsonResponse(updateOption(getDb(), id, body, user));
});
