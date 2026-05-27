import { getLlmClient } from '@/lib/llm';
import { generateClarifyingQuestionsAndPlan } from '@/lib/discover/agent';
import { generatePubMedSearchQuery, generateSectionDraft, refineTextSelection, summarizeReference } from '@/services/llmService';
import type { Project, Section } from '@/types';

const preview = (value: string) => value.replace(/\s+/g, ' ').trim().slice(0, 180);

const assertNonEmpty = (name: string, value: string) => {
  if (!value.trim()) {
    throw new Error(`${name} returned empty text`);
  }
};

const run = async <T>(name: string, fn: () => Promise<T>) => {
  const started = Date.now();
  const result = await fn();
  const elapsed = Date.now() - started;
  console.log(`PASS ${name} (${elapsed}ms)`);
  return result;
};

const project = {
  id: 'verify-project',
  title: 'Local LangChain Verification',
  projectType: 'GENERAL',
  references: [],
  sections: [],
  settings: {
    targetJournal: '',
    tone: 'clear and concise',
    formattingRequirements: '',
  },
  writingBrief: {
    blocks: [
      {
        id: 'brief-audience',
        title: 'Audience',
        content: 'Write for clinicians who need a concise operational summary.',
      },
    ],
  },
} as unknown as Project;

const section = {
  id: 'verify-section',
  title: 'Summary',
  userNotes: 'Explain that local LangChain generation is available.',
  content: 'Existing placeholder text.',
  useReferences: false,
  draftingContext: {
    briefBlockIds: ['brief-audience'],
    sectionIds: [],
    includeCurrentContent: true,
  },
} as unknown as Section;

const main = async () => {
  process.env.MANUSCRIPTAI_LLM_PROVIDER ||= 'langchain';
  process.env.MANUSCRIPTAI_LMSTUDIO_BASE_URL ||= 'http://localhost:1234/v1';
  process.env.MANUSCRIPTAI_LMSTUDIO_MODEL ||= 'openai/gpt-oss-20b';
  process.env.MANUSCRIPTAI_LLM_MODEL_FAST ||= process.env.MANUSCRIPTAI_LMSTUDIO_MODEL;
  process.env.MANUSCRIPTAI_LLM_MODEL_QUALITY ||= process.env.MANUSCRIPTAI_LMSTUDIO_MODEL;

  const llm = getLlmClient();
  console.log(`Provider: ${llm.provider}`);

  const text = await run('generateText', async () => llm.generateText({
    system: 'Reply in one short sentence.',
    prompt: 'Say that LM Studio is connected.',
    maxOutputTokens: 128,
    temperature: 0,
  }));
  assertNonEmpty('generateText', text.text);
  console.log(`  ${preview(text.text)}`);

  const json = await run('generateJson', async () => llm.generateJson<{ ok: boolean; provider: string }>({
    system: 'Return only strict JSON.',
    prompt: 'Return {"ok": true, "provider": "lmstudio"}.',
    maxOutputTokens: 256,
    temperature: 0,
  }));
  if (json.data.ok !== true || json.data.provider !== 'lmstudio') {
    throw new Error(`generateJson returned unexpected data: ${JSON.stringify(json.data)}`);
  }

  const draft = await run('generateSectionDraft', async () => generateSectionDraft(
    project,
    section,
    'Write one concise sentence only.'
  ));
  assertNonEmpty('generateSectionDraft', draft.text);
  console.log(`  ${preview(draft.text)}`);

  const refined = await run('refineTextSelection', async () => refineTextSelection(
    'Local generation works.',
    'Make this more formal in one sentence.',
    'Local generation works inside the editor.',
    project
  ));
  assertNonEmpty('refineTextSelection', refined.text);
  console.log(`  ${preview(refined.text)}`);

  const summary = await run('summarizeReference', async () => summarizeReference(
    'Smith J. Local language model workflows for research writing. Abstract: Local models can reduce latency and improve privacy for drafting workflows.'
  ));
  assertNonEmpty('summarizeReference', summary);
  console.log(`  ${preview(summary)}`);

  const pubmedQuery = await run('generatePubMedSearchQuery', async () => generatePubMedSearchQuery(
    'recent reviews about local large language models in clinical writing'
  ));
  assertNonEmpty('generatePubMedSearchQuery', pubmedQuery);
  console.log(`  ${preview(pubmedQuery)}`);

  const discoverStart = await run('generateClarifyingQuestionsAndPlan', async () => generateClarifyingQuestionsAndPlan({
    llmClient: llm,
    userRequest: 'Find recent reviews about large language models supporting clinical writing workflows.',
    mode: 'highly_relevant',
    exclusions: { englishOnly: true, excludeAnimalOnly: true },
    constraints: { yearFrom: 2022 },
  }));
  if (discoverStart.plan.length === 0) {
    throw new Error('generateClarifyingQuestionsAndPlan returned no plan items');
  }
  console.log(`  plan: ${discoverStart.plan.map(preview).join(' | ')}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
