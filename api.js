// API Network Fetch Adaptors & Clients Module

import {
  debateState,
  elements
} from './state.js?v=9.1';

import {
  renderScorecard
} from './ui.js?v=9.1';

// We import compileTranscript at runtime/dynamically to avoid circular dependency
// or we can import it normally if simulator.js doesn't import api.js directly, 
// but simulator.js DOES import callSpeakerAPI and callJudgeAPI. 
// Standard ES modules resolve circular imports, but dynamic or lazy resolution is safer.
let compileTranscriptFn = null;
export function setCompileTranscriptFn(fn) {
  compileTranscriptFn = fn;
}

function cleanJSONResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
  }
  return cleaned;
}

// Sanitize error messages to prevent API key leakage in user-facing error cards.
function sanitizeErrorMessage(message, apiKey) {
  if (!message) return "Unknown API error";
  let sanitized = String(message);
  // Strip any occurrence of the API key from the message
  if (apiKey && apiKey.length > 8) {
    sanitized = sanitized.replaceAll(apiKey, '[REDACTED]');
    // Also check for partial key leaks (first/last 8 chars)
    const partial = apiKey.substring(0, 8);
    if (sanitized.includes(partial)) {
      sanitized = sanitized.replaceAll(partial, '[REDACTED]');
    }
  }
  return sanitized;
}

function getModeratorInstructions() {
  return DEBATE_PRESETS.defaultModerator.systemInstructions;
}

