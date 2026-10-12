import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as schema from './schema';

export type DB = BetterSQLite3Database<typeof schema>;

const globalState = globalThis as typeof globalThis & { __cafeDb?: DB };

export function getDb(): DB {
	if (globalState.__cafeDb) return globalState.__cafeDb;

	const dataDir = resolve(process.env.DATA_DIR ?? 'data');
	mkdirSync(dataDir, { recursive: true });

	const sqlite = new Database(join(dataDir, 'cafe.db'));
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	sqlite.pragma('busy_timeout = 5000');

	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: resolve(process.env.MIGRATIONS_DIR ?? 'drizzle') });
	db.insert(schema.cafeSettings)
		.values({ id: 1, name: 'کافه', updatedAt: Date.now() })
		.onConflictDoNothing()
		.run();

	globalState.__cafeDb = db;
	return db;
}
