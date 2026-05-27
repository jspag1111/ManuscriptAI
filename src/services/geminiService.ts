import { GoogleGenAI } from "@google/genai";
import { MODEL_IMAGE } from '@/constants';
import { getLlmClient } from '@/lib/llm';
import { Project, Reference, Section } from '@/types';

const getImageAI = () => {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Set NEXT_PUBLIC_GEMINI_API_KEY.');
  }
  return new GoogleGenAI({ apiKey });
};

const buildWritingBriefContext = (project?: Project, section?: Section): string => {
  const brief = project?.writingBrief;
  if (!brief) return '';

  const selectedIds = section?.draftingContext?.briefBlockIds ?? [];
  const includeAllBlocks = project?.projectType !== 'GENERAL' || !section;
  const sourceBlocks = includeAllBlocks
    ? brief.blocks
    : brief.blocks.filter((block) => selectedIds.includes(block.id));

  const entries = sourceBlocks
    .map((block) => ({
      title: typeof block.title === 'string' ? block.title.trim() : '',
      content: typeof block.content === 'string' ? block.content.trim() : '',
    }))
    .filter(({ content }) => content.length > 0)
    .map(({ title, content }) => `${title || 'Brief Block'}:\n${content}`);

  return entries.length > 0 ? entries.join('\n\n') : '';
};

const buildSelectedSectionContext = (project: Project, section: Section): string => {
  if (project.projectType !== 'GENERAL') return '';
  const selectedIds = section.draftingContext?.sectionIds ?? [];
  if (selectedIds.length === 0) return '';

  const entries = project.sections
    .filter((candidate) => candidate.id !== section.id && selectedIds.includes(candidate.id))
    .map((candidate) => {
      const noteBlock = candidate.userNotes.trim() ? `Notes:\n${candidate.userNotes.trim()}\n\n` : '';
      const contentBlock = candidate.content.trim() ? `Content:\n${candidate.content.trim()}` : 'Content:\n[Empty section]';
      return `${candidate.title}:\n${noteBlock}${contentBlock}`;
    });

  return entries.join('\n\n');
};

export const generateSectionDraft = async (
  project: Project,
  section: Section,
  instructions: string
): Promise<{ text: string; model: string }> => {
  const llm = getLlmClient();
  const isGeneralWriting = project.projectType === 'GENERAL';
  
  const useReferences = section.useReferences !== false; // Default to true if undefined
  const hasReferences = project.references.length > 0 && useReferences;
  const writingBrief = buildWritingBriefContext(project, section);
  const writingBriefBlock = writingBrief ? `Selected Writing Brief Blocks:\n${writingBrief}` : '';
  const relatedSectionContext = buildSelectedSectionContext(project, section);
  const relatedSectionBlock = relatedSectionContext ? `Selected Related Sections:\n${relatedSectionContext}` : '';
  const includeCurrentContent = project.projectType === 'GENERAL'
    ? section.draftingContext?.includeCurrentContent !== false
    : true;

  // Construct context from project settings and references
  const referenceList = hasReferences
    ? project.references.map((r) => 
        `RefID: ${r.id}
         Citation Info: ${r.authors} (${r.year}). ${r.title}.
         Content: ${r.abstract ? `Abstract: ${r.abstract}` : (r.summary ? `Summary: ${r.summary}` : '')}
         ---`
      ).join('\n')
    : "No references provided or references disabled for this section.";

  const systemInstruction = [
    isGeneralWriting
      ? 'You are an expert writing assistant helping to draft and refine a document.'
      : 'You are an expert academic research assistant helping to write a manuscript.',
    '',
    `Project Title: ${project.title}`,
    ...(isGeneralWriting
      ? []
      : [
          `Target Journal/Style: ${project.settings.targetJournal}`,
          `Tone: ${project.settings.tone}`,
          `Formatting Requirements: ${project.settings.formattingRequirements}`,
        ]),
    '',
    `Your goal is to draft or refine the "${section.title}" section.`,
    '',
    hasReferences
      ? `You have access to a list of provided references. You MUST cite these references in the text where appropriate to support your statements.
IMPORTANT: You must use the following citation format exactly: [[ref:RefID]].
Example: "Recent studies have shown X [[ref:1234-abcd]]."
Do NOT use formatted citations like "(Smith, 2023)" or "[1]" in the output text. Use only the [[ref:ID]] format.`
      : isGeneralWriting
        ? 'Use clear, natural prose. Do NOT invent citations or sources.'
        : 'Adhere strictly to academic standards. DO NOT include any in-text citations (like [1] or (Author, Year)) because references are disabled or not provided.',
  ].join('\n');

  const prompt = `
    ${writingBriefBlock}
    ${relatedSectionBlock}

    Current Section Notes/Goal:
    ${section.userNotes}

    Specific Instructions for this Draft/Edit:
    ${instructions}

    Available References:
    ${referenceList}

    ${includeCurrentContent
      ? `Current Content (if any):
    ${section.content}`
      : 'Current Content has been intentionally omitted from this request.'}

    Please generate the content for this section. Output ONLY the content in Markdown format. Do not include conversational filler.
  `;

  try {
    const { text, model } = await llm.generateText({
      prompt,
      system: systemInstruction,
      model: process.env.MANUSCRIPTAI_LLM_MODEL_QUALITY || process.env.MANUSCRIPTAI_LLM_MODEL_FAST,
      maxOutputTokens: 8192,
      temperature: 0.4,
    });
    return { text, model };
  } catch (error) {
    console.error("LLM Draft Error:", error);
    throw error;
  }
};