// Unified call adapter for active AI speakers V2
export async function callSpeakerAPI(debater, step) {
  let provider, model, systemInstructions, temp, apiKey;
  
  if (step.type === 'debater') {
    provider = debater.provider;
    model = debater.model === 'custom' ? debater.customModel : debater.model;
    systemInstructions = debater.instructions;
    temp = debater.temperature;
    apiKey = debater.apiKey || "";
  } else {
    provider = debateState.moderator.provider;
    model = debateState.moderator.model === 'custom' ? debateState.moderator.customModel : debateState.moderator.model;
    systemInstructions = debateState.moderator.instructions || getModeratorInstructions();
    temp = 0.5;
    apiKey = debateState.moderator.apiKey || "";
  }
  
  const topicTitle = elements.inputTopicTitle.value;
  const topicDesc = elements.inputTopicDesc.value;
  
  const transcript = compileTranscriptFn ? compileTranscriptFn(debater) : "";
  
  let systemPrompt = "";
  
  if (step.type === 'debater') {
    const baseInstructions = debater.instructions || "You are a debater.";
    
    const hasActiveTraits = debater.personaPreset || 
                            debater.logic !== 5 || 
                            debater.emotion !== 5 || 
                            debater.aggression !== 5 || 
                            debater.humor !== 5 || 
                            debater.stubbornness !== 5;
    
    let traitsDirectives = "";
    if (hasActiveTraits) {
      traitsDirectives = [
        `Your behavior is parameterized by the following traits (on a scale of 1 to 10):`,
        `- Logic & Evidence: ${debater.logic}/10. (High logic: base arguments on statistics, structural reasoning, hard data, avoid emotional rhetoric).`,
        `- Rhetorical Emotion: ${debater.emotion}/10. (High emotion: use storytelling, passion, human interest, moral appeals, vivid metaphors).`,
        `- Aggression: ${debater.aggression}/10. (High aggression: aggressively attack opponents' arguments, call out logical fallacies, use sharp, confrontational phrasing).`,
        `- Humor & Wit: ${debater.humor}/10. (High humor: use wit, sarcasm, brief jokes, ironical framing of the opponent's points).`,
        `- Stubbornness: ${debater.stubbornness}/10. (High stubbornness: defend your points resolutely, never make concessions, double down on refutations).`
      ].join('\n');
    }
    
    let modeDirectives = "";
    if (debateState.debateMode === "short") {
      modeDirectives = `Debate Mode: Short Face-off. Deliver a punchy, concise, and direct statement. You are limited to a maximum of 100 words. Focus only on your strongest point and attack the opponent's core claim immediately.`;
    } else if (debateState.debateMode === "medium") {
      modeDirectives = `Debate Mode: Standard Debate. Deliver a well-structured, persuasive statement. You are limited to a maximum of 200 words. Balance your time between supporting your stance and addressing key counterclaims.`;
    } else if (debateState.debateMode === "long") {
      modeDirectives = `Debate Mode: Deep Analysis. Deliver a thorough, evidence-based, and analytical statement. You are limited to a maximum of 400 words. Elaborate on structural points, cite logical frameworks, and dissect the opponent's arguments in detail.`;
    } else if (debateState.debateMode === "advanced") {
      modeDirectives = `Debate Mode: Advanced Academic. Deliver a highly rigorous, sophisticated, and comprehensive argument. You are limited to a maximum of 600 words. Use formal logic, analyze systemic implications, and provide a deep, philosophical or empirical defense.`;
    } else if (debateState.debateMode === "twitter") {
      modeDirectives = `Debate Mode: Twitter / X Fight. Keep your response extremely short, sharp, punchy, and aggressive. You are limited to a maximum of 50 words. Speak like you are debating in a fast-paced, hype-filled social media feed using tech buzzwords and sharp sarcasm. Do NOT use any hashtags (do not include the '#' character or hashtag words like #AI, #Tech, etc.).`;
    } else if (debateState.debateMode === "podcast") {
      modeDirectives = `Debate Mode: Podcast Talkshow. Keep your response conversational, natural, and verbose. You are limited to a maximum of 300 words. Reference other debaters by name. Use a conversational, engaging, but argumentative podcast tone.`;
    } else if (debateState.debateMode === "socratic") {
      modeDirectives = `Debate Mode: Socratic Dialogue. Deliver a probing statement that questions your opponent's core assumptions and premises. You are limited to a maximum of 150 words. Use Socratic irony, ask challenging questions, and guide the debate through logical inquiry.`;
    } else if (debateState.debateMode === "humorous") {
      modeDirectives = `Debate Mode: Humorous / Satirical. Deliver a witty, sarcastic, and highly entertaining statement. You are limited to a maximum of 200 words. Use clever analogies, lighthearted humor, and ironical framing to dismantle the opposition's points.`;
    } else {
      modeDirectives = `Debate Mode: Standard Debate. Deliver a well-structured statement. You are limited to a maximum of 200 words.`;
    }
    
    let formattingDirectives = "";
    if (debateState.thoughtEnabled) {
      formattingDirectives = [
        `CRITICAL FORMAT REQUIREMENT: You MUST start your response with an internal reasoning monologue enclosed in <thought>...</thought> tags.`,
        `In this monologue, analyze the previous arguments and plan your verbal strategy.` + (hasActiveTraits ? ` Keep your strategy aligned with your personality traits.` : ``),
        `Following the closing </thought> tag, write your public response. Do NOT mention these tags in your public text.`
      ].join('\n');
    } else {
      formattingDirectives = `CRITICAL FORMAT REQUIREMENT: Do NOT write any internal monologue, reasoning, or thoughts. Do NOT use any <thought> or similar tags. Write your public response directly.`;
    }
    
    const systemPromptParts = [
      baseInstructions,
      `CRITICAL: Act natural and normal. This is a computer simulation; there is no live audience, spectators, or physical hall. Do not address an audience (e.g., do not say "Ladies and gentlemen", "Dear audience", or "Welcome everyone"). Keep your language direct, normal, natural, and focused entirely on the content of the arguments without theatrical or performative filler (like "Thank you, Moderator").`
    ];
    systemPromptParts.push(`You are participating in a formal team debate on the topic: "${topicTitle}".`);
    systemPromptParts.push(`Premise: "${topicDesc}".`);
    systemPromptParts.push(`You are on the ${debater.team === 'pro' ? 'AFFIRMATIVE (Team Pro)' : 'NEGATIVE (Team Con)'} team.`);
    if (traitsDirectives) {
      systemPromptParts.push(traitsDirectives);
    }
    
    const teammates = debateState.debaters.filter(d => d.team === debater.team && d.id !== debater.id);
    if (teammates.length > 0 && !step.isDiscussion) {
      const teammateNames = teammates.map(t => t.name).join(", ");
      systemPromptParts.push(`TEAM COLLABORATION DIRECTIVE:
You are part of a team. Your teammates are: [${teammateNames}].
You MUST support your teammates. Refer to them by name, build upon their arguments, defend them from the opposition's counterarguments, and ensure your team's stance remains aligned and logically consistent. Avoid contradicting anything your teammates have argued.`);
    }

    if (step.isDiscussion) {
      const teammateNames = teammates.map(t => t.name).join(", ");
      systemPromptParts.push(`TEAM PRIVATE DISCUSSION PHASE:
You are in a PRIVATE team strategy session with your teammates: [${teammateNames}].
The opposing team CANNOT hear this discussion.
Use this turn to coordinate strategy with your teammates for the next round.
Discuss:
1. What key weaknesses in the opposition's argument should your team target next?
2. Who should focus on which points?
3. How can you defend your team's stance more effectively?

CRITICAL: Keep your response relatively concise (1-2 paragraphs). Speak directly to your teammates as a colleague on their team (e.g. using "we", "our", "let's"). Remember, this is a private strategy discussion, so do not address the moderator, the judge, or the opponents.`);
    }
    
    if (debateState.roastEnabled) {
      systemPromptParts.push(`ROASTING MODE IS ACTIVE:
- You are encouraged to mock, roast, and satirize the opposing team's arguments, logic, and word choice in a witty, sharp, and savage manner.
- If the opposition has roasted you in previous turns, you MUST defend yourself and counter-attack directly on their roasts.
- If teammate discussion is allowed, cooperate with your teammates, refer to their points, and defend them from the opposition's roasts.`);
    }

    if (step.isRebuttal) {
      if (step.rebuttalPhase === 'ask') {
        systemPromptParts.push(`REBUTTAL PHASE - ASK QUESTION RULE:
You are in the rebuttal phase. You have the opportunity to ask ONE question to your opponent, ${step.oppDebaterName}.
Your question must be based strictly on what your opponent said in their main argument or their previous answers. Do not introduce new topics or premises.
Challenge their logic, evidence, and specific statements directly.
If you do not want to ask any further questions, you MUST output exactly: NO_QUESTIONS`);
      } else {
        systemPromptParts.push(`REBUTTAL PHASE - ANSWER RULE:
You are in the rebuttal phase. You must answer the question asked by your opponent, ${step.oppDebaterName}.
Be direct, clear, and address their question directly without evasiveness. Maintain your stance and defend your previous arguments.`);
      }
    } else if (step.isDiscussion) {
      // (Discussion rules already added above)
    } else {
      systemPromptParts.push(modeDirectives);
    }
    systemPromptParts.push(formattingDirectives);
    
    systemPrompt = systemPromptParts.join('\n\n');
  } else {
    systemPrompt = [
      systemInstructions,
      `CRITICAL: Act natural and normal. This is a computer simulation; there is no live audience, spectators, or physical hall. Do not address an audience (e.g., do not say "Ladies and gentlemen", "Dear audience", or "Welcome everyone"). Keep your language direct, normal, natural, and focused entirely on managing the debate without theatrical or performative filler.`,
      `You are the Moderator. Topic: "${topicTitle}". Premise: "${topicDesc}".`,
      `Keep the debate moving. Formally invite speakers, highlight the contention, and do not take sides. Keep your responses concise.`
    ].join('\n\n');
  }
  
  let contextPrompt = "";
  if (transcript) {
    contextPrompt += `Here is the debate transcript so far:\n\n${transcript}\n\n`;
  } else {
    contextPrompt += `The debate has just begun.\n\n`;
  }
  
  if (step.type === 'debater') {
    if (step.isRebuttal) {
      if (step.rebuttalPhase === 'ask') {
        contextPrompt += `It is your turn to ASK a question to ${step.oppDebaterName}.
Analyze the transcript above and formulate a challenging question based on their main argument or their previous answers.
If you have no questions to ask, reply with the exact text: NO_QUESTIONS`;
      } else {
        contextPrompt += `It is your turn to ANSWER the question from ${step.oppDebaterName}.
Here is the question they asked:
"${step.currentQuestion}"

Provide a clear and direct answer to this question.`;
      }
    } else if (step.isDiscussion) {
      contextPrompt += `It is your turn in the PRIVATE team strategy discussion. Coordinate with your team and address your teammates directly.`;
    } else {
      contextPrompt += `It is your turn. Deliver your statement supporting the ${debater.team === 'pro' ? 'Affirmative' : 'Negative'} stance.`;
    }
  } else {
    if (step.type === 'mod-intro') {
      contextPrompt += `It is the start of the debate. Introduce the topic and outline the premise, then formally invite the first speaker (${debateState.debaters[0].name}) to speak.`;
    } else if (step.type === 'mod-transition') {
      if (step.phase === 'standard-to-rebuttal') {
        contextPrompt += `Round ${step.round} main statements are complete. Briefly summarize the key arguments presented in this round, and invite the speakers to begin the Round ${step.round} Rebuttal phase where they must directly address and question each other's points.`;
      } else {
        contextPrompt += `Round ${step.round} rebuttal statements are complete. Briefly summarize the key points of contention that emerged, and invite the speakers to begin Round ${step.round + 1} main statements.`;
      }
    } else if (step.type === 'mod-outro') {
      contextPrompt += `The debate rounds have completed. Deliver a closing summary wrapping up, and formally request the Judge to evaluate and deliver the final verdict.`;
    }
  }

  switch (provider) {
    case 'gemini':
      return await makeGeminiRequest(model, systemPrompt, contextPrompt, temp, apiKey);
    case 'openai':
      return await makeOpenAIRequest(model, systemPrompt, contextPrompt, temp, apiKey);
    case 'openrouter':
      return await makeOpenRouterRequest(model, systemPrompt, contextPrompt, temp, apiKey);
    case 'anthropic':
      return await makeAnthropicRequest(model, systemPrompt, contextPrompt, temp, apiKey);
    case 'huggingface':
      return await makeHuggingFaceRequest(model, systemPrompt, contextPrompt, temp, apiKey);
    case 'grok':
      return await makeGrokRequest(model, systemPrompt, contextPrompt, temp, apiKey);
    case 'groq':
      return await makeGroqRequest(model, systemPrompt, contextPrompt, temp, apiKey);
    case 'ollama':
      const ollamaHost = (step.type === 'debater') ? (debateState.ollamaHost) : (debateState.moderator.ollamaHost || debateState.ollamaHost);
      return await makeOllamaRequest(model, systemPrompt, contextPrompt, temp, ollamaHost);
    default:
      throw new Error(`Unsupported API provider: ${provider}`);
  }
}

