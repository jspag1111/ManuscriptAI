import { NextResponse } from 'next/server';
import { getServerSupabase, getServiceRoleSupabase } from '../../../../lib/supabaseServer';

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = getServerSupabase();
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const service = getServiceRoleSupabase();
  const { error } = await service.from('projects').delete().eq('id', params.id).eq('user_id', userId);
  if (error) return new NextResponse('Failed to delete project', { status: 500 });
  return new NextResponse(null, { status: 204 });
}
