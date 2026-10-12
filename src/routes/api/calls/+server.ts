import { apiRoute, jsonResponse, readJson } from '#lib/server/http';
import { createCall } from '#lib/server/orders';

export const POST = apiRoute(async (event) => {
	const body = await readJson(event.request);
	const call = createCall(body, event.getClientAddress());
	return jsonResponse({ id: call.id }, 201);
});