// Judge API evaluator V2 (Team Affirmative vs Team Negative)
export async function callJudgeAPI() {
  const provider = debateState.judge.provider;
  const model = debateState.judge.model === 'custom' ? debateState.judge.customModel : debateState.judge.model;
  const apiKey = debateState.judge.apiKey || "";
  
  const topicTitle = elements.inputTopicTitle.value;
  const transcript = compileTranscriptFn ? compileTranscriptFn(null, false) : "";
  
  const pros = debateState.debaters.filter(d => d.team === 'pro').map(d => d.name).join(', ');
  const cons = debateState.debaters.filter(d => d.team === 'con').map(d => d.name).join(', ');
  
  const judgeInstructions = debateState.judge.instructions ? `\nCustom Evaluation Instructions: ${debateState.judge.instructions}\n` : "";
  const systemPrompt = `You are a professional, neutral, analytical debate judge. Act natural and normal. This is a computer simulation; do not refer to or address an audience, spectators, or a physical hall. Evaluate the team debate. Team Affirmative (Pro) consists of: [${pros}]. Team Negative (Con) consists of: [${cons}]. Deliver a winner and individual team grades (0-100) across 4 pillars.${judgeInstructions}
CRITICAL: Analyze the entire debate transcript carefully. In your summary evaluation, make sure to explicitly analyze the contributions of each individual debater by name, explaining their key arguments, their logic, and how they affected the outcome. If any direct logical contradictions (where a speaker contradicts themselves or their teammates) occurred, highlight them under a 'Contradiction Alerts' section.`;
  
  let contextPrompt = `Here is the complete debate transcript on the topic "${topicTitle}":\n\n${transcript}\n\n`;
  contextPrompt += `Assign scores to both Team Affirmative (pro) and Team Negative (con).\n`;
  contextPrompt += `Return ONLY a valid JSON object matching the following structure. Do NOT include markdown code blocks. Ensure the json is perfectly formatted and parseable.\n\n`;
  contextPrompt += `{
  "winner": "pro" | "con" | "draw",
  "winnerName": "Team Affirmative" | "Team Negative" | "Draw",
  "scores": {
    "pro": {
      "logical": 85,
      "rhetorical": 80,
      "rebuttal": 75,
      "reasoning": 70
    },
    "con": {
      "logical": 80,
      "rhetorical": 85,
      "rebuttal": 80,
      "reasoning": 75
    }
  },
  "summary": "Detailed, professional summary of the debate evaluation..."
}`;

  let resultString = "";
  if (provider === 'gemini') {
    resultString = await makeGeminiRequest(model, systemPrompt, contextPrompt, 0.2, apiKey);
  } else if (provider === 'openai') {
    resultString = await makeOpenAIRequest(model, systemPrompt, contextPrompt, 0.2, apiKey);
  } else if (provider === 'openrouter') {
    resultString = await makeOpenRouterRequest(model, systemPrompt, contextPrompt, 0.2, apiKey);
  } else if (provider === 'anthropic') {
    resultString = await makeAnthropicRequest(model, systemPrompt, contextPrompt, 0.2, apiKey);
  } else if (provider === 'huggingface') {
    resultString = await makeHuggingFaceRequest(model, systemPrompt, contextPrompt, 0.2, apiKey);
  } else if (provider === 'grok') {
    resultString = await makeGrokRequest(model, systemPrompt, contextPrompt, 0.2, apiKey);
  } else if (provider === 'groq') {
    resultString = await makeGroqRequest(model, systemPrompt, contextPrompt, 0.2, apiKey);
  } else if (provider === 'ollama') {
    const judgeOllamaHost = debateState.judge.ollamaHost || debateState.ollamaHost;
    resultString = await makeOllamaRequest(model, systemPrompt, contextPrompt, 0.2, judgeOllamaHost);
  }
  
  try {
    const cleanJSON = cleanJSONResponse(resultString);
    const parsedData = JSON.parse(cleanJSON);
    
    // Schema validation for judge response
    if (!parsedData || typeof parsedData !== 'object') {
      throw new Error("Judge returned invalid data structure.");
    }
    if (!['pro', 'con', 'draw'].includes(parsedData.winner)) {
      parsedData.winner = 'draw';
      parsedData.winnerName = 'Draw';
    }
    if (typeof parsedData.summary !== 'string') {
      parsedData.summary = String(parsedData.summary || 'No summary provided.');
    }
    // Ensure scores are valid numbers
    if (parsedData.scores) {
      for (const team of ['pro', 'con']) {
        if (parsedData.scores[team]) {
          for (const key of ['logical', 'rhetorical', 'rebuttal', 'reasoning']) {
            const val = parseInt(parsedData.scores[team][key], 10);
            parsedData.scores[team][key] = isNaN(val) ? 0 : Math.max(0, Math.min(100, val));
          }
        }
      }
    }
    
    renderScorecard(parsedData);
    return `Final Verdict Delivered: Winner is ${parsedData.winnerName}. Rationale: ${parsedData.summary}`;
    
  } catch (error) {
    console.error("Failed parsing Judge JSON scorecard:", error.message);
    throw new Error(`The Judge returned a non-parseable scorecard response. Ensure the judge model is capable of outputting clean JSON.`);
  }
}

