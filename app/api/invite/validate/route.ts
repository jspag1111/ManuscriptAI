import { NextResponse } from 'next/server';
import { getServiceRoleSupabase } from '../../../../lib/supabaseServer';

export async function POST(request: Request) {
  const { token } = await request.json();
  if (!token) {
    return new NextResponse('Invite token is required', { status: 400 });
  }

  const supabase = getServiceRoleSupabase();
  const { data, error } = await supabase
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

  if (data.redeemed_by) {
    return new NextResponse('Invite token has already been used', { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
