/**
 * speechEngine.js
 * -----------------------------------------------------------------------
 * The only file that touches the Web Speech API. Everything above it
 * (lessonEngine, testEngine, pages) just calls start()/stop()/speak() and
 * gets callbacks — they never see SpeechRecognition directly. This keeps
 * "press mic once, listen forever until the session ends" logic in one
 * place, and means recognition quirks/vendor prefixes never leak out.
 * -----------------------------------------------------------------------
 */
const SpeechEngine = (function () {
  let recognition = null;
  let sessionActive = false;
  let restarting = false;
  let onResultCb = null;
  let onErrorCb = null;
  let currentLocale = null;

  function supported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function ttsSupported() {
    return 'speechSynthesis' in window;
  }

  function build(locale) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = locale;
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 3;

    rec.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcripts = Array.from(result).map(alt => alt.transcript);
      if (onResultCb) onResultCb(transcripts);
    };

    rec.onerror = (event) => {
      // "no-speech" and "aborted" are routine during continuous listening —
      // don't treat them as fatal, onend will handle the restart.
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        sessionActive = false;
        if (onErrorCb) onErrorCb('permission-denied');
      } else if (onErrorCb) {
        onErrorCb(event.error);
      }
    };

    rec.onend = () => {
      // The browser stopped recognition on its own. If our session is
      // still supposed to be active, restart — but never loop after the
      // session has been explicitly ended.
      if (sessionActive && !restarting) {
        restarting = true;
        setTimeout(() => {
          restarting = false;
          if (sessionActive) {
            try { recognition.start(); } catch (e) { /* already running */ }
          }
        }, 250);
      }
    };

    return rec;
  }

  return {
    supported,
    ttsSupported,
    isActive: () => sessionActive,

    /** Start (or resume) a continuous listening session. Call once per lesson/test session. */
    start(locale, onResult, onError) {
      if (!supported()) {
        if (onError) onError('unsupported');
        return false;
      }
      onResultCb = onResult;
      onErrorCb = onError;
      if (!recognition || currentLocale !== locale) {
        if (recognition) { try { recognition.stop(); } catch (e) {} }
        recognition = build(locale);
        currentLocale = locale;
      }
      sessionActive = true;
      try { recognition.start(); } catch (e) { /* already started, fine */ }
      return true;
    },

    /** Permanently stop the session (e.g. lesson finished / user left). */
    stop() {
      sessionActive = false;
      if (recognition) { try { recognition.stop(); } catch (e) {} }
    },

    /** Speak text aloud in the given locale (used by the 🔊 Listen button and Listening questions). */
    speak(text, locale, onEnd) {
      if (!ttsSupported()) { if (onEnd) onEnd(); return; }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = locale;
      if (onEnd) utter.onend = onEnd;
      window.speechSynthesis.speak(utter);
    }
  };
})();