async function makeOpenAICompatibleRequest(endpoint, model, apiKey, systemPrompt, userPrompt, temperature) {
  const body = {
    model: model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: temperature
  };
  
  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  };
  if (debateState.abortController) {
    fetchOptions.signal = debateState.abortController.signal;
  }
  
  const response = await fetch(endpoint, fetchOptions);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(sanitizeErrorMessage(errorData.error?.message || `API Error: Status ${response.status}`, apiKey));
  }
  
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response returned from API endpoint");
  return text;
}

async function makeGeminiRequest(model, systemPrompt, userPrompt, temperature, apiKey) {
  if (!apiKey) throw new Error("Google Gemini API Key is missing. Click 'Settings' in the header to configure.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  
  const body = {
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { temperature: temperature, maxOutputTokens: 8192 }
  };
  
  const fetchOptions = {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify(body)
  };
  if (debateState.abortController) {
    fetchOptions.signal = debateState.abortController.signal;
  }
  
  const response = await fetch(url, fetchOptions);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(sanitizeErrorMessage(errorData.error?.message || `Gemini API Error: Status ${response.status}`, apiKey));
  }
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Empty response returned from Gemini API.");
  }
  return text;
}

async function makeOpenAIRequest(model, systemPrompt, userPrompt, temperature, apiKey) {
  if (!apiKey) throw new Error("OpenAI API Key is missing. Click 'Settings' in the header to configure.");
  return await makeOpenAICompatibleRequest("https://api.openai.com/v1/chat/completions", model, apiKey, systemPrompt, userPrompt, temperature);
}

