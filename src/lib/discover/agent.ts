import { generateId } from '@/lib/projects';
import { getLlmClient } from '@/lib/llm';
import type { LlmClient } from '@/lib/llm/types';
import { pubmedElinkRelated, pubmedEsearch, pubmedEsummary } from './pubmed';
import type {
  DiscoverClarifyingQuestion,
  DiscoverConstraints,
  DiscoverExclusions,
  DiscoverFeedback,
  DiscoverKeptItem,
  DiscoverMode,
  DiscoverQueryAttempt,
  DiscoverRunState,
} from './types';

const now = () => Date.now();

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizeMode = (mode: DiscoverMode): DiscoverMode => (mode === 'highly_relevant' ? 'highly_relevant' : 'comprehensive');

const buildGlobalFilters = (exclusions: DiscoverExclusions, constraints: DiscoverConstraints): string => {
  const parts: string[] = [];

  if (constraints.mustInclude && constraints.mustInclude.trim()) {
    parts.push(`AND (${constraints.mustInclude.trim()})`);
  }

  if (constraints.mustExclude && constraints.mustExclude.trim()) {
    parts.push(`NOT (${constraints.mustExclude.trim()})`);
  }

  if (constraints.yearFrom || constraints.yearTo) {
    const from = constraints.yearFrom ? String(constraints.yearFrom) : '1800';
    const to = constraints.yearTo ? String(constraints.yearTo) : String(new Date().getFullYear());
    parts.push(`AND ("${from}"[Date - Publication] : "${to}"[Date - Publication])`);
  }

  if (exclusions.englishOnly) {
    parts.push('AND english[lang]');
  }

  if (exclusions.excludeCaseReports) {
    parts.push('NOT ("Case Reports"[Publication Type])');
  }

  if (exclusions.excludeAnimalOnly) {
    // Common PubMed pattern for excluding animal-only studies while retaining human/mixed studies.
    parts.push('NOT (animals[mh] NOT humans[mh])');
  }

  if (exclusions.excludePediatrics) {
    parts.push('NOT (infant[mh] OR child[mh] OR adolescent[mh])');
  }

  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
};

const dedupeTitles = (items: { pmid: string; title: string }[]) => {
  const seen = new Set<string>();
  const out: { pmid: string; title: string }[] = [];
  for (const item of items) {
    if (!item?.pmid || !item?.title) continue;
    if (seen.has(item.pmid)) continue;
    seen.add(item.pmid);
    out.push({ pmid: item.pmid, title: item.title });
  }
  return out;
};

type LlmStartPayload = {
  clarifyingQuestions: Array<{ id: string; question: string }>;
  assumptions: string[];
  plan: string[];
};

type LlmSearchSpec = {
  rubric: string;
  queries: Array<{
    query: string;
    sort?: 'relevance' | 'pub_date';
    intent?: string;
  }>;
};

type LlmTitleGate = {
  decisions: Array<{
    pmid: string;
    keep: boolean;
    reason: string;
    confidence?: number;
  }>;
};

const ensureQuestionIds = (questions: Array<{ id?: string; question?: string }>): DiscoverClarifyingQuestion[] =>
  (Array.isArray(questions) ? questions : [])
    .map((q, index) => ({
      id: typeof q?.id === 'string' && q.id.trim().length > 0 ? q.id.trim() : `q${index + 1}`,
      question: typeof q?.question === 'string' ? q.question.trim() : '',
    }))
    .filter((q) => q.question.length > 0)
    .slice(0, 3);

const safeStringArray = (value: unknown, max = 12): string[] =>
  (Array.isArray(value) ? value : [])
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
    .slice(0, max);

const safeQueries = (queries: any, max = 12): LlmSearchSpec['queries'] =>
  (Array.isArray(queries) ? queries : [])
    .map((q: any) => {
      const query = typeof q?.query === 'string' ? q.query.trim() : '';
      const sort: 'relevance' | 'pub_date' = q?.sort === 'pub_date' ? 'pub_date' : 'relevance';
      const intent = typeof q?.intent === 'string' ? q.intent.trim() : undefined;
      return { query, sort, intent };
    })
    .filter((q) => q.query.length > 0)
    .slice(0, max);

