// AI Debate Simulator - V2 Core Application Logic
// Supports 2 to 6 dynamic debaters, team-based arguments, and 10 LLM providers.

// Helper to escape HTML to prevent XSS and DOM breaking
function escapeHtml(text) {
  if (text === undefined || text === null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Global state V2
let debateState = {
  active: false,
  paused: false,
  currentRound: 1,
  totalRounds: 2,
  currentStepIndex: 0,
  turnSequence: [], // Array of steps: { type: 'mod-intro'|'mod-transition'|'mod-outro'|'debater'|'judge-verdict', debaterId: '', round: 1 }
  history: [],      // Array of { role: 'pro'|'con'|'mod'|'judge', name: '', text: '', avatar: '', team: 'pro'|'con'|'none' }
  activeSpeaker: null, // debater object or 'mod' or 'judge'
  isThinking: false,
  debaters: [],     // Array of debaters. Minimum 2, maximum 6.
  moderator: {
    enabled: true,
    style: "strict-judge",
    provider: "gemini",
    model: "gemini-3.5-flash",
    apiKey: ""
  },
  teamDiscussionEnabled: false,
  ollamaHost: "http://localhost:11434",
  rulePreset: "classic-arena",
  debateMode: "formal",
  abortController: null // AbortController to cancel ongoing fetches
};

// DOM elements lookup (populated dynamically on initialization)
let elements = {};

let tempModalState = {
  debaters: [],
  moderator: {}
};

// Default initial debaters V2
const DEFAULT_DEBATERS = [
  {
    id: "debater_1",
    name: "Debater #1",
    team: "pro",
    provider: "gemini",
    model: "gemini-1.5-flash",
    apiKey: "",
    customModel: "",
    personaPreset: "",
    instructions: "",
    temperature: 0.8,
    avatar: "🤖",
    aggression: 5,
    logic: 5,
    emotion: 5,
    humor: 5,
    stubbornness: 5
  },
  {
    id: "debater_2",
    name: "Debater #2",
    team: "con",
    provider: "gemini",
    model: "gemini-1.5-flash",
    apiKey: "",
    customModel: "",
    personaPreset: "",
    instructions: "",
    temperature: 0.7,
    avatar: "🧠",
    aggression: 5,
    logic: 5,
    emotion: 5,
    humor: 5,
    stubbornness: 5
  }
];

// Initialize Application
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

function initApp() {
  // Populate DOM elements lookup dynamically when DOM is guaranteed ready
  elements = {
    selectPreset: document.getElementById('select-preset'),
    selectRulePreset: document.getElementById('select-rule-preset'),
    selectDebateMode: document.getElementById('select-debate-mode'),
    inputTopicTitle: document.getElementById('input-topic-title'),
    inputTopicDesc: document.getElementById('input-topic-desc'),
    btnModalAddDebater: document.getElementById('btn-modal-add-debater'),
    
    checkModEnabled: document.getElementById('check-mod-enabled'),
    moderatorSubsettings: document.getElementById('moderator-subsettings'),
    selectModStyle: document.getElementById('select-mod-style'),
    checkDiscussionEnabled: document.getElementById('check-discussion-enabled'),
    grpTeamDiscussion: document.getElementById('grp-team-discussion'),
    
    inputRounds: document.getElementById('input-rounds'),
    valRounds: document.getElementById('val-rounds'),
    
    btnStart: document.getElementById('btn-start'),
    btnPause: document.getElementById('btn-pause'),
    btnStep: document.getElementById('btn-step'),
    btnReset: document.getElementById('btn-reset'),
    btnExportMd: document.getElementById('btn-export-md'),
    
    debaterPods: document.getElementById('debater-pods'),
    debateFeed: document.getElementById('debate-feed'),
    feedEmptyGuide: document.getElementById('feed-empty-guide'),
    
    btnSettingsToggle: document.getElementById('btn-settings-toggle'),
    modalSettings: document.getElementById('modal-debaters'),
    btnCloseSettings: document.getElementById('btn-close-debaters'),
    btnSaveSettings: document.getElementById('btn-save-debaters'),
    btnHeaderCloseSettings: document.getElementById('btn-header-close-debaters'),
    modalSettingsBody: document.getElementById('modal-debaters-settings')
  };

  setupInitialDebaters();
  initializePresets();
  loadModeratorFromStorage();
  loadDebateModeFromStorage();
  loadRulePresetFromStorage();
  loadTeamDiscussionFromStorage();
  setupEventListeners();
  updateUIForState();
}

function saveTeamDiscussionToStorage() {
  try {
    const isEnabled = elements.checkDiscussionEnabled ? elements.checkDiscussionEnabled.checked : false;
    localStorage.setItem('ai_debate_team_discussion_enabled', isEnabled ? 'true' : 'false');
  } catch (e) {
    console.warn("Storage writing restricted:", e);
  }
}

function loadTeamDiscussionFromStorage() {
  try {
    const saved = localStorage.getItem('ai_debate_team_discussion_enabled');
    if (saved !== null && elements.checkDiscussionEnabled) {
      elements.checkDiscussionEnabled.checked = saved === 'true';
    }
  } catch (e) {
    console.warn("Storage access restricted:", e);
  }
}




function saveDebatersToStorage() {
  try {
    localStorage.setItem('ai_debaters_state_v2', JSON.stringify(debateState.debaters));
  } catch (e) {
    console.warn("Storage writing restricted:", e);
  }
}

function saveModeratorToStorage() {
  try {
    localStorage.setItem('ai_debate_moderator_v2', JSON.stringify(debateState.moderator));
  } catch (e) {
    console.warn("Storage writing restricted:", e);
  }
}

function saveDebateModeToStorage() {
  try {
    localStorage.setItem('ai_debate_mode_v2', debateState.debateMode);
  } catch (e) {
    console.warn("Storage writing restricted:", e);
  }
}

function loadDebateModeFromStorage() {
  try {
    const savedMode = localStorage.getItem('ai_debate_mode_v2');
    if (savedMode) {
      debateState.debateMode = savedMode;
      if (elements.selectDebateMode) {
        elements.selectDebateMode.value = savedMode;
      }
    }
  } catch (e) {
    console.warn("Storage access restricted:", e);
  }
}

function saveRulePresetToStorage() {
  try {
    localStorage.setItem('ai_debate_rule_preset_v2', debateState.rulePreset);
  } catch (e) {
    console.warn("Storage writing restricted:", e);
  }
}

function loadRulePresetFromStorage() {
  try {
    const savedPreset = localStorage.getItem('ai_debate_rule_preset_v2');
    if (savedPreset) {
      debateState.rulePreset = savedPreset;
      if (elements.selectRulePreset) {
        elements.selectRulePreset.value = savedPreset;
      }
      applyRulePreset(savedPreset);
    } else {
      setRulePreset("classic-arena", false);
      applyRulePreset("classic-arena");
    }
  } catch (e) {
    console.warn("Storage access restricted:", e);
  }
}

function applyRulePreset(presetId) {
  if (presetId === "custom") return;
  
  let rounds = 2;
  let mode = "formal";
  let modEnabled = true;

  if (presetId === "quick-clash") {
    rounds = 1;
    mode = "twitter";
    modEnabled = true;
  } else if (presetId === "classic-arena") {
    rounds = 2;
    mode = "formal";
    modEnabled = true;
  } else if (presetId === "deep-podcast") {
    rounds = 3;
    mode = "podcast";
    modEnabled = true;
  } else if (presetId === "direct-faceoff") {
    rounds = 2;
    mode = "formal";
    modEnabled = false;
  }

  // Update State
  debateState.debateMode = mode;
  debateState.moderator.enabled = modEnabled;
  
  // Update UI Elements
  if (elements.inputRounds) {
    elements.inputRounds.value = rounds;
    elements.valRounds.textContent = rounds;
  }
  if (elements.selectDebateMode) {
    elements.selectDebateMode.value = mode;
  }
  if (elements.checkModEnabled) {
    elements.checkModEnabled.checked = modEnabled;
    elements.moderatorSubsettings.style.display = modEnabled ? 'block' : 'none';
  }
  
  // Save all to storage
  saveDebateModeToStorage();
  saveModeratorToStorage();
}

function setRulePreset(presetId, save = true) {
  debateState.rulePreset = presetId;
  if (elements.selectRulePreset) {
    elements.selectRulePreset.value = presetId;
  }
  if (save) {
    saveRulePresetToStorage();
  }
}

function loadModeratorFromStorage() {
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
    elements.moderatorSubsettings.style.display = debateState.moderator.enabled ? 'block' : 'none';
  }
  if (elements.selectModStyle) {
    elements.selectModStyle.value = debateState.moderator.style;
  }
}

// Populate preset dropdowns
function initializePresets() {
  // Topics select
  DEBATE_PRESETS.topics.forEach(topic => {
    const opt = document.createElement('option');
    opt.value = topic.id;
    opt.textContent = topic.title;
    elements.selectPreset.appendChild(opt);
  });
  
  // Moderator styles select
  DEBATE_PRESETS.moderators.forEach(mod => {
    const opt = document.createElement('option');
    opt.value = mod.id;
    opt.textContent = mod.name;
    elements.selectModStyle.appendChild(opt);
  });

  // Set default values
  elements.selectPreset.value = "custom";
  elements.selectModStyle.value = "strict-judge";
}

// Populate models select based on chosen provider
function populateModelsDropdown(providerSelect, modelSelect) {
  const provider = providerSelect.value;
  modelSelect.innerHTML = "";
  
  const modelsList = [...(DEBATE_PRESETS.models[provider] || [])];
  if (modelsList.length > 0 && !modelsList.some(m => m.id === 'custom')) {
    modelsList.push({ id: "custom", name: "[Custom Model Identifier...]" });
  }
  
  modelsList.forEach(model => {
    const opt = document.createElement('option');
    opt.value = model.id;
    opt.textContent = model.name;
    modelSelect.appendChild(opt);
  });
}

// Set initial debaters list
function setupInitialDebaters() {
  let savedDebaters = null;
  try {
    savedDebaters = localStorage.getItem('ai_debaters_state_v2');
  } catch (e) {
    console.warn("Storage access restricted:", e);
  }

  if (savedDebaters) {
    try {
      const parsed = JSON.parse(savedDebaters);
      if (Array.isArray(parsed) && parsed.length >= 2 && parsed.length <= 6) {
        debateState.debaters = parsed;
        // Ensure apiKey and trait properties exist on all debaters
        debateState.debaters.forEach(d => {
          if (!d.id) d.id = `debater_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          if (!d.name) d.name = "Unnamed";
          if (d.team !== "pro" && d.team !== "con") d.team = "pro";
          if (!d.provider) d.provider = "gemini";
          if (!d.model) d.model = "gemini-1.5-flash";
          if (d.apiKey === undefined) d.apiKey = "";
          if (d.provider === "offline" || d.provider === "mock") {
            d.provider = "gemini";
            d.model = "gemini-1.5-flash";
          }
        });
      } else {
        throw new Error("Invalid debaters array length or shape");
      }
    } catch (e) {
      console.error("Error parsing debaters settings, resetting to default:", e);
      debateState.debaters = JSON.parse(JSON.stringify(DEFAULT_DEBATERS));
    }
  } else {
    debateState.debaters = JSON.parse(JSON.stringify(DEFAULT_DEBATERS));
  }
  
  renderArenaStage();
}

// Render Moderator and AI Debaters config inside settings modal
function renderSettingsModal() {
  if (!elements.modalSettingsBody) return;
  elements.modalSettingsBody.innerHTML = "";
  
  // Disable Add button if limit reached
  if (elements.btnModalAddDebater) {
    elements.btnModalAddDebater.disabled = tempModalState.debaters.length >= 6;
  }
  
  // Build providers options
  const providers = [
    { id: 'gemini', name: 'Google Gemini' },
    { id: 'openrouter', name: 'OpenRouter' },
    { id: 'openai', name: 'OpenAI' },
    { id: 'anthropic', name: 'Anthropic' },
    { id: 'huggingface', name: 'Hugging Face' },
    { id: 'grok', name: 'Grok (xAI)' },
    { id: 'groq', name: 'Groq' },
    { id: 'qwen', name: 'Qwen' },
    { id: 'deepseek', name: 'DeepSeek' },
    { id: 'ollama', name: 'Ollama (Local)' }
  ];

  // 1. Render AI Moderator config card
  const modCard = document.createElement('div');
  modCard.className = 'modal-debater-card team-mod';
  modCard.style.borderLeft = '3px solid var(--color-mod)';
  
  let modProviderOptions = "";
  providers.forEach(p => {
    modProviderOptions += `<option value="${p.id}" ${tempModalState.moderator.provider === p.id ? 'selected' : ''}>${p.name}</option>`;
  });

  const modModels = [...(DEBATE_PRESETS.models[tempModalState.moderator.provider] || [])];
  if (modModels.length > 0 && !modModels.some(m => m.id === 'custom')) {
    modModels.push({ id: "custom", name: "[Custom Model Identifier...]" });
  }
  let modModelOptions = "";
  modModels.forEach(m => {
    modModelOptions += `<option value="${m.id}" ${tempModalState.moderator.model === m.id ? 'selected' : ''}>${m.name}</option>`;
  });

  modCard.innerHTML = `
    <div class="modal-debater-card-header">
      <div class="modal-debater-card-title">
        <span style="font-size: 1.25rem;">⚖️</span>
        <span style="font-weight: 700; font-size: 0.95rem; color: var(--color-mod);">AI Moderator & Judge Settings</span>
      </div>
    </div>
    
    <div class="modal-debater-card-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
      <div>
        <div class="form-group">
          <label>API Provider</label>
          <select id="select-mod-provider-modal">
            ${modProviderOptions}
          </select>
        </div>

        <div class="form-group" style="margin-top: 0.5rem;">
          <label>Model</label>
          <select id="select-mod-model-modal">
            ${modModelOptions}
          </select>
        </div>
      </div>

      <div>
        <div class="form-group">
          <label>API Key</label>
          <div class="api-input-wrap">
            <input type="password" id="select-mod-key-modal" value="${escapeHtml(tempModalState.moderator.apiKey || '')}" placeholder="Enter API Key...">
            <button type="button" class="toggle-visibility-btn" data-target="select-mod-key-modal" aria-label="Toggle password visibility">👁️</button>
          </div>
        </div>

        <div class="form-group grp-custom-model" id="grp-mod-custom-model-modal" style="display: ${tempModalState.moderator.model === 'custom' ? 'block' : 'none'}; margin-top: 0.5rem;">
          <label>Custom Model ID</label>
          <input type="text" id="input-mod-custom-model-modal" value="${escapeHtml(tempModalState.moderator.customModel || '')}" placeholder="e.g., llama3:70b">
        </div>

        <div class="form-group" id="grp-ollama-host-modal" style="display: ${tempModalState.moderator.provider === 'ollama' ? 'block' : 'none'}; margin-top: 0.5rem;">
          <label>Ollama Host URL</label>
          <input type="text" id="input-ollama-host-modal" value="${escapeHtml(tempModalState.moderator.ollamaHost || debateState.ollamaHost || '')}" placeholder="e.g., http://localhost:11434">
        </div>
      </div>
    </div>
  `;
  elements.modalSettingsBody.appendChild(modCard);

  // 2. Render AI Debaters
  tempModalState.debaters.forEach((debater, index) => {
    const card = document.createElement('div');
    card.className = `modal-debater-card team-${debater.team}`;
    card.id = `modal-debater-card-${debater.id}`;
    
    let personaOptions = `<option value="">-- Custom Persona --</option>`;
    DEBATE_PRESETS.personas.forEach(p => {
      personaOptions += `<option value="${p.id}" ${debater.personaPreset === p.id ? 'selected' : ''}>${p.name}</option>`;
    });

    let providerOptions = "";
    providers.forEach(p => {
      providerOptions += `<option value="${p.id}" ${debater.provider === p.id ? 'selected' : ''}>${p.name}</option>`;
    });

    const models = [...(DEBATE_PRESETS.models[debater.provider] || [])];
    if (models.length > 0 && !models.some(m => m.id === 'custom')) {
      models.push({ id: "custom", name: "[Custom Model Identifier...]" });
    }
    let modelOptions = "";
    models.forEach(m => {
      modelOptions += `<option value="${m.id}" ${debater.model === m.id ? 'selected' : ''}>${m.name}</option>`;
    });

    card.innerHTML = `
      <div class="modal-debater-card-header">
        <div class="modal-debater-card-title">
          <span style="font-size: 1.25rem;">${debater.avatar}</span>
          <span class="modal-debater-card-label" data-id="${debater.id}" style="font-weight: 700; font-size: 0.95rem;">
            ${escapeHtml(debater.name) || `Debater #${index + 1}`}
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span class="info-badge team-badge-${debater.team}" style="font-weight: 700; font-size: 0.65rem; color: ${debater.team === 'pro' ? 'var(--color-pro)' : 'var(--color-con)'}">
            ${debater.team === 'pro' ? 'PRO' : 'CON'}
          </span>
          ${tempModalState.debaters.length > 2 ? `
            <button class="btn-remove-debater btn-icon-only" data-id="${debater.id}" title="Remove Debater" style="background: none; border: none; font-size: 0.95rem; cursor: pointer; padding: 0.2rem; display: inline-flex; align-items: center; justify-content: center; margin-left: 0.25rem;">
              🗑️
            </button>
          ` : ''}
        </div>
      </div>
      
      <div class="modal-debater-card-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div>
          <div class="form-group">
            <label>Name</label>
            <input type="text" class="input-debater-name" data-id="${debater.id}" value="${escapeHtml(debater.name)}">
          </div>

          <div class="form-group" style="margin-top: 0.5rem;">
            <label>Team Allocation</label>
            <select class="select-debater-team" data-id="${debater.id}" style="font-weight: 700; color: ${debater.team === 'pro' ? 'var(--color-pro)' : 'var(--color-con)'}">
              <option value="pro" ${debater.team === 'pro' ? 'selected' : ''}>Affirmative (Team Pro)</option>
              <option value="con" ${debater.team === 'con' ? 'selected' : ''}>Negative (Team Con)</option>
            </select>
          </div>

          <div class="form-group" style="margin-top: 0.5rem;">
            <label>Persona Preset</label>
            <select class="select-debater-persona" data-id="${debater.id}">
              ${personaOptions}
            </select>
          </div>
          
          <div class="form-group" style="margin-top: 0.5rem;">
            <div style="display: flex; justify-content: space-between;">
              <label>Temperature</label>
              <span class="val-debater-temp" data-id="${debater.id}" style="font-family: var(--font-mono); font-size: 0.8rem;">${debater.temperature}</span>
            </div>
            <input type="range" class="slider-debater-temp" data-id="${debater.id}" min="0" max="1.5" step="0.1" value="${debater.temperature}">
          </div>
        </div>

        <div>
          <div class="modal-debater-fields-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label>API Provider</label>
              <select class="select-debater-provider" data-id="${debater.id}">
                ${providerOptions}
              </select>
            </div>

            <div class="form-group">
              <label>Model</label>
              <select class="select-debater-model" data-id="${debater.id}">
                ${modelOptions}
              </select>
            </div>
          </div>

          <div class="form-group" style="margin-top: 0.5rem;">
            <label>API Key</label>
            <div class="api-input-wrap">
              <input type="password" id="key-${debater.id}" class="input-debater-key" data-id="${debater.id}" value="${escapeHtml(debater.apiKey || '')}" placeholder="Enter API Key...">
              <button type="button" class="toggle-visibility-btn" data-target="key-${debater.id}" aria-label="Toggle password visibility">👁️</button>
            </div>
          </div>

          <div class="form-group grp-custom-model" id="grp-custom-model-${debater.id}" style="display: ${debater.model === 'custom' ? 'block' : 'none'}; margin-top: 0.5rem;">
            <label>Custom Model ID</label>
            <input type="text" class="input-debater-custom-model" data-id="${debater.id}" value="${escapeHtml(debater.customModel || '')}" placeholder="e.g., llama3:8b">
          </div>

          <div class="form-group" style="margin-top: 0.5rem;">
            <label>System Instructions</label>
            <textarea class="textarea-debater-instructions" data-id="${debater.id}" style="min-height: 80px;">${escapeHtml(debater.instructions || '')}</textarea>
          </div>
        </div>
      </div>
    `;
    elements.modalSettingsBody.appendChild(card);
  });

  bindModalDebaterEvents();
}

// Bind event listeners for dynamic inputs inside settings modal
function bindModalDebaterEvents() {
  // --- Moderator Change Listeners ---
  const modProv = document.getElementById('select-mod-provider-modal');
  if (modProv) {
    modProv.addEventListener('change', (e) => {
      const val = e.target.value;
      tempModalState.moderator.provider = val;
      
      const modModelSelect = document.getElementById('select-mod-model-modal');
      if (modModelSelect) {
        modModelSelect.innerHTML = "";
        const models = [...(DEBATE_PRESETS.models[val] || [])];
        if (models.length > 0 && !models.some(m => m.id === 'custom')) {
          models.push({ id: "custom", name: "[Custom Model Identifier...]" });
        }
        models.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.id;
          opt.textContent = m.name;
          modModelSelect.appendChild(opt);
        });
        tempModalState.moderator.model = modModelSelect.value;
      }
      
      const customRow = document.getElementById('grp-mod-custom-model-modal');
      if (customRow) customRow.style.display = tempModalState.moderator.model === 'custom' ? 'block' : 'none';
      
      const ollamaRow = document.getElementById('grp-ollama-host-modal');
      if (ollamaRow) ollamaRow.style.display = val === 'ollama' ? 'block' : 'none';
    });
  }

  const modMod = document.getElementById('select-mod-model-modal');
  if (modMod) {
    modMod.addEventListener('change', (e) => {
      const val = e.target.value;
      tempModalState.moderator.model = val;
      const customRow = document.getElementById('grp-mod-custom-model-modal');
      if (customRow) customRow.style.display = val === 'custom' ? 'block' : 'none';
    });
  }

  // --- Debaters Change Listeners ---
  // Name changes
  document.querySelectorAll('#modal-settings-body .input-debater-name').forEach(el => {
    el.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      const name = e.target.value;
      updateTempDebaterProperty(id, 'name', name);
      const card = document.getElementById(`modal-debater-card-${id}`);
      if (card) {
        const label = card.querySelector('.modal-debater-card-label');
        if (label) label.textContent = name || "Unnamed";
      }
    });
  });

  // Team Allocation
  document.querySelectorAll('#modal-settings-body .select-debater-team').forEach(el => {
    el.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      const val = e.target.value;
      updateTempDebaterProperty(id, 'team', val);
      
      const card = document.getElementById(`modal-debater-card-${id}`);
      if (card) {
        card.className = `modal-debater-card team-${val}`;
        const modalBadge = card.querySelector(`.info-badge`);
        if (modalBadge) {
          modalBadge.className = `info-badge team-badge-${val}`;
          modalBadge.textContent = val === 'pro' ? 'PRO' : 'CON';
          modalBadge.style.color = val === 'pro' ? 'var(--color-pro)' : 'var(--color-con)';
        }
      }
      e.target.style.color = val === 'pro' ? 'var(--color-pro)' : 'var(--color-con)';
    });
  });

  // Persona selections
  document.querySelectorAll('#modal-settings-body .select-debater-persona').forEach(el => {
    el.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      const personaId = e.target.value;
      updateTempDebaterProperty(id, 'personaPreset', personaId);
      
      if (personaId) {
        const persona = DEBATE_PRESETS.personas.find(p => p.id === personaId);
        if (persona) {
          const textarea = document.querySelector(`#modal-debater-card-${id} .textarea-debater-instructions`);
          if (textarea) {
            textarea.value = persona.systemInstructions;
            updateTempDebaterProperty(id, 'instructions', persona.systemInstructions);
          }
        }
      }
    });
  });

  // Instructions textarea
  document.querySelectorAll('#modal-settings-body .textarea-debater-instructions').forEach(el => {
    el.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      updateTempDebaterProperty(id, 'instructions', e.target.value);
      const personaSelect = document.querySelector(`#modal-debater-card-${id} .select-debater-persona`);
      if (personaSelect) {
        personaSelect.value = "";
        updateTempDebaterProperty(id, 'personaPreset', "");
      }
    });
  });

  // Provider changes
  document.querySelectorAll('#modal-settings-body .select-debater-provider').forEach(el => {
    el.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      const val = e.target.value;
      updateTempDebaterProperty(id, 'provider', val);
      
      const modelSelect = document.querySelector(`#modal-debater-card-${id} .select-debater-model`);
      if (modelSelect) {
        modelSelect.innerHTML = "";
        const models = [...(DEBATE_PRESETS.models[val] || [])];
        if (models.length > 0 && !models.some(m => m.id === 'custom')) {
          models.push({ id: "custom", name: "[Custom Model Identifier...]" });
        }
        models.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.id;
          opt.textContent = m.name;
          modelSelect.appendChild(opt);
        });
        updateTempDebaterProperty(id, 'model', modelSelect.value);
      }
      
      toggleCustomModelRow(id);
    });
  });

  // API Key inputs
  document.querySelectorAll('#modal-settings-body .input-debater-key').forEach(el => {
    el.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      updateTempDebaterProperty(id, 'apiKey', e.target.value.trim());
    });
  });
}

