/**
 * lessonEngine.js
 * -----------------------------------------------------------------------
 * Runs one lesson as an explicit state machine, one continuous
 * recognition session for the whole lesson (never per-card):
 *
 *   listening -> processing -> correct  -> revealing -> speaking -> (advance) -> listening (next)
 *                          \-> incorrect (attempt 1) -> listening (retry, same card)
 *                           \-> failed (attempt 2)   -> revealing -> speaking -> (advance) -> listening (next)
 *
 * "speaking" = Speech Synthesis is reading the correct answer aloud.
 * Recognition is explicitly paused for that window (SpeechEngine.pause())
 * and resumed right after, so the mic never hears the app's own voice.
 *
 * If recognition is unsupported or the mic permission is denied, the
 * lesson doesn't stop — it drops into a quiet "fallback" mode (no speech
 * verification, tap to reveal/continue) driven by the same state machine.
 *
 * The page (lessonPage.js) only reacts to onStateChange(state, context) —
 * it never pokes at speech recognition or timers directly.
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
    handlers: handlers || {}
  };

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

  function start() {
    if (!SpeechEngine.supported()) {
      beginFallbackCard();
      return;
    }
    const ok = SpeechEngine.start(
      languageConfig.speechRecognitionLocale,
      handleSpeechResult,
      handleSpeechError
    );
    if (ok) setState('listening', cardContext());
    else beginFallbackCard();
  }

  function handleSpeechError(err) {
    if (err === 'unsupported' || err === 'permission-denied') {
      // Degrade quietly instead of breaking the lesson: keep moving
      // through the cards without speech verification.
      beginFallbackCard();
    }
    // other transient errors (no-speech, network blips) are ignored —
    // SpeechEngine auto-restarts recognition on its own.
  }

  function handleSpeechResult(transcripts) {
    if (state.current !== 'listening') return; // ignore stray results mid-transition
    setState('processing', cardContext());

    const sentence = currentSentence();
    const matched = transcripts.some(t => Utils.matchesAnswer(t, sentence.answers));
    ProgressStorage.recordAttempt(sentence.id, matched);

    if (matched) onCorrect(sentence);
    else onIncorrect(sentence);
  }

  function onCorrect(sentence) {
    state.correctCount += 1;
    const prevState = ProgressStorage.getSentenceState(sentence.id);
    ProgressStorage.setSentenceState(sentence.id, prevState === 'new' ? 'learning' : 'learned');
    setState('correct', cardContext());
    revealThenSpeak(sentence);
  }

  function onIncorrect(sentence) {
    state.attempts += 1;
    if (state.attempts < MAX_ATTEMPTS_PER_CARD) {
      setState('incorrect', cardContext());
      setTimeout(() => {
        if (state.current === 'incorrect') setState('listening', cardContext());
      }, APP_CONFIG.incorrectRetryDelayMs);
    } else {
      state.wrongCount += 1;
      state.mistakes.push(sentence.id);
      setState('failed', cardContext());
      revealThenSpeak(sentence);
    }
  }

  /** Flip the card to show the correct answer, speak it, then advance — pausing recognition while it talks. */
  function revealThenSpeak(sentence) {
    SpeechEngine.pause();
    setState('revealing', cardContext());
    setState('speaking', cardContext());
    SpeechEngine.speak(sentence.target, languageConfig.ttsLocale, () => advance());
  }

  function advance() {
    setState('advancing');
    state.index += 1;
    state.attempts = 0;
    if (state.index >= state.sentences.length) {
      complete();
    } else {
      SpeechEngine.resume();
      setState('listening', cardContext());
    }
  }

  function complete() {
    SpeechEngine.stop();
    setState('completed', {
      total: state.sentences.length,
      correctCount: state.correctCount,
      wrongCount: state.wrongCount,
      mistakes: state.mistakes.slice()
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
    SpeechEngine.stop();
  }

  return { start, stop, continueFallback, getState: () => state.current, getIndex: () => state.index };
}
