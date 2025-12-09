import { NextResponse } from 'next/server';
import { projectStore } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const projects = projectStore.getAll();
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Failed to fetch projects', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const saved = projectStore.save(body);
    return NextResponse.json(saved);
  } catch (error) {
    console.error('Failed to save project', error);
    return NextResponse.json({ error: 'Failed to save project' }, { status: 500 });
  }
}
