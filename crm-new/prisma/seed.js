const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

require('dotenv').config();

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { rows } = await client.query('SELECT id FROM "User" WHERE username = $1', ['admin']);
  if (rows.length > 0) {
    console.log('Admin already exists, skipping seed.');
    await client.end();
    return;
  }

  const password = await bcrypt.hash('admin123', 10);
  const id = randomUUID();
  const now = new Date().toISOString();

  await client.query(
    `INSERT INTO "User" (id, "createdAt", "updatedAt", username, password, role)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, now, now, 'admin', password, 'ADMIN']
  );

  console.log('Admin created:  login=admin  password=admin123');
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