function updateTempDebaterProperty(id, property, value) {
  const debater = tempModalState.debaters.find(d => d.id === id);
  if (debater) {
    debater[property] = value;
  }
}

function updateDebaterProperty(id, property, value) {
  const debater = debateState.debaters.find(d => d.id === id);
  if (debater) {
    debater[property] = value;
    saveDebatersToStorage();
  }
}

function toggleCustomModelRow(id) {
  const debater = tempModalState.debaters.find(d => d.id === id) || debateState.debaters.find(d => d.id === id);
  const row = document.getElementById(`grp-custom-model-${id}`);
  if (debater && debater.model === 'custom') {
    row.style.display = 'block';
  } else {
    row.style.display = 'none';
  }
}



// Add a new debater card dynamically
function addDebater() {
  if (tempModalState.debaters.length >= 6) return;
  
  const count = tempModalState.debaters.length + 1;
  
  // Pick cycled avatar emoji
  const avatarIndex = (count - 1) % DEBATE_PRESETS.emojis.length;
  const avatar = DEBATE_PRESETS.emojis[avatarIndex];
  
  // Pick team: Alternate Pro and Con
  const team = count % 2 === 1 ? 'pro' : 'con';
  
  const newDebater = {
    id: `debater_${Date.now()}`,
    name: `Debater #${count}`,
    team: team,
    provider: "gemini",
    model: "gemini-1.5-flash",
    apiKey: "",
    customModel: "",
    personaPreset: "",
    instructions: "",
    temperature: 0.7,
    avatar: avatar
  };
  
  tempModalState.debaters.push(newDebater);
  renderSettingsModal();
}

