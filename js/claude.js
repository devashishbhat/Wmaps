/**
 * Anthropic Claude API integration.
 *
 * Two call sites:
 *   - enrichPOIHooks: one batched call that writes a short hook per POI.
 *   - fetchStory:     on-demand 3-sentence narration for "Tell me more".
 *
 * Claude is never used to discover places — only to add colour to them.
 */

import { MODES, MODE_TONES, CLAUDE_MODEL } from './constants.js';
import { getConfig } from './state.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

function buildHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': getConfig().ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
}

async function callClaude(prompt, maxTokens = 1000) {
  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp.ok) throw new Error(`Claude API error: ${resp.status}`);
  const data = await resp.json();
  return data.content?.[0]?.text || '';
}

/** Mutates each POI in place, adding a `hookLine`. Fails silently. */
export async function enrichPOIHooks(pois, modeKey) {
  const placeList = pois
    .map((p, i) => `${i + 1}. "${p.name}" near ${p.vicinity} (types: ${p.types.slice(0, 3).join(', ')})`)
    .join('\n');

  const prompt = `You are a travel researcher who finds hidden stories. For each place below, write ONE short sentence (max 15 words) revealing something surprising, specific, or lesser-known about it.

Rules:
- Use real facts: a year, a person's name, a specific event, a film title, a battle
- If you don't know a specific fact, invent a compelling plausible hook based on the place type and region
- Never use "fascinating", "interesting", "notable", "hidden gem", or "must-see"
- Be specific and vivid, like: "Where Confederate gold vanished in 1865" or "Filming location for Dirty Dancing's lake scene"
- Mode: ${MODES[modeKey].label}

Places:
${placeList}

Reply with ONLY a JSON array of strings, one hook per place, same order. Example: ["Hook for place 1", "Hook for place 2"]`;

  try {
    const text = await callClaude(prompt);
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const hooks = JSON.parse(match[0]);
      pois.forEach((poi, i) => {
        if (hooks[i]) poi.hookLine = hooks[i];
      });
    }
  } catch (err) {
    console.warn('Could not enrich POI hooks:', err);
  }
}

/** Returns a 3-sentence story for a single POI, in the mode's tone. */
export async function fetchStory(poi, modeKey) {
  const prompt = `You are a storytelling travel guide. In 3 sentences, tell an interesting story about "${poi.name}" near ${poi.vicinity}.
Be specific — use real names, dates, and events where possible.
Never use the words "fascinating", "interesting", or "notable".
Tone: ${MODE_TONES[modeKey]}.`;

  return callClaude(prompt);
}
