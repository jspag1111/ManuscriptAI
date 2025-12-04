'use client';

import { useEffect, useState } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useSupabase } from '../providers/SupabaseProvider';
import { useInvite } from '../providers/InviteProvider';
import { AlertCircle, ShieldCheck } from 'lucide-react';

export function AuthLanding() {
  const supabase = useSupabase();
  const { inviteToken, setInviteToken } = useInvite();
  const [tokenInput, setTokenInput] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (inviteToken) {
      setTokenInput(inviteToken);
    }
  }, [inviteToken]);

  const validateToken = async () => {
    setError(null);
    setStatus('Validating invite token...');
    const response = await fetch('/api/invite/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenInput.trim() }),
    });
    if (!response.ok) {
      const message = await response.text();
      setStatus(null);
      setError(message || 'Invalid invite token.');
      return;
    }
    setInviteToken(tokenInput.trim());
    setStatus('Invite token accepted. You can now sign in.');
  };

  return (
    <div className="card" style={{ padding: 24, marginTop: 32 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <ShieldCheck size={18} color="#7ad7f0" />
        <div>
          <div style={{ fontWeight: 700 }}>Secure Access</div>
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>
            A valid invite token is required before you can sign in or register.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <input
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="Enter admin-provided invite token"
          style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
        />
        <button
          onClick={validateToken}
          style={{ padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(120deg, var(--accent), var(--accent-strong))', color: '#0b1021', border: 'none', fontWeight: 700 }}
        >
          Validate
        </button>
      </div>
      {status && <div style={{ color: '#7ad7f0', marginBottom: 12 }}>{status}</div>}
      {error && (
        <div style={{ color: 'var(--danger)', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {inviteToken ? (
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google']}
          redirectTo="/"
          magicLink
          localization={{ variables: { sign_in: { email_label: 'Work email' } } }}
        />
      ) : (
        <div style={{ color: 'var(--muted)', fontSize: 14 }}>
          Enter a valid invite token to unlock email and Google sign-in. Tokens are managed in the admin dashboard.
        </div>
      )}
    </div>
  );
}
