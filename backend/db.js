import pg from 'pg';

let pool;

function getPool() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/zimu',
      max: 10,
    });
    pool.on('error', err => {
      console.error('Database pool error:', err.message);
    });
  }
  return pool;
}

async function createTables() {
  const client = await getPool().connect();
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
  const result = await getPool().query(sql, params);
  return {
    columns: result.fields.map(f => f.name),
    values: result.rows.map(r => Object.values(r)),
  };
}

// run() for INSERT/UPDATE (returns nothing)
export async function run(sql, params = []) {
  await getPool().query(sql, params);
}

// No-op save — PostgreSQL auto-commits
export function save() {}

// Get a single row as a plain object (or null)
export async function getOne(sql, params = []) {
  const result = await getPool().query(sql, params);
  return result.rows.length ? result.rows[0] : null;
}

// Get multiple rows as plain objects
export async function getMany(sql, params = []) {
  const result = await getPool().query(sql, params);
  return result.rows;
}

export default { initDb, exec, run, save, getOne, getMany };
