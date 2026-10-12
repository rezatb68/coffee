import type { Handle } from '@sveltejs/kit/hooks';
import { getSessionUser, SESSION_COOKIE } from '#lib/server/auth';
import { jsonResponse } from '#lib/server/http';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PERSONAL_PREFIXES = ['/panel', '/kitchen', '/api/panel', '/api/orders', '/api/auth'];

function sameHost(origin: string, host: string | null): boolean {
	if (!host) return false;
	try {
		return new URL(origin).host === host;
	} catch {
		return false;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	const { request, url } = event;

	if (url.pathname.startsWith('/api/') && MUTATING.has(request.method)) {
		const origin = request.headers.get('origin');
		// Compare the Origin host with the Host header; this holds behind a reverse proxy that forwards Host.
		if (origin && !sameHost(origin, request.headers.get('host'))) {
			return jsonResponse({ message: 'درخواست از این مبدأ مجاز نیست.' }, 403);
		}
	}

	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.user = token ? getSessionUser(token) : null;

	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	if (PERSONAL_PREFIXES.some((p) => url.pathname.startsWith(p))) {
		response.headers.set('Cache-Control', 'private, no-store');
	}
	return response;
};
