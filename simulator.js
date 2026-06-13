// Debate Simulation State Machine & Loop Control Module

import {
  debateState,
  elements
} from './state.js?v=7.0';

import {
  highlightSpeakerPod,
  appendTypingIndicator,
  appendMessageWithAnimation,
  appendErrorCard,
  updateUIForState,
  renderArenaStage
} from './ui.js?v=7.0';

import {
  callSpeakerAPI,
  callJudgeAPI,
  setCompileTranscriptFn
} from './api.js?v=7.0';

// Setup compileTranscript in api.js at initialization
setCompileTranscriptFn(compileTranscript);

export function compileTranscript(activeDebater = null, isExport = false) {
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

export function buildTurnSequence() {
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
    if (modEnabled && debateState.rebuttalEnabled) {
      seq.push({ type: 'mod-transition', round: r, phase: 'standard-to-rebuttal' });
    }
    
    // 2. Rebuttal Phase
    if (debateState.rebuttalEnabled) {
      seq.push({ type: 'rebuttal-phase', round: r });
    }
    
    // 3. Team Strategy Discussion Phase
    if (discussionEnabled && debateState.debaters.length > 2) {
      seq.push({ type: 'team-discussion-phase', round: r });
    }
    
    // Moderator Transition between Rebuttal Round and next Standard Round
    if (modEnabled && debateState.rebuttalEnabled && r < rounds) {
      seq.push({ type: 'mod-transition', round: r, phase: 'rebuttal-to-standard' });
    }
  }
  
  if (modEnabled) {
    seq.push({ type: 'mod-outro' });
  }
  
  const judgeEnabled = elements.checkJudgeEnabled ? elements.checkJudgeEnabled.checked : true;
  if (judgeEnabled) {
    seq.push({ type: 'judge-verdict' });
  }
  return seq;
}

export function startDebate() {
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

export function togglePauseDebate() {
  if (!debateState.active) return;
  debateState.paused = !debateState.paused;
  updateUIForState();
  
  if (!debateState.paused && !debateState.isThinking) {
    stepTurn();
  }
}

export function resetArena() {
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

export async function stepTurn() {
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
      debateState.currentStepIndex++;
      debateState.isThinking = false;
      stepTurn();
      return;
    }
    role = debaterObj.team;
    speakerName = debaterObj.name;
    avatar = debaterObj.avatar;
    team = debaterObj.team;
    debateState.currentRound = step.round;
  } else if (step.type.startsWith('mod')) {
    role = 'mod';
    speakerName = "Moderator";
    avatar = '⚖️';
  } else if (step.type === 'judge-verdict') {
    role = 'judge';
    speakerName = "Debate Judge";
    avatar = '🏆';
  }
  
  if (step.type === 'debater') {
    highlightSpeakerPod(debaterObj.id);
  } else {
    highlightSpeakerPod(null);
  }
  
  const typingBubble = appendTypingIndicator(role, speakerName, avatar, step);
  debateState.abortController = new AbortController();
  
  try {
    let responseText = "";
    
    if (step.type === 'judge-verdict') {
      responseText = await callJudgeAPI();
    } else {
      responseText = await callSpeakerAPI(debaterObj, step);
    }
    
    typingBubble.remove();
    
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

export async function processRebuttalStep(step) {
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
        proQuestionsAsked: 0,
        conQuestionsAsked: 0,
        phase: 'pro-ask'
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
  
  if (rState.currentPairIndex >= rState.pairs.length) {
    debateState.rebuttalState = null;
    debateState.currentStepIndex++;
    debateState.isThinking = false;
    updateUIForState();
    stepTurn();
    return;
  }

  const pair = rState.pairs[rState.currentPairIndex];
  
  // Enforce question limits! If a team has reached the limit, force them to pass.
  if (pair.proQuestionsAsked >= debateState.rebuttalLimit) {
    pair.proPassed = true;
  }
  if (pair.conQuestionsAsked >= debateState.rebuttalLimit) {
    pair.conPassed = true;
  }

  if (pair.proPassed && pair.conPassed) {
    rState.currentPairIndex++;
    processRebuttalStep(step);
    return;
  }

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

  let activeDebater = null;
  let oppDebater = null;
  let rebuttalPhase = '';
  
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
  
  const typingBubble = appendTypingIndicator(role, speakerName, avatar, rebuttalStep);
  debateState.abortController = new AbortController();
  
  try {
    let responseText = await callSpeakerAPI(activeDebater, rebuttalStep);
    typingBubble.remove();

    const historyText = responseText.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();
    
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
      const thoughtMatch = responseText.match(/<thought>([\s\S]*?)<\/thought>/i);
      const thoughtText = thoughtMatch ? thoughtMatch[0] : "";
      finalResponseText = thoughtText + "\n\nNo further questions.";
      
      if (activeDebater.team === 'pro') {
        pair.proPassed = true;
      } else {
        pair.conPassed = true;
      }
    } else if (rebuttalPhase === 'ask') {
      rState.currentQuestion = historyText;
      if (activeDebater.team === 'pro') {
        pair.proQuestionsAsked++;
      } else {
        pair.conQuestionsAsked++;
      }
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

export function advanceRebuttalState(pair, isPass) {
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

export async function processTeamDiscussionStep(step) {
  if (!debateState.discussionState) {
    const proDebaters = debateState.debaters.filter(d => d.team === 'pro');
    const conDebaters = debateState.debaters.filter(d => d.team === 'con');
    const discussionQueue = [];
    
    if (proDebaters.length > 1) {
      proDebaters.forEach(d => {
        discussionQueue.push({ debater: d, team: 'pro' });
      });
    }
    
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

  if (dState.currentIndex >= dState.queue.length) {
    debateState.discussionState = null;
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

export function exportDebateAsMarkdown() {
  if (debateState.history.length === 0) return;
  
  const topicTitle = elements.inputTopicTitle.value;
  const topicDesc = elements.inputTopicDesc.value;
  const rounds = elements.inputRounds.value;
  
  let md = `# AI Debate Transcript V2: ${topicTitle}\n\n`;
  md += `**Premise:** ${topicDesc}\n`;
  md += `**Debate Parameters:** ${rounds} rounds per model, ${debateState.debaters.length} debater agents\n`;
  md += `**Generated on:** ${new Date().toLocaleString()}\n\n`;
  md += `--- \n\n`;
  
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

export function finalizeDebateState() {
  debateState.active = false;
  debateState.paused = false;
  debateState.activeSpeaker = null;
  highlightSpeakerPod(null);
  updateUIForState();
}
