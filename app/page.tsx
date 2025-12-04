import { cookies, headers } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import ManuscriptApp from '../components/ManuscriptApp';
import { AuthLanding } from '../components/auth/AuthLanding';
import { Database } from '../types/supabase';

export default async function Home() {
  const supabase = createServerComponentClient<Database>({ cookies, headers });
  const {
    data: { session },
  } = await supabase.auth.getSession();

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

      {session ? (
        <ManuscriptApp />
      ) : (
        <AuthLanding />
      )}
    </main>
  );
}
