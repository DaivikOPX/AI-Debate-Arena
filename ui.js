// UI / DOM Syncing & Modal Management Module

import {
  debateState,
  elements,
  saveDebatersToStorage,
  saveModeratorToStorage,
  saveJudgeToStorage
} from './state.js?v=7.0';

export let tempModalState = {
  debaters: [],
  moderator: {},
  judge: {}
};

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

// Helper to escape HTML to prevent XSS and DOM breaking
export function escapeHtml(text) {
  if (text === undefined || text === null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Simple Markdown parser
export function parseMarkdown(text) {
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
  const rawHtml = paragraphs.map(p => {
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

  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(rawHtml);
  }
  return rawHtml;
}

export function scrollToBottom() {
  const arenaView = document.querySelector('.arena-view');
  if (arenaView) {
    arenaView.scrollTop = arenaView.scrollHeight;
  }
}

export function appendTypingIndicator(role, name, avatar, step) {
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
    <div class="message-avatar">${escapeHtml(avatar)}</div>
    <div class="message-bubble-wrapper">
      <div class="message-meta">
        <span class="message-speaker">${escapeHtml(name)}</span>
        ${metaBadge}
        <span class="message-time">${escapeHtml(phaseLabel)}</span>
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

export function appendMessageWithAnimation(role, name, text, avatar, step) {
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
      ${!isMod ? `<div class="message-avatar">${escapeHtml(avatar)}</div>` : ''}
      <div class="message-bubble-wrapper" style="${isMod ? 'width: 100%;' : ''}">
        <div class="message-meta">
          <span class="message-speaker">${escapeHtml(name)}</span>
          ${metaBadge}
          <span class="message-time">${escapeHtml(phaseLabel)}</span>
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

export function appendErrorCard(role, name, error) {
  const errDiv = document.createElement('div');
  errDiv.className = 'message message-mod';
  
  let instructions = "Verify your API Key is correctly input in the configurations panel and try again.";
  if (error.message && (error.message.toLowerCase().includes('fetch') || error.message.toLowerCase().includes('failed'))) {
    instructions = "Connection failed. If you are using Ollama, make sure Ollama is running locally. Otherwise, verify your internet connection and API keys.";
  }
  
  errDiv.innerHTML = `
    <div class="message-bubble" style="border-color: #ef4444; background: rgba(239, 68, 68, 0.05);">
      <div class="message-meta" style="color: #ef4444; justify-content: center;">
        <strong>⚠️ ERROR IN TRANSMISSION (${escapeHtml(name)})</strong>
      </div>
      <div class="message-content" style="text-align: left; font-size: 0.85rem;">
        <p><strong>Details:</strong> ${escapeHtml(error.message || error || "Unknown Connection Failure")}</p>
        <p style="margin-top: 0.5rem; border-top: 1px solid rgba(239, 68, 68, 0.2); padding-top: 0.5rem; color: var(--text-muted);">
          ${instructions}
        </p>
      </div>
    </div>
  `;
  elements.debateFeed.appendChild(errDiv);
  scrollToBottom();
}

export function renderScorecard(data) {
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

  const pL = parseInt(data.scores?.pro?.logical) || 0;
  const cL = parseInt(data.scores?.con?.logical) || 0;
  const pR = parseInt(data.scores?.pro?.rhetorical) || 0;
  const cR = parseInt(data.scores?.con?.rhetorical) || 0;
  const pRb = parseInt(data.scores?.pro?.rebuttal) || 0;
  const cRb = parseInt(data.scores?.con?.rebuttal) || 0;
  const pRs = parseInt(data.scores?.pro?.reasoning) || 0;
  const cRs = parseInt(data.scores?.con?.reasoning) || 0;
  
  scoreCardDiv.innerHTML = `
    <div class="verdict-title">
      <span>🏆</span> Final Verdict Scorecard <span>🏆</span>
    </div>
    <div class="verdict-winner">
      <div class="verdict-winner-label">Debate Winner</div>
      <div class="verdict-winner-name ${escapeHtml(winnerClass)}">${escapeHtml(winnerText)}</div>
    </div>
    <div class="scorecard-metrics">
      <div class="metric-row">
        <div class="metric-label">
          <span style="color: var(--color-pro);">${pL}</span>
          <span>Logical Consistency</span>
          <span style="color: var(--color-con);">${cL}</span>
        </div>
        <div class="metric-bar-container">
          <div class="metric-bar-pro" style="width: ${pL}%"></div>
          <div class="metric-bar-con" style="width: ${cL}%"></div>
        </div>
      </div>
      <div class="metric-row">
        <div class="metric-label">
          <span style="color: var(--color-pro);">${pR}</span>
          <span>Rhetorical Strength</span>
          <span style="color: var(--color-con);">${cR}</span>
        </div>
        <div class="metric-bar-container">
          <div class="metric-bar-pro" style="width: ${pR}%"></div>
          <div class="metric-bar-con" style="width: ${cR}%"></div>
        </div>
      </div>
      <div class="metric-row">
        <div class="metric-label">
          <span style="color: var(--color-pro);">${pRb}</span>
          <span>Rebuttal Effectiveness</span>
          <span style="color: var(--color-con);">${cRb}</span>
        </div>
        <div class="metric-bar-container">
          <div class="metric-bar-pro" style="width: ${pRb}%"></div>
          <div class="metric-bar-con" style="width: ${cRb}%"></div>
        </div>
      </div>
      <div class="metric-row">
        <div class="metric-label">
          <span style="color: var(--color-pro);">${pRs}</span>
          <span>Fact-Based Reasoning</span>
          <span style="color: var(--color-con);">${cRs}</span>
        </div>
        <div class="metric-bar-container">
          <div class="metric-bar-pro" style="width: ${pRs}%"></div>
          <div class="metric-bar-con" style="width: ${cRs}%"></div>
        </div>
      </div>
    </div>
    <div class="verdict-summary">
      <h4>Judge's Decision Rationale</h4>
      <div class="verdict-summary-content">
        ${parseMarkdown(data.summary)}
      </div>
    </div>
  `;
  
  elements.debateFeed.appendChild(scoreCardDiv);
  scrollToBottom();
}

export function populateModelsDropdown(providerSelect, modelSelect) {
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

export function setupInitialDebaters() {
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

export function renderArenaStage() {
  if (!elements.debaterPods) return;
  elements.debaterPods.innerHTML = "";
  
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

export function highlightSpeakerPod(debaterId) {
  document.querySelectorAll('.debater-pods .pod').forEach(pod => pod.classList.remove('active'));
  
  if (debaterId) {
    const pod = document.getElementById(`pod-arena-${debaterId}`);
    if (pod) pod.classList.add('active');
  }
}

export function renderSettingsModal() {
  if (!elements.modalSettingsBody) return;
  elements.modalSettingsBody.innerHTML = "";
  
  if (elements.btnModalAddDebater) {
    elements.btnModalAddDebater.disabled = tempModalState.debaters.length >= 6;
  }
  
  const providers = [
    { id: 'gemini', name: 'Google Gemini' },
    { id: 'openrouter', name: 'OpenRouter (Recommended)' },
    { id: 'openai', name: 'OpenAI' },
    { id: 'anthropic', name: 'Anthropic' },
    { id: 'huggingface', name: 'Hugging Face' },
    { id: 'grok', name: 'Grok (xAI)' },
    { id: 'groq', name: 'Groq' },
    { id: 'ollama', name: 'Ollama (Local)' }
  ];

  // Moderator (Host) Card
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
        <span style="font-size: 1.25rem;">🎤</span>
        <span style="font-weight: 700; font-size: 0.95rem; color: var(--color-mod);">AI Moderator (Host) Settings</span>
      </div>
    </div>
    
    <div class="modal-debater-card-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
      <!-- Left Column: Core Identity & Model Configuration -->
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <div class="form-group">
          <label>API Provider</label>
          <select id="select-mod-provider-modal">
            ${modProviderOptions}
          </select>
        </div>

        <div class="form-group">
          <label>Model</label>
          <select id="select-mod-model-modal">
            ${modModelOptions}
          </select>
        </div>
      </div>

      <!-- Right Column: API Credentials & Custom Instructions -->
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <div class="form-group">
          <label>API Key</label>
          <div class="api-input-wrap">
            <input type="password" id="select-mod-key-modal" value="${escapeHtml(tempModalState.moderator.apiKey || '')}" placeholder="Enter API Key...">
            <button type="button" class="toggle-visibility-btn" data-target="select-mod-key-modal" aria-label="Toggle password visibility">👁️</button>
          </div>
        </div>

        <div class="form-group grp-custom-model" id="grp-mod-custom-model-modal" style="display: ${tempModalState.moderator.model === 'custom' ? 'block' : 'none'};">
          <label>Custom Model ID</label>
          <input type="text" id="input-mod-custom-model-modal" value="${escapeHtml(tempModalState.moderator.customModel || '')}" placeholder="e.g., llama3:70b">
        </div>

        <div class="form-group" id="grp-ollama-host-modal" style="display: ${tempModalState.moderator.provider === 'ollama' ? 'block' : 'none'};">
          <label>Ollama Host URL</label>
          <input type="text" id="input-ollama-host-modal" value="${escapeHtml(tempModalState.moderator.ollamaHost || debateState.ollamaHost || '')}" placeholder="e.g., http://localhost:11434">
        </div>

        <div class="form-group" style="display: flex; flex-direction: column; flex: 1; margin: 0;">
          <label>Custom Instructions (Moderator)</label>
          <textarea id="textarea-mod-instructions-modal" style="flex: 1; min-height: 80px; resize: vertical;" placeholder="Enter custom instructions to define the moderator persona...">${escapeHtml(tempModalState.moderator.instructions || '')}</textarea>
        </div>
      </div>
    </div>
  `;
  elements.modalSettingsBody.appendChild(modCard);

  // Judge Card
  const judgeCard = document.createElement('div');
  judgeCard.className = 'modal-debater-card team-mod';
  judgeCard.style.borderLeft = '3px solid var(--color-mod)';
  
  let judgeProviderOptions = "";
  providers.forEach(p => {
    judgeProviderOptions += `<option value="${p.id}" ${tempModalState.judge.provider === p.id ? 'selected' : ''}>${p.name}</option>`;
  });

  const judgeModels = [...(DEBATE_PRESETS.models[tempModalState.judge.provider] || [])];
  if (judgeModels.length > 0 && !judgeModels.some(m => m.id === 'custom')) {
    judgeModels.push({ id: "custom", name: "[Custom Model Identifier...]" });
  }
  let judgeModelOptions = "";
  judgeModels.forEach(m => {
    judgeModelOptions += `<option value="${m.id}" ${tempModalState.judge.model === m.id ? 'selected' : ''}>${m.name}</option>`;
  });

  judgeCard.innerHTML = `
    <div class="modal-debater-card-header">
      <div class="modal-debater-card-title">
        <span style="font-size: 1.25rem;">⚖️</span>
        <span style="font-weight: 700; font-size: 0.95rem; color: var(--color-mod);">AI Judge Settings</span>
      </div>
    </div>
    
    <div class="modal-debater-card-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
      <!-- Left Column: Core Identity & Model Configuration -->
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <div class="form-group">
          <label>API Provider</label>
          <select id="select-judge-provider-modal">
            ${judgeProviderOptions}
          </select>
        </div>

        <div class="form-group">
          <label>Model</label>
          <select id="select-judge-model-modal">
            ${judgeModelOptions}
          </select>
        </div>
      </div>

      <!-- Right Column: API Credentials & Custom Instructions -->
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <div class="form-group">
          <label>API Key</label>
          <div class="api-input-wrap">
            <input type="password" id="select-judge-key-modal" value="${escapeHtml(tempModalState.judge.apiKey || '')}" placeholder="Enter API Key...">
            <button type="button" class="toggle-visibility-btn" data-target="select-judge-key-modal" aria-label="Toggle password visibility">👁️</button>
          </div>
        </div>

        <div class="form-group grp-custom-model" id="grp-judge-custom-model-modal" style="display: ${tempModalState.judge.model === 'custom' ? 'block' : 'none'};">
          <label>Custom Model ID</label>
          <input type="text" id="input-judge-custom-model-modal" value="${escapeHtml(tempModalState.judge.customModel || '')}" placeholder="e.g., llama3:70b">
        </div>

        <div class="form-group" id="grp-judge-ollama-host-modal" style="display: ${tempModalState.judge.provider === 'ollama' ? 'block' : 'none'};">
          <label>Ollama Host URL</label>
          <input type="text" id="input-judge-ollama-host-modal" value="${escapeHtml(tempModalState.judge.ollamaHost || debateState.ollamaHost || '')}" placeholder="e.g., http://localhost:11434">
        </div>

        <div class="form-group" style="display: flex; flex-direction: column; flex: 1; margin: 0;">
          <label>Custom Instructions (Judge / Verdict Criteria)</label>
          <textarea id="textarea-judge-instructions-modal" style="flex: 1; min-height: 80px; resize: vertical;" placeholder="Enter custom instructions to define the judge evaluation criteria...">${escapeHtml(tempModalState.judge.instructions || '')}</textarea>
        </div>
      </div>
    </div>
  `;
  elements.modalSettingsBody.appendChild(judgeCard);

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
      
      <div class="modal-debater-card-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
        <!-- Left Column: Identity, Team & Model Configuration -->
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <div class="form-group">
            <label>Name</label>
            <input type="text" class="input-debater-name" data-id="${debater.id}" value="${escapeHtml(debater.name)}" placeholder="Enter Name...">
          </div>

          <div class="form-group">
            <label>Team Allocation</label>
            <select class="select-debater-team" data-id="${debater.id}" style="font-weight: 700; color: ${debater.team === 'pro' ? 'var(--color-pro)' : 'var(--color-con)'}">
              <option value="pro" ${debater.team === 'pro' ? 'selected' : ''}>Affirmative (Team Pro)</option>
              <option value="con" ${debater.team === 'con' ? 'selected' : ''}>Negative (Team Con)</option>
            </select>
          </div>

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

        <!-- Right Column: API Key & System Persona Details -->
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <div class="form-group">
            <label>API Key</label>
            <div class="api-input-wrap">
              <input type="password" id="key-${debater.id}" class="input-debater-key" data-id="${debater.id}" value="${escapeHtml(debater.apiKey || '')}" placeholder="Enter API Key...">
              <button type="button" class="toggle-visibility-btn" data-target="key-${debater.id}" aria-label="Toggle password visibility">👁️</button>
            </div>
          </div>

          <div class="form-group grp-custom-model" id="grp-custom-model-${debater.id}" style="display: ${debater.model === 'custom' ? 'block' : 'none'};">
            <label>Custom Model ID</label>
            <input type="text" class="input-debater-custom-model" data-id="${debater.id}" value="${escapeHtml(debater.customModel || '')}" placeholder="e.g., llama3:8b">
          </div>

          <div class="form-group" style="display: flex; flex-direction: column; flex: 1; margin: 0;">
            <label>System Instructions (Persona)</label>
            <textarea class="textarea-debater-instructions" data-id="${debater.id}" style="flex: 1; min-height: 100px; resize: vertical;" placeholder="Enter custom instructions to define this debater's persona...">${escapeHtml(debater.instructions || '')}</textarea>
          </div>
        </div>
      </div>
    `;
    elements.modalSettingsBody.appendChild(card);
  });

  bindModalDebaterEvents();
}

export function bindModalDebaterEvents() {
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

  const judgeProv = document.getElementById('select-judge-provider-modal');
  if (judgeProv) {
    judgeProv.addEventListener('change', (e) => {
      const val = e.target.value;
      tempModalState.judge.provider = val;
      
      const judgeModelSelect = document.getElementById('select-judge-model-modal');
      if (judgeModelSelect) {
        judgeModelSelect.innerHTML = "";
        const models = [...(DEBATE_PRESETS.models[val] || [])];
        if (models.length > 0 && !models.some(m => m.id === 'custom')) {
          models.push({ id: "custom", name: "[Custom Model Identifier...]" });
        }
        models.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.id;
          opt.textContent = m.name;
          judgeModelSelect.appendChild(opt);
        });
        tempModalState.judge.model = judgeModelSelect.value;
      }
      
      const customRow = document.getElementById('grp-judge-custom-model-modal');
      if (customRow) customRow.style.display = tempModalState.judge.model === 'custom' ? 'block' : 'none';
      
      const ollamaRow = document.getElementById('grp-judge-ollama-host-modal');
      if (ollamaRow) ollamaRow.style.display = val === 'ollama' ? 'block' : 'none';
    });
  }

  const judgeMod = document.getElementById('select-judge-model-modal');
  if (judgeMod) {
    judgeMod.addEventListener('change', (e) => {
      const val = e.target.value;
      tempModalState.judge.model = val;
      const customRow = document.getElementById('grp-judge-custom-model-modal');
      if (customRow) customRow.style.display = val === 'custom' ? 'block' : 'none';
    });
  }

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

  document.querySelectorAll('#modal-settings-body .textarea-debater-instructions').forEach(el => {
    el.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      updateTempDebaterProperty(id, 'instructions', e.target.value);
    });
  });

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

  document.querySelectorAll('#modal-settings-body .input-debater-key').forEach(el => {
    el.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      updateTempDebaterProperty(id, 'apiKey', e.target.value.trim());
    });
  });
}

