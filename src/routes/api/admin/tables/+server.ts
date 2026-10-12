import { requireStaff } from '#lib/server/auth';
import { getDb } from '#lib/server/db';
import { apiRoute, jsonResponse, readJson } from '#lib/server/http';
import { listTables, upsertTable } from '#lib/server/admin2';

export const GET = apiRoute(async (event) => {
	requireStaff(event, ['owner']);
	return jsonResponse(listTables(getDb()));
});

export const POST = apiRoute(async (event) => {
	const user = requireStaff(event, ['owner']);
	const body = await readJson(event.request);
	return jsonResponse(upsertTable(getDb(), body, user), 201);
});
