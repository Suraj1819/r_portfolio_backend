import app from './app.js';
import { env } from './config/env.js';
import { checkDbHealth } from './config/db.js';

// Startup pe DB connection verify karo
async function assertDbConnection() {
  const health = await checkDbHealth();
  if (health.ok) {
    console.log('✅ Connected to PostgreSQL (Supabase)');
  } else {
    console.error('❌ PostgreSQL connection failed:', health.reason);
    console.error('   Check DATABASE_URL in server/.env');
    process.exit(1);
  }
}

assertDbConnection().then(() => {
  app.listen(env.PORT, () => {
    console.log(`Portfolio API listening on port ${env.PORT} (${env.NODE_ENV})`);
  });
});