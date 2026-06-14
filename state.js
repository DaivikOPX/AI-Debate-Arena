// Global State & Storage Helpers Module

// --- Security Helpers ---

// Simple obfuscation for API keys in localStorage (Base64 + reversal).
// Not encryption — prevents casual snooping and automated key-scraping.
function obfuscateKey(key) {
  if (!key) return "";
  try {
    return btoa(key.split('').reverse().join(''));
  } catch (e) {
    return key;
  }
}

export function deobfuscateKey(encoded) {
  if (!encoded) return "";
  try {
    return atob(encoded).split('').reverse().join('');
  } catch (e) {
    return encoded;
  }
}

// Allowlists for safe property merging from localStorage (prevents prototype pollution)
const MODERATOR_ALLOWED_KEYS = ['enabled', 'style', 'provider', 'model', 'apiKey', 'instructions', 'customModel', 'ollamaHost'];
const JUDGE_ALLOWED_KEYS = ['enabled', 'provider', 'model', 'apiKey', 'instructions', 'customModel', 'ollamaHost'];
const VALID_DEBATE_MODES = ['short', 'medium', 'long', 'advanced', 'twitter', 'podcast', 'socratic', 'humorous'];

function filterAllowedKeys(obj, allowedKeys) {
  const filtered = {};
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      filtered[key] = obj[key];
    }
  }
  return filtered;
}

export let debateState = {
  active: false,
  paused: false,
  currentRound: 1,
  totalRounds: 2,
  currentStepIndex: 0,
  turnSequence: [], // Array of steps
  history: [],      // Array of { role, name, text, avatar, team }
  activeSpeaker: null,
  isThinking: false,
  debaters: [],     // Array of debater objects
  moderator: {
    enabled: true,
    style: "strict-judge",
    provider: "gemini",
    model: "gemini-3.5-flash",
    apiKey: "",
    instructions: ""
  },
  judge: {
    enabled: true,
    provider: "gemini",
    model: "gemini-3.5-flash",
    apiKey: "",
    instructions: ""
  },
  teamDiscussionEnabled: false,
  roastEnabled: false,
  rebuttalEnabled: true,
  rebuttalLimit: 3,
  ollamaHost: "http://localhost:11434",
  thoughtEnabled: true,
  debateMode: "medium",
  abortController: null
};

// Shared DOM elements lookup
export let elements = {};

export function saveTeamDiscussionToStorage() {
  try {
    const isEnabled = elements.checkDiscussionEnabled ? elements.checkDiscussionEnabled.checked : false;
    localStorage.setItem('ai_debate_team_discussion_enabled', isEnabled ? 'true' : 'false');
  } catch (e) {
    console.warn("Storage writing restricted:", e);
  }
}

export function loadTeamDiscussionFromStorage() {
  try {
    const saved = localStorage.getItem('ai_debate_team_discussion_enabled');
    if (saved !== null && elements.checkDiscussionEnabled) {
      elements.checkDiscussionEnabled.checked = saved === 'true';
    }
  } catch (e) {
    console.warn("Storage access restricted:", e);
  }
}

export function saveRoastModeToStorage() {
  try {
    const isEnabled = elements.checkRoastEnabled ? elements.checkRoastEnabled.checked : false;
    localStorage.setItem('ai_debate_roast_enabled', isEnabled ? 'true' : 'false');
  } catch (e) {
    console.warn("Storage writing restricted:", e);
  }
}

export function loadRoastModeFromStorage() {
  try {
    const saved = localStorage.getItem('ai_debate_roast_enabled');
    if (saved !== null) {
      debateState.roastEnabled = saved === 'true';
      if (elements.checkRoastEnabled) {
        elements.checkRoastEnabled.checked = debateState.roastEnabled;
      }
    }
  } catch (e) {
    console.warn("Storage access restricted:", e);
  }
}