export function updateTempDebaterProperty(id, property, value) {
  const debater = tempModalState.debaters.find(d => d.id === id);
  if (debater) {
    debater[property] = value;
  }
}

export function updateDebaterProperty(id, property, value) {
  const debater = debateState.debaters.find(d => d.id === id);
  if (debater) {
    debater[property] = value;
    saveDebatersToStorage();
  }
}

export function toggleCustomModelRow(id) {
  const debater = tempModalState.debaters.find(d => d.id === id) || debateState.debaters.find(d => d.id === id);
  const row = document.getElementById(`grp-custom-model-${id}`);
  if (row) {
    if (debater && debater.model === 'custom') {
      row.style.display = 'block';
    } else {
      row.style.display = 'none';
    }
  }
}

export function addDebater() {
  if (tempModalState.debaters.length >= 6) return;
  
  const count = tempModalState.debaters.length + 1;
  const avatarIndex = (count - 1) % DEBATE_PRESETS.emojis.length;
  const avatar = DEBATE_PRESETS.emojis[avatarIndex];
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

export function removeDebater(id) {
  if (tempModalState.debaters.length <= 2) return;
  tempModalState.debaters = tempModalState.debaters.filter(d => d.id !== id);
  renderSettingsModal();
}

export function initializePresets() {
  if (!elements.selectPreset) return;
  elements.selectPreset.innerHTML = '<option value="custom">-- Custom Topic --</option>';
  if (typeof DEBATE_PRESETS !== 'undefined' && DEBATE_PRESETS.topics) {
    DEBATE_PRESETS.topics.forEach(topic => {
      const opt = document.createElement('option');
      opt.value = topic.id;
      opt.textContent = topic.title;
      elements.selectPreset.appendChild(opt);
    });
  }
  elements.selectPreset.value = "custom";
}

export function loadTopicPreset(topicId) {
  if (topicId === "custom") return;
  const topic = DEBATE_PRESETS.topics.find(t => t.id === topicId);
  if (topic) {
    elements.inputTopicTitle.value = topic.title;
    elements.inputTopicDesc.value = topic.description;
  }
}

export function updateUIForState() {
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
  document.querySelectorAll('.textarea-debater-instructions').forEach(el => el.disabled = disableForm);
  document.querySelectorAll('.btn-remove-debater').forEach(el => el.disabled = disableForm);
  
  elements.checkModEnabled.disabled = disableForm;
  if (elements.checkJudgeEnabled) {
    elements.checkJudgeEnabled.disabled = disableForm;
  }
  if (elements.checkRoastEnabled) {
    elements.checkRoastEnabled.disabled = disableForm;
  }
  if (elements.selectDebateMode) {
    elements.selectDebateMode.disabled = disableForm;
  }
  elements.inputRounds.disabled = disableForm;
  elements.btnSettingsToggle.disabled = disableForm;
  
  if (elements.checkDiscussionEnabled) {
    elements.checkDiscussionEnabled.disabled = disableForm;
  }
  const showTeamDiscussion = debateState.debaters.length > 2;
  if (elements.grpTeamDiscussion) {
    elements.grpTeamDiscussion.style.display = showTeamDiscussion ? 'block' : 'none';
  }

  if (elements.checkRebuttalEnabled) {
    elements.checkRebuttalEnabled.disabled = disableForm;
  }
  if (elements.selectRebuttalLimit) {
    elements.selectRebuttalLimit.disabled = disableForm;
  }
  if (elements.grpRebuttalLimit) {
    elements.grpRebuttalLimit.style.display = debateState.rebuttalEnabled ? 'block' : 'none';
  }

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
  }) && (!debateState.moderator.enabled || debateState.moderator.provider === 'ollama' || (debateState.moderator.apiKey && debateState.moderator.apiKey.length > 0))
     && (!debateState.judge.enabled || debateState.judge.provider === 'ollama' || (debateState.judge.apiKey && debateState.judge.apiKey.length > 0));
  
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
    const judgeEnabled = elements.checkJudgeEnabled ? elements.checkJudgeEnabled.checked : false;
    const debateModeText = elements.selectDebateMode ? elements.selectDebateMode.options[elements.selectDebateMode.selectedIndex]?.text : "Standard";
    const discEnabled = elements.checkDiscussionEnabled && elements.checkDiscussionEnabled.checked;
    const roastEnabled = elements.checkRoastEnabled && elements.checkRoastEnabled.checked;
    
    const rebuttalEnabled = debateState.rebuttalEnabled;
    const rebuttalLimitText = debateState.rebuttalLimit;
    
    let summaryHtml = `<div style="display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.85rem; color: var(--text-muted);">`;
    summaryHtml += `<div>Debate Mode: <strong style="color: var(--text-main);">${debateModeText}</strong></div>`;
    summaryHtml += `<div>Rounds Per Debater: <strong style="color: var(--text-main); font-family: var(--font-mono);">${rounds}</strong></div>`;
    summaryHtml += `<div>AI Moderator (Host): <strong style="color: var(--text-main);">${modEnabled ? 'Enabled' : 'Disabled'}</strong></div>`;
    summaryHtml += `<div>AI Judge: <strong style="color: var(--text-main);">${judgeEnabled ? 'Enabled' : 'Disabled'}</strong></div>`;
    summaryHtml += `<div>Roasting Mode: <strong style="color: var(--text-main);">${roastEnabled ? '🔥 Enabled' : 'Disabled'}</strong></div>`;
    summaryHtml += `<div>Rebuttal Phase: <strong style="color: var(--text-main);">${rebuttalEnabled ? 'Enabled (Max ' + rebuttalLimitText + ' Qs)' : 'Disabled'}</strong></div>`;
    summaryHtml += `<div>Team Discussion: <strong style="color: var(--text-main);">${discEnabled ? 'Enabled' : 'Disabled'}</strong></div>`;
    summaryHtml += `</div>`;
    displayRulesSummary.innerHTML = summaryHtml;
  }
}