// Remove a debater card dynamically
function removeDebater(id) {
  if (tempModalState.debaters.length <= 2) return;
  tempModalState.debaters = tempModalState.debaters.filter(d => d.id !== id);
  renderSettingsModal();
}

// Load topic preset details and update instructions V2
function loadTopicPreset(topicId) {
  if (topicId === "custom") return;
  const topic = DEBATE_PRESETS.topics.find(t => t.id === topicId);
  if (topic) {
    elements.inputTopicTitle.value = topic.title;
    elements.inputTopicDesc.value = topic.description;
  }
}

// Set up event listeners for V2 inputs
function setupEventListeners() {
  elements.selectPreset.addEventListener('change', (e) => loadTopicPreset(e.target.value));
  elements.inputTopicTitle.addEventListener('input', updateUIForState);
  elements.inputTopicDesc.addEventListener('input', updateUIForState);
  
  // Add debater click
  if (elements.btnModalAddDebater) {
    elements.btnModalAddDebater.addEventListener('click', addDebater);
  }
  
  // Style for Moderator (Sidebar control, saves instantly)
  elements.selectModStyle.addEventListener('change', () => {
    debateState.moderator.style = elements.selectModStyle.value;
    saveModeratorToStorage();
  });

  // Rounds slider
  elements.inputRounds.addEventListener('input', (e) => {
    elements.valRounds.textContent = e.target.value;
  });
  
  // Moderator toggle
  elements.checkModEnabled.addEventListener('change', (e) => {
    elements.moderatorSubsettings.style.display = e.target.checked ? 'block' : 'none';
    debateState.moderator.enabled = e.target.checked;
    saveModeratorToStorage();
  });

  // Team discussion toggle
  if (elements.checkDiscussionEnabled) {
    elements.checkDiscussionEnabled.addEventListener('change', () => {
      saveTeamDiscussionToStorage();
    });
  }

  // Action Buttons
  elements.btnStart.addEventListener('click', startDebate);
  elements.btnPause.addEventListener('click', togglePauseDebate);
  elements.btnStep.addEventListener('click', stepTurn);
  elements.btnReset.addEventListener('click', resetArena);
  elements.btnExportMd.addEventListener('click', exportDebateAsMarkdown);

  // --- Unified Arena Settings Modal ---
  elements.btnSettingsToggle.addEventListener('click', () => {
    tempModalState.debaters = JSON.parse(JSON.stringify(debateState.debaters));
    tempModalState.moderator = JSON.parse(JSON.stringify(debateState.moderator));
    renderSettingsModal();
    elements.modalSettings.classList.add('active');
  });

  // Close Settings modal (cancel)
  elements.btnCloseSettings.addEventListener('click', () => {
    elements.modalSettings.classList.remove('active');
  });
  elements.btnHeaderCloseSettings.addEventListener('click', () => {
    elements.modalSettings.classList.remove('active');
  });

  // Close Settings modal when clicking outside
  elements.modalSettings.addEventListener('click', (e) => {
    if (e.target === elements.modalSettings) {
      elements.modalSettings.classList.remove('active');
    }
  });

  // Save settings
  elements.btnSaveSettings.addEventListener('click', saveSettings);
  
  // Delegated click handler for password visibility and debater removal
  document.addEventListener('click', (e) => {
    // Onboarding settings click
    const onboardingBtn = e.target.closest('#btn-onboarding-settings');
    if (onboardingBtn) {
      e.preventDefault();
      elements.btnSettingsToggle.click();
      return;
    }

    // Visibility toggle
    const toggleBtn = e.target.closest('.toggle-visibility-btn');
    if (toggleBtn) {
      e.preventDefault();
      const targetId = toggleBtn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (input) {
        if (input.type === 'password') {
          input.type = 'text';
          toggleBtn.textContent = "🙈";
        } else {
          input.type = 'password';
          toggleBtn.textContent = "👁️";
        }
      }
      return;
    }

    // Debater remove button
    const removeBtn = e.target.closest('.btn-remove-debater');
    if (removeBtn) {
      e.preventDefault();
      const id = removeBtn.getAttribute('data-id');
      removeDebater(id);
      return;
    }
  });

  // Escape key to close active modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      elements.modalSettings.classList.remove('active');
    }
  });
}