const llm = (): LlmClient => getLlmClient();

export const createDiscoverRunState = ({
  userId,
  userRequest,
  mode,
  exclusions,
  constraints,
  start,
}: {
  userId: string;
  userRequest: string;
  mode: DiscoverMode;
  exclusions: DiscoverExclusions;
  constraints: DiscoverConstraints;
  start?: Partial<Pick<DiscoverRunState, 'clarifyingQuestions' | 'plan' | 'logs'>>;
}): DiscoverRunState => {
  const createdAt = now();
  return {
    version: 1,
    id: generateId(),
    userId,
    createdAt,
    updatedAt: createdAt,
    stage: 'CLARIFY',
    userRequest,
    mode: normalizeMode(mode),
    exclusions,
    constraints,
    clarifyingQuestions: start?.clarifyingQuestions ?? [],
    clarifyingAnswers: {},
    plan: start?.plan ?? [],
    rubric: '',
    attempts: [],
    kept: {},
    rejected: {},
    feedback: { thumbsUpPmids: [], thumbsDownPmids: [] },
    logs: start?.logs ?? [],
  };
};

export const generateClarifyingQuestionsAndPlan = async ({
  llmClient,
  userRequest,
  mode,
  exclusions,
  constraints,
}: {
  llmClient: LlmClient;
  userRequest: string;
  mode: DiscoverMode;
  exclusions: DiscoverExclusions;
  constraints: DiscoverConstraints;
}): Promise<{ clarifyingQuestions: DiscoverClarifyingQuestion[]; plan: string[]; assumptions: string[]; model: string }> => {
  const system = `You are a careful PubMed search agent. Ask only clarifying questions that materially change the search and would improve recall/precision. If none are needed, ask 0 questions. Return ONLY valid JSON.`;

  const prompt = `User request:\n${userRequest}\n\nMode:\n${mode}\n\nExclusions:\n${JSON.stringify(exclusions)}\n\nConstraints:\n${JSON.stringify(constraints)}\n\nReturn JSON with this shape:\n{\n  \"clarifyingQuestions\": [{\"id\":\"q1\",\"question\":\"...\"}],\n  \"assumptions\": [\"...\"],\n  \"plan\": [\"...\"]\n}\n\nRules:\n- Max 3 clarifying questions.\n- Plan: 3-6 short bullets.\n- Assumptions: 0-4.\n- No markdown, no extra keys.`;

  const response = await llmClient.generateJson<LlmStartPayload>({
    system,
    prompt,
    model: process.env.MANUSCRIPTAI_LLM_MODEL_FAST,
    maxOutputTokens: 1200,
    temperature: 0.2,
  });

  const payload = response.data;
  return {
    clarifyingQuestions: ensureQuestionIds(payload?.clarifyingQuestions || []),
    plan: safeStringArray(payload?.plan, 6),
    assumptions: safeStringArray(payload?.assumptions, 4),
    model: response.model,
  };
};