export function saveSettings() {
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
  
  const modInstructionsInput = document.getElementById('textarea-mod-instructions-modal');
  if (modInstructionsInput) tempModalState.moderator.instructions = modInstructionsInput.value.trim();

  const selectJudgeProvider = document.getElementById('select-judge-provider-modal');
  const selectJudgeModel = document.getElementById('select-judge-model-modal');
  const inputJudgeCustomModel = document.getElementById('input-judge-custom-model-modal');
  const judgeKeyInput = document.getElementById('select-judge-key-modal');
  const judgeOllamaHostInput = document.getElementById('input-judge-ollama-host-modal');
  
  if (selectJudgeProvider) tempModalState.judge.provider = selectJudgeProvider.value;
  if (selectJudgeModel) tempModalState.judge.model = selectJudgeModel.value;
  if (inputJudgeCustomModel) tempModalState.judge.customModel = inputJudgeCustomModel.value.trim();
  if (judgeKeyInput) tempModalState.judge.apiKey = judgeKeyInput.value.trim();
  if (judgeOllamaHostInput) tempModalState.judge.ollamaHost = judgeOllamaHostInput.value.trim();
  
  const judgeInstructionsInput = document.getElementById('textarea-judge-instructions-modal');
  if (judgeInstructionsInput) tempModalState.judge.instructions = judgeInstructionsInput.value.trim();

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
  debateState.judge = JSON.parse(JSON.stringify(tempModalState.judge));
  
  if (debateState.moderator.ollamaHost) {
    debateState.ollamaHost = debateState.moderator.ollamaHost;
  }
  
  saveDebatersToStorage();
  saveModeratorToStorage();
  saveJudgeToStorage();
  
  renderArenaStage();
  updateUIForState();
  
  elements.modalSettings.classList.remove('active');
}
