import { requireStaff } from '#lib/server/auth';
import { apiRoute } from '#lib/server/http';
import { sseResponse } from '#lib/server/realtime';

const CALL_EVENTS = new Set(['call.created', 'call.resolved']);

export const GET = apiRoute((event) => {
	const user = requireStaff(event);
	return sseResponse(event.request, 'panel', {
		filter: (e) => user.role !== 'kitchen' || !CALL_EVENTS.has(e.type)
	});
});
