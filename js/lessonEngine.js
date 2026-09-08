/**
 * lessonEngine.js
 * -----------------------------------------------------------------------
 * Runs one lesson as an explicit state machine, one continuous
 * recognition session for the whole lesson (never per-card):
 *
 *   listening -> processing -> correct  -> revealing -> speaking -> (auto-advance) -> listening (next)
 *                          \-> incorrect (attempt 1) -> listening (retry, same card)
 *                           \-> failed (attempt 2)   -> revealing -> speaking -> awaiting-continue -> (tap) -> listening (next)
 *   listening --(5s silence)--> timeout -> revealing -> speaking -> (auto-advance) -> listening (next)
 *
 * "speaking" = Speech Synthesis is reading the correct answer aloud.
 * Recognition is explicitly paused for that window (SpeechEngine.pause())
 * and resumed right after, so the mic never hears the app's own voice.
 *
 * Two different endings after showing the correct answer, on purpose:
 *   - correct / silence-timeout -> keep the pace up, advance automatically.
 *   - failed after 2 wrong attempts -> stay on the answer until the user
 *     taps to continue (engine.continueAfterReveal()), so a real mistake
 *     doesn't flash by before it's absorbed.
 *
 * If recognition is unsupported or the mic permission is denied, the
 * lesson doesn't stop — it drops into a quiet "fallback" mode (no speech
 * verification, tap to reveal/continue) driven by the same state machine.
 *
 * The page (lessonPage.js) only reacts to onStateChange(state, context)
 * and calls the small set of methods below — it never pokes at speech
 * recognition or timers directly.
 * -----------------------------------------------------------------------
 */
const MAX_ATTEMPTS_PER_CARD = 2;

