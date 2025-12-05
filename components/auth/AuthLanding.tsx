'use client';

import { useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useSupabase } from '../providers/SupabaseProvider';
import { useInvite } from '../providers/InviteProvider';
import { ShieldCheck } from 'lucide-react';

export function AuthLanding() {
  const supabase = useSupabase();
  const { setInviteToken } = useInvite();

  useEffect(() => {
    setInviteToken(null);
  }, [setInviteToken]);

  return (
    <div className="card" style={{ padding: 24, marginTop: 32 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <ShieldCheck size={18} color="#7ad7f0" />
        <div>
          <div style={{ fontWeight: 700 }}>Secure Access</div>
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>
            Sign in or create an account. After signing in, you&apos;ll need an invite token to enter the app unless
            your email is listed in <code>ADMIN_ALLOWED_EMAILS</code>.
          </div>
        </div>
      </div>

      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={['google']}
        redirectTo="/"
        magicLink
        localization={{ variables: { sign_in: { email_label: 'Work email' } } }}
      />
    </div>
  );
}
