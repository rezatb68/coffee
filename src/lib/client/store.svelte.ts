export type CartOption = { id: number; name: string; priceDelta: number };

export type CartLine = {
	key: string;
	itemId: number;
	name: string;
	unitPrice: number;
	qty: number;
	optionIds: number[];
	options: CartOption[];
	note: string | null;
};

export type HistoryEntry = { code: string; token: string; tableNumber: number; total: number; createdAt: number };

const CART_KEY = 'cm-cart-v1';
const HISTORY_KEY = 'cm-orders-v1';
const CLIENT_KEY = 'cm-client-id-v1';

function readStorage<T>(key: string, fallback: T): T {
	if (typeof localStorage === 'undefined') return fallback;
	try {
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
}

function writeStorage(key: string, value: unknown): void {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Storage can be full or disabled (private mode); the in-memory state still works.
	}
}

function randomHex(bytes: number): string {
	return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getClientId(): string {
	let id = readStorage<string | null>(CLIENT_KEY, null);
	if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
		id = randomHex(16);
		writeStorage(CLIENT_KEY, id);
	}
	return id;
}

export function lineKey(itemId: number, optionIds: number[], note: string | null): string {
	return `${itemId}|${[...optionIds].sort((a, b) => a - b).join(',')}|${note ?? ''}`;
}

class Cart {
	lines = $state<CartLine[]>(readStorage<CartLine[]>(CART_KEY, []));
	count = $derived(this.lines.reduce((n, l) => n + l.qty, 0));
	total = $derived(this.lines.reduce((n, l) => n + l.unitPrice * l.qty, 0));

	private persist() {
		writeStorage(CART_KEY, this.lines);
	}

	countFor(itemId: number): number {
		return this.lines.filter((l) => l.itemId === itemId).reduce((n, l) => n + l.qty, 0);
	}

	add(line: Omit<CartLine, 'key' | 'qty'> & { qty?: number }) {
		const qty = line.qty ?? 1;
		const key = lineKey(line.itemId, line.optionIds, line.note);
		const existing = this.lines.find((l) => l.key === key);
		if (existing) existing.qty = Math.min(20, existing.qty + qty);
		else this.lines.push({ ...line, key, qty });
		this.persist();
	}

	setQty(key: string, qty: number) {
		if (qty <= 0) this.lines = this.lines.filter((l) => l.key !== key);
		else {
			const line = this.lines.find((l) => l.key === key);
			if (line) line.qty = Math.min(20, qty);
		}
		this.persist();
	}

	/** Removes one unit of the most recently added line for an item. */
	decrementLast(itemId: number) {
		const line = [...this.lines].reverse().find((l) => l.itemId === itemId);
		if (!line) return;
		this.setQty(line.key, line.qty - 1);
	}

	/** Adds one unit to the most recently added line for an item. */
	incrementLast(itemId: number): boolean {
		const line = [...this.lines].reverse().find((l) => l.itemId === itemId);
		if (!line || line.qty >= 20) return false;
		line.qty += 1;
		this.persist();
		return true;
	}

	clear() {
		this.lines = [];
		this.persist();
	}
}

class OrderHistory {
	entries = $state<HistoryEntry[]>(readStorage<HistoryEntry[]>(HISTORY_KEY, []));

	add(entry: HistoryEntry) {
		this.entries = [entry, ...this.entries.filter((e) => e.code !== entry.code)].slice(0, 50);
		writeStorage(HISTORY_KEY, this.entries);
	}

	find(code: string): HistoryEntry | undefined {
		return this.entries.find((e) => e.code === code);
	}
}

export const cart = new Cart();
export const history = new OrderHistory();
