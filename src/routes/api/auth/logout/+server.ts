import { dev } from '$app/environment';
import { deleteSession, SESSION_COOKIE } from '#lib/server/auth';
import { apiRoute, jsonResponse } from '#lib/server/http';

export const POST = apiRoute(async (event) => {
	const token = event.cookies.get(SESSION_COOKIE);
	if (token) deleteSession(token);
	event.cookies.delete(SESSION_COOKIE, { path: '/', httpOnly: true, sameSite: 'lax', secure: !dev });
	return jsonResponse({ ok: true });
});
