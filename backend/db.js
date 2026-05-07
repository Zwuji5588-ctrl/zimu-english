import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/zimu',
  max: 10,
});

pool.on('error', err => {
  console.error('Database pool error:', err.message);
});

async function createTables() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        tier TEXT NOT NULL DEFAULT 'free',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        data TEXT NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_orders (
        id SERIAL PRIMARY KEY,
        order_id TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        provider TEXT NOT NULL DEFAULT 'dev',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }
}

export async function initDb() {
  await createTables();
  console.log('PostgreSQL connected, tables ready');
}

// Backward-compatible wrapper: exec() returns {columns, values} like sql.js
export async function exec(sql, params = []) {
  const result = await pool.query(sql, params);
  return {
    columns: result.fields.map(f => f.name),
    values: result.rows.map(r => Object.values(r)),
  };
}

// run() for INSERT/UPDATE (returns nothing)
export async function run(sql, params = []) {
  await pool.query(sql, params);
}

// Get a connection for transactions if needed
export function getPool() {
  return pool;
}

// No-op save — PostgreSQL auto-commits
export function save() {}

export default { initDb, exec, run, getPool, save };
