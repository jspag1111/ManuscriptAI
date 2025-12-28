import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { discoverRunStore } from '@/lib/db';
import { getLlmClient } from '@/lib/llm';
import { createDiscoverRunState, generateClarifyingQuestionsAndPlan, runDiscoverSearch } from '@/lib/discover/agent';
import type { DiscoverConstraints, DiscoverExclusions, DiscoverFeedback, DiscoverMode } from '@/lib/discover/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StartBody = {
  action: 'start';
  request: string;
  mode?: DiscoverMode;
  exclusions?: DiscoverExclusions;
  constraints?: DiscoverConstraints;
};

type SearchBody = {
  action: 'search';
  runId: string;
  clarifyingAnswers?: Record<string, string>;
  feedback?: Partial<DiscoverFeedback>;
  additionalTarget?: number;
};

type AgentBody = StartBody | SearchBody;

const asBool = (value: unknown) => value === true;

const coerceExclusions = (raw: unknown): DiscoverExclusions => {
  const obj = (raw && typeof raw === 'object') ? (raw as any) : {};
  return {
    excludeCaseReports: asBool(obj.excludeCaseReports),
    excludePediatrics: asBool(obj.excludePediatrics),
    excludeAnimalOnly: asBool(obj.excludeAnimalOnly),
    englishOnly: asBool(obj.englishOnly),
  };
};

const coerceConstraints = (raw: unknown): DiscoverConstraints => {
  const obj = (raw && typeof raw === 'object') ? (raw as any) : {};
  const yearFrom = typeof obj.yearFrom === 'number' ? obj.yearFrom : (typeof obj.yearFrom === 'string' ? Number(obj.yearFrom) : undefined);
  const yearTo = typeof obj.yearTo === 'number' ? obj.yearTo : (typeof obj.yearTo === 'string' ? Number(obj.yearTo) : undefined);
  return {
    yearFrom: Number.isFinite(yearFrom) ? yearFrom : undefined,
    yearTo: Number.isFinite(yearTo) ? yearTo : undefined,
    mustInclude: typeof obj.mustInclude === 'string' ? obj.mustInclude : undefined,
    mustExclude: typeof obj.mustExclude === 'string' ? obj.mustExclude : undefined,
  };
};

const coerceMode = (value: unknown): DiscoverMode => (value === 'highly_relevant' ? 'highly_relevant' : 'comprehensive');

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as AgentBody;
    if (!body || typeof body !== 'object' || !('action' in body)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    if (body.action === 'start') {
      const userRequest = typeof body.request === 'string' ? body.request.trim() : '';
      if (!userRequest) {
        return NextResponse.json({ error: 'Request is required' }, { status: 400 });
      }

      const mode = coerceMode(body.mode);
      const exclusions = coerceExclusions(body.exclusions);
      const constraints = coerceConstraints(body.constraints);

      const llmClient = getLlmClient();
      const start = await generateClarifyingQuestionsAndPlan({
        llmClient,
        userRequest,
        mode,
        exclusions,
        constraints,
      });

      const state = createDiscoverRunState({
        userId,
        userRequest,
        mode,
        exclusions,
        constraints,
        start: {
          clarifyingQuestions: start.clarifyingQuestions,
          plan: start.plan,
          logs: [`LLM: ${start.model}`, 'Ready to clarify search intent.'],
        },
      });

      await discoverRunStore.save(state);
      return NextResponse.json({
        runId: state.id,
        stage: state.stage,
        clarifyingQuestions: state.clarifyingQuestions,
        plan: state.plan,
        assumptions: start.assumptions,
        logs: state.logs,
      });
    }

    if (body.action === 'search') {
      const runId = typeof body.runId === 'string' ? body.runId.trim() : '';
      if (!runId) {
        return NextResponse.json({ error: 'runId is required' }, { status: 400 });
      }

      const existing = await discoverRunStore.get(runId, userId);
      if (!existing) {
        return NextResponse.json({ error: 'Run not found' }, { status: 404 });
      }

      const updated = await runDiscoverSearch({
        state: existing,
        clarifyingAnswers: body.clarifyingAnswers && typeof body.clarifyingAnswers === 'object' ? body.clarifyingAnswers : undefined,
        feedback: body.feedback && typeof body.feedback === 'object' ? body.feedback : undefined,
        additionalTarget: typeof body.additionalTarget === 'number' ? body.additionalTarget : undefined,
      });

      await discoverRunStore.save(updated);
      return NextResponse.json({
        runId: updated.id,
        stage: updated.stage,
        plan: updated.plan,
        rubric: updated.rubric,
        logs: updated.logs,
        attempts: updated.attempts,
        kept: Object.values(updated.kept),
        nextSuggestedAction: Object.keys(updated.kept).length > 0 ? 'MORE' : 'DONE',
      });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    console.error('Discover agent error', error);
    const rawMessage = error instanceof Error ? error.message : 'Discover agent failed';
    const message = rawMessage.length > 800 ? `${rawMessage.slice(0, 800)}…` : rawMessage;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
