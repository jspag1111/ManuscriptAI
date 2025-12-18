export const DEFAULT_SECTIONS = [
  { title: 'Abstract', defaultNotes: 'Summarize the entire paper...' },
  { title: 'Introduction', defaultNotes: 'Introduce the problem and hypothesis...' },
  { title: 'Methods', defaultNotes: 'Describe the experimental setup...' },
  { title: 'Results', defaultNotes: 'Detail the findings...' },
  { title: 'Discussion', defaultNotes: 'Interpret the results...' },
  { title: 'Conclusion', defaultNotes: 'Final thoughts and future directions...' },
];

const getEnvModel = (envVar: string, fallback: string) =>
  process.env[envVar] ?? fallback;

export const MODEL_TEXT_FAST = getEnvModel(
  'NEXT_PUBLIC_GEMINI_MODEL_TEXT_FAST',
  'gemini-3-flash-preview'
);

export const MODEL_TEXT_QUALITY = getEnvModel(
  'NEXT_PUBLIC_GEMINI_MODEL_TEXT_QUALITY',
  MODEL_TEXT_FAST
);

export const MODEL_IMAGE = getEnvModel(
  'NEXT_PUBLIC_GEMINI_MODEL_IMAGE',
  'gemini-2.5-flash-image'
);