async function makeOpenRouterRequest(model, systemPrompt, userPrompt, temperature, apiKey) {
  if (!apiKey) throw new Error("OpenRouter API Key is missing. Click 'Settings' in the header to configure.");
  
  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'AI Debate Arena'
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: temperature
    })
  };
  if (debateState.abortController) {
    fetchOptions.signal = debateState.abortController.signal;
  }
  
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", fetchOptions);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(sanitizeErrorMessage(errorData.error?.message || `OpenRouter Error: Status ${response.status}`, apiKey));
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function makeAnthropicRequest(model, systemPrompt, userPrompt, temperature, apiKey) {
  if (!apiKey) throw new Error("Anthropic API Key is missing. Click 'Settings' in the header to configure.");
  
  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: model,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 4096,
      temperature: temperature
    })
  };
  if (debateState.abortController) {
    fetchOptions.signal = debateState.abortController.signal;
  }
  
  const response = await fetch("https://api.anthropic.com/v1/messages", fetchOptions);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(sanitizeErrorMessage(errorData.error?.message || `Anthropic Error: Status ${response.status}`, apiKey));
  }
  const data = await response.json();
  return data.content?.[0]?.text || "";
}

async function makeHuggingFaceRequest(model, systemPrompt, userPrompt, temperature, apiKey) {
  if (!apiKey) throw new Error("Hugging Face API Token is missing. Click 'Settings' in the header to configure.");
  const url = `https://api-inference.huggingface.co/v1/chat/completions`;
  return await makeOpenAICompatibleRequest(url, model, apiKey, systemPrompt, userPrompt, temperature);
}

