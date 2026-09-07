(function () {
  const languageCode = Utils.qs('lang') || LANGUAGES[0].code;
  const lang = getLanguageConfig(languageCode);
  const testId = Utils.qs('test');
  const test = ProgressEngine.getTestById(languageCode, testId);

  if (!test || !ProgressEngine.isTestUnlocked(languageCode, test)) {
    window.location.href = 'index.html';
    return;
  }

  const KIND_LABELS = {
    speaking: 'Speaking',
    recall: 'Recall',
    multipleChoice: 'Multiple Choice',
    reverseTranslation: 'Reverse Translation',
    listening: 'Listening'
  };

  const MAX_SPEECH_ATTEMPTS = 2;

  const els = {
    titleLabel: document.getElementById('test-title-label'),
    flow: document.getElementById('test-flow'),
    progressFill: document.getElementById('test-progress-fill'),
    progressCount: document.getElementById('test-progress-count'),
    kindLabel: document.getElementById('question-kind-label'),
    promptText: document.getElementById('question-prompt-text'),
    speechArea: document.getElementById('q-speech-area'),
    micButton: document.getElementById('q-mic-button'),
    speechStatus: document.getElementById('q-speech-status'),
    optionsArea: document.getElementById('q-options-area'),
    listeningArea: document.getElementById('q-listening-area'),
    listenAudioBtn: document.getElementById('q-listen-audio-btn'),
    listeningOptionsArea: document.getElementById('q-listening-options-area'),
    results: document.getElementById('test-results'),
    bigScore: document.getElementById('result-big-score'),
    resultSub: document.getElementById('result-sub'),
    categories: document.getElementById('result-categories'),
    mistakeSection: document.getElementById('mistake-section'),
    mistakeCount: document.getElementById('mistake-count'),
    mistakeList: document.getElementById('mistake-list'),
    reviewBtn: document.getElementById('review-mistakes-btn'),
    panelUnsupported: document.getElementById('panel-unsupported'),
    retrainFlow: document.getElementById('retrain-flow'),
    reviewScreen: document.getElementById('review-screen'),
    reviewTitle: document.getElementById('review-title'),
    reviewSubtitle: document.getElementById('review-subtitle'),
    reviewList: document.getElementById('review-list'),
    startTestBtn: document.getElementById('start-test-btn')
  };

  els.titleLabel.textContent = test.type === 'cumulative'
    ? `Cumulative Test`
    : `Test ${test.index}`;

  // If this browser can't do speech recognition, reroute speaking/recall
  // questions into text-based ones for this test only — the rest of the
  // test still runs normally (see spec: unsupported browsers degrade
  // gracefully rather than breaking the whole experience).
  const speechIsSupported = SpeechEngine.supported();
  if (!speechIsSupported) APP_CONFIG.enableSpeaking = false;

  const questions = TestEngine.generate(test, languageCode);
  const answeredLog = [];
  let qIndex = 0;
  let speechAttempts = 0;
  let speechSessionStarted = false;
  let resolvedCurrent = false;

  function currentQuestion() { return questions[qIndex]; }

  function updateProgress() {
    els.progressFill.style.width = `${Utils.formatPercent(qIndex, questions.length)}%`;
    els.progressCount.textContent = `${qIndex} / ${questions.length}`;
  }

  function hideAllAreas() {
    els.speechArea.hidden = true;
    els.optionsArea.hidden = true;
    els.listeningArea.hidden = true;
  }

  function recordAnswer(question, wasCorrect) {
    answeredLog.push({ sentenceId: question.sentenceId, category: question.category, wasCorrect });
    ProgressStorage.recordAttempt(question.sentenceId, wasCorrect);
  }

  function goNext() {
    qIndex += 1;
    if (qIndex >= questions.length) { finishTest(); return; }
    renderQuestion();
  }

  function renderQuestion() {
    resolvedCurrent = false;
    speechAttempts = 0;
    const q = currentQuestion();
    updateProgress();
    hideAllAreas();
    els.kindLabel.textContent = KIND_LABELS[q.type] || q.type;

    if (q.type === 'speaking' || q.type === 'recall') {
      els.promptText.textContent = q.prompt;
      els.speechArea.hidden = false;
      els.speechStatus.textContent = speechSessionStarted ? 'Listening…' : 'Tap the mic to answer';
      setMicClass(speechSessionStarted ? 'is-listening' : '');
      return;
    }

    if (q.type === 'multipleChoice' || q.type === 'reverseTranslation') {
      els.promptText.textContent = q.prompt;
      els.optionsArea.hidden = false;
      renderOptions(els.optionsArea, q.options, (chosen, btn, allBtns) => {
        const correct = TestEngine.grade(q, chosen);
        markOptionResult(btn, allBtns, correct, q.correct);
        recordAnswer(q, correct);
        setTimeout(goNext, 900);
      });
      return;
    }

    if (q.type === 'listening') {
      els.promptText.textContent = 'Listen, then choose the translation';
      els.listeningArea.hidden = false;
      els.listeningOptionsArea.innerHTML = '';
      renderOptions(els.listeningOptionsArea, q.options, (chosen, btn, allBtns) => {
        const correct = TestEngine.grade(q, chosen);
        markOptionResult(btn, allBtns, correct, q.correct);
        recordAnswer(q, correct);
        setTimeout(goNext, 900);
      });
      playListeningAudio(q);
    }
  }

  function renderOptions(container, options, onChoose) {
    container.innerHTML = '';
    const buttons = options.map(opt => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.type = 'button';
      btn.textContent = opt;
      container.appendChild(btn);
      return btn;
    });
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (resolvedCurrent) return;
        resolvedCurrent = true;
        buttons.forEach(b => b.disabled = true);
        onChoose(btn.textContent, btn, buttons);
      });
    });
  }

  function markOptionResult(chosenBtn, allBtns, wasCorrect, correctText) {
    allBtns.forEach(b => {
      if (b.textContent === correctText) b.classList.add('is-correct');
    });
    if (!wasCorrect) chosenBtn.classList.add('is-incorrect');
  }

  function playListeningAudio(q) {
    SpeechEngine.speak(q.audioText, lang.speechRecognitionLocale);
  }
  els.listenAudioBtn.addEventListener('click', () => {
    const q = currentQuestion();
    if (q && q.type === 'listening') playListeningAudio(q);
  });

  function setMicClass(extra) {
    els.micButton.className = 'mic-button' + (extra ? ' ' + extra : '');
  }

  function handleSpeechResult(transcripts) {
    const q = currentQuestion();
    if (!q || (q.type !== 'speaking' && q.type !== 'recall') || resolvedCurrent) return;

    setMicClass('is-processing');
    els.speechStatus.textContent = 'Checking…';

    const matched = transcripts.some(t => Utils.matchesAnswer(t, q.answers));
    speechAttempts += 1;

    if (matched) {
      resolvedCurrent = true;
      setMicClass('is-correct');
      els.speechStatus.textContent = 'Correct ✓';
      els.speechStatus.className = 'card-status is-correct';
      recordAnswer(q, true);
      setTimeout(goNext, APP_CONFIG.correctRevealDelayMs);
    } else if (speechAttempts >= MAX_SPEECH_ATTEMPTS) {
      resolvedCurrent = true;
      setMicClass('is-incorrect');
      els.speechStatus.textContent = `Answer: ${q.target}`;
      els.speechStatus.className = 'card-status is-incorrect';
      recordAnswer(q, false);
      setTimeout(goNext, APP_CONFIG.correctRevealDelayMs);
    } else {
      setMicClass('is-incorrect');
      els.speechStatus.textContent = 'Try again';
      els.speechStatus.className = 'card-status is-incorrect';
      setTimeout(() => {
        if (!resolvedCurrent) {
          setMicClass('is-listening');
          els.speechStatus.textContent = 'Listening…';
          els.speechStatus.className = 'card-status';
        }
      }, APP_CONFIG.incorrectRetryDelayMs);
    }
  }

  function handleSpeechError(err) {
    if (err === 'unsupported') {
      els.flow.hidden = true;
      els.panelUnsupported.hidden = false;
    }
    // permission-denied and transient errors: leave status text as-is; user can retap mic.
  }

  els.micButton.addEventListener('click', () => {
    if (speechSessionStarted) return;
    const ok = SpeechEngine.start(lang.speechRecognitionLocale, handleSpeechResult, handleSpeechError);
    if (ok) {
      speechSessionStarted = true;
      setMicClass('is-listening');
      els.speechStatus.textContent = 'Listening…';
      els.speechStatus.className = 'card-status';
    }
  });

  function finishTest() {
    SpeechEngine.stop();
    els.flow.hidden = true;
    const summary = TestEngine.summarize(answeredLog);
    ProgressStorage.saveTestResult(test.id, summary);

    els.bigScore.textContent = `${summary.score}%`;
    els.resultSub.textContent = `${summary.correctCount} / ${summary.totalCount} Correct`;

    const categoryOrder = ['speaking', 'listening', 'translation'];
    els.categories.innerHTML = categoryOrder
      .filter(cat => typeof summary.categoryScores[cat] === 'number')
      .map(cat => `
        <div class="cat">
          <span class="cat-num">${summary.categoryScores[cat]}%</span>
          <span class="cat-label">${cat}</span>
        </div>`).join('');

    if (summary.mistakes.length) {
      els.mistakeSection.hidden = false;
      els.reviewBtn.hidden = false;
      els.mistakeCount.textContent = summary.mistakes.length;
      const allSentences = ProgressEngine.sentencesFor(languageCode);
      els.mistakeList.innerHTML = summary.mistakes.map(id => {
        const s = allSentences.find(x => x.id === id);
        return `<div class="mistake-item"><span>${s.english}</span><span class="m-target">${s.target}</span></div>`;
      }).join('');
      els.reviewBtn.addEventListener('click', () => startRetrain(summary.mistakes));
    }

    els.results.hidden = false;
  }

  // ---- Mistake retrain: reuses the sentence-card flip UI via lessonEngine ----
  function startRetrain(mistakeIds) {
    const allSentences = ProgressEngine.sentencesFor(languageCode);
    const retrainSentences = mistakeIds.map(id => allSentences.find(s => s.id === id));
    els.results.hidden = true;
    els.retrainFlow.hidden = false;

    const r = {
      progressFill: document.getElementById('retrain-progress-fill'),
      progressCount: document.getElementById('retrain-progress-count'),
      card: document.getElementById('retrain-card'),
      prompt: document.getElementById('retrain-prompt-text'),
      status: document.getElementById('retrain-status-text'),
      mic: document.getElementById('retrain-mic-button'),
      target: document.getElementById('retrain-target-text'),
      echo: document.getElementById('retrain-echo-text')
    };

    const engine = createLessonEngine(retrainSentences, lang, {
      onStateChange(state, ctx) {
        switch (state) {
          case 'listening':
            r.card.classList.remove('is-flipped');
            r.prompt.textContent = ctx.sentence.english;
            r.status.textContent = 'Listening…';
            r.status.className = 'card-status';
            r.mic.className = 'mic-button is-listening';
            r.progressFill.style.width = `${Utils.formatPercent(ctx.index, ctx.total)}%`;
            r.progressCount.textContent = `${ctx.index} / ${ctx.total}`;
            break;
          case 'processing':
            r.mic.className = 'mic-button is-processing';
            r.status.textContent = 'Checking…';
            break;
          case 'correct':
            r.mic.className = 'mic-button is-correct';
            r.status.textContent = 'Correct ✓';
            r.status.className = 'card-status is-correct';
            break;
          case 'revealing':
            r.target.textContent = ctx.sentence.target;
            r.echo.textContent = `${ctx.sentence.english} · ${ctx.sentence.pronunciation}`;
            r.card.classList.add('is-flipped');
            break;
          case 'incorrect':
            r.mic.className = 'mic-button is-incorrect';
            r.status.textContent = 'Try again';
            r.status.className = 'card-status is-incorrect';
            break;
          case 'advancing':
            r.card.classList.remove('is-flipped');
            break;
          case 'completed':
            r.status.textContent = 'Review complete — nice work!';
            setTimeout(() => { window.location.href = 'index.html'; }, 1600);
            break;
        }
      }
    });
    r.mic.addEventListener('click', () => engine.start(), { once: true });
    r.status.textContent = 'Tap the mic to begin reviewing';
  }

  // ---- Review screen: shown before the test starts, built purely from
  // this test's sentence list (same data source the test itself uses —
  // no separate content, no test/progress logic touched). ----
  function renderReviewScreen() {
    const label = test.type === 'cumulative' ? 'Cumulative Test' : `Test ${test.index}`;
    els.reviewTitle.textContent = label;
    els.reviewSubtitle.textContent =
      `Lessons ${test.lessonRange[0]}–${test.lessonRange[1]} · ${test.sentenceIds.length} sentences`;

    const allSentences = ProgressEngine.sentencesFor(languageCode);
    const reviewSentences = allSentences.filter(s => test.sentenceIds.includes(s.id));

    // Plain text nodes only — Speech Synthesis is created on demand per
    // tap (see the delegated click handler below), never up front.
    els.reviewList.innerHTML = reviewSentences.map(s => `
      <div class="review-card">
        <div class="review-card-text">
          <span class="review-card-target">${s.target}</span>
          <span class="review-card-pron">${s.pronunciation}</span>
          <span class="review-card-english">${s.english}</span>
        </div>
        <button class="review-listen-btn" data-target="${s.target.replace(/"/g, '&quot;')}" aria-label="Listen">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7"/></svg>
        </button>
      </div>`).join('');
  }

  els.reviewList.addEventListener('click', (e) => {
    const btn = e.target.closest('.review-listen-btn');
    if (!btn) return;
    SpeechEngine.speak(btn.dataset.target, lang.speechRecognitionLocale);
  });

  els.startTestBtn.addEventListener('click', () => {
    els.reviewScreen.hidden = true;
    els.flow.hidden = false;
    renderQuestion();
  }, { once: true });

  renderReviewScreen();
})();
