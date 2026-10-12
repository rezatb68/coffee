import { eq } from 'drizzle-orm';
import { dev } from '$app/environment';
import { createSession, SESSION_COOKIE, verifyPassword } from '#lib/server/auth';
import { getDb } from '#lib/server/db';
import { staffUsers } from '#lib/server/db/schema';
import { apiRoute, HttpError, isRecord, jsonResponse, readJson } from '#lib/server/http';
import { hitRateLimit } from '#lib/server/rate-limit';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const INVALID = 'نام کاربری یا رمز عبور اشتباه است.';

export const POST = apiRoute(async (event) => {
	const ip = event.getClientAddress();
	if (!hitRateLimit(`login:ip:${ip}`, 20, FIFTEEN_MINUTES)) {
		throw new HttpError(429, 'تلاش زیاد. ۱۵ دقیقه دیگر دوباره امتحان کنید.');
	}

	const body = await readJson(event.request);
	if (!isRecord(body) || typeof body.username !== 'string' || typeof body.password !== 'string') {
		throw new HttpError(400, 'نام کاربری و رمز عبور لازم است.');
	}
	const username = body.username.trim().toLowerCase();
	const password = body.password;
	if (!username || !password || password.length > 200 || username.length > 64) {
		throw new HttpError(400, INVALID);
	}
	if (!hitRateLimit(`login:user:${username}`, 10, FIFTEEN_MINUTES)) {
		throw new HttpError(429, 'تلاش زیاد برای این حساب. چند دقیقه دیگر دوباره امتحان کنید.');
	}

	const db = getDb();
	const user = db.select().from(staffUsers).where(eq(staffUsers.username, username)).get();
	if (!user || !user.isActive) throw new HttpError(401, INVALID);

	const now = Date.now();
	if (user.lockedUntil && user.lockedUntil > now) {
		throw new HttpError(423, 'حساب موقتاً قفل شده است. چند دقیقه دیگر تلاش کنید.');
	}

	const valid = await verifyPassword(user.passwordHash, password);
	if (!valid) {
		const attempts = user.failedAttempts + 1;
		const locked = attempts >= MAX_FAILURES;
		db.update(staffUsers)
			.set({ failedAttempts: locked ? 0 : attempts, lockedUntil: locked ? now + FIFTEEN_MINUTES : null })
			.where(eq(staffUsers.id, user.id))
			.run();
		throw new HttpError(401, INVALID);
	}

	db.update(staffUsers).set({ failedAttempts: 0, lockedUntil: null }).where(eq(staffUsers.id, user.id)).run();
	const session = createSession(user.id, ip, event.request.headers.get('user-agent'));
	event.cookies.set(SESSION_COOKIE, session.token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: session.maxAgeSeconds
	});

	return jsonResponse({ name: user.name, role: user.role });
});
