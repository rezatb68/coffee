import { hash, verify } from '@node-rs/argon2';
import type { RequestEvent } from '@sveltejs/kit';
import { createHash, randomBytes } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import { getDb } from './db';
import { sessions, staffUsers } from './db/schema';
import { HttpError } from './http';
import type { Role } from '../shared/status';

export type SessionUser = { id: number; name: string; username: string; role: Role };

export const SESSION_COOKIE = 'cm_session';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export function hashPassword(password: string): Promise<string> {
	return hash(password);
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
	try {
		return await verify(stored, password);
	} catch {
		return false;
	}
}

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('base64url');
}

export function createSession(userId: number, ip: string, userAgent: string | null) {
	const db = getDb();
	const token = randomBytes(32).toString('base64url');
	const now = Date.now();
	db.delete(sessions).where(lt(sessions.expiresAt, now)).run();
	db.insert(sessions)
		.values({
			id: hashToken(token),
			userId,
			createdAt: now,
			expiresAt: now + SESSION_MS,
			ip,
			userAgent: userAgent ? userAgent.slice(0, 200) : null
		})
		.run();
	return { token, maxAgeSeconds: SESSION_MS / 1000 };
}

export function getSessionUser(token: string): SessionUser | null {
	const row = getDb()
		.select({
			id: staffUsers.id,
			name: staffUsers.name,
			username: staffUsers.username,
			role: staffUsers.role,
			isActive: staffUsers.isActive,
			expiresAt: sessions.expiresAt
		})
		.from(sessions)
		.innerJoin(staffUsers, eq(sessions.userId, staffUsers.id))
		.where(eq(sessions.id, hashToken(token)))
		.get();

	if (!row || !row.isActive || row.expiresAt <= Date.now()) return null;
	return { id: row.id, name: row.name, username: row.username, role: row.role };
}

export function deleteSession(token: string): void {
	getDb().delete(sessions).where(eq(sessions.id, hashToken(token))).run();
}

export function requireStaff(event: RequestEvent, roles?: readonly Role[]): SessionUser {
	const user = event.locals.user;
	if (!user) throw new HttpError(401, 'ابتدا وارد شوید.');
	if (roles && !roles.includes(user.role)) throw new HttpError(403, 'دسترسی ندارید.');
	return user;
}
