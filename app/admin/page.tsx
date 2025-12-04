import { InviteDashboard } from '../../components/admin/InviteDashboard';
import { getServerSupabase } from '../../lib/supabaseServer';

export default async function AdminPage() {
  const supabase = getServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return (
    <main className="main-shell">
      <h1 style={{ marginTop: 20 }}>Admin access control</h1>
      <p style={{ color: 'var(--muted)' }}>
        Only emails listed in <code>ADMIN_ALLOWED_EMAILS</code> can read or create invite tokens.
      </p>
      {session ? (
        <InviteDashboard />
      ) : (
        <div className="card" style={{ padding: 16 }}>You must be signed in to view the admin dashboard.</div>
      )}
    </main>
  );
}
