import { requireStaff } from '#lib/server/auth';
import { apiRoute, jsonResponse } from '#lib/server/http';
import { getPanelSnapshot } from '#lib/server/orders';

export const GET = apiRoute(async (event) => {
	const user = requireStaff(event);
	return jsonResponse(getPanelSnapshot(user.role));
});
