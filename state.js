// Global State & Storage Helpers Module

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
  teamDiscussionEnabled: false,
  roastEnabled: false,
  rebuttalEnabled: true,
  rebuttalLimit: 3,
  ollamaHost: "http://localhost:11434",
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
    localStorage.setItem('ai_debaters_state_v2', JSON.stringify(debateState.debaters));
  } catch (e) {
    console.warn("Storage writing restricted:", e);
  }
}

export function saveModeratorToStorage() {
  try {
    localStorage.setItem('ai_debate_moderator_v2', JSON.stringify(debateState.moderator));
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
      debateState.moderator = { ...debateState.moderator, ...JSON.parse(savedMod) };
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

export function saveRebuttalSettingsToStorage() {
  try {
    const isEnabled = elements.checkRebuttalEnabled ? elements.checkRebuttalEnabled.checked : true;
    const limit = elements.selectRebuttalLimit ? parseInt(elements.selectRebuttalLimit.value) : 3;
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
      debateState.rebuttalLimit = parseInt(savedLimit);
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

