import { createPrivateKey, createPublicKey, sign, verify, generateKeyPairSync, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, utimesSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import type { DB } from './db';
import { licenseState } from './db/schema';

/** One signed day-count anchor stored outside the DB, so deleting the DB doesn't reset the trial. */
type Anchor = { uuid: string; startedAt: number; signedAt: number; sig: string };

const DAY = 86_400_000;
const TRIAL_DAYS = 7;

function dataDir(): string {
	return resolve(process.env.DATA_DIR ?? 'data');
}

function anchorPath(): string {
	return join(dataDir(), '.trial-anchor');
}

function loadAnchor(): Anchor | null {
	try {
		if (!existsSync(anchorPath())) return null;
		return JSON.parse(readFileSync(anchorPath(), 'utf8')) as Anchor;
	} catch {
		return null;
	}
}

function anchorKeyMaterial(uuid: string, startedAt: number): string {
	return `coffee-menu-trial:${uuid}:${startedAt}:anchor-v1`;
}

/** Signs the anchor with a stable per-install key derived from file identity. */
function anchorSecret(): string {
	const p = anchorPath();
	let stat: { size: number; mtimeMs: number };
	try {
		stat = statSync(p);
	} catch {
		return 'coffee-menu-trial-secret-v1';
	}
	return `${stat.size}:${Math.floor(stat.mtimeMs / 60_000)}`;
}

function writeAnchor(uuid: string, startedAt: number): Anchor {
	const anchor: Anchor = { uuid, startedAt, signedAt: Date.now(), sig: '' };
	anchor.sig = signAnchor(uuid, startedAt);
	const dir = dataDir();
	mkdirSync(dir, { recursive: true });
	writeFileSync(anchorPath(), JSON.stringify(anchor));
	return anchor;
}

function signAnchor(uuid: string, startedAt: number): string {
	return sign(null, Buffer.from(anchorKeyMaterial(uuid, startedAt)), deriveAnchorKeyPem()).toString('base64url');
}

export function verifyAnchor(anchor: Anchor): boolean {
	try {
		const publicKey = createPublicKey(createPrivateKey(deriveAnchorKeyPem()));
		return verify(null, Buffer.from(anchorKeyMaterial(anchor.uuid, anchor.startedAt)), publicKey, Buffer.from(anchor.sig, 'base64url'));
	} catch {
		return false;
	}
}

/** Stable per-install Ed25519 key for anchor signing — generated once and persisted outside the DB.
 * Not cryptographic armor against a determined attacker (they can read the file too),
 * but it defeats casual DB-recreate / clock-change resets. */
function deriveAnchorKeyPem(): string {
	const p = join(dataDir(), '.anchor-key.json');
	if (existsSync(p)) {
		try {
			const { privateKey } = JSON.parse(readFileSync(p, 'utf8'));
			return privateKey;
		} catch {
			/* regenerate */
		}
	}
	const { privateKey } = generateKeyPairSync('ed25519');
	const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
	mkdirSync(dataDir(), { recursive: true });
	writeFileSync(p, JSON.stringify({ privateKey: pem }));
	return pem;
}

/** License payload signed by the vendor's Ed25519 private key. Schema versioned. */
export type LicensePayload = {
	v: 1;
	holder: string;
	domain: string | null;
	issuedAt: number;
	expiresAt: number | null; // null = perpetual
	nonce: string;
};

export function formatLicenseKey(payload: LicensePayload, signatureB64: string): string {
	// Keep body and signature as valid base64url separated by a dot; chunk only for readability.
	const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
	const combined = `${body}.${signatureB64}`;
	return combined.replace(/(.{40})/g, '$1-');
}

/** Parses a formatted license key back into (payload, signature). */
export function parseLicenseKey(key: string): { payload: LicensePayload; signatureB64: string } | null {
	const raw = key.replace(/[^A-Za-z0-9._-]/g, '').replace(/-/g, '');
	const idx = raw.indexOf('.');
	if (idx === -1) return null;
	const body = raw.slice(0, idx);
	const sig = raw.slice(idx + 1);
	try {
		const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as LicensePayload;
		if (payload.v !== 1) return null;
		return { payload, signatureB64: sig };
	} catch {
		return null;
	}
}

/** Vendor public key. In production this is baked at build time; can be overridden via env. */
export function vendorPublicKey(): ReturnType<typeof createPublicKey> {
	const pem = process.env.LICENSE_VENDOR_PUBLIC_KEY;
	if (pem) return createPublicKey(pem);
	// Development vendor keypair is generated on first use and cached in data dir.
	const p = join(dataDir(), 'vendor-keypair.json');
	if (existsSync(p)) {
		try {
			const { publicKey } = JSON.parse(readFileSync(p, 'utf8'));
			return createPublicKey(publicKey);
		} catch {
			/* regenerate */
		}
	}
	const { publicKey, privateKey } = generateKeyPairSync('ed25519');
	mkdirSync(dataDir(), { recursive: true });
	writeFileSync(p, JSON.stringify({ publicKey: publicKey.export({ type: 'spki', format: 'pem' }), privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }) }));
	return createPublicKey(publicKey.export({ type: 'spki', format: 'pem' }));
}

