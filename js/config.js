/**
 * config.js
 * -----------------------------------------------------------------------
 * Every rule that shapes the hierarchy (lesson size, when tests appear,
 * when cumulative tests appear, how a test is composed) lives here.
 * Nothing else in the codebase should hard-code numbers like "10" or "5" —
 * they all read from APP_CONFIG. Change a number here and the whole app
 * (lesson counts, test generation, unlock rules, progress math) adapts
 * automatically.
 * -----------------------------------------------------------------------
 */
const APP_CONFIG = {
  // How many sentences make up one lesson.
  sentencesPerLesson: 10,

  // How many lessons must be completed before a "section test" is generated.
  lessonsPerTest: 5,

  // After this many section tests, a cumulative test covering everything
  // learned so far is generated (2 -> cumulative after test 2, test 4, ...).
  testsPerCumulative: 2,

  // Feature flags — toggle whole subsystems without touching engine code.
  enableSpeaking: true,
  enableListening: true,
  enableReview: true,
  enableAchievements: true,

  // How a generated test's questions are distributed across question
  // types, as fractions of the total sentence count in that test.
  // Must sum to 1. Add a new key + a matching generator in testEngine.js
  // to introduce a new question type without touching this shape.
  testDistribution: {
    speaking: 0.3,
    multipleChoice: 0.15,
    reverseTranslation: 0.15,
    listening: 0.2,
    recall: 0.2
  },

  // Multiple-choice / listening / reverse-translation distractor count.
  distractorCount: 3,

  // Milliseconds the "correct" flip stays up before auto-advancing.
  correctRevealDelayMs: 1400,
  // Milliseconds an "incorrect" state is shown before listening resumes.
  incorrectRetryDelayMs: 900,
  // If the user says nothing at all for this long while a card is
  // listening, treat it like a missed attempt (reveal the answer and
  // move on) instead of waiting forever.
  silenceTimeoutMs: 5000,

  // Achievement thresholds (sentence-count based ones use SENTENCES.length
  // at unlock-check time, so they too scale with content automatically).
  achievements: [
    { id: 'first_lesson', label: 'First Lesson', check: (p) => p.completedLessons.length >= 1 },
    { id: 'ten_sentences', label: '10 Sentences', check: (p) => p.sentencesLearned >= 10 },
    { id: 'fifty_sentences', label: '50 Sentences', check: (p) => p.sentencesLearned >= 50 },
    { id: 'first_test', label: 'First Test', check: (p) => Object.keys(p.testResults).length >= 1 },
    { id: 'hundred_sentences', label: '100 Sentences', check: (p) => p.sentencesLearned >= 100 },
    { id: 'perfect_test', label: 'Perfect Test', check: (p) => Object.values(p.testResults).some(r => r.score === 100) },
    { id: 'week_streak', label: '7 Day Streak', check: (p) => p.streak >= 7 },
    { id: 'five_hundred_sentences', label: '500 Sentences', check: (p) => p.sentencesLearned >= 500 },
    { id: 'thousand_sentences', label: '1000 Sentences', check: (p) => p.sentencesLearned >= 1000 }
  ]
};

/**
 * Every language the app knows about. Adding a new language is adding one
 * object here (plus its sentences in data.js) — no other file changes.
 */
const LANGUAGES = [
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    speechRecognitionLocale: 'es-ES',
    ttsLocale: 'es-ES'
  }
  // Future: French, German, Italian, Turkish... just append here.
];

function getLanguageConfig(code) {
  return LANGUAGES.find(l => l.code === code) || LANGUAGES[0];
}
