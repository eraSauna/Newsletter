// Dunne wrapper om de Google Gemini SDK (@google/genai) voor lagen 1-3.
// Veldnamen volgen de @google/genai-SDK van juli 2026 — smoke-test op de eerste
// live run en verifieer tegen de actuele SDK-docs waar nodig.

import { GoogleGenAI } from "@google/genai";

let _ai = null;
export function genai() {
  if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
  return _ai;
}

/**
 * Eén Gemini-call. Met grounding wordt Google Search ingezet; grounding en een
 * afgedwongen JSON-schema gaan niet samen, dus bij grounding krijg je tekst terug.
 * @returns {Promise<{text: string, grounded: boolean}>}
 */
export async function geminiCall({ model, system, prompt, grounding = false, schema, ledger, label }) {
  ledger?.assertUnderCap();
  const config = {};
  if (system) config.systemInstruction = system;
  if (grounding) config.tools = [{ googleSearch: {} }];
  else if (schema) {
    config.responseMimeType = "application/json";
    config.responseSchema = schema;
  }

  const res = await genai().models.generateContent({ model, contents: prompt, config });

  const u = res.usageMetadata || {};
  ledger?.record(
    model,
    { input_tokens: u.promptTokenCount || 0, output_tokens: u.candidatesTokenCount || 0 },
    { label }
  );

  const grounded = !!res.candidates?.[0]?.groundingMetadata;
  return { text: res.text || "", grounded };
}

/** Parse een JSON-array uit modeltekst, tolerant voor ```json-omhulsels. */
export function parseJsonArray(text) {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try {
    return JSON.parse(m[0]);
  } catch {
    return [];
  }
}