// Save Settings from unified modal
function saveSettings() {
  const selectModProvider = document.getElementById('select-mod-provider-modal');
  const selectModModel = document.getElementById('select-mod-model-modal');
  const inputModCustomModel = document.getElementById('input-mod-custom-model-modal');
  const modKeyInput = document.getElementById('select-mod-key-modal');
  const ollamaHostInput = document.getElementById('input-ollama-host-modal');
  
  if (selectModProvider) tempModalState.moderator.provider = selectModProvider.value;
  if (selectModModel) tempModalState.moderator.model = selectModModel.value;
  if (inputModCustomModel) tempModalState.moderator.customModel = inputModCustomModel.value.trim();
  if (modKeyInput) tempModalState.moderator.apiKey = modKeyInput.value.trim();
  if (ollamaHostInput) tempModalState.moderator.ollamaHost = ollamaHostInput.value.trim();

  // Team balance validation
  const proCount = tempModalState.debaters.filter(d => d.team === 'pro').length;
  const conCount = tempModalState.debaters.filter(d => d.team === 'con').length;
  if (proCount === 0 || conCount === 0) {
    alert("Error: Team balance mismatch. There must be at least one debater on both Team Pro (Affirmative) and Team Con (Negative).");
    return;
  }

  // Commit temp settings to official state
  debateState.debaters = JSON.parse(JSON.stringify(tempModalState.debaters));
  debateState.moderator = JSON.parse(JSON.stringify(tempModalState.moderator));
  
  if (debateState.moderator.ollamaHost) {
    debateState.ollamaHost = debateState.moderator.ollamaHost;
  }
  
  saveDebatersToStorage();
  saveModeratorToStorage();
  
  renderArenaStage();
  updateUIForState();
  
  elements.modalSettings.classList.remove('active');
}

// Render the stage pods dynamically V3 — Vertical Esports Portrait Cards
function renderArenaStage() {
  elements.debaterPods.innerHTML = "";
  
  // Set layout class count
  const count = debateState.debaters.length;
  elements.debaterPods.className = `debater-pods pods-${count}`;
  
  debateState.debaters.forEach(d => {
    const podDiv = document.createElement('div');
    podDiv.className = `pod pod-${d.team}`;
    podDiv.id = `pod-arena-${d.id}`;
    
    const displayModel = d.provider === 'ollama' && d.model === 'custom' 
      ? d.customModel 
      : d.model;
    
    const teamLabel = d.team === 'pro' ? 'Affirmative' : 'Negative';
      
    podDiv.innerHTML = `
      <div class="pod-live-indicator">
        <span class="live-dot"></span>
        <span class="live-label">LIVE</span>
      </div>
      <div class="pod-avatar-ring">
        <div class="pod-avatar">${escapeHtml(d.avatar)}</div>
      </div>
      <div class="pod-info">
        <div class="pod-name">${escapeHtml(d.name)}</div>
        <div class="pod-team-chip pod-chip-${d.team}">${teamLabel}</div>
        <div class="pod-model" title="${escapeHtml(displayModel)}">${escapeHtml(displayModel)}</div>
      </div>
      <div class="thinking-wave">
        <span></span><span></span><span></span><span></span>
      </div>
    `;
    elements.debaterPods.appendChild(podDiv);
  });
}

// Highlight speaking pod V2
function highlightSpeakerPod(debaterId) {
  // Clear all
  document.querySelectorAll('.debater-pods .pod').forEach(pod => pod.classList.remove('active'));
  
  if (debaterId) {
    const pod = document.getElementById(`pod-arena-${debaterId}`);
    if (pod) pod.classList.add('active');
  }
}

// Generate the turn steps sequence V2
function buildTurnSequence() {
  const rounds = parseInt(elements.inputRounds.value);
  const modEnabled = elements.checkModEnabled.checked;
  const discussionEnabled = elements.checkDiscussionEnabled ? elements.checkDiscussionEnabled.checked : false;
  const seq = [];
  
  if (modEnabled) {
    seq.push({ type: 'mod-intro' });
  }
  
  for (let r = 1; r <= rounds; r++) {
    // 1. Standard Round
    debateState.debaters.forEach(d => {
      seq.push({ type: 'debater', debaterId: d.id, round: r, isRebuttal: false });
    });
    
    // Moderator Transition between Standard Round and Rebuttal Round
    if (modEnabled) {
      seq.push({ type: 'mod-transition', round: r, phase: 'standard-to-rebuttal' });
    }
    
    // 2. Rebuttal Phase
    seq.push({ type: 'rebuttal-phase', round: r });
    
    // 3. Team Strategy Discussion Phase
    if (discussionEnabled && debateState.debaters.length > 2) {
      seq.push({ type: 'team-discussion-phase', round: r });
    }
    
    // Moderator Transition between Rebuttal Round and next Standard Round
    if (modEnabled && r < rounds) {
      seq.push({ type: 'mod-transition', round: r, phase: 'rebuttal-to-standard' });
    }
  }
  
  if (modEnabled) {
    seq.push({ type: 'mod-outro' });
  }
  
  seq.push({ type: 'judge-verdict' });
  return seq;
}

// Start debate V2
function startDebate() {
  if (debateState.active) return;
  
  // Team Balance Validation
  const proCount = debateState.debaters.filter(d => d.team === 'pro').length;
  const conCount = debateState.debaters.filter(d => d.team === 'con').length;
  if (proCount === 0 || conCount === 0) {
    alert("Error: Team balance mismatch. There must be at least one debater on both Team Pro (Affirmative) and Team Con (Negative) to start the debate.");
    return;
  }
  
  debateState.active = true;
  debateState.paused = false;
  debateState.currentRound = 1;
  debateState.currentStepIndex = 0;
  debateState.totalRounds = parseInt(elements.inputRounds.value);
  debateState.teamDiscussionEnabled = elements.checkDiscussionEnabled ? elements.checkDiscussionEnabled.checked : false;
  debateState.turnSequence = buildTurnSequence();
  debateState.history = [];
  
  elements.debateFeed.innerHTML = "";
  elements.feedEmptyGuide.style.display = "none";
  
  renderArenaStage();
  updateUIForState();
  
  stepTurn();
}

// Toggle pause V2
function togglePauseDebate() {
  if (!debateState.active) return;
  debateState.paused = !debateState.paused;
  updateUIForState();
  
  if (!debateState.paused && !debateState.isThinking) {
    stepTurn();
  }
}

// Reset Arena V2
function resetArena() {
  // Abort any ongoing network request
  if (debateState.abortController) {
    debateState.abortController.abort();
  }
  
  debateState.active = false;
  debateState.paused = false;
  debateState.currentRound = 1;
  debateState.currentStepIndex = 0;
  debateState.turnSequence = [];
  debateState.history = [];
  debateState.rebuttalState = null;
  debateState.discussionState = null;
  debateState.isThinking = false;
  debateState.activeSpeaker = null;
  
  elements.debateFeed.innerHTML = "";
  elements.feedEmptyGuide.style.display = "flex";
  
  renderArenaStage();
  updateUIForState();
}

