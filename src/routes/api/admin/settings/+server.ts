import { requireStaff } from '#lib/server/auth';
import { getDb } from '#lib/server/db';
import { apiRoute, jsonResponse, readJson } from '#lib/server/http';
import { parseSettingsInput, updateSettings } from '#lib/server/admin';

export const PATCH = apiRoute(async (event) => {
	const user = requireStaff(event, ['owner']);
	const body = await readJson(event.request);
	return jsonResponse(updateSettings(getDb(), parseSettingsInput(body), user));
});