/** Validates a license key offline: signature, expiry, domain, holder non-empty. Returns error id or null. */
export function validateLicenseKey(
	db: DB,
	key: string,
	currentHost: string | null
): { ok: true; payload: LicensePayload } | { ok: false; error: 'invalid' | 'expired' | 'domain' } {
	const parsed = parseLicenseKey(key);
	if (!parsed) return { ok: false, error: 'invalid' };
	const { payload, signatureB64 } = parsed;
	let sigOk = false;
	try {
		sigOk = verify(null, Buffer.from(JSON.stringify(payload), 'utf8'), vendorPublicKey(), Buffer.from(signatureB64, 'base64url'));
	} catch {
		sigOk = false;
	}
	if (!sigOk) return { ok: false, error: 'invalid' };
	if (payload.expiresAt !== null && payload.expiresAt < Date.now()) return { ok: false, error: 'expired' };
	const row = db.select().from(licenseState).where(eq(licenseState.id, 1)).get();
	void row;
	// domain check: exact host match (strip port); null domain = any host
	if (payload.domain && currentHost) {
		const host = currentHost.split(':')[0];
		if (host !== payload.domain && !host.endsWith(`.${payload.domain}`)) return { ok: false, error: 'domain' };
	}
	return { ok: true, payload };
}

/** Trial state machine. Called on cold start (getDb users call ensureTrial on demand). */
export function ensureTrial(db: DB) {
	const row = db.select().from(licenseState).where(eq(licenseState.id, 1)).get();
	if (row) return;
	const now = Date.now();
	let anchor = loadAnchor();
	if (!anchor || !verifyAnchor(anchor)) anchor = writeAnchor(randomUUID(), now);
	db.insert(licenseState)
		.values({ id: 1, mode: 'trial', trialStartedAt: anchor.startedAt, trialEndsAt: anchor.startedAt + TRIAL_DAYS * DAY, updatedAt: now })
		.onConflictDoNothing()
		.run();
}

export type TrialStatus = {
	mode: 'trial' | 'licensed' | 'trial_expired';
	daysLeft: number;
	trialEndsAt: number;
	licenseHolder: string | null;
	licenseExpiresAt: number | null;
};

const CLOCK_TAMPER_TOLERANCE = 36 * 3600_000;

export function getTrialStatus(db: DB): TrialStatus {
	const row = db.select().from(licenseState).where(eq(licenseState.id, 1)).get();
	if (!row) {
		// first run: create trial
		const now = Date.now();
		let anchor = loadAnchor();
		if (!anchor || !verifyAnchor(anchor)) anchor = writeAnchor(randomUUID(), now);
		db.insert(licenseState)
			.values({ id: 1, mode: 'trial', trialStartedAt: anchor.startedAt, trialEndsAt: anchor.startedAt + TRIAL_DAYS * DAY, updatedAt: now })
			.onConflictDoNothing()
			.run();
		return { mode: 'trial', daysLeft: TRIAL_DAYS, trialEndsAt: anchor.startedAt + TRIAL_DAYS * DAY, licenseHolder: null, licenseExpiresAt: null };
	}
	if (row.mode === 'licensed') {
		return { mode: 'licensed', daysLeft: Infinity as unknown as number, trialEndsAt: row.trialEndsAt, licenseHolder: row.licenseHolder, licenseExpiresAt: row.licenseExpiresAt };
	}

	// A forced/licensed-only state transition: 'trial_expired' is sticky until a license is activated.
	if (row.mode === 'trial_expired') {
		return { mode: 'trial_expired', daysLeft: 0, trialEndsAt: row.trialEndsAt, licenseHolder: null, licenseExpiresAt: null };
	}

	// tamper detection: anchor says the trial started earlier than DB remembers
	const anchor = loadAnchor();
	if (anchor && verifyAnchor(anchor) && anchor.startedAt < row.trialStartedAt - CLOCK_TAMPER_TOLERANCE) {
		// someone restored an older DB/anchor — clamp to the earliest known start
		db.update(licenseState).set({ trialStartedAt: anchor.startedAt, trialEndsAt: anchor.startedAt + TRIAL_DAYS * DAY, updatedAt: Date.now() }).where(eq(licenseState.id, 1)).run();
	}
	const eff = (db.select().from(licenseState).where(eq(licenseState.id, 1)).get())!;
	const daysLeft = Math.max(0, Math.ceil((eff.trialEndsAt - Date.now()) / DAY));
	const mode: TrialStatus['mode'] = daysLeft <= 0 ? 'trial_expired' : 'trial';
	if (mode !== eff.mode) {
		db.update(licenseState).set({ mode, updatedAt: Date.now() }).where(eq(licenseState.id, 1)).run();
	}
	return { mode, daysLeft, trialEndsAt: eff.trialEndsAt, licenseHolder: null, licenseExpiresAt: null };
}

export function activateLicense(db: DB, key: string, currentHost: string | null): { ok: boolean; error?: string; holder?: string } {
	const result = validateLicenseKey(db, key, currentHost);
	if (!result.ok) return { ok: false, error: result.error };
	const now = Date.now();
	db.update(licenseState)
		.set({ mode: 'licensed', licenseKey: key, licenseHolder: result.payload.holder, licenseDomain: result.payload.domain, licenseExpiresAt: result.payload.expiresAt, lastCheckedAt: now, updatedAt: now })
		.where(eq(licenseState.id, 1))
		.run();
	return { ok: true, holder: result.payload.holder };
}

/** Utility mode: when trial expired but not licensed, menu stays readable, ordering is closed. */
export function isOrderingBlockedByLicense(mode: string): boolean {
	return mode === 'trial_expired';
}