// Advance Turn V2
async function stepTurn() {
  if (!debateState.active || debateState.isThinking) return;
  
  const step = debateState.turnSequence[debateState.currentStepIndex];
  if (!step) {
    finalizeDebateState();
    return;
  }

  // Handle rebuttal phase dynamically!
  if (step.type === 'rebuttal-phase') {
    debateState.isThinking = true;
    updateUIForState();
    await processRebuttalStep(step);
    return;
  }

  // Handle team strategy discussion phase dynamically!
  if (step.type === 'team-discussion-phase') {
    debateState.isThinking = true;
    updateUIForState();
    await processTeamDiscussionStep(step);
    return;
  }
  
  debateState.isThinking = true;
  updateUIForState();
  
  let role = '';
  let speakerName = '';
  let avatar = '';
  let team = 'none';
  let debaterObj = null;
  
  if (step.type === 'debater') {
    debaterObj = debateState.debaters.find(d => d.id === step.debaterId);
    if (!debaterObj) {
      // Safety skip
      debateState.currentStepIndex++;
      debateState.isThinking = false;
      stepTurn();
      return;
    }
    role = debaterObj.team; // 'pro' or 'con'
    speakerName = debaterObj.name;
    avatar = debaterObj.avatar;
    team = debaterObj.team;
    debateState.currentRound = step.round;
  } else if (step.type.startsWith('mod')) {
    role = 'mod';
    const modStyle = DEBATE_PRESETS.moderators.find(m => m.id === elements.selectModStyle.value);
    speakerName = modStyle ? modStyle.name : "Moderator";
    avatar = '⚖️';
  } else if (step.type === 'judge-verdict') {
    role = 'judge';
    speakerName = "Debate Judge";
    avatar = '🏆';
  }
  
  // Update speaker pod visualization glow
  if (step.type === 'debater') {
    highlightSpeakerPod(debaterObj.id);
  } else {
    highlightSpeakerPod(null);
  }
  
  // Append temporary typing indicator
  const typingBubble = appendTypingIndicator(role, speakerName, avatar, step);
  
  // Create AbortController for this turn request
  debateState.abortController = new AbortController();
  
  try {
    let responseText = "";
    
    if (step.type === 'judge-verdict') {
      responseText = await callJudgeAPI();
    } else {
      responseText = await callSpeakerAPI(debaterObj, step);
    }
    
    typingBubble.remove();
    
    // Add to history (stripping thought tags so opponent agents only see public statements)
    const historyText = responseText.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();
    debateState.history.push({
      role: role,
      name: speakerName,
      text: historyText,
      avatar: avatar,
      team: team
    });
    
    await appendMessageWithAnimation(role, speakerName, responseText, avatar, step);
    
    debateState.currentStepIndex++;
    debateState.isThinking = false;
    updateUIForState();
    
    // Run loop next step if not paused
    if (debateState.active && !debateState.paused) {
      setTimeout(() => {
        if (debateState.active && !debateState.paused) {
          stepTurn();
        }
      }, 1500);
    }
    
  } catch (error) {
    typingBubble.remove();
    debateState.isThinking = false;
    
    if (error.name === 'AbortError') {
      console.log("Transmission aborted by user.");
      return;
    }
    
    console.error("Transmission error:", error);
    debateState.paused = true;
    
    appendErrorCard(role, speakerName, error);
    updateUIForState();
  }
}

async function processRebuttalStep(step) {
  // Ensure rebuttalState is initialized
  if (!debateState.rebuttalState) {
    const proDebaters = debateState.debaters.filter(d => d.team === 'pro');
    const conDebaters = debateState.debaters.filter(d => d.team === 'con');
    const pairs = [];
    const numPairs = Math.max(proDebaters.length, conDebaters.length);
    for (let i = 0; i < numPairs; i++) {
      pairs.push({
        pro: proDebaters[i % proDebaters.length],
        con: conDebaters[i % conDebaters.length],
        proPassed: false,
        conPassed: false,
        phase: 'pro-ask' // pro-ask, con-answer, con-ask, pro-answer
      });
    }
    debateState.rebuttalState = {
      round: step.round,
      pairs: pairs,
      currentPairIndex: 0,
      currentQuestion: ""
    };
  }

  const rState = debateState.rebuttalState;
  
  // If we processed all pairs, finish the rebuttal phase
  if (rState.currentPairIndex >= rState.pairs.length) {
    debateState.rebuttalState = null; // clear
    debateState.currentStepIndex++;
    debateState.isThinking = false;
    updateUIForState();
    stepTurn();
    return;
  }

  const pair = rState.pairs[rState.currentPairIndex];
  
  // If both have passed, advance pair and try again
  if (pair.proPassed && pair.conPassed) {
    rState.currentPairIndex++;
    processRebuttalStep(step);
    return;
  }

  // If active speaker has already passed, skip their turn and update phase
  if (pair.phase === 'pro-ask' && pair.proPassed) {
    pair.phase = 'con-ask';
    processRebuttalStep(step);
    return;
  }
  if (pair.phase === 'con-ask' && pair.conPassed) {
    pair.phase = 'pro-ask';
    processRebuttalStep(step);
    return;
  }

  // Determine active speaker and role (ask or answer) based on pair phase
  let activeDebater = null;
  let oppDebater = null;
  let rebuttalPhase = ''; // 'ask' or 'answer'
  
  switch (pair.phase) {
    case 'pro-ask':
      activeDebater = pair.pro;
      oppDebater = pair.con;
      rebuttalPhase = 'ask';
      break;
    case 'con-answer':
      activeDebater = pair.con;
      oppDebater = pair.pro;
      rebuttalPhase = 'answer';
      break;
    case 'con-ask':
      activeDebater = pair.con;
      oppDebater = pair.pro;
      rebuttalPhase = 'ask';
      break;
    case 'pro-answer':
      activeDebater = pair.pro;
      oppDebater = pair.con;
      rebuttalPhase = 'answer';
      break;
  }

  const role = activeDebater.team;
  const speakerName = activeDebater.name;
  const avatar = activeDebater.avatar;
  const team = activeDebater.team;

  // Build the temporary rebuttal step to pass to speaker API and visual animators
  const rebuttalStep = {
    type: 'debater',
    debaterId: activeDebater.id,
    round: rState.round,
    isRebuttal: true,
    rebuttalPhase: rebuttalPhase,
    oppDebaterName: oppDebater.name,
    currentQuestion: rState.currentQuestion
  };

  highlightSpeakerPod(activeDebater.id);
  
  // Append temporary typing indicator
  const typingBubble = appendTypingIndicator(role, speakerName, avatar, rebuttalStep);
  
  debateState.abortController = new AbortController();
  
  try {
    let responseText = await callSpeakerAPI(activeDebater, rebuttalStep);
    typingBubble.remove();

    const historyText = responseText.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();
    
    // Check if the debater chose to pass (no questions)
    const isPass = rebuttalPhase === 'ask' && (
      historyText.toUpperCase().includes("NO_QUESTIONS") || 
      historyText.toUpperCase().includes("NO QUESTIONS") ||
      (historyText.length < 30 && (
        historyText.toLowerCase().includes("no further questions") ||
        historyText.toLowerCase().includes("no questions") ||
        historyText.toLowerCase().includes("i pass") ||
        historyText.toLowerCase() === "no"
      ))
    );

    let finalResponseText = responseText;
    if (isPass) {
      // Overwrite response with a clean "No further questions."
      const thoughtMatch = responseText.match(/<thought>([\s\S]*?)<\/thought>/i);
      const thoughtText = thoughtMatch ? thoughtMatch[0] : "";
      finalResponseText = thoughtText + "\n\nNo further questions.";
      
      if (activeDebater.team === 'pro') {
        pair.proPassed = true;
      } else {
        pair.conPassed = true;
      }
    } else if (rebuttalPhase === 'ask') {
      // Save the question for the answering opponent
      rState.currentQuestion = historyText;
    }

    const cleanHistoryText = finalResponseText.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();
    debateState.history.push({
      role: role,
      name: speakerName,
      text: cleanHistoryText,
      avatar: avatar,
      team: team
    });

    await appendMessageWithAnimation(role, speakerName, finalResponseText, avatar, rebuttalStep);
    
    // State transitions!
    advanceRebuttalState(pair, isPass);
    
    debateState.isThinking = false;
    updateUIForState();
    
    if (debateState.active && !debateState.paused) {
      setTimeout(() => {
        if (debateState.active && !debateState.paused) {
          stepTurn();
        }
      }, 1500);
    }

  } catch (error) {
    typingBubble.remove();
    debateState.isThinking = false;
    
    if (error.name === 'AbortError') {
      console.log("Transmission aborted by user.");
      return;
    }
    
    console.error("Transmission error in rebuttal:", error);
    debateState.paused = true;
    appendErrorCard(role, speakerName, error);
    updateUIForState();
  }
}

function advanceRebuttalState(pair, isPass) {
  const rState = debateState.rebuttalState;
  if (!rState) return;

  switch (pair.phase) {
    case 'pro-ask':
      if (isPass) {
        pair.phase = 'con-ask';
      } else {
        pair.phase = 'con-answer';
      }
      break;
      
    case 'con-answer':
      pair.phase = 'con-ask';
      break;
      
    case 'con-ask':
      if (isPass) {
        pair.phase = 'pro-ask';
      } else {
        pair.phase = 'pro-answer';
      }
      break;
      
    case 'pro-answer':
      pair.phase = 'pro-ask';
      break;
  }
}

