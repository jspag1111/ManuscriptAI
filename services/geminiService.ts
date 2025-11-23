
import { GoogleGenAI } from "@google/genai";
import { Project, Reference, Section, PaperSearchResult } from '../types';
import { MODEL_TEXT_QUALITY, MODEL_TEXT_FAST, MODEL_IMAGE } from '../constants';

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateSectionDraft = async (
  project: Project,
  section: Section,
  instructions: string
): Promise<string> => {
  const ai = getAI();
  
  const hasReferences = project.references.length > 0;

  // Construct context from project settings and references
  // Prefer abstract if available, otherwise summary, otherwise just title/author
  const referenceList = hasReferences
    ? project.references.map((r, i) => 
        `[${i+1}] ${r.authors} (${r.year}). ${r.title}. ${r.abstract ? `Abstract: ${r.abstract}` : (r.summary ? `Summary: ${r.summary}` : '')}`
      ).join('\n')
    : "No references provided.";

  const systemInstruction = `
    You are an expert academic research assistant helping to write a manuscript.
    
    Project Title: ${project.title}
    Target Journal/Style: ${project.settings.targetJournal}
    Tone: ${project.settings.tone}
    Formatting Requirements: ${project.settings.formattingRequirements}

    Your goal is to draft or refine the "${section.title}" section.
    ${hasReferences 
      ? 'Adhere strictly to academic standards. Use citations like [1], [2] where appropriate based ONLY on the provided reference list. Do not cite sources not in the list.' 
      : 'Adhere strictly to academic standards. DO NOT include any in-text citations (like [1] or (Author, Year)) because no references are provided.'}
  `;

  const prompt = `
    Current Section Notes/Goal:
    ${section.userNotes}

    Specific Instructions for this Draft/Edit:
    ${instructions}

    Available References:
    ${referenceList}

    Current Content (if any):
    ${section.content}

    Please generate the content for this section. Output ONLY the content in Markdown format. Do not include conversational filler.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_TEXT_QUALITY,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        thinkingConfig: { thinkingBudget: 2048 }, // Using some budget for better reasoning on structure
        maxOutputTokens: 8192,
      },
    });
    return response.text || '';
  } catch (error) {
    console.error("Gemini Draft Error:", error);
    throw error;
  }
};

export const refineTextSelection = async (
  selection: string,
  instruction: string,
  fullContext: string
): Promise<string> => {
  const ai = getAI();
  
  const prompt = `
    I have the following text selected from a research manuscript:
    "${selection}"

    Context (surrounding text):
    ...${fullContext.slice(0, 500)}...

    Please rewrite the selected text following this instruction: ${instruction}
    
    Return ONLY the rewritten text.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_TEXT_QUALITY,
      contents: prompt,
    });
    return response.text || '';
  } catch (error) {
    console.error("Gemini Refine Error:", error);
    throw error;
  }
};

export const summarizeReference = async (referenceText: string): Promise<string> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: MODEL_TEXT_FAST,
      contents: `Summarize this research paper citation/abstract in 2-3 sentences for a literature review: ${referenceText}`,
    });
    return response.text || '';
  } catch (error) {
    console.error("Gemini Summary Error:", error);
    throw error;
  }
};

export const findRelevantPapers = async (query: string): Promise<PaperSearchResult[]> => {
  const ai = getAI();
  
  const prompt = `
    Perform a Google Search to find high-quality academic papers relevant to this request: "${query}".
    Focus strictly on finding articles indexed in PubMed.

    For each relevant paper found, extract:
    1. "pmid": The PubMed ID (REQUIRED). If you cannot find a PMID, do not include the paper.
    2. "title": The title of the paper.
    3. "relevance": A specific, high-quality explanation of why this paper is relevant to the user's specific query.
    
    Return the results as a strictly valid JSON array string. 
    Example structure: 
    [
      {
        "pmid": "12345678",
        "title": "Example Paper Title", 
        "relevance": "This paper establishes the baseline for..."
      }
    ]
    
    Do not wrap the JSON in markdown blocks. Output only the raw JSON string.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_TEXT_FAST,
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
        // responseMimeType not allowed with tools
      }
    });

    const text = response.text || '[]';
    // Clean up markdown if model adds it despite instructions
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      const results = JSON.parse(cleanText);
      // Ensure we only return results that have a PMID as per user request
      // And ensure PMID is treated as a string to avoid downstream errors
      return results
        .filter((r: any) => r.pmid)
        .map((r: any) => ({ ...r, pmid: String(r.pmid) }))
        .filter((r: any) => /^\d+$/.test(r.pmid));
    } catch (parseError) {
      console.warn("Failed to parse JSON from search result", text);
      return [];
    }
  } catch (error) {
    console.error("Search Error:", error);
    throw error;
  }
};

export const generateFigure = async (prompt: string): Promise<string> => {
  const ai = getAI();
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
