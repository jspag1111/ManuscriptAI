export type DiscoverMode = 'comprehensive' | 'highly_relevant';

export interface DiscoverExclusions {
  excludeCaseReports?: boolean;
  excludePediatrics?: boolean;
  excludeAnimalOnly?: boolean;
  englishOnly?: boolean;
}

export interface DiscoverConstraints {
  yearFrom?: number;
  yearTo?: number;
  mustInclude?: string;
  mustExclude?: string;
}

export type DiscoverRunStage = 'CLARIFY' | 'SEARCHING' | 'DONE';

export interface DiscoverClarifyingQuestion {
  id: string;
  question: string;
}

export interface DiscoverQueryAttempt {
  id: string;
  createdAt: number;
  query: string;
  sort: 'relevance' | 'pub_date';
  source: 'llm' | 'retry' | 'related';
  pmidsFound: number;
  titlesReviewed: number;
  kept: number;
  notes?: string;
}

export interface DiscoverKeptItem {
  pmid: string;
  title: string;
  reason: string;
  confidence?: number;
  sourceAttemptId?: string;
}

export interface DiscoverFeedback {
  thumbsUpPmids: string[];
  thumbsDownPmids: string[];
}

export interface DiscoverRunState {
  version: 1;
  id: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  stage: DiscoverRunStage;
  userRequest: string;
  mode: DiscoverMode;
  exclusions: DiscoverExclusions;
  constraints: DiscoverConstraints;
  clarifyingQuestions: DiscoverClarifyingQuestion[];
  clarifyingAnswers: Record<string, string>;
  plan: string[];
  rubric: string;
  attempts: DiscoverQueryAttempt[];
  kept: Record<string, DiscoverKeptItem>;
  rejected: Record<string, { pmid: string; title: string; reason: string }>;
  feedback: DiscoverFeedback;
  logs: string[];
}

export interface DiscoverStartResponse {
  runId: string;
  stage: DiscoverRunStage;
  clarifyingQuestions: DiscoverClarifyingQuestion[];
  plan: string[];
  assumptions: string[];
  logs: string[];
}

export interface DiscoverSearchResponse {
  runId: string;
  stage: DiscoverRunStage;
  plan: string[];
  rubric: string;
  logs: string[];
  attempts: DiscoverQueryAttempt[];
  kept: DiscoverKeptItem[];
  nextSuggestedAction?: 'MORE' | 'DONE';
}
