import { NextRequest, NextResponse } from 'next/server';
import { projectStore } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    projectStore.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete project', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
