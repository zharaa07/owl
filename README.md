# Lingua Trail

A speaking-first, hierarchical language-learning app: sentence cards with
continuous voice recognition, auto-generated cumulative tests, and a
progress system built so content grows without touching code.

Open `index.html` directly in a browser (Chrome or Edge recommended for
speech recognition). No build step, no server, no dependencies.

## How it's structured

```
index.html        Dashboard: stats + the lesson/test trail
lesson.html        One lesson: sentence cards + continuous mic
test.html          A generated test + results + mistake retrain

css/
  variables.css     Design tokens (color, type, spacing)
  base.css          Resets
  components.css    Every UI component
  responsive.css    Mobile tweaks

js/
  config.js         APP_CONFIG (the rules) + LANGUAGES (the language list)
  data.js           SENTENCES — the only file content editors touch
  utils.js          Text normalization, shuffle, small helpers
  storage.js        localStorage wrapper — swap for a real backend later
  progressEngine.js Derives lessons/tests/unlocks/progress from data.js
  speechEngine.js   Web Speech API wrapper (recognition + TTS)
  lessonEngine.js   Lesson state machine
  testEngine.js     Question generation + grading
  app.js            Dashboard page logic
  lessonPage.js     Lesson page logic
  testPage.js       Test page logic
```

## Adding content (the only thing you should ever need to do)

Add sentences to `js/data.js`:

```js
{ id: 51, languageCode: 'es', lesson: 6, target: 'Hola', pronunciation: 'أولا', english: 'Hello', answers: ['Hola'] }
```

- A new `lesson` number automatically becomes a new lesson.
- Once a full block of `APP_CONFIG.lessonsPerTest` lessons exists, a
  section test is generated for it automatically.
- Every `APP_CONFIG.testsPerCumulative` section tests, a cumulative test
  covering everything so far is generated automatically.
- The dashboard's percentages, the trail, and unlock rules all recompute
  from the new data with no other changes.

Nothing in `lessonEngine.js`, `testEngine.js`, or the UI ever references a
specific lesson or sentence number — they only read counts and rules from
`config.js` and iterate over whatever is in `data.js`.

## Adding a language

Add one entry to `LANGUAGES` in `js/config.js`:

```js
{ code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷',
  speechRecognitionLocale: 'fr-FR', ttsLocale: 'fr-FR' }
```

Then add sentences with `languageCode: 'fr'` in `data.js`. Every page
accepts `?lang=fr` and the whole app — lessons, tests, dashboard, speech
locale — follows.

## Tuning the system

Everything that shapes the hierarchy lives in `APP_CONFIG`
(`js/config.js`):

```js
sentencesPerLesson: 10,   // informational; lessons are actually sized by data.js grouping
lessonsPerTest: 5,        // lessons per section test
testsPerCumulative: 2,    // section tests between cumulative tests
testDistribution: {       // question-type mix per generated test
  speaking: 0.3, multipleChoice: 0.15, reverseTranslation: 0.15,
  listening: 0.2, recall: 0.2
}
```

Change `lessonsPerTest` to `10` and every future test regenerates at the
new size — no code changes.

## Adding a new question type

1. Add a generator function to `QuestionGenerators` in `testEngine.js`
   (it receives a sentence and the sentence pool, returns a question object).
2. Add a key + fraction to `APP_CONFIG.testDistribution`.
3. Add a case for the new `type` in `testPage.js`'s `renderQuestion()`.

The test generator, scoring, and category breakdown all pick it up
automatically.

## Data model notes

- Sentence state (`new → learning → learned → review → mastered`) is
  tracked per sentence in `ProgressStorage` and is ready for spaced
  repetition later — the state machine exists but nothing schedules
  reviews yet by design (see spec).
- Swap `storage.js`'s internals for Firebase/Supabase/a real API and
  nothing else in the app needs to change — every other file only calls
  `ProgressStorage.*`.