export function saveDebatersToStorage() {
  try {
    const sanitized = debateState.debaters.map(d => ({
      ...d,
      apiKey: obfuscateKey(d.apiKey || "")
    }));
    localStorage.setItem('ai_debaters_state_v2', JSON.stringify(sanitized));
  } catch (e) {
    console.warn("Storage writing restricted:", e);
  }
}

export function saveModeratorToStorage() {
  try {
    const sanitized = { ...debateState.moderator, apiKey: obfuscateKey(debateState.moderator.apiKey || "") };
    localStorage.setItem('ai_debate_moderator_v2', JSON.stringify(sanitized));
  } catch (e) {
    console.warn("Storage writing restricted:", e);
  }
}

export function saveJudgeToStorage() {
  try {
    const sanitized = { ...debateState.judge, apiKey: obfuscateKey(debateState.judge.apiKey || "") };
    localStorage.setItem('ai_debate_judge_v2', JSON.stringify(sanitized));
  } catch (e) {
    console.warn("Storage writing restricted:", e);
  }
}

export function saveDebateModeToStorage() {
  try {
    localStorage.setItem('ai_debate_mode_v2', debateState.debateMode);
  } catch (e) {
    console.warn("Storage writing restricted:", e);
  }
}

export function loadDebateModeFromStorage() {
  try {
    let savedMode = localStorage.getItem('ai_debate_mode_v2');
    
    // Map legacy modes to new modes if they exist
    if (savedMode === "formal") savedMode = "medium";
    else if (savedMode === "creative") savedMode = "advanced";

    // Validate against allowed modes
    if (savedMode && !VALID_DEBATE_MODES.includes(savedMode)) {
      savedMode = "medium";
    }

    if (savedMode) {
      debateState.debateMode = savedMode;
      if (elements.selectDebateMode) {
        elements.selectDebateMode.value = savedMode;
      }
    } else {
      debateState.debateMode = "medium";
      if (elements.selectDebateMode) {
        elements.selectDebateMode.value = "medium";
      }
    }
    
    // Auto-adjust rounds count slider based on loaded mode
    let autoRounds = 2;
    const mode = debateState.debateMode;
    if (mode === "short" || mode === "twitter") autoRounds = 1;
    else if (mode === "medium" || mode === "humorous") autoRounds = 2;
    else if (mode === "long" || mode === "podcast") autoRounds = 3;
    else if (mode === "advanced") autoRounds = 4;
    else if (mode === "socratic") autoRounds = 5;
    
    if (elements.inputRounds) {
      elements.inputRounds.value = autoRounds;
      if (elements.valRounds) {
        elements.valRounds.textContent = autoRounds;
      }
    }
  } catch (e) {
    console.warn("Storage access restricted:", e);
    debateState.debateMode = "medium";
  }
}

export function loadModeratorFromStorage() {
  let savedMod = null;
  try {
    savedMod = localStorage.getItem('ai_debate_moderator_v2');
  } catch (e) {
    console.warn("Storage access restricted:", e);
  }
  
  if (savedMod) {
    try {
      const parsed = filterAllowedKeys(JSON.parse(savedMod), MODERATOR_ALLOWED_KEYS);
      // Deobfuscate API key
      if (parsed.apiKey) parsed.apiKey = deobfuscateKey(parsed.apiKey);
      debateState.moderator = { ...debateState.moderator, ...parsed };
      if (debateState.moderator.provider === "offline" || debateState.moderator.provider === "mock") {
        debateState.moderator.provider = "gemini";
        debateState.moderator.model = "gemini-3.5-flash";
      }
      if (debateState.moderator.ollamaHost) {
        debateState.ollamaHost = debateState.moderator.ollamaHost;
      }
    } catch (e) {
      console.error("Error parsing moderator settings:", e);
    }
  }
  
  // Sync state to elements if they exist
  if (elements.checkModEnabled) {
    elements.checkModEnabled.checked = debateState.moderator.enabled;
  }
}

