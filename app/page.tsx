import ManuscriptApp from '../components/ManuscriptApp';
import { AuthLanding } from '../components/auth/AuthLanding';
import { AccessGate } from '../components/auth/AccessGate';
import { cookies } from 'next/headers';
import { getServerSupabase, getServiceRoleSupabase } from '../lib/supabaseServer';

const ADMIN_EMAILS = (process.env.ADMIN_ALLOWED_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export default async function Home() {
  const supabase = getServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const email = session?.user?.email?.toLowerCase() ?? null;

  const isAdmin = email ? ADMIN_EMAILS.includes(email) : false;
  let inviteValidated = false;
  let inviteInvalid = false;

  if (session && !isAdmin) {
    const inviteCookie = cookies().get('invite_token')?.value;
    if (inviteCookie) {
      const serviceSupabase = getServiceRoleSupabase();
      const { data, error } = await serviceSupabase
        .from('invite_tokens')
        .select('*')
        .eq('token', inviteCookie)
        .maybeSingle();

      if (!error && data) {
        const emailMatches = !data.allowed_email || data.allowed_email.toLowerCase() === email;
        const notExpired = !data.expires_at || new Date(data.expires_at) >= new Date();
        const redemptionValid = !data.redeemed_by || data.redeemed_by.toLowerCase() === email;
        inviteValidated = emailMatches && notExpired && redemptionValid;
        inviteInvalid = !inviteValidated;
      } else {
        inviteInvalid = true;
      }
    }
  }

  return (
    <main className="main-shell">
      <header className="flex-between" style={{ marginTop: 20, marginBottom: 12 }}>
        <div>
          <p style={{ color: 'var(--muted)', margin: 0 }}>Production-ready Next.js workspace</p>
          <h1 style={{ margin: 0, fontSize: 32 }}>ManuscriptAI</h1>
        </div>
        <div style={{ color: 'var(--muted)', textAlign: 'right' }}>
          <div>Supabase Auth &amp; Storage</div>
          <div style={{ fontSize: 13 }}>Bring your own API keys</div>
        </div>
      </header>

      {!session && <AuthLanding />}
      {session && (isAdmin || inviteValidated) && <ManuscriptApp />}
      {session && !isAdmin && !inviteValidated && (
        <AccessGate email={email} reason={inviteInvalid ? 'invalid' : 'missing'} />
      )}
    </main>
  );
}
