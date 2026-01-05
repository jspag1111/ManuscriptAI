import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { chatkitDocumentStore } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sanitizeFilename = (filename: string) => {
  const trimmed = filename.trim();
  if (!trimmed) return 'document.md';
  return trimmed
    .replace(/[\r\n\t"\\]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 120);
};

const toContentType = (format: string) => {
  if (format === 'txt') return 'text/plain; charset=utf-8';
  return 'text/markdown; charset=utf-8';
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing document id' }, { status: 400 });
  }

  const document = await chatkitDocumentStore.get(id, userId);
  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const filename = sanitizeFilename(document.filename);

  return new NextResponse(document.content, {
    headers: {
      'Content-Type': toContentType(document.format),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
