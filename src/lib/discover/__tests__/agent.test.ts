import { describe, expect, it, vi } from 'vitest';

import { generateClarifyingQuestionsAndPlan, createDiscoverRunState } from '../agent';
import type { LlmClient } from '@/lib/llm/types';

describe('createDiscoverRunState', () => {
  it('normalizes the discover mode and seeds default state', () => {
    const state = createDiscoverRunState({
      userId: 'user-123',
      userRequest: 'Find recent trials',
      mode: 'unrecognized-mode' as any,
      exclusions: { englishOnly: true, excludeCaseReports: false, excludeAnimalOnly: false, excludePediatrics: false },
      constraints: { mustInclude: '', mustExclude: '', yearFrom: null, yearTo: null },
    });

    expect(state.stage).toBe('CLARIFY');
    expect(state.mode).toBe('comprehensive');
    expect(state.id).toBeTruthy();
    expect(state.logs).toEqual([]);
    expect(state.plan).toEqual([]);
  });

  it('preserves provided starting values without clobbering logs', () => {
    const start = {
      clarifyingQuestions: [{ id: 'q1', question: 'Existing?' }],
      plan: ['Existing plan item'],
      logs: ['pre-seeded log'],
    };

    const state = createDiscoverRunState({
      userId: 'user-123',
      userRequest: 'Find recent trials',
      mode: 'comprehensive',
      exclusions: { englishOnly: false, excludeCaseReports: false, excludeAnimalOnly: false, excludePediatrics: false },
      constraints: { mustInclude: '', mustExclude: '', yearFrom: null, yearTo: null },
      start,
    });

    expect(state.clarifyingQuestions).toEqual(start.clarifyingQuestions);
    expect(state.plan).toEqual(start.plan);
    expect(state.logs).toEqual(start.logs);
  });
});

describe('generateClarifyingQuestionsAndPlan', () => {
  it('sanitizes and limits clarifying questions, plan items, and assumptions', async () => {
    const mockClient: LlmClient = {
      provider: 'gemini',
      generateText: vi.fn(),
      generateJson: vi.fn().mockResolvedValue({
        data: {
          clarifyingQuestions: [
            { question: 'First question? ' },
            { id: '', question: '   ' },
            { id: 'custom-id', question: ' Second question ' },
            { question: 'Third question' },
            { question: 'Fourth question' },
          ],
          plan: [' Step one ', '', 'Step two', 'Step three', 'Step four', 'Step five', 'Step six', 'Step seven'],
          assumptions: ['A', 'B', 'C', 'D', 'E'],
        },
        rawText: '{}',
        rawJson: '{}',
        model: 'mock-model',
      }),
    };

    const result = await generateClarifyingQuestionsAndPlan({
      llmClient: mockClient,
      userRequest: 'Search for oncology studies',
      mode: 'highly_relevant',
      exclusions: { englishOnly: false, excludeCaseReports: false, excludeAnimalOnly: false, excludePediatrics: false },
      constraints: { mustInclude: '', mustExclude: '', yearFrom: null, yearTo: null },
    });

    expect(result.model).toBe('mock-model');
    expect(result.clarifyingQuestions).toEqual([
      { id: 'q1', question: 'First question?' },
      { id: 'custom-id', question: 'Second question' },
      { id: 'q4', question: 'Third question' },
    ]);
    expect(result.plan).toEqual(['Step one', 'Step two', 'Step three', 'Step four', 'Step five', 'Step six']);
    expect(result.assumptions).toEqual(['A', 'B', 'C', 'D']);
  });

  it('returns empty lists when the LLM payload is missing or malformed', async () => {
    const mockClient: LlmClient = {
      provider: 'gemini',
      generateText: vi.fn(),
      generateJson: vi.fn().mockResolvedValue({
        data: undefined,
        rawText: '{}',
        rawJson: '{}',
        model: 'mock-model',
      }),
    };

    const result = await generateClarifyingQuestionsAndPlan({
      llmClient: mockClient,
      userRequest: 'Search for oncology studies',
      mode: 'highly_relevant',
      exclusions: { englishOnly: false, excludeCaseReports: false, excludeAnimalOnly: false, excludePediatrics: false },
      constraints: { mustInclude: '', mustExclude: '', yearFrom: null, yearTo: null },
    });

    expect(result.clarifyingQuestions).toEqual([]);
    expect(result.plan).toEqual([]);
    expect(result.assumptions).toEqual([]);
  });
});
