// Tests truncate every table. Fail before anything connects unless DATABASE_URL clearly points at a
// test database. Without this, a missing .env.test would let app.ts load .env (the dev database).
const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    'DATABASE_URL is not set. Server tests need their own database: locally via server/.env.test, in CI via the job env.',
  );
}

const database = new URL(url).pathname.slice(1);

if (!database.endsWith('_test')) {
  throw new Error(
    `Refusing to run server tests against "${database}": they truncate every table, so the database name must end in "_test".`,
  );
}
