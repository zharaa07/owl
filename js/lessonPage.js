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
    hintBtn: document.getElementById('hint-btn'),
    targetText: document.getElementById('card-target-text'),
    echoText: document.getElementById('card-echo-text'),
    listenBtn: document.getElementById('listen-btn'),
    continueBtn: document.getElementById('continue-btn'),
    panelComplete: document.getElementById('panel-complete'),
    completeBigScore: document.getElementById('complete-big-score'),
    completeSub: document.getElementById('complete-sub'),
    completeCorrectNum: document.getElementById('complete-correct-num'),
    completeWrongNum: document.getElementById('complete-wrong-num'),
    reviewMistakesBtn: document.getElementById('review-mistakes-btn'),
    nextLessonBtn: document.getElementById('next-lesson-btn'),
    previewScreen: document.getElementById('lesson-review-screen'),
    previewTitle: document.getElementById('lesson-review-title'),
    previewSubtitle: document.getElementById('lesson-review-subtitle'),
    previewList: document.getElementById('lesson-review-list'),
    startLessonBtn: document.getElementById('start-lesson-btn')
  };

  els.titleLabel.textContent = lesson.title;

  let started = false;
  let engine = null;
  let isReviewPass = false; // true while re-running the mistake retrain

  function setMicClass(cls) {
    els.micButton.className = 'mic-button' + (cls ? ' ' + cls : '');
  }

  /**
   * Visual-feedback layer on top of the existing state machine — purely
   * cosmetic, doesn't touch attempts/scoring/advance logic at all. Adds
   * at most one of is-correct / is-wrong / is-delayed / is-active to the
   * card wrapper; CSS handles the border, glow, badge and animation per
   * state, and clears itself back to the plain default whenever a fresh
   * 'listening' (or fallback) card begins.
   */
  function setCardFeedback(cls) {
    els.card.classList.remove('is-correct', 'is-wrong', 'is-delayed', 'is-active');
    if (cls) els.card.classList.add(cls);
  }

  function updateProgress(index, total) {
    const pct = Utils.formatPercent(index, total);
    els.progressFill.style.width = `${pct}%`;
    els.progressCount.textContent = `${index} / ${total}`;
  }

  function showCard() {
    els.previewScreen.hidden = true;
    els.cardStage.hidden = false;
    els.progressWrap.hidden = false;
    els.panelComplete.hidden = true;
  }

  function showComplete() {
    els.previewScreen.hidden = true;
    els.cardStage.hidden = true;
    els.progressWrap.hidden = true;
    els.panelComplete.hidden = false;
  }

  // ---- Vocabulary preview: shown before the lesson starts, built purely
  // from this lesson's own sentence list — no separate content, and it
  // never touches the lesson/speech engines. ----
  function renderLessonPreview() {
    els.previewTitle.textContent = lesson.title;
    els.previewSubtitle.textContent = `${lesson.sentences.length} sentences`;

    // Plain text only — Speech Synthesis is created on demand per tap,
    // never up front for the whole list.
    els.previewList.innerHTML = lesson.sentences.map(s => `
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

  els.previewList.addEventListener('click', (e) => {
    const btn = e.target.closest('.review-listen-btn');
    if (!btn) return;
    SpeechEngine.speak(btn.dataset.target, lang.ttsLocale);
  });


  function onStateChange(state, ctx) {
    switch (state) {
      case 'listening':
        showCard();
        els.card.classList.remove('is-flipped');
        setCardFeedback('is-active');
        els.continueBtn.hidden = true;
        els.promptText.textContent = ctx.sentence.english;
        els.statusText.textContent = 'Listening…';
        els.statusText.className = 'card-status';
        setMicClass('is-listening');
        els.hintBtn.hidden = false;
        updateProgress(ctx.index, ctx.total);
        break;

      case 'processing':
        setMicClass('is-processing');
        els.statusText.textContent = 'Checking…';
        els.hintBtn.hidden = true;
        break;

      case 'correct':
        setMicClass('is-correct');
        setCardFeedback('is-correct');
        els.statusText.textContent = 'Correct ✓';
        els.statusText.className = 'card-status is-correct';
        els.hintBtn.hidden = true;
        break;

      case 'incorrect':
        setMicClass('is-incorrect');
        setCardFeedback('is-wrong');
        els.statusText.textContent = 'Try again';
        els.statusText.className = 'card-status is-incorrect';
        els.hintBtn.hidden = false; // still their turn to speak — hint stays available
        break;

      case 'failed':
        setMicClass('is-incorrect');
        setCardFeedback('is-wrong');
        els.statusText.textContent = 'Incorrect';
        els.statusText.className = 'card-status is-incorrect';
        els.hintBtn.hidden = true;
        break;

      case 'timeout':
        setMicClass('is-incorrect');
        setCardFeedback('is-delayed');
        els.statusText.textContent = 'No answer detected';
        els.statusText.className = 'card-status is-incorrect';
        els.hintBtn.hidden = true;
        break;

      case 'revealing':
        els.targetText.textContent = ctx.sentence.target;
        els.echoText.textContent = `${ctx.sentence.english} · ${ctx.sentence.pronunciation}`;
        els.card.classList.add('is-flipped');
        els.continueBtn.hidden = true; // only shown once we reach 'awaiting-continue'
        break;

      case 'speaking':
        // Card is already flipped from 'revealing'; nothing else to update —
        // Speech Synthesis is playing and recognition is paused underneath.
        break;

      case 'awaiting-continue':
        // Failed twice: the answer stays on screen until the user taps
        // Continue — no auto-advance, so the mistake actually sinks in.
        els.continueBtn.hidden = false;
        break;

      case 'advancing':
        els.card.classList.remove('is-flipped');
        break;

      case 'fallback-card':
        showCard();
        els.card.classList.remove('is-flipped');
        setCardFeedback(null);
        els.continueBtn.hidden = true;
        els.promptText.textContent = ctx.sentence.english;
        els.statusText.textContent = 'Speaking practice unavailable — tap to continue';
        els.statusText.className = 'card-status';
        setMicClass('');
        els.hintBtn.hidden = false;
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
    // A fresh shuffle every time the lesson starts, so it's not the same
    // order on repeat runs.
    const shuffled = Utils.shuffle(lesson.sentences);
    engine = createLessonEngine(shuffled, lang, { onStateChange, lessonKey: lesson.key });
    engine.start();
  }

  els.startLessonBtn.addEventListener('click', () => {
    showCard();
    // Idle state before first mic tap.
    els.promptText.textContent = lesson.sentences[0].english;
    els.statusText.textContent = 'Tap the mic to begin';
    els.hintBtn.hidden = true;
    els.continueBtn.hidden = true;
    updateProgress(0, lesson.sentences.length);
  }, { once: true });

  els.micButton.addEventListener('click', () => {
    if (!started) { beginSession(); return; }
    if (engine && engine.getState() === 'fallback-card') engine.continueFallback();
  });

  els.hintBtn.addEventListener('click', () => {
    if (engine) engine.speakHint();
  });

  els.continueBtn.addEventListener('click', () => {
    if (engine) engine.continueAfterReveal();
  });

  els.listenBtn.addEventListener('click', () => {
    SpeechEngine.speak(els.targetText.textContent, lang.ttsLocale);
  });

  window.addEventListener('beforeunload', () => { if (engine) engine.stop(); });

  renderLessonPreview();
})();