export const refineTextSelection = async (
  selection: string,
  instruction: string,
  fullContext: string,
  project?: Project
): Promise<{ text: string; model: string }> => {
  const llm = getLlmClient();
  const isGeneralWriting = project?.projectType === 'GENERAL';
  const writingBrief = buildWritingBriefContext(project);
  const writingBriefBlock = writingBrief ? `Project Writing Brief:\n${writingBrief}\n\n` : '';
  
  const prompt = `
    ${writingBriefBlock}I have the following text selected from a ${isGeneralWriting ? 'document' : 'research manuscript'}:
    "${selection}"

    Context (surrounding text):
    ...${fullContext.slice(0, 500)}...

    Please rewrite the selected text following this instruction: ${instruction}
    
    Return ONLY the rewritten text.
  `;

  try {
    return await llm.generateText({
      prompt,
      model: process.env.MANUSCRIPTAI_LLM_MODEL_FAST,
      maxOutputTokens: 4096,
      temperature: 0.2,
    });
  } catch (error) {
    console.error("LLM Refine Error:", error);
    throw error;
  }
};

export const summarizeReference = async (referenceText: string): Promise<string> => {
  const llm = getLlmClient();
  try {
    const response = await llm.generateText({
      prompt: `Summarize this research paper citation/abstract in 2-3 sentences for a literature review: ${referenceText}`,
      model: process.env.MANUSCRIPTAI_LLM_MODEL_FAST,
      maxOutputTokens: 800,
      temperature: 0.2,
    });
    return response.text;
  } catch (error) {
    console.error("LLM Summary Error:", error);
    throw error;
  }
};

export const generatePubMedSearchQuery = async (userQuery: string): Promise<string> => {
  const llm = getLlmClient();
  
  const prompt = `
    You are an expert research librarian proficient in PubMed/Medline search syntax.
    Convert the following user request into a precise PubMed search query string.

    User Request: "${userQuery}"

    Rules:
    1. Use MeSH terms where appropriate (e.g., "Diabetes Mellitus"[Mesh]).
    2. Use boolean operators (AND, OR, NOT).
    3. Use field tags if necessary (e.g., [Title/Abstract], [Publication Type]).
    4. If the user asks for "reviews", "trials", etc., include the appropriate publication types.
    5. Return ONLY the raw search string. Do not include markdown, explanations, or quotes around the whole string.

    Example Output: ("Glucagon-Like Peptide-1"[Mesh] OR "GLP-1") AND ("Diabetes Mellitus"[Mesh]) AND ("Randomized Controlled Trial"[Publication Type])
  `;

  try {
    const response = await llm.generateText({
      prompt,
      model: process.env.MANUSCRIPTAI_LLM_MODEL_FAST,
      maxOutputTokens: 600,
      temperature: 0.1,
    });
    
    let query = response.text.replace(/\\n/g, '\n');
    // Clean up if the model adds markdown
    query = query.replace(/^```(?:\w+)?/i, '').replace(/```$/i, '').trim();
    // Remove leading/trailing quotes if the model added them
    if (query.startsWith('"') && query.endsWith('"')) {
        query = query.slice(1, -1);
    }
    return query;
  } catch (error) {
    console.error("LLM Search Query Gen Error:", error);
    throw error;
  }
};

export const generateFigure = async (prompt: string): Promise<string> => {
  const ai = getImageAI();
  try {
    const response = await ai.models.generateContent({
      model: MODEL_IMAGE,
      contents: prompt,
      config: {
        // Nano banana (gemini-2.5-flash-image) doesn't support responseMimeType/Schema
      }
    });

    // Extract image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated");
  } catch (error) {
    console.error("Gemini Image Error:", error);
    throw error;
  }
};
