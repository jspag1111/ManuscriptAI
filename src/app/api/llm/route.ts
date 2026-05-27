import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { generatePubMedSearchQuery, generateSectionDraft, refineTextSelection, summarizeReference } from '@/services/llmService';
import type { Project, Section } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LlmRoutePayload =
  | {
      action: 'generateSectionDraft';
      project: Project;
      section: Section;
      instructions: string;
    }
  | {
      action: 'refineTextSelection';
      selection: string;
      instruction: string;
      fullContext: string;
      project?: Project;
    }
  | {
      action: 'summarizeReference';
      referenceText: string;
    }
  | {
      action: 'generatePubMedSearchQuery';
      userQuery: string;
    };

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const readPayload = async (request: Request): Promise<LlmRoutePayload> => {
  const payload = await request.json();
  if (!isObject(payload) || typeof payload.action !== 'string') {
    throw new Error('Invalid LLM request payload.');
  }
  return payload as LlmRoutePayload;
};

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await readPayload(request);

    switch (payload.action) {
      case 'generateSectionDraft': {
        if (!isObject(payload.project) || !isObject(payload.section) || typeof payload.instructions !== 'string') {
          return NextResponse.json({ error: 'Invalid draft request.' }, { status: 400 });
        }
        const result = await generateSectionDraft(payload.project, payload.section, payload.instructions);
        return NextResponse.json(result);
      }
      case 'refineTextSelection': {
        if (
          typeof payload.selection !== 'string'
          || typeof payload.instruction !== 'string'
          || typeof payload.fullContext !== 'string'
        ) {
          return NextResponse.json({ error: 'Invalid refinement request.' }, { status: 400 });
        }
        const result = await refineTextSelection(payload.selection, payload.instruction, payload.fullContext, payload.project);
        return NextResponse.json(result);
      }
      case 'summarizeReference': {
        if (typeof payload.referenceText !== 'string') {
          return NextResponse.json({ error: 'Invalid summary request.' }, { status: 400 });
        }
        const summary = await summarizeReference(payload.referenceText);
        return NextResponse.json({ summary });
      }
      case 'generatePubMedSearchQuery': {
        if (typeof payload.userQuery !== 'string') {
          return NextResponse.json({ error: 'Invalid PubMed query request.' }, { status: 400 });
        }
        const query = await generatePubMedSearchQuery(payload.userQuery);
        return NextResponse.json({ query });
      }
      default:
        return NextResponse.json({ error: 'Unsupported LLM action.' }, { status: 400 });
    }
  } catch (error) {
    console.error('LLM API route error:', error);
    const message = error instanceof Error ? error.message : 'LLM request failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
