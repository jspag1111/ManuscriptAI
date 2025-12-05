import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { deleteProject } from '@/server/projectStore';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').filter(Boolean).pop();

    if (!id) {
      return NextResponse.json({ error: 'Project id is required' }, { status: 400 });
    }

    await deleteProject(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete project', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
