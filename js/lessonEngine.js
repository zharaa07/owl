/**
 * lessonEngine.js
 * -----------------------------------------------------------------------
 * Runs one lesson as an explicit state machine:
 *
 *   idle -> listening -> processing -> correct -> revealing -> advancing -> listening (next)
 *                              \-> incorrect -> listening (retry, same sentence)
 *   ... -> completed
 *
 * The page (lessonPage.js) only reacts to onStateChange(state, context) —
 * it never pokes at speech recognition or timers directly. This is what
 * makes "10 sentences" vs "500 sentences" identical from the engine's
 * point of view: it just walks an array.
 * -----------------------------------------------------------------------
 */
function createLessonEngine(sentences, languageConfig, handlers) {
  const state = {
    sentences,
    index: 0,
    current: 'idle',
    correctSentenceIds: [],
    handlers: handlers || {}
  };

  function setState(name, context) {
    state.current = name;
    if (state.handlers.onStateChange) state.handlers.onStateChange(name, context || {});
  }

  function currentSentence() {
    return state.sentences[state.index];
  }

  function start() {
    if (!SpeechEngine.supported()) {
      setState('unsupported');
      return;
    }
    const ok = SpeechEngine.start(
      languageConfig.speechRecognitionLocale,
      handleSpeechResult,
      handleSpeechError
    );
    if (ok) setState('listening', { sentence: currentSentence(), index: state.index, total: state.sentences.length });
  }

  function handleSpeechError(err) {
    if (err === 'unsupported') { setState('unsupported'); return; }
    if (err === 'permission-denied') { setState('permission-denied'); return; }
    // transient errors (no-speech, network blip) — stay in listening, engine auto-restarts
  }

  function handleSpeechResult(transcripts) {
    if (state.current !== 'listening') return; // ignore stray results mid-transition
    setState('processing', { sentence: currentSentence() });

    const sentence = currentSentence();
    const matched = transcripts.some(t => Utils.matchesAnswer(t, sentence.answers));
    ProgressStorage.recordAttempt(sentence.id, matched);

    if (matched) onCorrect(sentence);
    else onIncorrect(sentence);
  }

  function onCorrect(sentence) {
    state.correctSentenceIds.push(sentence.id);
    const prevState = ProgressStorage.getSentenceState(sentence.id);
    ProgressStorage.setSentenceState(sentence.id, prevState === 'new' ? 'learning' : 'learned');
    setState('correct', { sentence });
    setState('revealing', { sentence, index: state.index, total: state.sentences.length });

    setTimeout(() => advance(), APP_CONFIG.correctRevealDelayMs);
  }

  function onIncorrect(sentence) {
    setState('incorrect', { sentence });
    setTimeout(() => {
      if (state.current === 'incorrect') {
        setState('listening', { sentence: currentSentence(), index: state.index, total: state.sentences.length });
      }
    }, APP_CONFIG.incorrectRetryDelayMs);
  }

  function advance() {
    setState('advancing');
    state.index += 1;
    if (state.index >= state.sentences.length) {
      complete();
    } else {
      setState('listening', { sentence: currentSentence(), index: state.index, total: state.sentences.length });
    }
  }

  function complete() {
    SpeechEngine.stop();
    setState('completed', {
      total: state.sentences.length,
      correctFirstTry: state.correctSentenceIds.length
    });
  }

  function stop() {
    SpeechEngine.stop();
  }

  return { start, stop, getState: () => state.current, getIndex: () => state.index };
}
