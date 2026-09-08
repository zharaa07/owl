/**
 * progressEngine.js
 * -----------------------------------------------------------------------
 * The heart of the "content changes, the system doesn't" principle.
 * Everything here is computed from SENTENCES + APP_CONFIG at call time.
 * Add sentence #5001 under lesson 501 and, with zero code changes:
 *   - a new lesson appears
 *   - it unlocks in its correct place in the sequence
 *   - a new section test is generated once its block of lessons is full
 *   - cumulative tests grow to include it
 *   - dashboard percentages recompute
 * -----------------------------------------------------------------------
 */
const ProgressEngine = (function () {

  function sentencesFor(languageCode) {
    return SENTENCES.filter(s => s.languageCode === languageCode).sort((a, b) => a.id - b.id);
  }

  function lessonKey(languageCode, lessonNumber) {
    return `${languageCode}-${lessonNumber}`;
  }

  /** All lessons for a language, each with its sentences, in order. */
  function getLessons(languageCode) {
    const sentences = sentencesFor(languageCode);
    const byLesson = new Map();
    sentences.forEach(s => {
      if (!byLesson.has(s.lesson)) byLesson.set(s.lesson, []);
      byLesson.get(s.lesson).push(s);
    });
    const numbers = Array.from(byLesson.keys()).sort((a, b) => a - b);
    return numbers.map(n => ({
      key: lessonKey(languageCode, n),
      number: n,
      title: LESSON_TITLES[n] || `Lesson ${n}`,
      sentences: byLesson.get(n)
    }));
  }

  function getLessonByNumber(languageCode, number) {
    return getLessons(languageCode).find(l => l.number === number) || null;
  }

  /**
   * Whether a lesson is unlocked:
   *  - the first lesson is always unlocked
   *  - a lesson mid-block unlocks once the previous lesson is complete
   *  - the first lesson of a new block unlocks once the section test
   *    covering the previous block has been completed
   */
  function isLessonUnlocked(languageCode, lessonNumber) {
    const perTest = APP_CONFIG.lessonsPerTest;
    if (lessonNumber <= 1) return true;

    const isFirstOfBlock = (lessonNumber - 1) % perTest === 0;
    if (!isFirstOfBlock) {
      const prev = getLessonByNumber(languageCode, lessonNumber - 1);
      return prev ? ProgressStorage.isLessonComplete(prev.key) : false;
    }

    // First lesson of a new block: gate on the test for the previous block.
    const blockIndexJustFinished = (lessonNumber - 1) / perTest; // 1-based test index
    const tests = getTestDefinitions(languageCode);
    const gatingTest = tests.find(t => t.type === 'section' && t.index === blockIndexJustFinished);
    if (!gatingTest) return true; // no test defined yet (shouldn't happen) — don't block
    return ProgressStorage.isTestComplete(gatingTest.id);
  }

  function isLessonComplete(languageCode, lessonNumber) {
    const lesson = getLessonByNumber(languageCode, lessonNumber);
    return lesson ? ProgressStorage.isLessonComplete(lesson.key) : false;
  }

  /**
   * Generates every test (section + cumulative) that the current amount
   * of content justifies, in sequence order. A test only appears once its
   * full block of lessons exists in the data.
   */
  function getTestDefinitions(languageCode) {
    const lessons = getLessons(languageCode);
    const perTest = APP_CONFIG.lessonsPerTest;
    const perCumulative = APP_CONFIG.testsPerCumulative;
    const sectionTestCount = Math.floor(lessons.length / perTest);

    const tests = [];
    let sinceLastCumulative = 0;

    for (let t = 1; t <= sectionTestCount; t++) {
      const fromLesson = (t - 1) * perTest + 1;
      const toLesson = t * perTest;
      const blockLessons = lessons.filter(l => l.number >= fromLesson && l.number <= toLesson);
      const sentenceIds = blockLessons.flatMap(l => l.sentences.map(s => s.id));

      tests.push({
        id: `${languageCode}-test-${t}`,
        type: 'section',
        index: t,
        lessonRange: [fromLesson, toLesson],
        sentenceIds
      });

      sinceLastCumulative++;
      if (sinceLastCumulative === perCumulative) {
        const cumulativeLessons = lessons.filter(l => l.number <= toLesson);
        tests.push({
          id: `${languageCode}-cumulative-${toLesson}`,
          type: 'cumulative',
          lessonRange: [1, toLesson],
          sentenceIds: cumulativeLessons.flatMap(l => l.sentences.map(s => s.id)),
          coversTests: tests.filter(x => x.type === 'section').slice(-perCumulative).map(x => x.id)
        });
        sinceLastCumulative = 0;
      }
    }
    return tests;
  }

  function getTestById(languageCode, testId) {
    return getTestDefinitions(languageCode).find(t => t.id === testId) || null;
  }

  function isTestUnlocked(languageCode, test) {
    if (test.type === 'section') {
      const [from, to] = test.lessonRange;
      for (let n = from; n <= to; n++) {
        if (!isLessonComplete(languageCode, n)) return false;
      }
      return true;
    }
    // cumulative: unlocked once every section test it covers is complete
    return test.coversTests.every(id => ProgressStorage.isTestComplete(id));
  }

  function isTestComplete(testId) {
    return ProgressStorage.isTestComplete(testId);
  }

  /** Sentence-state-aware lesson progress (for in-lesson progress bars). */
  function getLessonProgress(languageCode, lessonNumber) {
    const lesson = getLessonByNumber(languageCode, lessonNumber);
    if (!lesson) return { completed: 0, total: 0 };
    const complete = isLessonComplete(languageCode, lessonNumber);
    return { completed: complete ? lesson.sentences.length : 0, total: lesson.sentences.length, isComplete: complete };
  }

  /** Aggregate numbers for the dashboard. */
  function getOverallProgress(languageCode) {
    const lessons = getLessons(languageCode);
    const tests = getTestDefinitions(languageCode);
    const totalSentences = sentencesFor(languageCode).length;
    const progress = ProgressStorage.getProgress();

    const completedLessons = lessons.filter(l => ProgressStorage.isLessonComplete(l.key));
    const completedTests = tests.filter(t => ProgressStorage.isTestComplete(t.id));

    const accuracyEntries = Object.values(progress.attempts);
    const totalAttempts = accuracyEntries.reduce((sum, a) => sum + a.correct + a.incorrect, 0);
    const totalCorrect = accuracyEntries.reduce((sum, a) => sum + a.correct, 0);
    const accuracy = totalAttempts ? Utils.formatPercent(totalCorrect, totalAttempts) : 0;

    const speakingAccuracyScores = Object.values(progress.testResults)
      .map(r => r.categoryScores && r.categoryScores.speaking)
      .filter(v => typeof v === 'number');
    const speakingAccuracy = speakingAccuracyScores.length
      ? Math.round(speakingAccuracyScores.reduce((a, b) => a + b, 0) / speakingAccuracyScores.length)
      : accuracy;

    return {
      languageCode,
      totalLessons: lessons.length,
      completedLessonsCount: completedLessons.length,
      totalSentences,
      sentencesLearned: progress.sentencesLearned,
      totalTests: tests.length,
      completedTestsCount: completedTests.length,
      overallPercent: Utils.formatPercent(completedLessons.length, lessons.length || 1),
      accuracy,
      speakingAccuracy,
      streak: progress.streak
    };
  }

  /** Where should "Continue" resume the user? First incomplete unlocked lesson. */
  function getNextLesson(languageCode) {
    const lessons = getLessons(languageCode);
    return lessons.find(l => !ProgressStorage.isLessonComplete(l.key)) || null;
  }

  function checkAchievements() {
    if (!APP_CONFIG.enableAchievements) return [];
    const progress = ProgressStorage.getProgress();
    return APP_CONFIG.achievements.filter(a => a.check(progress));
  }

  // ---- Curriculum metadata (level / unit) ---------------------------
  // Purely additive: these read the optional level/unit fields sentences
  // may carry (see data.js) but never affect lesson/test generation or
  // unlocking above, which stay keyed on the flat `lesson` number alone.

  /** Units derived from whichever sentences actually carry a `.unit` field. */
  function getUnits(languageCode) {
    const sentences = sentencesFor(languageCode);
    const byUnit = new Map();
    sentences.forEach(s => {
      if (s.unit == null) return; // content without unit metadata is simply skipped
      if (!byUnit.has(s.unit)) byUnit.set(s.unit, { unit: s.unit, level: s.level, lessons: new Set(), sentenceIds: [] });
      const u = byUnit.get(s.unit);
      u.lessons.add(s.lesson);
      u.sentenceIds.push(s.id);
    });
    const unitNumbers = Array.from(byUnit.keys()).sort((a, b) => a - b);
    return unitNumbers.map(n => {
      const u = byUnit.get(n);
      const meta = (typeof UNITS !== 'undefined') ? UNITS.find(x => x.unit === n) : null;
      const lessonNumbers = Array.from(u.lessons).sort((a, b) => a - b);
      return {
        unit: n,
        name: (meta && meta.name) || `Unit ${n}`,
        level: u.level,
        lessonNumbers,
        sentenceIds: u.sentenceIds,
        isComplete: lessonNumbers.every(num => isLessonComplete(languageCode, num))
      };
    });
  }

  /** Per-level completion (lesson-count based), in LEVELS' display order when available. */
  function getLevelProgress(languageCode) {
    const lessons = getLessons(languageCode);
    const byLevel = new Map();
    lessons.forEach(lesson => {
      const level = lesson.sentences[0] && lesson.sentences[0].level;
      if (!level) return; // lessons without level metadata are simply excluded
      if (!byLevel.has(level)) byLevel.set(level, { total: 0, completed: 0 });
      const entry = byLevel.get(level);
      entry.total += 1;
      if (ProgressStorage.isLessonComplete(lesson.key)) entry.completed += 1;
    });
    const order = (typeof LEVELS !== 'undefined') ? LEVELS.map(l => l.code) : Array.from(byLevel.keys());
    return order.filter(code => byLevel.has(code)).map(code => {
      const e = byLevel.get(code);
      const meta = (typeof LEVELS !== 'undefined') ? LEVELS.find(l => l.code === code) : null;
      return {
        level: code,
        name: (meta && meta.name) || code,
        completedLessons: e.completed,
        totalLessons: e.total,
        percent: Utils.formatPercent(e.completed, e.total)
      };
    });
  }

  /** What level/unit is the user's next lesson in? (null once everything is complete.) */
  function getCurrentLevelAndUnit(languageCode) {
    const next = getNextLesson(languageCode);
    const reference = next ? next.sentences[0] : sentencesFor(languageCode).slice(-1)[0];
    if (!reference) return { level: null, unit: null, isComplete: !next };
    const unitMeta = (typeof UNITS !== 'undefined') ? UNITS.find(u => u.unit === reference.unit) : null;
    return {
      level: reference.level || null,
      unit: reference.unit || null,
      unitName: unitMeta ? unitMeta.name : null,
      isComplete: !next
    };
  }

  /**
   * Content-authoring aid (not a runtime gate): flags sentences whose
   * target text repeats an earlier one without being marked as an
   * intentional spaced-repetition review (`intentionalRepeat: true` on
   * the later entry). Call from a console when adding content; nothing
   * in the lesson/test flow calls this automatically.
   */
  function validateCurriculum(languageCode) {
    const sentences = sentencesFor(languageCode);
    const seenTargets = new Map();
    const duplicates = [];
    sentences.forEach(s => {
      const key = Utils.normalize(s.target);
      if (seenTargets.has(key) && !s.intentionalRepeat) {
        duplicates.push({ id: s.id, target: s.target, duplicateOfId: seenTargets.get(key) });
      } else if (!seenTargets.has(key)) {
        seenTargets.set(key, s.id);
      }
    });
    if (duplicates.length) {
      console.warn(`Curriculum check: ${duplicates.length} unintentional duplicate sentence(s)`, duplicates);
    } else {
      console.info('Curriculum check: no unintentional duplicate sentences found.');
    }
    return duplicates;
  }

  return {
    sentencesFor,
    getLessons,
    getLessonByNumber,
    isLessonUnlocked,
    isLessonComplete,
    getLessonProgress,
    getTestDefinitions,
    getTestById,
    isTestUnlocked,
    isTestComplete,
    getOverallProgress,
    getNextLesson,
    checkAchievements,
    lessonKey,
    getUnits,
    getLevelProgress,
    getCurrentLevelAndUnit,
    validateCurriculum
  };
})();