function createLessonEngine(sentences, languageConfig, handlers) {
  const state = {
    sentences,
    index: 0,
    attempts: 0,
    current: 'idle',
    correctCount: 0,
    wrongCount: 0,
    mistakes: [],
    startedAt: null,
    handlers: handlers || {}
  };

  let silenceTimer = null;

  function setState(name, context) {
    state.current = name;
    if (state.handlers.onStateChange) state.handlers.onStateChange(name, context || {});
  }

  function currentSentence() {
    return state.sentences[state.index];
  }

  function cardContext(extra) {
    return Object.assign({
      sentence: currentSentence(),
      index: state.index,
      total: state.sentences.length,
      attempts: state.attempts
    }, extra || {});
  }

  function clearSilenceTimer() {
    if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
  }

  function startSilenceTimer() {
    clearSilenceTimer();
    silenceTimer = setTimeout(handleSilenceTimeout, APP_CONFIG.silenceTimeoutMs);
  }

  /** Enter 'listening' and (re)arm the silence timeout in one place. */
  function enterListening() {
    setState('listening', cardContext());
    startSilenceTimer();
  }

  function start() {
    state.startedAt = Date.now();
    if (!SpeechEngine.supported()) {
      beginFallbackCard();
      return;
    }
    const ok = SpeechEngine.start(
      languageConfig.speechRecognitionLocale,
      handleSpeechResult,
      handleSpeechError
    );
    if (ok) enterListening();
    else beginFallbackCard();
  }

  function handleSpeechError(err) {
    if (err === 'unsupported' || err === 'permission-denied') {
      // Degrade quietly instead of breaking the lesson: keep moving
      // through the cards without speech verification.
      clearSilenceTimer();
      beginFallbackCard();
    }
    // other transient errors (no-speech, network blips) are ignored —
    // SpeechEngine auto-restarts recognition on its own.
  }

  function handleSpeechResult(transcripts, confidence) {
    if (state.current !== 'listening') return; // ignore stray results mid-transition
    clearSilenceTimer(); // the user said something — no longer silent
    setState('processing', cardContext());

    const sentence = currentSentence();
    const matched = transcripts.some(t => Utils.matchesAnswer(t, sentence.answers, confidence));
    ProgressStorage.recordAttempt(sentence.id, matched);

    if (matched) onCorrect(sentence);
    else onIncorrect(sentence);
  }

  function onCorrect(sentence) {
    state.correctCount += 1;
    const prevState = ProgressStorage.getSentenceState(sentence.id);
    ProgressStorage.setSentenceState(sentence.id, prevState === 'new' ? 'learning' : 'learned');
    setState('correct', cardContext());
    revealThenAdvance(sentence);
  }

  function onIncorrect(sentence) {
    state.attempts += 1;
    if (state.attempts < MAX_ATTEMPTS_PER_CARD) {
      setState('incorrect', cardContext());
      setTimeout(() => {
        if (state.current === 'incorrect') enterListening();
      }, APP_CONFIG.incorrectRetryDelayMs);
    } else {
      state.wrongCount += 1;
      state.mistakes.push(sentence.id);
      setState('failed', cardContext());
      revealThenWaitForTap(sentence);
    }
  }

  function handleSilenceTimeout() {
    if (state.current !== 'listening') return;
    const sentence = currentSentence();
    state.wrongCount += 1;
    state.mistakes.push(sentence.id);
    setState('timeout', cardContext());
    revealThenAdvance(sentence);
  }

  /** Correct answer / silence timeout: reveal, speak, then move on automatically. */
  function revealThenAdvance(sentence) {
    clearSilenceTimer();
    SpeechEngine.pause();
    setState('revealing', cardContext());
    setState('speaking', cardContext());
    SpeechEngine.speak(sentence.target, languageConfig.ttsLocale, () => advance());
  }

  /** Failed after MAX_ATTEMPTS_PER_CARD: reveal, speak, then hold until the user taps to continue. */
  function revealThenWaitForTap(sentence) {
    clearSilenceTimer();
    SpeechEngine.pause();
    setState('revealing', cardContext());
    setState('speaking', cardContext());
    SpeechEngine.speak(sentence.target, languageConfig.ttsLocale, () => {
      setState('awaiting-continue', cardContext());
    });
  }

  /** Called by the page when the user taps to move on from an 'awaiting-continue' card. */
  function continueAfterReveal() {
    if (state.current !== 'awaiting-continue') return;
    advance();
  }

  /**
   * Manual hint replay (🔄): speak the current card's correct pronunciation
   * on demand. Only pauses/resumes recognition (and the silence timer) if
   * we were actually listening — harmless to call at any time otherwise.
   */
  function speakHint() {
    const wasListening = state.current === 'listening' || state.current === 'incorrect';
    if (wasListening) {
      SpeechEngine.pause();
      clearSilenceTimer();
    }
    SpeechEngine.speak(currentSentence().target, languageConfig.ttsLocale, () => {
      if (wasListening && (state.current === 'listening' || state.current === 'incorrect')) {
        SpeechEngine.resume();
        startSilenceTimer();
      }
    });
  }

  function advance() {
    setState('advancing');
    state.index += 1;
    state.attempts = 0;
    if (state.index >= state.sentences.length) {
      complete();
    } else {
      SpeechEngine.resume();
      enterListening();
    }
  }

  function complete() {
    clearSilenceTimer();
    SpeechEngine.stop();
    // Only the real lesson pass persists progress — a "Review Mistakes"
    // retrain (created without a lessonKey) walks a subset of sentences
    // and shouldn't re-touch lesson/streak state.
    if (state.handlers.lessonKey) {
      ProgressStorage.markLessonComplete(state.handlers.lessonKey);
    }
    setState('completed', {
      total: state.sentences.length,
      correctCount: state.correctCount,
      wrongCount: state.wrongCount,
      mistakes: state.mistakes.slice(),
      timeTakenMs: state.startedAt ? Date.now() - state.startedAt : 0
    });
  }

  // ---- Fallback: no recognition available / permission denied ----
  // Same card-by-card progression, no speech verification. The page
  // triggers continueFallback() from a tap instead of a spoken answer.

  function beginFallbackCard() {
    setState('fallback-card', cardContext());
  }

  function continueFallback() {
    if (state.current !== 'fallback-card') return;
    const sentence = currentSentence();
    setState('revealing', cardContext());
    if (SpeechEngine.ttsSupported()) {
      setState('speaking', cardContext());
      SpeechEngine.speak(sentence.target, languageConfig.ttsLocale, () => advanceFallback());
    } else {
      setTimeout(() => advanceFallback(), APP_CONFIG.correctRevealDelayMs);
    }
  }

  function advanceFallback() {
    setState('advancing');
    state.index += 1;
    if (state.index >= state.sentences.length) {
      complete();
    } else {
      beginFallbackCard();
    }
  }

  function stop() {
    clearSilenceTimer();
    SpeechEngine.stop();
  }

  return {
    start,
    stop,
    continueFallback,
    continueAfterReveal,
    speakHint,
    getState: () => state.current,
    getIndex: () => state.index
  };
}
