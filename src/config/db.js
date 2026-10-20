import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

let pool = null;

export function getPool() {
  if (!env.DATABASE_URL) {
    return null;
  }
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10,
    });
    pool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err.message);
    });
  }
  return pool;
}

export async function query(text, params) {
  const p = getPool();
  if (!p) {
    throw new Error('Database not configured');
  }
  return p.query(text, params);
}

export async function checkDbHealth() {
  try {
    const p = getPool();
    if (!p) return { ok: false, reason: 'not_configured' };
    await p.query('SELECT 1');
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}
