/**
 * storage.js
 * -----------------------------------------------------------------------
 * The single point of contact with persistence. Every other file calls
 * ProgressStorage.* and never touches localStorage directly. To move to
 * Firebase/Supabase/a real backend later, rewrite the body of these
 * functions (ideally keeping them async-compatible) — nothing that calls
 * them needs to change.
 * -----------------------------------------------------------------------
 */
const ProgressStorage = (function () {
  const KEY = 'lingua.progress.v1';

  function defaultProgress() {
    return {
      completedLessons: [],       // array of lesson keys, e.g. "es-1"
      sentenceStates: {},         // { sentenceId: 'new'|'learning'|'learned'|'review'|'mastered' }
      testResults: {},            // { testId: { score, categoryScores, mistakes:[], completedAt } }
      attempts: {},                // { sentenceId: { correct, incorrect } }
      streak: 0,
      lastActivityDate: null,     // ISO date string (day granularity)
      sentencesLearned: 0,
      currentPosition: null       // { languageCode, lessonNumber, sentenceIndex }
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultProgress();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultProgress(), parsed);
    } catch (e) {
      console.warn('ProgressStorage: failed to read, resetting', e);
      return defaultProgress();
    }
  }

  function save(progress) {
    try {
      localStorage.setItem(KEY, JSON.stringify(progress));
    } catch (e) {
      console.warn('ProgressStorage: failed to write', e);
    }
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function touchStreak(progress) {
    const t = today();
    if (progress.lastActivityDate === t) return; // already counted today
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    progress.streak = progress.lastActivityDate === yesterday ? progress.streak + 1 : 1;
    progress.lastActivityDate = t;
  }

  return {
    getProgress() {
      return load();
    },

    setSentenceState(sentenceId, state) {
      const p = load();
      p.sentenceStates[sentenceId] = state;
      if (state === 'learned' || state === 'mastered') {
        const wasCountedBefore = p.sentencesLearned > 0 &&
          Object.values(p.sentenceStates).filter(s => s === 'learned' || s === 'mastered').length <= p.sentencesLearned;
      }
      // recompute count from source of truth to avoid double counting
      p.sentencesLearned = Object.values(p.sentenceStates)
        .filter(s => s === 'learned' || s === 'mastered').length;
      save(p);
      return p;
    },

    getSentenceState(sentenceId) {
      const p = load();
      return p.sentenceStates[sentenceId] || 'new';
    },

    recordAttempt(sentenceId, wasCorrect) {
      const p = load();
      if (!p.attempts[sentenceId]) p.attempts[sentenceId] = { correct: 0, incorrect: 0 };
      p.attempts[sentenceId][wasCorrect ? 'correct' : 'incorrect'] += 1;
      save(p);
      return p;
    },

    markLessonComplete(lessonKey) {
      const p = load();
      if (!p.completedLessons.includes(lessonKey)) {
        p.completedLessons.push(lessonKey);
      }
      touchStreak(p);
      save(p);
      return p;
    },

    isLessonComplete(lessonKey) {
      return load().completedLessons.includes(lessonKey);
    },

    saveTestResult(testId, result) {
      const p = load();
      p.testResults[testId] = Object.assign({ completedAt: new Date().toISOString() }, result);
      // Any sentence missed in a test drops back to "review" for spaced practice later.
      (result.mistakes || []).forEach(sentenceId => {
        p.sentenceStates[sentenceId] = 'review';
      });
      // Sentences answered correctly in a test move toward "mastered".
      (result.correctSentenceIds || []).forEach(sentenceId => {
        if (p.sentenceStates[sentenceId] === 'learned') p.sentenceStates[sentenceId] = 'mastered';
      });
      touchStreak(p);
      save(p);
      return p;
    },

    isTestComplete(testId) {
      return !!load().testResults[testId];
    },

    setCurrentPosition(pos) {
      const p = load();
      p.currentPosition = pos;
      save(p);
    },

    getCurrentPosition() {
      return load().currentPosition;
    },

    reset() {
      save(defaultProgress());
    }
  };
})();