const generateSearchSpec = async ({
  llmClient,
  userRequest,
  mode,
  exclusions,
  constraints,
  clarifyingQuestions,
  clarifyingAnswers,
  feedback,
  keptTitlesSample,
}: {
  llmClient: LlmClient;
  userRequest: string;
  mode: DiscoverMode;
  exclusions: DiscoverExclusions;
  constraints: DiscoverConstraints;
  clarifyingQuestions: DiscoverClarifyingQuestion[];
  clarifyingAnswers: Record<string, string>;
  feedback: DiscoverFeedback;
  keptTitlesSample: string[];
}): Promise<{ rubric: string; queries: LlmSearchSpec['queries']; model: string }> => {
  const system = `You are a PubMed search agent. Produce diversified PubMed queries and a relevance rubric. Return ONLY valid JSON.`;

  const prompt = `User request:\n${userRequest}\n\nMode:\n${mode}\n\nExclusions (already applied globally; do not embed these as filters in queries):\n${JSON.stringify(exclusions)}\n\nConstraints (already applied globally; do not embed these as filters in queries):\n${JSON.stringify(constraints)}\n\nClarifying Q/A:\n${JSON.stringify({ questions: clarifyingQuestions, answers: clarifyingAnswers })}\n\nUser feedback:\n${JSON.stringify(feedback)}\n\nAlready-kept titles (sample, may be empty):\n${keptTitlesSample.map((t) => `- ${t}`).join('\n')}\n\nReturn JSON with this shape:\n{\n  \"rubric\": \"Short rubric describing what to include/exclude.\",\n  \"queries\": [\n    {\"query\": \"...\", \"sort\": \"relevance\", \"intent\": \"strict\"},\n    {\"query\": \"...\", \"sort\": \"pub_date\", \"intent\": \"recent\"}\n  ]\n}\n\nRules:\n- Provide 6-10 queries.\n- Include at least: strict/PICO, broad keywords, MeSH-heavy, review/guideline, and recent.\n- Query strings must be valid PubMed syntax, focusing on topic/method terms only.\n- Keep each query under ~300 characters.\n- No markdown, no extra keys.`;

  const response = await llmClient.generateJson<LlmSearchSpec>({
    system,
    prompt,
    model: process.env.MANUSCRIPTAI_LLM_MODEL_QUALITY || process.env.MANUSCRIPTAI_LLM_MODEL_FAST,
    maxOutputTokens: 2200,
    temperature: 0.2,
  });

  const data = response.data;
  const rubric = typeof data?.rubric === 'string' ? data.rubric.trim() : '';
  const queries = safeQueries(data?.queries, 12);
  return { rubric, queries, model: response.model };
};

const reviseQuery = async ({
  llmClient,
  userRequest,
  previousQuery,
  mode,
}: {
  llmClient: LlmClient;
  userRequest: string;
  previousQuery: string;
  mode: DiscoverMode;
}): Promise<{ query: string; model: string }> => {
  const system = `You are a PubMed search expert. You will be given a query that returned zero results; rewrite it to be slightly broader while keeping intent. Return ONLY valid JSON.`;
  const prompt = `User request:\n${userRequest}\n\nMode:\n${mode}\n\nZero-result query:\n${previousQuery}\n\nReturn JSON: {\"query\":\"...\"}\nRules:\n- Keep syntax valid.\n- Prefer removing overly-specific phrases, rare abbreviations, or overly strict field tags.\n- Do not add global filters (language/year/exclusions).`;

  const response = await llmClient.generateJson<{ query: string }>({
    system,
    prompt,
    model: process.env.MANUSCRIPTAI_LLM_MODEL_FAST,
    maxOutputTokens: 600,
    temperature: 0.2,
  });

  return { query: typeof response.data?.query === 'string' ? response.data.query.trim() : '', model: response.model };
};

const gateTitlesForRelevance = async ({
  llmClient,
  userRequest,
  rubric,
  mode,
  candidates,
  feedback,
}: {
  llmClient: LlmClient;
  userRequest: string;
  rubric: string;
  mode: DiscoverMode;
  candidates: Array<{ pmid: string; title: string }>;
  feedback: DiscoverFeedback;
}): Promise<{ decisions: LlmTitleGate['decisions']; model: string }> => {
  const system = `You are screening PubMed search results for relevance. Use ONLY the title and the rubric. Return ONLY valid JSON.`;
  const prompt = `User request:\n${userRequest}\n\nMode:\n${mode}\n\nRubric:\n${rubric}\n\nUser feedback:\n${JSON.stringify(feedback)}\n\nCandidates:\n${candidates.map((c) => `- ${c.pmid}: ${c.title}`).join('\n')}\n\nReturn JSON:\n{\n  \"decisions\": [\n    {\"pmid\":\"...\",\"keep\":true,\"reason\":\"...\",\"confidence\":0.0}\n  ]\n}\n\nRules:\n- Decide for every PMID listed.\n- For \"highly_relevant\", keep only directly on-target titles.\n- For \"comprehensive\", include borderline-but-useful titles.\n- Confidence is 0.0 to 1.0.\n- No markdown, no extra keys.`;

  const response = await llmClient.generateJson<LlmTitleGate>({
    system,
    prompt,
    model: process.env.MANUSCRIPTAI_LLM_MODEL_FAST,
    maxOutputTokens: clamp(900 + candidates.length * 60, 1200, 5000),
    temperature: 0.1,
  });

  const decisions = Array.isArray(response.data?.decisions) ? response.data.decisions : [];
  return { decisions, model: response.model };
};

