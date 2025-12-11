import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { projectStore } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const projects = await projectStore.getAll(userId);
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Failed to fetch projects', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const saved = await projectStore.save(body, userId);
    return NextResponse.json(saved);
  } catch (error) {
    console.error('Failed to save project', error);
    return NextResponse.json({ error: 'Failed to save project' }, { status: 500 });
  }
}
