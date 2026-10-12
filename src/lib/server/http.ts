import type { RequestEvent } from '@sveltejs/kit';

export class HttpError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = 'HttpError';
		this.status = status;
	}
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function jsonResponse(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
	const headers = new Headers({
		'content-type': 'application/json; charset=utf-8',
		'cache-control': 'no-store'
	});
	for (const [key, value] of Object.entries(extraHeaders ?? {})) headers.set(key, value);
	return new Response(JSON.stringify(data), { status, headers });
}

export async function readJson(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		throw new HttpError(400, 'داده‌ی ارسالی معتبر نیست.');
	}
}

export function apiRoute<P extends Record<string, string> = Record<string, string>>(
	fn: (event: RequestEvent<P>) => Promise<Response> | Response
) {
	return async (event: RequestEvent<P>): Promise<Response> => {
		try {
			return await fn(event);
		} catch (err) {
			if (err instanceof HttpError) return jsonResponse({ message: err.message }, err.status);
			console.error(err);
			return jsonResponse({ message: 'خطایی رخ داد. دوباره تلاش کنید.' }, 500);
		}
	};
}
