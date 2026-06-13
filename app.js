// AI Debate Simulator - V2 Modular Entrypoint

import {
  debateState,
  elements,
  loadModeratorFromStorage,
  loadJudgeFromStorage,
  loadDebateModeFromStorage,
  loadTeamDiscussionFromStorage,
  loadRoastModeFromStorage,
  loadRebuttalSettingsFromStorage,
  saveDebateModeToStorage,
  saveRoastModeToStorage,
  saveModeratorToStorage,
  saveJudgeToStorage,
  saveTeamDiscussionToStorage,
  saveRebuttalSettingsToStorage
} from './state.js?v=8.0';

import {
  setupInitialDebaters,
  initializePresets,
  loadTopicPreset,
  addDebater,
  removeDebater,
  tempModalState,
  renderSettingsModal,
  saveSettings,
  updateUIForState
} from './ui.js?v=8.0';

import {
  startDebate,
  togglePauseDebate,
  stepTurn,
  resetArena,
  exportDebateAsMarkdown
} from './simulator.js?v=8.0';

// Initialize Application Entrypoint
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

function initApp() {
  // Populate DOM elements lookup dynamically when DOM is guaranteed ready
  elements.selectPreset = document.getElementById('select-preset');
  elements.selectDebateMode = document.getElementById('select-debate-mode');
  elements.inputTopicTitle = document.getElementById('input-topic-title');
  elements.inputTopicDesc = document.getElementById('input-topic-desc');
  elements.btnModalAddDebater = document.getElementById('btn-modal-add-debater');
  
  elements.checkModEnabled = document.getElementById('check-mod-enabled');
  elements.checkJudgeEnabled = document.getElementById('check-judge-enabled');
  elements.checkRoastEnabled = document.getElementById('check-roast-enabled');
  elements.checkRebuttalEnabled = document.getElementById('check-rebuttal-enabled');
  elements.selectRebuttalLimit = document.getElementById('select-rebuttal-limit');
  elements.grpRebuttalLimit = document.getElementById('grp-rebuttal-limit');
  elements.checkDiscussionEnabled = document.getElementById('check-discussion-enabled');
  elements.grpTeamDiscussion = document.getElementById('grp-team-discussion');
  
  elements.inputRounds = document.getElementById('input-rounds');
  elements.valRounds = document.getElementById('val-rounds');
  
  elements.btnStart = document.getElementById('btn-start');
  elements.btnPause = document.getElementById('btn-pause');
  elements.btnStep = document.getElementById('btn-step');
  elements.btnReset = document.getElementById('btn-reset');
  elements.btnExportMd = document.getElementById('btn-export-md');
  elements.btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  elements.btnExpandSidebar = document.getElementById('btn-expand-sidebar');
  
  elements.debaterPods = document.getElementById('debater-pods');
  elements.debateFeed = document.getElementById('debate-feed');
  elements.feedEmptyGuide = document.getElementById('feed-empty-guide');
  
  elements.btnSettingsToggle = document.getElementById('btn-settings-toggle');
  elements.modalSettings = document.getElementById('modal-debaters');
  elements.btnCloseSettings = document.getElementById('btn-close-debaters');
  elements.btnSaveSettings = document.getElementById('btn-save-debaters');
  elements.btnHeaderCloseSettings = document.getElementById('btn-header-close-debaters');
  elements.modalSettingsBody = document.getElementById('modal-debaters-settings');

  setupInitialDebaters();
  initializePresets();
  loadModeratorFromStorage();
  loadJudgeFromStorage();
  loadDebateModeFromStorage();
  loadRoastModeFromStorage();
  loadTeamDiscussionFromStorage();
  loadRebuttalSettingsFromStorage();
  setupEventListeners();
  updateUIForState();
}

