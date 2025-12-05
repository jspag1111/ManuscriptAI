#!/usr/bin/env node
import { verifySupabaseConnection } from '../lib/supabaseHealth.js';

const main = async () => {
  const result = await verifySupabaseConnection();

  if (result.ok) {
    console.log(`Supabase connection verified. Projects rows: ${result.rowCount}`);
    process.exit(0);
  }

  console.error(`Supabase verification failed (${result.reason}): ${result.message}`);
  if (result.error) {
    console.error(result.error);
  }
  process.exit(1);
};

main().catch((error) => {
  console.error('Unexpected Supabase verification failure', error);
  process.exit(1);
});
