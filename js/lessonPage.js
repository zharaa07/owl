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
    panelPermission: document.getElementById('panel-permission'),
    panelUnsupported: document.getElementById('panel-unsupported'),
    panelComplete: document.getElementById('panel-complete'),
    retryPermissionBtn: document.getElementById('retry-permission-btn'),
    completeSummary: document.getElementById('complete-summary'),
    nextLessonBtn: document.getElementById('next-lesson-btn')
  };

  els.titleLabel.textContent = lesson.title;

  let started = false;
  let engine = null;

  function setMicClass(cls) {
    els.micButton.className = 'mic-button' + (cls ? ' ' + cls : '');
  }

  function updateProgress(index, total) {
    const pct = Utils.formatPercent(index, total);
    els.progressFill.style.width = `${pct}%`;
    els.progressCount.textContent = `${index} / ${total}`;
  }

  function showOnly(panel) {
    [els.cardStage, els.progressWrap, els.panelPermission, els.panelUnsupported, els.panelComplete]
      .forEach(el => { el.hidden = (el !== panel); });
  }

  function onStateChange(state, ctx) {
    switch (state) {
      case 'listening':
        showOnly(els.cardStage);
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

      case 'revealing':
        els.targetText.textContent = ctx.sentence.target;
        els.echoText.textContent = `${ctx.sentence.english} · ${ctx.sentence.pronunciation}`;
        els.card.classList.add('is-flipped');
        break;

      case 'incorrect':
        setMicClass('is-incorrect');
        els.statusText.textContent = 'Try again';
        els.statusText.className = 'card-status is-incorrect';
        break;

      case 'advancing':
        els.card.classList.remove('is-flipped');
        break;

      case 'completed':
        showOnly(els.panelComplete);
        els.completeSummary.textContent =
          `You spoke ${ctx.total} sentences in ${lesson.title}.`;
        {
          const next = ProgressEngine.getLessons(languageCode).find(l => l.number > lessonNumber);
          if (next && ProgressEngine.isLessonUnlocked(languageCode, next.number)) {
            els.nextLessonBtn.href = `lesson.html?lang=${languageCode}&lesson=${next.number}`;
            els.nextLessonBtn.textContent = 'Next lesson';
          } else {
            els.nextLessonBtn.href = 'index.html';
            els.nextLessonBtn.textContent = 'Back to dashboard';
          }
        }
        break;

      case 'unsupported':
        showOnly(els.panelUnsupported);
        break;

      case 'permission-denied':
        showOnly(els.panelPermission);
        break;
    }
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

  els.micButton.addEventListener('click', beginSession);
  els.retryPermissionBtn.addEventListener('click', () => {
    started = false;
    beginSession();
  });
  els.listenBtn.addEventListener('click', () => {
    SpeechEngine.speak(els.targetText.textContent, lang.ttsLocale);
  });

  window.addEventListener('beforeunload', () => { if (engine) engine.stop(); });
})();
