(function () {
  const languageCode = Utils.qs('lang') || LANGUAGES[0].code;
  const lang = getLanguageConfig(languageCode);
  const lessonNumber = parseInt(Utils.qs('lesson'), 10);
  const lesson = ProgressEngine.getLessonByNumber(languageCode, lessonNumber);

  if (!lesson) { window.location.href = 'index.html'; return; }

  const els = {
    titleLabel: document.getElementById('lesson-title-label'),
    progressWrap: document.getElementById('lesson-progress-wrap'),
    progressFill: document.getElementById('progress-bar-fill'),
    progressCount: document.getElementById('progress-count'),
    cardStage: document.getElementById('card-stage'),
    card: document.getElementById('sentence-card'),
    promptText: document.getElementById('card-prompt-text'),
    statusText: document.getElementById('card-status-text'),
    micButton: document.getElementById('mic-button'),
    targetText: document.getElementById('card-target-text'),
    echoText: document.getElementById('card-echo-text'),
    listenBtn: document.getElementById('listen-btn'),
    panelComplete: document.getElementById('panel-complete'),
    completeBigScore: document.getElementById('complete-big-score'),
    completeSub: document.getElementById('complete-sub'),
    completeCorrectNum: document.getElementById('complete-correct-num'),
    completeWrongNum: document.getElementById('complete-wrong-num'),
    reviewMistakesBtn: document.getElementById('review-mistakes-btn'),
    nextLessonBtn: document.getElementById('next-lesson-btn')
  };

  els.titleLabel.textContent = lesson.title;

  let started = false;
  let engine = null;
  let isReviewPass = false; // true while re-running the mistake retrain

  function setMicClass(cls) {
    els.micButton.className = 'mic-button' + (cls ? ' ' + cls : '');
  }

  function updateProgress(index, total) {
    const pct = Utils.formatPercent(index, total);
    els.progressFill.style.width = `${pct}%`;
    els.progressCount.textContent = `${index} / ${total}`;
  }

  function showCard() {
    els.cardStage.hidden = false;
    els.progressWrap.hidden = false;
    els.panelComplete.hidden = true;
  }

  function showComplete() {
    els.cardStage.hidden = true;
    els.progressWrap.hidden = true;
    els.panelComplete.hidden = false;
  }

  function onStateChange(state, ctx) {
    switch (state) {
      case 'listening':
        showCard();
        els.card.classList.remove('is-flipped');
        els.promptText.textContent = ctx.sentence.english;
        els.statusText.textContent = 'Listening…';
        els.statusText.className = 'card-status';
        setMicClass('is-listening');
        updateProgress(ctx.index, ctx.total);
        break;

      case 'processing':
        setMicClass('is-processing');
        els.statusText.textContent = 'Checking…';
        break;

      case 'correct':
        setMicClass('is-correct');
        els.statusText.textContent = 'Correct ✓';
        els.statusText.className = 'card-status is-correct';
        break;

      case 'incorrect':
        setMicClass('is-incorrect');
        els.statusText.textContent = 'Try again';
        els.statusText.className = 'card-status is-incorrect';
        break;

      case 'failed':
        setMicClass('is-incorrect');
        els.statusText.textContent = 'Incorrect';
        els.statusText.className = 'card-status is-incorrect';
        break;

      case 'revealing':
        els.targetText.textContent = ctx.sentence.target;
        els.echoText.textContent = `${ctx.sentence.english} · ${ctx.sentence.pronunciation}`;
        els.card.classList.add('is-flipped');
        break;

      case 'speaking':
        // Card is already flipped from 'revealing'; nothing else to update —
        // Speech Synthesis is playing and recognition is paused underneath.
        break;

      case 'advancing':
        els.card.classList.remove('is-flipped');
        break;

      case 'fallback-card':
        showCard();
        els.card.classList.remove('is-flipped');
        els.promptText.textContent = ctx.sentence.english;
        els.statusText.textContent = 'Speaking practice unavailable — tap to continue';
        els.statusText.className = 'card-status';
        setMicClass('');
        updateProgress(ctx.index, ctx.total);
        break;

      case 'completed':
        if (isReviewPass) { window.location.href = 'index.html'; return; }
        renderCompletion(ctx);
        break;
    }
  }

  function renderCompletion(ctx) {
    showComplete();
    const total = ctx.correctCount + ctx.wrongCount;
    const score = total ? Utils.formatPercent(ctx.correctCount, total) : 100;
    els.completeBigScore.textContent = `${score}%`;
    els.completeSub.textContent = `${ctx.correctCount} / ${ctx.total} correct`;
    els.completeCorrectNum.textContent = ctx.correctCount;
    els.completeWrongNum.textContent = ctx.wrongCount;

    if (ctx.mistakes && ctx.mistakes.length) {
      els.reviewMistakesBtn.hidden = false;
      els.reviewMistakesBtn.onclick = () => startReview(ctx.mistakes);
    } else {
      els.reviewMistakesBtn.hidden = true;
    }

    const next = ProgressEngine.getLessons(languageCode).find(l => l.number > lessonNumber);
    if (next && ProgressEngine.isLessonUnlocked(languageCode, next.number)) {
      els.nextLessonBtn.hidden = false;
      els.nextLessonBtn.href = `lesson.html?lang=${languageCode}&lesson=${next.number}`;
    } else {
      els.nextLessonBtn.hidden = true;
    }
  }

  function startReview(mistakeIds) {
    isReviewPass = true;
    const retrainSentences = mistakeIds.map(id => lesson.sentences.find(s => s.id === id)).filter(Boolean);
    started = false;
    engine = createLessonEngine(retrainSentences, lang, { onStateChange });
    engine.start();
  }

  function beginSession() {
    if (started) return;
    started = true;
    engine = createLessonEngine(lesson.sentences, lang, { onStateChange });
    engine.start();
  }

  // Idle state before first tap.
  els.promptText.textContent = lesson.sentences[0].english;
  els.statusText.textContent = 'Tap the mic to begin';
  updateProgress(0, lesson.sentences.length);

  els.micButton.addEventListener('click', () => {
    if (!started) { beginSession(); return; }
    if (engine && engine.getState() === 'fallback-card') engine.continueFallback();
  });

  els.listenBtn.addEventListener('click', () => {
    SpeechEngine.speak(els.targetText.textContent, lang.ttsLocale);
  });

  window.addEventListener('beforeunload', () => { if (engine) engine.stop(); });
})();
