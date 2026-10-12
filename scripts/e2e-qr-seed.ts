import Database from 'better-sqlite3';
import { hashPassword } from '../src/lib/server/auth';

const db = new Database('/tmp/qr-e2e/data/cafe.db');
const existing = db.prepare("select id from staff_users where username='admin'").get();
if (existing) {
  console.log('admin exists');
  process.exit(0);
}
const run = async () => {
  const hash: string = await hashPassword('e2e-qr-owner-pass');
  db.prepare(
    "insert into staff_users (name, username, password_hash, role, is_active, created_at) values (?, 'admin', ?, 'owner', 1, ?)"
  ).run('مدیر', hash, Date.now());
  db.prepare('insert or ignore into cafe_tables (number, is_active) values (1, 1)').run();
  console.log('seeded admin + table 1');
};
await run();
