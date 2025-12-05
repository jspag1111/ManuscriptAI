import { NextResponse } from 'next/server';
import { getServerSupabase, getServiceRoleSupabase } from '../../../lib/supabaseServer';
import type { Json } from '../../../types/supabase';
import { Project } from '../../../types';

const mapRowToProject = (row: any): Project => {
  const payload = (row?.payload as Project) || {};
  return { ...payload, id: row.id, title: row.title || payload.title, description: row.description || payload.description } as Project;
};

async function requireUser() {
  const supabase = getServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { userId: null };
  return { userId: data.user.id };
}

export async function GET() {
  const { userId } = await requireUser();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const supabase = getServiceRoleSupabase();
  const { data, error } = await supabase.from('projects').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
  if (error) return new NextResponse('Failed to load projects', { status: 500 });
  return NextResponse.json((data || []).map(mapRowToProject));
}

export async function POST(request: Request) {
  const body: Project = await request.json();
  const { userId } = await requireUser();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const supabase = getServiceRoleSupabase();
  const payload = body as unknown as Json;
  const { error, data } = await supabase
    .from('projects')
    .upsert({
      id: body.id,
      user_id: userId,
      title: body.title,
      description: body.description,
      payload,
      updated_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();

  if (error || !data) {
    return new NextResponse('Failed to save project', { status: 500 });
  }

  return NextResponse.json(mapRowToProject(data));
}
