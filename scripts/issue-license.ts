// Usage: npx tsx scripts/issue-license.ts --holder "کافه روução" --domain cafe.example.com [--days 365] [--out license.txt]
// Signs a license with the vendor keypair stored in data/vendor-keypair.json (auto-generated for dev).
import { sign as cryptoSign, generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { formatLicenseKey, type LicensePayload } from '../src/lib/server/license';

const args = process.argv.slice(2);
const get = (name: string) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : undefined;
};

const holder = get('holder');
if (!holder) {
	console.error('--holder is required');
	process.exit(1);
}
const domainArg = get('domain');
const daysArg = get('days');
const outArg = get('out');

const dataDir = resolve(process.env.DATA_DIR ?? 'data');
mkdirSync(dataDir, { recursive: true });
const keyPath = join(dataDir, 'vendor-keypair.json');
let publicKeyPem: string;
let privateKeyPem: string;
if (existsSync(keyPath)) {
	const pair = JSON.parse(readFileSync(keyPath, 'utf8'));
	publicKeyPem = pair.publicKey;
	privateKeyPem = pair.privateKey;
} else {
	const { publicKey, privateKey } = generateKeyPairSync('ed25519');
	publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
	privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
	writeFileSync(keyPath, JSON.stringify({ publicKey: publicKeyPem, privateKey: privateKeyPem }));
	console.log('یک جفت‌کلید فروشنده جدید ساخته شد (برای توسعه). در تولید کلید عمومی را در LICENSE_VENDOR_PUBLIC_KEY قرار دهید.');
}

const payload: LicensePayload = {
	v: 1,
	holder,
	domain: domainArg ?? null,
	issuedAt: Date.now(),
	expiresAt: daysArg ? Date.now() + Number(daysArg) * 86_400_000 : null,
	nonce: Math.random().toString(36).slice(2) + Date.now().toString(36)
};

const signature = cryptoSign(null, Buffer.from(JSON.stringify(payload), 'utf8'), privateKeyPem).toString('base64url');
const licenseKey = formatLicenseKey(payload, signature);

const report = [
	'لایسنس صادر شد:',
	`  دارنده:   ${payload.holder}`,
	`  دامنه:    ${payload.domain ?? 'همه دامنه‌ها'}`,
	`  صدور:     ${new Date(payload.issuedAt).toISOString()}`,
	`  انقضا:    ${payload.expiresAt ? new Date(payload.expiresAt).toISOString() : 'دائمی'}`,
	'',
	'کلید لایسنس:',
	licenseKey
].join('\n');
console.log(report);
if (outArg) writeFileSync(outArg, licenseKey + '\n');
