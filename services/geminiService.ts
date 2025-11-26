import { GoogleGenAI } from "@google/genai";
import { Project, Reference, Section } from '../types';
import { MODEL_TEXT_QUALITY, MODEL_TEXT_FAST, MODEL_IMAGE } from '../constants';

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateSectionDraft = async (
  project: Project,
  section: Section,
  instructions: string
): Promise<string> => {
  const ai = getAI();
  
  const useReferences = section.useReferences !== false; // Default to true if undefined
  const hasReferences = project.references.length > 0 && useReferences;

  // Construct context from project settings and references
  const referenceList = hasReferences
    ? project.references.map((r) => 
        `RefID: ${r.id}
         Citation Info: ${r.authors} (${r.year}). ${r.title}.
         Content: ${r.abstract ? `Abstract: ${r.abstract}` : (r.summary ? `Summary: ${r.summary}` : '')}
         ---`
      ).join('\n')
    : "No references provided or references disabled for this section.";

  const systemInstruction = `
    You are an expert academic research assistant helping to write a manuscript.
    
    Project Title: ${project.title}
    Target Journal/Style: ${project.settings.targetJournal}
    Tone: ${project.settings.tone}
    Formatting Requirements: ${project.settings.formattingRequirements}

    Your goal is to draft or refine the "${section.title}" section.
    
    ${hasReferences 
      ? `You have access to a list of provided references. You MUST cite these references in the text where appropriate to support your statements.
         IMPORTANT: You must use the following citation format exactly: [[ref:RefID]].
         Example: "Recent studies have shown X [[ref:1234-abcd]]."
         Do NOT use formatted citations like "(Smith, 2023)" or "[1]" in the output text. Use only the [[ref:ID]] format.` 
      : 'Adhere strictly to academic standards. DO NOT include any in-text citations (like [1] or (Author, Year)) because references are disabled or not provided.'}
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

export const generatePubMedSearchQuery = async (userQuery: string): Promise<string> => {
  const ai = getAI();
  
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
    const response = await ai.models.generateContent({
      model: MODEL_TEXT_FAST,
      contents: prompt,
    });
    
    let query = response.text || '';
    // Clean up if the model adds markdown
    query = query.replace(/^```/g, '').replace(/```$/g, '').trim();
    // Remove leading/trailing quotes if the model added them
    if (query.startsWith('"') && query.endsWith('"')) {
        query = query.slice(1, -1);
    }
    return query;
  } catch (error) {
    console.error("Gemini Search Query Gen Error:", error);
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