async function processTeamDiscussionStep(step) {
  // Ensure discussionState is initialized
  if (!debateState.discussionState) {
    const proDebaters = debateState.debaters.filter(d => d.team === 'pro');
    const conDebaters = debateState.debaters.filter(d => d.team === 'con');
    const discussionQueue = [];
    
    // Cycle through Pro team members if > 1 member
    if (proDebaters.length > 1) {
      proDebaters.forEach(d => {
        discussionQueue.push({ debater: d, team: 'pro' });
      });
    }
    
    // Cycle through Con team members if > 1 member
    if (conDebaters.length > 1) {
      conDebaters.forEach(d => {
        discussionQueue.push({ debater: d, team: 'con' });
      });
    }
    
    debateState.discussionState = {
      round: step.round,
      queue: discussionQueue,
      currentIndex: 0
    };
  }

  const dState = debateState.discussionState;

  // If we processed all members in queue, finish discussion phase
  if (dState.currentIndex >= dState.queue.length) {
    debateState.discussionState = null; // clear
    debateState.currentStepIndex++;
    debateState.isThinking = false;
    updateUIForState();
    stepTurn();
    return;
  }

  const currentItem = dState.queue[dState.currentIndex];
  const activeDebater = currentItem.debater;
  const role = activeDebater.team;
  const speakerName = activeDebater.name;
  const avatar = activeDebater.avatar;
  const team = activeDebater.team;

  const discussionStep = {
    type: 'debater',
    debaterId: activeDebater.id,
    round: dState.round,
    isDiscussion: true
  };

  highlightSpeakerPod(activeDebater.id);

  // Append temporary typing indicator
  const typingBubble = appendTypingIndicator(role, speakerName, avatar, discussionStep);

  debateState.abortController = new AbortController();

  try {
    let responseText = await callSpeakerAPI(activeDebater, discussionStep);
    typingBubble.remove();

    const historyText = responseText.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();

    debateState.history.push({
      role: role,
      name: speakerName,
      text: historyText,
      avatar: avatar,
      team: team,
      isDiscussion: true
    });

    await appendMessageWithAnimation(role, speakerName, responseText, avatar, discussionStep);

    dState.currentIndex++;
    debateState.isThinking = false;
    updateUIForState();

    if (debateState.active && !debateState.paused) {
      setTimeout(() => {
        if (debateState.active && !debateState.paused) {
          stepTurn();
        }
      }, 1500);
    }

  } catch (error) {
    typingBubble.remove();
    debateState.isThinking = false;

    if (error.name === 'AbortError') {
      console.log("Transmission aborted by user.");
      return;
    }

    console.error("Transmission error in team discussion:", error);
    debateState.paused = true;
    appendErrorCard(role, speakerName, error);
    updateUIForState();
  }
}

// Unified call adapter for active AI speakers V2
async function callSpeakerAPI(debater, step) {
  let provider, model, systemInstructions, temp, apiKey;
  
  if (step.type === 'debater') {
    provider = debater.provider;
    model = debater.model === 'custom' ? debater.customModel : debater.model;
    systemInstructions = debater.instructions;
    temp = debater.temperature;
    apiKey = debater.apiKey || "";
  } else {
    // Moderator
    provider = debateState.moderator.provider;
    model = debateState.moderator.model === 'custom' ? debateState.moderator.customModel : debateState.moderator.model;
    systemInstructions = getModeratorInstructions();
    temp = 0.5;
    apiKey = debateState.moderator.apiKey || "";
  }
  
  const topicTitle = elements.inputTopicTitle.value;
  const topicDesc = elements.inputTopicDesc.value;
  const transcript = compileTranscript(debater);
  
  let systemPrompt = "";
  
  if (step.type === 'debater') {
    // 1. Core Persona Instructions
    const baseInstructions = debater.instructions || "You are a debater.";
    
    // 2. Personality Trait Weights
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
    
    // 3. Debate Mode rules
    let modeDirectives = "";
    if (debateState.debateMode === "twitter") {
      modeDirectives = `Debate Mode: Punchy / Social Media. Keep your responses short, sharp, punchy, and aggressive. Speak like you are debating in a fast-paced social media feed.`;
    } else if (debateState.debateMode === "podcast") {
      modeDirectives = `Debate Mode: Casual / Podcast. Keep your responses conversational, natural, and verbose. Reference other debaters by name. Use a conversational but argumentative tone.`;
    } else if (debateState.debateMode === "creative") {
      modeDirectives = `Debate Mode: Creative & Expressive. Deliver your argument in an expressive, highly theatrical, or stylistic manner. You are encouraged to use vivid metaphors, storytelling, rhyming hip-hop bars, or distinct roleplay (such as space-delegate, socratic inquiry, or passive-aggressive corporate speak) to make your points entertaining, clever, and persuasive.`;
    } else {
      modeDirectives = `Debate Mode: Standard / Formal. Deliver a structured, formal statement refuting the opposition.`;
    }
    
    // 4. Strategic Reasoning Stream Formatting
    const formattingDirectives = [
      `CRITICAL FORMAT REQUIREMENT: You MUST start your response with an internal reasoning monologue enclosed in <thought>...</thought> tags.`,
      `In this monologue, analyze the previous arguments and plan your verbal strategy.` + (hasActiveTraits ? ` Keep your strategy aligned with your personality traits.` : ``),
      `Following the closing </thought> tag, write your public response. Do NOT mention these tags in your public text.`
    ].join('\n');
    
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
    
    // Inject Teammate Defense Prompt if teammate(s) exist
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
    
    // Add specific instruction depending on phase
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
    // Moderator
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
    // Moderator instructions V2
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

  // Route API requests V2
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
    case 'qwen':
      return await makeQwenRequest(model, systemPrompt, contextPrompt, temp, apiKey);
    case 'deepseek':
      return await makeDeepSeekRequest(model, systemPrompt, contextPrompt, temp, apiKey);
    case 'ollama':
      return await makeOllamaRequest(model, systemPrompt, contextPrompt, temp);
    default:
      throw new Error(`Unsupported API provider: ${provider}`);
  }
}

