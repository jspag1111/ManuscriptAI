'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ShieldCheck, LockKeyhole, LogOut } from 'lucide-react';
import { useInvite } from '../providers/InviteProvider';
import { useSupabase } from '../providers/SupabaseProvider';

interface AccessGateProps {
  email: string | null;
  reason?: 'missing' | 'invalid';
}

export function AccessGate({ email, reason = 'missing' }: AccessGateProps) {
  const router = useRouter();
  const supabase = useSupabase();
  const { inviteToken, setInviteToken } = useInvite();
  const [tokenInput, setTokenInput] = useState(inviteToken ?? '');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (inviteToken) {
      setTokenInput(inviteToken);
    }
  }, [inviteToken]);

  const validateToken = async () => {
    const trimmed = tokenInput.trim();
    if (!trimmed) return;

    setStatus('Validating invite token...');
    setError(null);
    const response = await fetch('/api/invite/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: trimmed }),
    });

    if (!response.ok) {
      const message = await response.text();
      setStatus(null);
      setError(message || 'Invalid invite token.');
      return;
    }

    setInviteToken(trimmed);
    setStatus('Invite accepted. Loading your workspace...');
    router.refresh();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setInviteToken(null);
    router.refresh();
  };

  return (
    <div className="card" style={{ padding: 24, marginTop: 24 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <ShieldCheck size={18} color="#7ad7f0" />
        <div>
          <div style={{ fontWeight: 700 }}>Invite required</div>
          <div style={{ color: 'var(--muted)', fontSize: 14 }}>
            {reason === 'invalid'
              ? 'Your current invite token is invalid or expired. Please enter a new one.'
              : 'Enter a valid invite token to unlock the Manuscript workspace.'}
          </div>
        </div>
      </div>

      <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 12 }}>
        Signed in as <strong>{email || 'unknown user'}</strong>. Admin emails in <code>ADMIN_ALLOWED_EMAILS</code> can bypass
        this step.
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <input
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="Enter invite token"
          style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
        />
        <button
          onClick={validateToken}
          style={{ padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(120deg, var(--accent), var(--accent-strong))', color: '#0b1021', border: 'none', fontWeight: 700 }}
        >
          Validate
        </button>
      </div>

      {status && (
        <div style={{ color: '#7ad7f0', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <LockKeyhole size={16} />
          <span>{status}</span>
        </div>
      )}
      {error && (
        <div style={{ color: 'var(--danger)', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={signOut}
          style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
}
