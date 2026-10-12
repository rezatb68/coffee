type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Returns true when the action is allowed, false when the window limit is exceeded. */
export function hitRateLimit(key: string, limit: number, windowMs: number): boolean {
	const now = Date.now();

	if (buckets.size > 10_000) {
		for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
	}

	const bucket = buckets.get(key);
	if (!bucket || bucket.resetAt <= now) {
		buckets.set(key, { count: 1, resetAt: now + windowMs });
		return true;
	}
	if (bucket.count >= limit) return false;
	bucket.count += 1;
	return true;
}
