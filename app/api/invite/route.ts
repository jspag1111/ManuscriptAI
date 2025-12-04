import { NextResponse } from 'next/server';
import { getServiceRoleSupabase, getServerSupabase } from '../../../lib/supabaseServer';
import crypto from 'crypto';

const ADMIN_EMAILS = (process.env.ADMIN_ALLOWED_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean);

async function ensureAdmin() {
  const supabase = getServerSupabase();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email?.toLowerCase();
  if (!email || !ADMIN_EMAILS.includes(email)) {
    return { ok: false, response: new NextResponse('Forbidden', { status: 403 }) };
  }
  return { ok: true, email };
}

export async function GET() {
  const adminCheck = await ensureAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const supabase = getServiceRoleSupabase();
  const { data, error } = await supabase.from('invite_tokens').select('*').order('created_at', { ascending: false });
  if (error) {
    return new NextResponse('Failed to load invites', { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const adminCheck = await ensureAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { allowed_email, expires_at, notes } = await request.json();
  const token = crypto.randomBytes(12).toString('hex');
  const supabase = getServiceRoleSupabase();
  const { error } = await supabase.from('invite_tokens').insert({
    token,
    allowed_email: allowed_email || null,
    expires_at: expires_at || null,
    notes: notes || null,
  });

  if (error) {
    return new NextResponse('Failed to create invite token', { status: 500 });
  }

  return NextResponse.json({ token });
}