async function makeGrokRequest(model, systemPrompt, userPrompt, temperature, apiKey) {
  if (!apiKey) throw new Error("Grok (xAI) API Key is missing. Click 'Settings' in the header to configure.");
  return await makeOpenAICompatibleRequest("https://api.x.ai/v1/chat/completions", model, apiKey, systemPrompt, userPrompt, temperature);
}

async function makeGroqRequest(model, systemPrompt, userPrompt, temperature, apiKey) {
  if (!apiKey) throw new Error("Groq API Key is missing. Click 'Settings' in the header to configure.");
  return await makeOpenAICompatibleRequest("https://api.groq.com/openai/v1/chat/completions", model, apiKey, systemPrompt, userPrompt, temperature);
}

async function makeOllamaRequest(model, systemPrompt, userPrompt, temperature, customHost = null) {
  const host = customHost || debateState.ollamaHost || "http://localhost:11434";
  const fetchOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      options: { temperature: temperature },
      stream: false
    })
  };
  if (debateState.abortController) {
    fetchOptions.signal = debateState.abortController.signal;
  }
  
  const response = await fetch(`${host}/api/chat`, fetchOptions);
  
  if (!response.ok) throw new Error(`Ollama Server returned Status ${response.status}`);
  const data = await response.json();
  return data.message?.content || "";
}
