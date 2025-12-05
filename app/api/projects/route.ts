import { NextResponse } from 'next/server';
import { getProjects, saveProject } from '@/server/projectStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const projects = await getProjects();
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Failed to fetch projects', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const saved = await saveProject(body);
    return NextResponse.json(saved);
  } catch (error) {
    console.error('Failed to save project', error);
    return NextResponse.json({ error: 'Failed to save project' }, { status: 500 });
  }
}