const collectKeptTitlesSample = (state: DiscoverRunState, max = 12): string[] => {
  const kept = Object.values(state.kept);
  kept.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  return kept.slice(0, max).map((k) => k.title);
};

const getBudgets = (mode: DiscoverMode) => {
  if (mode === 'highly_relevant') {
    return {
      targetTotal: 30,
      maxAttempts: 12,
      retmaxPerAttempt: 30,
      maxRetriesPerAttempt: 1,
      relatedSeedCount: 4,
      relatedLimit: 120,
    };
  }
  return {
    targetTotal: 80,
    maxAttempts: 18,
    retmaxPerAttempt: 60,
    maxRetriesPerAttempt: 1,
    relatedSeedCount: 6,
    relatedLimit: 220,
  };
};

const addLog = (state: DiscoverRunState, message: string) => {
  state.logs.push(message);
  if (state.logs.length > 250) state.logs = state.logs.slice(-250);
};

const appendAttempt = (state: DiscoverRunState, attempt: DiscoverQueryAttempt) => {
  state.attempts.push(attempt);
  if (state.attempts.length > 50) state.attempts = state.attempts.slice(-50);
};

const setKept = (state: DiscoverRunState, item: DiscoverKeptItem) => {
  state.kept[item.pmid] = item;
};

const setRejected = (state: DiscoverRunState, pmid: string, title: string, reason: string) => {
  state.rejected[pmid] = { pmid, title, reason };
};