// Judge API evaluator V2 (Team Affirmative vs Team Negative)
async function callJudgeAPI() {
  const provider = debateState.moderator.provider;
  const model = debateState.moderator.model === 'custom' ? debateState.moderator.customModel : debateState.moderator.model;
  const apiKey = debateState.moderator.apiKey || "";
  
  const topicTitle = elements.inputTopicTitle.value;
  const transcript = compileTranscript();
  
  // List team members specifically in prompt
  const pros = debateState.debaters.filter(d => d.team === 'pro').map(d => d.name).join(', ');
  const cons = debateState.debaters.filter(d => d.team === 'con').map(d => d.name).join(', ');
  
  const systemPrompt = `You are a professional, neutral, analytical debate judge. Act natural and normal. This is a computer simulation; do not refer to or address an audience, spectators, or a physical hall. Evaluate the team debate. Team Affirmative (Pro) consists of: [${pros}]. Team Negative (Con) consists of: [${cons}]. Deliver a winner and individual team grades (0-100) across 4 pillars.
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
  } else if (provider === 'qwen') {
    resultString = await makeQwenRequest(model, systemPrompt, contextPrompt, 0.2, apiKey);
  } else if (provider === 'deepseek') {
    resultString = await makeDeepSeekRequest(model, systemPrompt, contextPrompt, 0.2, apiKey);
  } else if (provider === 'ollama') {
    resultString = await makeOllamaRequest(model, systemPrompt, contextPrompt, 0.2);
  }
  
  try {
    const cleanJSON = cleanJSONResponse(resultString);
    const parsedData = JSON.parse(cleanJSON);
    
    renderScorecard(parsedData);
    return `Final Verdict Delivered: Winner is ${parsedData.winnerName}. Rationale: ${parsedData.summary}`;
    
  } catch (error) {
    console.error("Failed parsing Judge JSON scorecard:", error);
    throw new Error(`The Judge returned a non-parseable scorecard response. Ensure the judge model is capable of outputting clean JSON. Raw response:\n\n${resultString || error.message}`);
  }
}

// ----------------------------------------------------
// V2 API NETWORK FETCH CLIENTS
// ----------------------------------------------------

// Standard helper for all OpenAI compatible APIs (Grok, Groq, Qwen, DeepSeek, HuggingFace)
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
    throw new Error(errorData.error?.message || `API Error: Status ${response.status}`);
  }
  
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response returned from API endpoint");
  return text;
}

async function makeGeminiRequest(model, systemPrompt, userPrompt, temperature, apiKey) {
  if (!apiKey) throw new Error("Google Gemini API Key is missing. Click 'Settings' in the header to configure.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  
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
    throw new Error(errorData.error?.message || `Gemini API Error: Status ${response.status}`);
  }
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Empty response returned from Gemini API. The model may have blocked the response due to safety settings or returned an empty payload.");
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
    throw new Error(errorData.error?.message || `OpenRouter Error: Status ${response.status}`);
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
    throw new Error(errorData.error?.message || `Anthropic Error: Status ${response.status}`);
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

async function makeQwenRequest(model, systemPrompt, userPrompt, temperature, apiKey) {
  if (!apiKey) throw new Error("Qwen (DashScope) Key is missing. Click 'Settings' in the header to configure.");
  return await makeOpenAICompatibleRequest("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", model, apiKey, systemPrompt, userPrompt, temperature);
}

async function makeDeepSeekRequest(model, systemPrompt, userPrompt, temperature, apiKey) {
  if (!apiKey) throw new Error("DeepSeek API Key is missing. Click 'Settings' in the header to configure.");
  return await makeOpenAICompatibleRequest("https://api.deepseek.com/v1/chat/completions", model, apiKey, systemPrompt, userPrompt, temperature);
}

async function makeOllamaRequest(model, systemPrompt, userPrompt, temperature) {
  const host = debateState.ollamaHost || "http://localhost:11434";
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

// ----------------------------------------------------
// EXPORTING TRANSCRIPT V2
// ----------------------------------------------------

function exportDebateAsMarkdown() {
  if (debateState.history.length === 0) return;
  
  const topicTitle = elements.inputTopicTitle.value;
  const topicDesc = elements.inputTopicDesc.value;
  const rounds = elements.inputRounds.value;
  
  let md = `# AI Debate Transcript V2: ${topicTitle}\n\n`;
  md += `**Premise:** ${topicDesc}\n`;
  md += `**Debate Parameters:** ${rounds} rounds per model, ${debateState.debaters.length} debater agents\n`;
  md += `**Generated on:** ${new Date().toLocaleString()}\n\n`;
  md += `--- \n\n`;
  
  // List debaters
  md += `## Debating Agents\n`;
  debateState.debaters.forEach((d, i) => {
    md += `- **Debater #${i+1}**: ${d.name} (${d.team.toUpperCase()}) | Model: ${d.provider}/${d.model}\n`;
  });
  md += `\n--- \n\n`;
  
  debateState.history.forEach(m => {
    let prefix = `### ${m.name} (${m.role.toUpperCase()})\n`;
    if (m.isDiscussion) {
      prefix = `### ${m.name} (PRIVATE TEAM ${m.team.toUpperCase()} DISCUSSION)\n`;
    } else if (m.role === 'judge') {
      prefix = `## 🏆 ${m.name}\n`;
    }
    md += `${prefix}${m.text}\n\n`;
  });
  
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `debate-v2-${topicTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Helper functions V2
function compileTranscript(activeDebater = null, isExport = false) {
  let text = "";
  debateState.history.forEach(m => {
    if (m.isDiscussion) {
      if (isExport) {
        text += `[${m.name}] (PRIVATE TEAM ${m.team.toUpperCase()} DISCUSSION): ${m.text}\n\n`;
      } else if (activeDebater && activeDebater.team === m.team) {
        text += `[${m.name}] (Team Strategy Session): ${m.text}\n\n`;
      }
    } else {
      const teamLabel = m.team !== 'none' ? ` [Team: ${m.team.toUpperCase()}]` : "";
      text += `[${m.name}${teamLabel}]: ${m.text}\n\n`;
    }
  });
  return text.trim();
}

function getModeratorInstructions() {
  const modStyleId = elements.selectModStyle.value;
  const style = DEBATE_PRESETS.moderators.find(m => m.id === modStyleId);
  return style ? style.systemInstructions : "You are the debate moderator.";
}

function finalizeDebateState() {
  debateState.active = false;
  debateState.paused = false;
  debateState.activeSpeaker = null;
  highlightSpeakerPod(null);
  updateUIForState();
}

function cleanJSONResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
  }
  return cleaned;
}

// ----------------------------------------------------
// RENDER MARKDOWN IN JS
// ----------------------------------------------------
function parseMarkdown(text) {
  if (!text) return "";
  
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');
  
  const paragraphs = html.split(/\n\n+/);
  return paragraphs.map(p => {
    const trimmed = p.trim();
    if (!trimmed) return "";
    
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items = trimmed.split(/\n[-*]\s+/).map(item => `<li>${item.replace(/^[-*]\s+/, "")}</li>`).join('');
      return `<ul>${items}</ul>`;
    }
    
    if (/^\d+\.\s+/.test(trimmed)) {
      const items = trimmed.split(/\n\d+\.\s+/).map(item => `<li>${item.replace(/^\d+\.\s+/, "")}</li>`).join('');
      return `<ol>${items}</ol>`;
    }
    
    if (trimmed.startsWith('&gt;')) {
      return `<blockquote>${trimmed.substring(4).trim()}</blockquote>`;
    }
    
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

// ----------------------------------------------------
// TRANSCRIPT RENDER HELPERS V2
// ----------------------------------------------------

function scrollToBottom() {
  elements.debateFeed.scrollTop = elements.debateFeed.scrollHeight;
}

function appendTypingIndicator(role, name, avatar, step) {
  const typeDiv = document.createElement('div');
  let typeClass = `message message-${role}`;
  if (step && step.isDiscussion) {
    typeClass += ` message-discussion`;
  }
  typeDiv.className = typeClass;
  
  let phaseLabel = "thinking...";
  let metaBadge = "";
  
  if (step) {
    if (step.type === 'debater') {
      let labelDetail = '(Main)';
      if (step.isRebuttal) {
        labelDetail = step.rebuttalPhase === 'ask' ? '(Rebuttal - Asking)' : '(Rebuttal - Answering)';
      } else if (step.isDiscussion) {
        labelDetail = '(Team Discussion)';
        metaBadge = `<span class="discussion-badge">🔒 Private Team Strategy</span>`;
      }
      phaseLabel = `Round ${step.round} ${labelDetail} - thinking...`;
    } else if (step.type.startsWith('mod')) {
      phaseLabel = `Moderator - thinking...`;
    } else if (step.type === 'judge-verdict') {
      phaseLabel = `Judge - thinking...`;
    }
  }
  typeDiv.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-bubble-wrapper">
      <div class="message-meta">
        <span class="message-speaker">${name}</span>
        ${metaBadge}
        <span class="message-time">${phaseLabel}</span>
      </div>
      <div class="message-bubble">
        <div class="typing-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
  `;
  elements.debateFeed.appendChild(typeDiv);
  scrollToBottom();
  return typeDiv;
}

function appendMessageWithAnimation(role, name, text, avatar, step) {
  return new Promise((resolve) => {
    const isMod = role === 'mod';
    const msgDiv = document.createElement('div');
    let msgClass = `message message-${role}`;
    if (step && step.isDiscussion) {
      msgClass += ` message-discussion`;
    }
    msgDiv.className = msgClass;
    
    // Parse Strategic Reasoning Stream if present (enclosed in <thought>...</thought> tags)
    const thoughtMatch = text.match(/<thought>([\s\S]*?)<\/thought>/i);
    let thoughtHtml = "";
    let cleanText = text;
    
    if (thoughtMatch) {
      const thoughtContentText = thoughtMatch[1].trim();
      cleanText = text.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();
      thoughtHtml = `
        <details class="thought-details">
          <summary>🧠 View Strategic Reasoning Stream</summary>
          <div class="thought-content">${parseMarkdown(thoughtContentText)}</div>
        </details>
      `;
    }
    
    let phaseLabel = "";
    let metaBadge = "";
    if (step) {
      if (step.type === 'debater') {
        let labelDetail = '(Main)';
        if (step.isRebuttal) {
          labelDetail = step.rebuttalPhase === 'ask' ? '(Rebuttal - Asking)' : '(Rebuttal - Answering)';
        } else if (step.isDiscussion) {
          labelDetail = '(Team Discussion)';
          metaBadge = `<span class="discussion-badge">🔒 Private Team Strategy</span>`;
        }
        phaseLabel = `Round ${step.round} ${labelDetail}`;
      } else if (step.type.startsWith('mod')) {
        phaseLabel = "Moderator";
      } else if (step.type === 'judge-verdict') {
        phaseLabel = "Judge Verdict";
      }
    } else {
      phaseLabel = `Turn ${debateState.currentRound}`;
    }

    msgDiv.innerHTML = `
      ${!isMod ? `<div class="message-avatar">${avatar}</div>` : ''}
      <div class="message-bubble-wrapper" style="${isMod ? 'width: 100%;' : ''}">
        <div class="message-meta">
          <span class="message-speaker">${name}</span>
          ${metaBadge}
          <span class="message-time">${phaseLabel}</span>
        </div>
        <div class="message-bubble">
          ${thoughtHtml}
          <div class="message-content"></div>
        </div>
      </div>
    `;
    
    elements.debateFeed.appendChild(msgDiv);
    const contentEl = msgDiv.querySelector('.message-content');
    
    const words = cleanText.split(' ');
    let currentWordIdx = 0;
    let typedText = "";
    
    const interval = setInterval(() => {
      if (currentWordIdx < words.length) {
        typedText += (currentWordIdx > 0 ? " " : "") + words[currentWordIdx];
        contentEl.innerHTML = parseMarkdown(typedText);
        currentWordIdx++;
        scrollToBottom();
      } else {
        clearInterval(interval);
        resolve();
      }
    }, 25);
  });
}

function appendErrorCard(role, name, error) {
  const errDiv = document.createElement('div');
  errDiv.className = 'message message-mod';
  
  let instructions = "Verify your API Key is correctly input in the configurations panel and try again.";
  if (error.message && error.message.includes('CORS')) {
    instructions = "Connection failed due to browser CORS policies. If you are using Ollama, make sure you ran: <code>OLLAMA_ORIGINS=\"*\" ollama serve</code>. If using OpenAI/Anthropic direct, try OpenRouter as it is browser-friendly.";
  }
  
  errDiv.innerHTML = `
    <div class="message-bubble" style="border-color: #ef4444; background: rgba(239, 68, 68, 0.05);">
      <div class="message-meta" style="color: #ef4444; justify-content: center;">
        <strong>⚠️ ERROR IN TRANSMISSION (${name})</strong>
      </div>
      <div class="message-content" style="text-align: left; font-size: 0.85rem;">
        <p><strong>Details:</strong> ${error.message || error || "Unknown Connection Failure"}</p>
        <p style="margin-top: 0.5rem; border-top: 1px solid rgba(239, 68, 68, 0.2); padding-top: 0.5rem; color: var(--text-muted);">
          ${instructions}
        </p>
      </div>
    </div>
  `;
  elements.debateFeed.appendChild(errDiv);
  scrollToBottom();
}

