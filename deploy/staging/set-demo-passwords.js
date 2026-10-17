// Runs inside staging's backend container (deploy/deploy-staging.sh pipes it
// to `node -`) right after the first seed: replaces the seed's well-known
// default passwords, which must never be live on a public URL, with the
// random ones in DEMO_ADMIN_PASSWORD / DEMO_SUPERADMIN_PASSWORD.
const bcrypt = require('bcrypt');
const { Client } = require('pg');

const accounts = [
  ['admin@goldenbites.local', process.env.DEMO_ADMIN_PASSWORD],
  ['superadmin@goldenbitespos.local', process.env.DEMO_SUPERADMIN_PASSWORD],
];

(async () => {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await client.connect();
  try {
    for (const [email, password] of accounts) {
      if (!password || password.length < 12) throw new Error(`No password given for ${email}`);
      const hash = await bcrypt.hash(password, 10);
      const result = await client.query(
        'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = now() WHERE email = $2',
        [hash, email],
      );
      console.log(`  ${email}: ${result.rowCount === 1 ? 'password set' : 'NOT FOUND'}`);
      if (result.rowCount !== 1) process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