export const runDiscoverSearch = async ({
  state,
  clarifyingAnswers,
  feedback,
  additionalTarget,
}: {
  state: DiscoverRunState;
  clarifyingAnswers?: Record<string, string>;
  feedback?: Partial<DiscoverFeedback>;
  additionalTarget?: number;
}): Promise<DiscoverRunState> => {
  const llmClient = llm();
  state.stage = 'SEARCHING';
  state.updatedAt = now();

  if (clarifyingAnswers) {
    state.clarifyingAnswers = { ...state.clarifyingAnswers, ...clarifyingAnswers };
  }
  if (feedback) {
    state.feedback = {
      thumbsUpPmids: Array.from(new Set([...(state.feedback.thumbsUpPmids || []), ...(feedback.thumbsUpPmids || [])])),
      thumbsDownPmids: Array.from(new Set([...(state.feedback.thumbsDownPmids || []), ...(feedback.thumbsDownPmids || [])])),
    };
  }

  const mode = normalizeMode(state.mode);
  const budgets = getBudgets(mode);
  const startingKept = Object.keys(state.kept).length;
  const targetTotal =
    typeof additionalTarget === 'number'
      ? clamp(startingKept + additionalTarget, startingKept, budgets.targetTotal + 60)
      : budgets.targetTotal;

  addLog(state, 'Creating search rubric and diversified queries...');
  const spec = await generateSearchSpec({
    llmClient,
    userRequest: state.userRequest,
    mode,
    exclusions: state.exclusions,
    constraints: state.constraints,
    clarifyingQuestions: state.clarifyingQuestions,
    clarifyingAnswers: state.clarifyingAnswers,
    feedback: state.feedback,
    keptTitlesSample: collectKeptTitlesSample(state),
  });
  state.rubric = spec.rubric;
  if (state.plan.length === 0) {
    state.plan = [
      'Run diverse PubMed queries',
      'Screen titles for relevance',
      'Expand using similar articles',
      'Return curated results',
    ];
  }

  const globalFilters = buildGlobalFilters(state.exclusions, state.constraints);
  const seen = new Set<string>([...Object.keys(state.kept), ...Object.keys(state.rejected)]);
  let consecutiveNoNew = 0;

  const runQuery = async (query: string, sort: 'relevance' | 'pub_date', source: 'llm' | 'retry' | 'related') => {
    if (Object.keys(state.kept).length >= targetTotal) return;
    if (state.attempts.length >= budgets.maxAttempts) return;

    const finalQuery = `(${query})${globalFilters}`;
    addLog(state, `Searching PubMed: ${finalQuery}`);

    const attemptId = generateId();
    const attemptStarted = now();
    let ids: string[] = [];
    let count = 0;

    try {
      const search = await pubmedEsearch({ term: finalQuery, retmax: budgets.retmaxPerAttempt, sort });
      ids = search.ids;
      count = search.count;
    } catch (error) {
      addLog(state, `PubMed error for query: ${String((error as any)?.message || error)}`);
    }

    if (ids.length === 0) {
      appendAttempt(state, {
        id: attemptId,
        createdAt: attemptStarted,
        query: finalQuery,
        sort,
        source,
        pmidsFound: 0,
        titlesReviewed: 0,
        kept: 0,
        notes: count ? `count=${count}` : 'no results',
      });
      consecutiveNoNew += 1;
      return;
    }

    addLog(state, `Found ${ids.length} (of ${count}) articles. Screening titles...`);
    let summaries: Array<{ pmid: string; title: string }> = [];
    try {
      const raw = await pubmedEsummary(ids);
      summaries = raw.map((r) => ({ pmid: r.pmid, title: r.title }));
    } catch (error) {
      addLog(state, `PubMed summary error: ${String((error as any)?.message || error)}`);
    }

    const candidates = dedupeTitles(summaries).filter((s) => !seen.has(s.pmid)).slice(0, budgets.retmaxPerAttempt);
    if (candidates.length === 0) {
      appendAttempt(state, {
        id: attemptId,
        createdAt: attemptStarted,
        query: finalQuery,
        sort,
        source,
        pmidsFound: ids.length,
        titlesReviewed: 0,
        kept: 0,
        notes: 'all previously seen',
      });
      consecutiveNoNew += 1;
      return;
    }

    const gated = await gateTitlesForRelevance({
      llmClient,
      userRequest: state.userRequest,
      rubric: state.rubric,
      mode,
      candidates,
      feedback: state.feedback,
    });

    const decisionsByPmid = new Map<string, (typeof gated.decisions)[number]>();
    for (const decision of gated.decisions) {
      if (!decision?.pmid) continue;
      decisionsByPmid.set(String(decision.pmid), decision);
    }

    let keptCount = 0;
    let newKept = 0;
    for (const candidate of candidates) {
      const decision = decisionsByPmid.get(candidate.pmid);
      const keep = decision?.keep === true;
      const reason = typeof decision?.reason === 'string' && decision.reason.trim() ? decision.reason.trim() : keep ? 'Relevant' : 'Not relevant';
      const confidence = typeof decision?.confidence === 'number' && Number.isFinite(decision.confidence) ? clamp(decision.confidence, 0, 1) : undefined;

      if (keep) {
        keptCount += 1;
        if (!state.kept[candidate.pmid]) newKept += 1;
        setKept(state, { pmid: candidate.pmid, title: candidate.title, reason, confidence, sourceAttemptId: attemptId });
      } else {
        setRejected(state, candidate.pmid, candidate.title, reason);
      }
      seen.add(candidate.pmid);
    }

    appendAttempt(state, {
      id: attemptId,
      createdAt: attemptStarted,
      query: finalQuery,
      sort,
      source,
      pmidsFound: ids.length,
      titlesReviewed: candidates.length,
      kept: keptCount,
      notes: gated.model ? `screened_by=${gated.model}` : undefined,
    });

    if (newKept === 0) consecutiveNoNew += 1;
    else consecutiveNoNew = 0;

    addLog(state, `Kept ${keptCount}/${candidates.length} titles. Total kept: ${Object.keys(state.kept).length}.`);
  };

  // Primary query pass
  for (const q of spec.queries) {
    if (Object.keys(state.kept).length >= targetTotal) break;
    if (state.attempts.length >= budgets.maxAttempts) break;
    await runQuery(q.query, q.sort || 'relevance', 'llm');

    if (consecutiveNoNew >= 3) break;
    if (Object.keys(state.kept).length >= targetTotal) break;

    // Retry if last attempt had zero results
    const last = state.attempts[state.attempts.length - 1];
    const lastHadZero = last && last.pmidsFound === 0;
    if (lastHadZero && budgets.maxRetriesPerAttempt > 0) {
      const revised = await reviseQuery({
        llmClient,
        userRequest: state.userRequest,
        previousQuery: q.query,
        mode,
      });
      if (revised.query && revised.query !== q.query) {
        addLog(state, `Retrying with a broader query: ${revised.query}`);
        await runQuery(revised.query, q.sort || 'relevance', 'retry');
      }
    }
  }

  // Related-citation expansion (\"More like these\")
  if (Object.keys(state.kept).length < targetTotal && state.attempts.length < budgets.maxAttempts) {
    const seeds = (state.feedback.thumbsUpPmids.length > 0 ? state.feedback.thumbsUpPmids : Object.keys(state.kept))
      .filter((pmid) => !!pmid)
      .slice(0, budgets.relatedSeedCount);

    if (seeds.length > 0) {
      addLog(state, `Expanding with similar articles from ${seeds.length} seed paper(s)...`);
      const related = await pubmedElinkRelated(seeds, budgets.relatedLimit);
      const filtered = related.filter((pmid) => !seen.has(pmid));
      addLog(state, `Found ${filtered.length} candidate similar articles. Screening titles...`);

      const summaries = await pubmedEsummary(filtered.slice(0, budgets.retmaxPerAttempt));
      const candidates = dedupeTitles(summaries.map((s) => ({ pmid: s.pmid, title: s.title }))).filter((s) => !seen.has(s.pmid));
      if (candidates.length > 0) {
        const attemptId = generateId();
        const attemptStarted = now();
        const gated = await gateTitlesForRelevance({
          llmClient,
          userRequest: state.userRequest,
          rubric: state.rubric,
          mode,
          candidates,
          feedback: state.feedback,
        });

        const decisionsByPmid = new Map<string, (typeof gated.decisions)[number]>();
        for (const decision of gated.decisions) {
          if (!decision?.pmid) continue;
          decisionsByPmid.set(String(decision.pmid), decision);
        }

        let keptCount = 0;
        let newKept = 0;
        for (const candidate of candidates) {
          const decision = decisionsByPmid.get(candidate.pmid);
          const keep = decision?.keep === true;
          const reason = typeof decision?.reason === 'string' && decision.reason.trim() ? decision.reason.trim() : keep ? 'Relevant' : 'Not relevant';
          const confidence =
            typeof decision?.confidence === 'number' && Number.isFinite(decision.confidence) ? clamp(decision.confidence, 0, 1) : undefined;

          if (keep) {
            keptCount += 1;
            if (!state.kept[candidate.pmid]) newKept += 1;
            setKept(state, { pmid: candidate.pmid, title: candidate.title, reason, confidence, sourceAttemptId: attemptId });
          } else {
            setRejected(state, candidate.pmid, candidate.title, reason);
          }
          seen.add(candidate.pmid);
        }

        appendAttempt(state, {
          id: attemptId,
          createdAt: attemptStarted,
          query: `related(seed_pmids=${seeds.join(',')})`,
          sort: 'relevance',
          source: 'related',
          pmidsFound: filtered.length,
          titlesReviewed: candidates.length,
          kept: keptCount,
          notes: gated.model ? `screened_by=${gated.model}` : undefined,
        });

        if (newKept === 0) consecutiveNoNew += 1;
        else consecutiveNoNew = 0;
        addLog(state, `Kept ${keptCount}/${candidates.length} similar-article titles. Total kept: ${Object.keys(state.kept).length}.`);
      }
    }
  }

  state.stage = 'DONE';
  state.updatedAt = now();
  if (Object.keys(state.kept).length === 0) {
    addLog(state, 'No relevant titles were found. Try relaxing exclusions or switching to Comprehensive mode.');
  }
  if (Object.keys(state.kept).length < targetTotal) {
    addLog(state, 'You can refine results by thumbs up/down a few titles, then click “Refine with feedback”.');
  }

  return state;
};