function renderScorecard(data) {
  const proName = "Team Affirmative";
  const conName = "Team Negative";
  
  const scoreCardDiv = document.createElement('div');
  scoreCardDiv.className = 'verdict-card';
  
  let winnerClass = 'winner-draw';
  let winnerText = 'It\'s a Draw!';
  
  if (data.winner === 'pro') {
    winnerClass = 'winner-pro';
    winnerText = proName;
  } else if (data.winner === 'con') {
    winnerClass = 'winner-con';
    winnerText = conName;
  }
  
  scoreCardDiv.innerHTML = `
    <div class="verdict-title">
      <span>🏆</span> Final Verdict Scorecard <span>🏆</span>
    </div>
    <div class="verdict-winner">
      <div class="verdict-winner-label">Debate Winner</div>
      <div class="verdict-winner-name ${winnerClass}">${winnerText}</div>
    </div>
    <div class="scorecard-metrics">
      <div class="metric-row">
        <div class="metric-label">
          <span style="color: var(--color-pro);">${data.scores.pro.logical}</span>
          <span>Logical Consistency</span>
          <span style="color: var(--color-con);">${data.scores.con.logical}</span>
        </div>
        <div class="metric-bar-container">
          <div class="metric-bar-pro" style="width: ${data.scores.pro.logical}%"></div>
          <div class="metric-bar-con" style="width: ${data.scores.con.logical}%"></div>
        </div>
      </div>
      <div class="metric-row">
        <div class="metric-label">
          <span style="color: var(--color-pro);">${data.scores.pro.rhetorical}</span>
          <span>Rhetorical Strength</span>
          <span style="color: var(--color-con);">${data.scores.con.rhetorical}</span>
        </div>
        <div class="metric-bar-container">
          <div class="metric-bar-pro" style="width: ${data.scores.pro.rhetorical}%"></div>
          <div class="metric-bar-con" style="width: ${data.scores.con.rhetorical}%"></div>
        </div>
      </div>
      <div class="metric-row">
        <div class="metric-label">
          <span style="color: var(--color-pro);">${data.scores.pro.rebuttal}</span>
          <span>Rebuttal Effectiveness</span>
          <span style="color: var(--color-con);">${data.scores.con.rebuttal}</span>
        </div>
        <div class="metric-bar-container">
          <div class="metric-bar-pro" style="width: ${data.scores.pro.rebuttal}%"></div>
          <div class="metric-bar-con" style="width: ${data.scores.con.rebuttal}%"></div>
        </div>
      </div>
      <div class="metric-row">
        <div class="metric-label">
          <span style="color: var(--color-pro);">${data.scores.pro.reasoning}</span>
          <span>Fact-Based Reasoning</span>
          <span style="color: var(--color-con);">${data.scores.con.reasoning}</span>
        </div>
        <div class="metric-bar-container">
          <div class="metric-bar-pro" style="width: ${data.scores.pro.reasoning}%"></div>
          <div class="metric-bar-con" style="width: ${data.scores.con.reasoning}%"></div>
        </div>
      </div>
    </div>
    <div class="verdict-summary">
      <h4>Judge's Decision Rationale</h4>
      <p>${parseMarkdown(data.summary)}</p>
    </div>
  `;
  
  elements.debateFeed.appendChild(scoreCardDiv);
  scrollToBottom();
}

function updateUIForState() {
  const isRunning = debateState.active && !debateState.paused;
  const isPaused = debateState.active && debateState.paused;
  
  if (debateState.active) {
    elements.btnStart.textContent = "Debate Active";
    elements.btnStart.disabled = true;
  } else {
    elements.btnStart.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      Start Debate
    `;
    elements.btnStart.disabled = false;
  }
  
  elements.btnPause.disabled = !debateState.active;
  if (isPaused) {
    elements.btnPause.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      Resume
    `;
  } else {
    elements.btnPause.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
      Pause
    `;
  }
  
  elements.btnStep.disabled = !isPaused || debateState.isThinking;
  elements.btnReset.disabled = false;
  elements.btnExportMd.disabled = debateState.history.length === 0;
  

  
  const disableForm = debateState.active;
  elements.selectPreset.disabled = disableForm;
  elements.inputTopicTitle.disabled = disableForm;
  elements.inputTopicDesc.disabled = disableForm;
  if (elements.btnModalAddDebater) {
    elements.btnModalAddDebater.disabled = disableForm || debateState.debaters.length >= 6;
  }
  
  document.querySelectorAll('.input-debater-name').forEach(el => el.disabled = disableForm);
  document.querySelectorAll('.select-debater-team').forEach(el => el.disabled = disableForm);
  document.querySelectorAll('.select-debater-provider').forEach(el => el.disabled = disableForm);
  document.querySelectorAll('.select-debater-model').forEach(el => el.disabled = disableForm);
  document.querySelectorAll('.input-debater-custom-model').forEach(el => el.disabled = disableForm);
  document.querySelectorAll('.select-debater-persona').forEach(el => el.disabled = disableForm);
  document.querySelectorAll('.textarea-debater-instructions').forEach(el => el.disabled = disableForm);
  document.querySelectorAll('.slider-debater-temp').forEach(el => el.disabled = disableForm);
  document.querySelectorAll('.btn-remove-debater').forEach(el => el.disabled = disableForm);
  
  elements.checkModEnabled.disabled = disableForm;
  elements.selectModStyle.disabled = disableForm;
  elements.inputRounds.disabled = disableForm;
  elements.btnSettingsToggle.disabled = disableForm;
  
  if (elements.checkDiscussionEnabled) {
    elements.checkDiscussionEnabled.disabled = disableForm;
  }
  const showTeamDiscussion = debateState.debaters.length > 2;
  if (elements.grpTeamDiscussion) {
    elements.grpTeamDiscussion.style.display = showTeamDiscussion ? 'block' : 'none';
  }

  // --- UI/UX Refinements V3 ---
  
  // 1. Reactive Onboarding Checklist Status
  const hasTopic = (elements.inputTopicTitle.value.trim().length > 0) && (elements.inputTopicDesc.value.trim().length > 0);
  const stepTopic = document.getElementById('step-topic');
  if (stepTopic) {
    if (hasTopic) {
      stepTopic.classList.add('completed');
      stepTopic.querySelector('.step-status').textContent = '✅';
    } else {
      stepTopic.classList.remove('completed');
      stepTopic.querySelector('.step-status').textContent = '⏳';
    }
  }

  const hasKeys = debateState.debaters.every(d => {
    if (d.provider === 'ollama') return true;
    return d.apiKey && d.apiKey.length > 0;
  }) && (!debateState.moderator.enabled || debateState.moderator.provider === 'ollama' || (debateState.moderator.apiKey && debateState.moderator.apiKey.length > 0));
  
  const stepConfigure = document.getElementById('step-configure');
  if (stepConfigure) {
    if (hasKeys) {
      stepConfigure.classList.add('completed');
      stepConfigure.querySelector('.step-status').textContent = '✅';
    } else {
      stepConfigure.classList.remove('completed');
      stepConfigure.querySelector('.step-status').textContent = '⏳';
    }
  }

  const stepLaunch = document.getElementById('step-launch');
  if (stepLaunch) {
    if (hasTopic && hasKeys) {
      stepLaunch.classList.add('completed');
      stepLaunch.querySelector('.step-status').textContent = '✅';
    } else {
      stepLaunch.classList.remove('completed');
      stepLaunch.querySelector('.step-status').textContent = '⏳';
    }
  }

  // 2. Toggle active debate state dashboard layout
  document.body.classList.toggle('debate-active', debateState.active);

  const displayTopicContent = document.getElementById('display-topic-content');
  if (displayTopicContent) {
    const title = elements.inputTopicTitle.value.trim() || "Untitled Topic";
    const desc = elements.inputTopicDesc.value.trim() || "No premise provided.";
    displayTopicContent.innerHTML = `
      <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-main); margin-bottom: 0.4rem; border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding-bottom: 0.35rem;">${escapeHtml(title)}</div>
      <div style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; white-space: pre-wrap;">${escapeHtml(desc)}</div>
    `;
  }

  const displayRulesSummary = document.getElementById('display-rules-summary');
  if (displayRulesSummary) {
    const rounds = elements.inputRounds.value;
    const modEnabled = elements.checkModEnabled.checked;
    const modStyle = elements.selectModStyle.options[elements.selectModStyle.selectedIndex]?.text || "Standard";
    const discEnabled = elements.checkDiscussionEnabled && elements.checkDiscussionEnabled.checked;
    
    let summaryHtml = `<div style="display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.85rem; color: var(--text-muted);">`;
    summaryHtml += `<div>Rounds Per Debater: <strong style="color: var(--text-main); font-family: var(--font-mono);">${rounds}</strong></div>`;
    summaryHtml += `<div>AI Moderator / Judge: <strong style="color: var(--text-main);">${modEnabled ? `Enabled (${modStyle})` : 'Disabled'}</strong></div>`;
    summaryHtml += `<div>Team Discussion: <strong style="color: var(--text-main);">${discEnabled ? 'Enabled' : 'Disabled'}</strong></div>`;
    summaryHtml += `</div>`;
    displayRulesSummary.innerHTML = summaryHtml;
  }
}

