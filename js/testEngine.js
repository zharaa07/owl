/**
 * testEngine.js
 * -----------------------------------------------------------------------
 * Turns a test definition (a list of sentence ids, from progressEngine)
 * into a shuffled list of question objects, mixed according to
 * APP_CONFIG.testDistribution. Adding a new question type = add a
 * generator to QuestionGenerators + a key in testDistribution. Nothing
 * else in the test flow needs to change.
 * -----------------------------------------------------------------------
 */
const QuestionGenerators = {
  speaking(sentence) {
    return { type: 'speaking', category: 'speaking', sentenceId: sentence.id, prompt: sentence.english, answers: sentence.answers, target: sentence.target };
  },
  recall(sentence) {
    return { type: 'recall', category: 'speaking', sentenceId: sentence.id, prompt: sentence.english, answers: sentence.answers, target: sentence.target };
  },
  multipleChoice(sentence, pool) {
    const distractors = Utils.pickRandom(pool.filter(s => s.id !== sentence.id), APP_CONFIG.distractorCount).map(s => s.target);
    const options = Utils.shuffle([sentence.target, ...distractors]);
    return { type: 'multipleChoice', category: 'translation', sentenceId: sentence.id, prompt: sentence.english, options, correct: sentence.target };
  },
  reverseTranslation(sentence, pool) {
    const distractors = Utils.pickRandom(pool.filter(s => s.id !== sentence.id), APP_CONFIG.distractorCount).map(s => s.english);
    const options = Utils.shuffle([sentence.english, ...distractors]);
    return { type: 'reverseTranslation', category: 'translation', sentenceId: sentence.id, prompt: sentence.target, options, correct: sentence.english };
  },
  listening(sentence, pool) {
    const distractors = Utils.pickRandom(pool.filter(s => s.id !== sentence.id), APP_CONFIG.distractorCount).map(s => s.english);
    const options = Utils.shuffle([sentence.english, ...distractors]);
    return { type: 'listening', category: 'listening', sentenceId: sentence.id, audioText: sentence.target, options, correct: sentence.english };
  }
};

const TestEngine = (function () {

  function computeCounts(distribution, total) {
    const types = Object.keys(distribution);
    const counts = {};
    let assigned = 0;
    types.forEach((type, i) => {
      if (i === types.length - 1) {
        counts[type] = total - assigned; // last type absorbs rounding remainder
      } else {
        const c = Math.round(distribution[type] * total);
        counts[type] = c;
        assigned += c;
      }
    });
    return counts;
  }

  /** Builds a full question list for a test definition (see progressEngine.getTestDefinitions). */
  function generate(testDef, languageCode) {
    const allSentences = ProgressEngine.sentencesFor(languageCode);
    const pool = allSentences.filter(s => testDef.sentenceIds.includes(s.id));
    const total = pool.length;
    const shuffledPool = Utils.shuffle(pool);

    const distribution = Object.assign({}, APP_CONFIG.testDistribution);
    if (!APP_CONFIG.enableListening) { distribution.multipleChoice += distribution.listening; distribution.listening = 0; }
    if (!APP_CONFIG.enableSpeaking) {
      // Speaking AND recall both need the microphone — reroute both shares
      // into the text-based question types so an unsupported browser still
      // gets a full, fair test instead of a mid-test dead end.
      distribution.multipleChoice += distribution.speaking / 2 + distribution.recall / 2;
      distribution.reverseTranslation = (distribution.reverseTranslation || 0) + distribution.speaking / 2 + distribution.recall / 2;
      distribution.speaking = 0;
      distribution.recall = 0;
    }

    const counts = computeCounts(distribution, total);
    const questions = [];
    let cursor = 0;
    Object.keys(counts).forEach(type => {
      const generator = QuestionGenerators[type];
      if (!generator) return;
      for (let i = 0; i < counts[type]; i++) {
        const sentence = shuffledPool[cursor % shuffledPool.length];
        cursor++;
        questions.push(generator(sentence, pool));
      }
    });
    return Utils.shuffle(questions);
  }

  /** Grades one answered question. `response` shape depends on type (string for speaking/recall, chosen option for MC/listening). */
  function grade(question, response) {
    if (question.type === 'speaking' || question.type === 'recall') {
      return Utils.matchesAnswer(response, question.answers);
    }
    return Utils.normalize(response) === Utils.normalize(question.correct);
  }

  /** Aggregate a finished test's answer log into a result object for storage + the results screen. */
  function summarize(answeredQuestions) {
    const total = answeredQuestions.length;
    const correct = answeredQuestions.filter(a => a.wasCorrect).length;
    const categories = {};
    answeredQuestions.forEach(a => {
      if (!categories[a.category]) categories[a.category] = { correct: 0, total: 0 };
      categories[a.category].total += 1;
      if (a.wasCorrect) categories[a.category].correct += 1;
    });
    const categoryScores = {};
    Object.keys(categories).forEach(cat => {
      categoryScores[cat] = Utils.formatPercent(categories[cat].correct, categories[cat].total);
    });

    const mistakes = [...new Set(answeredQuestions.filter(a => !a.wasCorrect).map(a => a.sentenceId))];
    const correctSentenceIds = [...new Set(answeredQuestions.filter(a => a.wasCorrect).map(a => a.sentenceId))];

    return {
      score: Utils.formatPercent(correct, total),
      correctCount: correct,
      totalCount: total,
      categoryScores,
      mistakes,
      correctSentenceIds
    };
  }

  return { generate, grade, summarize };
})();