export function loadJudgeFromStorage() {
  let savedJudge = null;
  try {
    savedJudge = localStorage.getItem('ai_debate_judge_v2');
  } catch (e) {
    console.warn("Storage access restricted:", e);
  }
  
  if (savedJudge) {
    try {
      const parsed = filterAllowedKeys(JSON.parse(savedJudge), JUDGE_ALLOWED_KEYS);
      // Deobfuscate API key
      if (parsed.apiKey) parsed.apiKey = deobfuscateKey(parsed.apiKey);
      debateState.judge = { ...debateState.judge, ...parsed };
      if (debateState.judge.provider === "offline" || debateState.judge.provider === "mock") {
        debateState.judge.provider = "gemini";
        debateState.judge.model = "gemini-3.5-flash";
      }
    } catch (e) {
      console.error("Error parsing judge settings:", e);
    }
  }
  
  // Sync state to elements if they exist
  if (elements.checkJudgeEnabled) {
    elements.checkJudgeEnabled.checked = debateState.judge.enabled;
  }
}

export function saveRebuttalSettingsToStorage() {
  try {
    const isEnabled = elements.checkRebuttalEnabled ? elements.checkRebuttalEnabled.checked : true;
    const limit = elements.selectRebuttalLimit ? parseInt(elements.selectRebuttalLimit.value, 10) : 3;
    localStorage.setItem('ai_debate_rebuttal_enabled', isEnabled ? 'true' : 'false');
    localStorage.setItem('ai_debate_rebuttal_limit', limit.toString());
  } catch (e) {
    console.warn("Storage writing restricted:", e);
  }
}

export function loadRebuttalSettingsFromStorage() {
  try {
    const savedEnabled = localStorage.getItem('ai_debate_rebuttal_enabled');
    if (savedEnabled !== null) {
      debateState.rebuttalEnabled = savedEnabled === 'true';
      if (elements.checkRebuttalEnabled) {
        elements.checkRebuttalEnabled.checked = debateState.rebuttalEnabled;
      }
    } else {
      debateState.rebuttalEnabled = true;
      if (elements.checkRebuttalEnabled) {
        elements.checkRebuttalEnabled.checked = true;
      }
    }

    const savedLimit = localStorage.getItem('ai_debate_rebuttal_limit');
    if (savedLimit !== null) {
      let parsedLimit = parseInt(savedLimit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) parsedLimit = 3;
      if (parsedLimit > 10) parsedLimit = 10;
      debateState.rebuttalLimit = parsedLimit;
      if (elements.selectRebuttalLimit) {
        elements.selectRebuttalLimit.value = debateState.rebuttalLimit.toString();
      }
    } else {
      debateState.rebuttalLimit = 3;
      if (elements.selectRebuttalLimit) {
        elements.selectRebuttalLimit.value = "3";
      }
    }
  } catch (e) {
    console.warn("Storage access restricted:", e);
  }
}

export function saveThoughtSettingToStorage() {
  try {
    const isEnabled = elements.checkThoughtEnabled ? elements.checkThoughtEnabled.checked : true;
    localStorage.setItem('ai_debate_thought_enabled_v2', isEnabled ? 'true' : 'false');
  } catch (e) {
    console.warn("Storage writing restricted:", e);
  }
}

export function loadThoughtSettingFromStorage() {
  try {
    const saved = localStorage.getItem('ai_debate_thought_enabled_v2');
    if (saved !== null) {
      debateState.thoughtEnabled = saved === 'true';
      if (elements.checkThoughtEnabled) {
        elements.checkThoughtEnabled.checked = debateState.thoughtEnabled;
      }
    } else {
      debateState.thoughtEnabled = true;
      if (elements.checkThoughtEnabled) {
        elements.checkThoughtEnabled.checked = true;
      }
    }
  } catch (e) {
    console.warn("Storage access restricted:", e);
  }
}