function setupEventListeners() {
  elements.selectPreset.addEventListener('change', (e) => loadTopicPreset(e.target.value));
  elements.inputTopicTitle.addEventListener('input', updateUIForState);
  elements.inputTopicDesc.addEventListener('input', updateUIForState);
  
  if (elements.btnModalAddDebater) {
    elements.btnModalAddDebater.addEventListener('click', addDebater);
  }
  
  if (elements.selectDebateMode) {
    elements.selectDebateMode.addEventListener('change', () => {
      const mode = elements.selectDebateMode.value;
      debateState.debateMode = mode;
      saveDebateModeToStorage();
      
      let autoRounds = 2;
      if (mode === "short" || mode === "twitter") autoRounds = 1;
      else if (mode === "medium" || mode === "humorous") autoRounds = 2;
      else if (mode === "long" || mode === "podcast") autoRounds = 3;
      else if (mode === "advanced") autoRounds = 4;
      else if (mode === "socratic") autoRounds = 5;
      
      if (elements.inputRounds) {
        elements.inputRounds.value = autoRounds;
        elements.valRounds.textContent = autoRounds;
      }
      updateUIForState();
    });
  }

  if (elements.inputRounds) {
    const updateRoundsText = () => {
      if (elements.valRounds) {
        elements.valRounds.textContent = elements.inputRounds.value;
      }
      updateUIForState();
    };
    elements.inputRounds.addEventListener('input', updateRoundsText);
    elements.inputRounds.addEventListener('change', updateRoundsText);
  }
  
  elements.checkModEnabled.addEventListener('change', (e) => {
    debateState.moderator.enabled = e.target.checked;
    saveModeratorToStorage();
    updateUIForState();
  });

  if (elements.checkJudgeEnabled) {
    elements.checkJudgeEnabled.addEventListener('change', (e) => {
      debateState.judge.enabled = e.target.checked;
      saveJudgeToStorage();
      updateUIForState();
    });
  }

  if (elements.checkRoastEnabled) {
    elements.checkRoastEnabled.addEventListener('change', (e) => {
      debateState.roastEnabled = e.target.checked;
      saveRoastModeToStorage();
      updateUIForState();
    });
  }

  if (elements.checkRebuttalEnabled) {
    elements.checkRebuttalEnabled.addEventListener('change', (e) => {
      debateState.rebuttalEnabled = e.target.checked;
      saveRebuttalSettingsToStorage();
      updateUIForState();
    });
  }

  if (elements.selectRebuttalLimit) {
    elements.selectRebuttalLimit.addEventListener('change', (e) => {
      debateState.rebuttalLimit = parseInt(e.target.value);
      saveRebuttalSettingsToStorage();
      updateUIForState();
    });
  }

  const toggleSidebar = () => {
    const container = document.querySelector('.app-container');
    if (container) {
      container.classList.toggle('sidebar-collapsed');
    }
  };

  if (elements.btnToggleSidebar) {
    elements.btnToggleSidebar.addEventListener('click', toggleSidebar);
  }

  if (elements.btnExpandSidebar) {
    elements.btnExpandSidebar.addEventListener('click', toggleSidebar);
  }

  if (elements.checkDiscussionEnabled) {
    elements.checkDiscussionEnabled.addEventListener('change', () => {
      saveTeamDiscussionToStorage();
    });
  }

  elements.btnStart.addEventListener('click', startDebate);
  elements.btnPause.addEventListener('click', togglePauseDebate);
  elements.btnStep.addEventListener('click', stepTurn);
  elements.btnReset.addEventListener('click', resetArena);
  elements.btnExportMd.addEventListener('click', exportDebateAsMarkdown);

  elements.btnSettingsToggle.addEventListener('click', () => {
    tempModalState.debaters = JSON.parse(JSON.stringify(debateState.debaters));
    tempModalState.moderator = JSON.parse(JSON.stringify(debateState.moderator));
    tempModalState.judge = JSON.parse(JSON.stringify(debateState.judge));
    renderSettingsModal();
    elements.modalSettings.classList.add('active');
  });

  elements.btnCloseSettings.addEventListener('click', () => {
    elements.modalSettings.classList.remove('active');
  });
  elements.btnHeaderCloseSettings.addEventListener('click', () => {
    elements.modalSettings.classList.remove('active');
  });

  elements.modalSettings.addEventListener('click', (e) => {
    if (e.target === elements.modalSettings) {
      elements.modalSettings.classList.remove('active');
    }
  });

  elements.btnSaveSettings.addEventListener('click', saveSettings);
  
  document.addEventListener('click', (e) => {
    const onboardingBtn = e.target.closest('#btn-onboarding-settings');
    if (onboardingBtn) {
      e.preventDefault();
      elements.btnSettingsToggle.click();
      return;
    }

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

    const removeBtn = e.target.closest('.btn-remove-debater');
    if (removeBtn) {
      e.preventDefault();
      const id = removeBtn.getAttribute('data-id');
      removeDebater(id);
      return;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      elements.modalSettings.classList.remove('active');
    }
  });
}
