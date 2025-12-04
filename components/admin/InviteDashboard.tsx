'use client';

import { useEffect, useState } from 'react';
import { useInvite } from '../providers/InviteProvider';
import { Shield, RefreshCcw, PlusCircle } from 'lucide-react';

type InviteRow = {
  token: string;
  allowed_email: string | null;
  expires_at: string | null;
  redeemed_by: string | null;
  notes: string | null;
  created_at: string;
};

export function InviteDashboard() {
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowedEmail, setAllowedEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const { setInviteToken } = useInvite();

  const loadInvites = async () => {
    setLoading(true);
    setError(null);
    const response = await fetch('/api/invite', { cache: 'no-store' });
    if (!response.ok) {
      setError('You must be an admin (ADMIN_ALLOWED_EMAILS) to view tokens.');
      setInvites([]);
      setLoading(false);
      return;
    }
    const data = await response.json();
    setInvites(data);
    setLoading(false);
  };

  useEffect(() => {
    loadInvites();
  }, []);

  const createInvite = async () => {
    setLoading(true);
    setError(null);
    const response = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowed_email: allowedEmail || null, notes, expires_at: expiresAt || null }),
    });
    if (!response.ok) {
      setError('Failed to create invite');
      setLoading(false);
      return;
    }
    const { token } = await response.json();
    setInviteToken(token);
    await loadInvites();
    setAllowedEmail('');
    setNotes('');
    setExpiresAt('');
  };

  return (
    <div className="card" style={{ padding: 24, marginTop: 24 }}>
      <div className="flex-between" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Shield size={18} color="#7ad7f0" />
          <div>
            <div style={{ fontWeight: 700 }}>Invite tokens</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Restrict access by email and expiry.</div>
          </div>
        </div>
        <button onClick={loadInvites} style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, padding: '8px 12px' }}>
          <RefreshCcw size={14} /> Refresh
        </button>
      </div>
      <div className="grid-responsive">
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Create token</div>
          <label style={{ color: 'var(--muted)', fontSize: 13 }}>Allowed email (optional)</label>
          <input value={allowedEmail} onChange={(e) => setAllowedEmail(e.target.value)} style={{ width: '100%', marginBottom: 8, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
          <label style={{ color: 'var(--muted)', fontSize: 13 }}>Expiry (ISO string)</label>
          <input value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} placeholder="2025-12-31T23:59:59Z" style={{ width: '100%', marginBottom: 8, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
          <label style={{ color: 'var(--muted)', fontSize: 13 }}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%', minHeight: 80, marginBottom: 8, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
          <button onClick={createInvite} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, border: 'none', background: 'linear-gradient(120deg, var(--accent), var(--accent-strong))', color: '#0b1021', fontWeight: 700 }}>
            <PlusCircle size={16} />
            Create invite
          </button>
        </div>
        <div className="card" style={{ padding: 16, minHeight: 200 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Existing tokens</div>
          {loading && <div style={{ color: 'var(--muted)' }}>Loading...</div>}
          {error && <div style={{ color: 'var(--danger)', marginBottom: 8 }}>{error}</div>}
          {!loading && invites.length === 0 && <div style={{ color: 'var(--muted)' }}>No invites yet.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {invites.map((invite) => (
              <div key={invite.token} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--surface)' }}>
                <div style={{ fontWeight: 700 }}>{invite.token}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Email: {invite.allowed_email || 'Any'}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Expires: {invite.expires_at || 'No expiry'}</div>
                <div style={{ color: invite.redeemed_by ? 'var(--accent-strong)' : 'var(--muted)', fontSize: 13 }}>
                  Status: {invite.redeemed_by ? 'Redeemed' : 'Open'}
                </div>
                {invite.notes && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Notes: {invite.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
