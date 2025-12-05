import { getSupabaseServiceRoleClient, hasSupabaseConfig } from './supabaseServerClient.js';
import { ensureProjectsTable } from './supabaseSchema.js';
import { TABLE_NAME } from '../server/projectStore.js';

const verifySupabaseConnection = async () => {
  if (!hasSupabaseConfig()) {
    return { ok: false, reason: 'missing-config', message: 'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' };
  }

  try {
    await ensureProjectsTable();
  } catch (error) {
    return { ok: false, reason: 'ensure-failed', message: 'Failed to ensure projects table exists.', error };
  }

  try {
    const client = getSupabaseServiceRoleClient();
    const { error, count } = await client
      .from(TABLE_NAME)
      .select('id', { count: 'exact', head: true });

    if (error) {
      return { ok: false, reason: 'query-error', message: error.message, error };
    }

    return { ok: true, rowCount: count ?? 0 };
  } catch (error) {
    return { ok: false, reason: 'unhandled-error', message: error.message, error };
  }
};

export { verifySupabaseConnection };
