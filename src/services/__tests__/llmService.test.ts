import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth } from '@clerk/nextjs/server';
import type { Project, Section } from '@/types';

const mockLlmClient = {
  provider: 'langchain',
  generateText: vi.fn(),
  generateJson: vi.fn(),
};

vi.mock('@/lib/llm', () => ({
  getLlmClient: vi.fn(() => mockLlmClient),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: 'user-test' })),
}));

const project = {
  id: 'project-1',
  title: 'Test Project',
  projectType: 'GENERAL',
  references: [],
  sections: [],
  settings: {
    targetJournal: '',
    tone: '',
    formattingRequirements: '',
  },
  writingBrief: {
    blocks: [
      { id: 'brief-1', title: 'Audience', content: 'Clinicians' },
    ],
  },
} as unknown as Project;

const section = {
  id: 'section-1',
  title: 'Introduction',
  userNotes: 'Explain the problem.',
  content: 'Existing text.',
  useReferences: false,
  draftingContext: {
    briefBlockIds: ['brief-1'],
    sectionIds: [],
    includeCurrentContent: true,
  },
} as unknown as Section;

describe('llmService text helpers', () => {
  beforeEach(() => {
    mockLlmClient.generateText.mockReset();
    mockLlmClient.generateJson.mockReset();
    vi.mocked(auth).mockResolvedValue({ userId: 'user-test' } as Awaited<ReturnType<typeof auth>>);
  });

  it('generates section drafts through the shared LLM client', async () => {
    mockLlmClient.generateText.mockResolvedValue({ text: 'Draft text', model: 'openai/gpt-oss-20b' });
    const { generateSectionDraft } = await import('../llmService');

    const result = await generateSectionDraft(project, section, 'Make it concise.');

    expect(result).toEqual({ text: 'Draft text', model: 'openai/gpt-oss-20b' });
    expect(mockLlmClient.generateText).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('Make it concise.'),
      system: expect.stringContaining('expert writing assistant'),
      maxOutputTokens: 8192,
    }));
  });

  it('refines selections and summarizes references through the shared LLM client', async () => {
    mockLlmClient.generateText
      .mockResolvedValueOnce({ text: 'Refined text', model: 'openai/gpt-oss-20b' })
      .mockResolvedValueOnce({ text: 'Summary text', model: 'openai/gpt-oss-20b' });
    const { refineTextSelection, summarizeReference } = await import('../llmService');

    await expect(refineTextSelection('rough text', 'tighten', 'full context', project)).resolves.toEqual({
      text: 'Refined text',
      model: 'openai/gpt-oss-20b',
    });
    await expect(summarizeReference('Paper title and abstract')).resolves.toBe('Summary text');
    expect(mockLlmClient.generateText).toHaveBeenCalledTimes(2);
  });

  it('generates PubMed search queries through the shared LLM client and strips fences', async () => {
    mockLlmClient.generateText.mockResolvedValue({
      text: '```\\n(\"Diabetes Mellitus\"[Mesh])\\n```',
      model: 'openai/gpt-oss-20b',
    });
    const { generatePubMedSearchQuery } = await import('../llmService');

    await expect(generatePubMedSearchQuery('diabetes reviews')).resolves.toBe('(\"Diabetes Mellitus\"[Mesh])');
    expect(mockLlmClient.generateText).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('diabetes reviews'),
    }));
  });

  it('handles browser-facing LLM route requests on the server', async () => {
    mockLlmClient.generateText.mockResolvedValue({ text: 'Summary text', model: 'openai/gpt-oss-20b' });
    const { POST } = await import('@/app/api/llm/route');

    const response = await POST(new Request('http://localhost/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'summarizeReference',
        referenceText: 'Paper title and abstract',
      }),
    }));

    await expect(response.json()).resolves.toEqual({ summary: 'Summary text' });
    expect(mockLlmClient.generateText).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('Paper title and abstract'),
    }));
  });

  it('rejects unauthenticated browser-facing LLM route requests', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);
    const { POST } = await import('@/app/api/llm/route');

    const response = await POST(new Request('http://localhost/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'summarizeReference',
        referenceText: 'Paper title and abstract',
      }),
    }));

    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(response.status).toBe(401);
    expect(mockLlmClient.generateText).not.toHaveBeenCalled();
  });
});
