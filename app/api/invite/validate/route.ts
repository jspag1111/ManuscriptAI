import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSupabase, getServiceRoleSupabase } from '../../../../lib/supabaseServer';

const ADMIN_EMAILS = (process.env.ADMIN_ALLOWED_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function POST(request: Request) {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase() ?? null;

  if (!user || !email) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  if (ADMIN_EMAILS.includes(email)) {
    const response = NextResponse.json({ ok: true, adminBypass: true });
    cookies().set('invite_token', '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 });
    return response;
  }

  const { token } = await request.json();
  if (!token) {
    return new NextResponse('Invite token is required', { status: 400 });
  }

  const serviceSupabase = getServiceRoleSupabase();
  const { data, error } = await serviceSupabase
    .from('invite_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    return new NextResponse('Unable to validate invite token', { status: 500 });
  }

  if (!data) {
    return new NextResponse('Invite token not found', { status: 404 });
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return new NextResponse('Invite token expired', { status: 403 });
  }

  if (data.allowed_email && data.allowed_email.toLowerCase() !== email) {
    return new NextResponse('This invite token is restricted to a different email.', { status: 403 });
  }

  if (data.redeemed_by && data.redeemed_by.toLowerCase() !== email) {
    return new NextResponse('Invite token has already been used', { status: 409 });
  }

  const response = NextResponse.json({ ok: true, redeemed_by: data.redeemed_by || email });

  if (!data.redeemed_by) {
    await serviceSupabase
      .from('invite_tokens')
      .update({ redeemed_by: email })
      .eq('token', token);
  }

  response.cookies.set('invite_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
