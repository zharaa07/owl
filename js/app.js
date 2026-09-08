(function () {
  const languageCode = Utils.qs('lang') || LANGUAGES[0].code;
  const lang = getLanguageConfig(languageCode);

  function renderHeader() {
    document.getElementById('lang-flag').textContent = lang.flag;
    document.getElementById('lang-name').textContent = lang.name;
    document.getElementById('lang-native').textContent = lang.nativeName;
    document.title = `Lingua Trail — Learn ${lang.name} by Speaking`;
  }

  function renderStats() {
    const p = ProgressEngine.getOverallProgress(languageCode);
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (p.overallPercent / 100) * circumference;
    document.getElementById('ring-fill').setAttribute('stroke-dasharray', circumference.toFixed(1));
    document.getElementById('ring-fill').setAttribute('stroke-dashoffset', offset.toFixed(1));
    document.getElementById('ring-percent').textContent = `${p.overallPercent}%`;

    document.getElementById('stat-lessons').textContent = p.completedLessonsCount;
    document.getElementById('stat-lessons-label').textContent = `of ${p.totalLessons} lessons`;
    document.getElementById('stat-sentences').textContent = p.sentencesLearned;
    document.getElementById('stat-sentences-label').textContent = `of ${p.totalSentences} sentences`;
    document.getElementById('stat-accuracy').textContent = `${p.accuracy}%`;
    document.getElementById('stat-speaking').textContent = `${p.speakingAccuracy}%`;

    if (p.streak > 0) {
      document.getElementById('streak-chip').hidden = false;
      document.getElementById('streak-count').textContent = p.streak;
    }
  }

  function renderContinueCta() {
    const cta = document.getElementById('continue-cta');
    const next = ProgressEngine.getNextLesson(languageCode);
    if (next) {
      document.getElementById('continue-title').textContent =
        ProgressStorage.getProgress().completedLessons.length ? 'Continue learning' : 'Start learning';
      document.getElementById('continue-sub').textContent = `${next.title} · ${next.sentences.length} sentences`;
      cta.href = `lesson.html?lang=${languageCode}&lesson=${next.number}`;
    } else {
      document.getElementById('continue-title').textContent = 'All lessons complete';
      document.getElementById('continue-sub').textContent = 'Check the trail below for open tests';
      cta.href = '#trail';
    }
  }

  function buildTrailItems() {
    const lessons = ProgressEngine.getLessons(languageCode);
    const tests = ProgressEngine.getTestDefinitions(languageCode);
    const perTest = APP_CONFIG.lessonsPerTest;
    const items = [];
    let i = 0;
    let level = 1;
    while (i < lessons.length) {
      items.push({ kind: 'level-label', level });
      const block = lessons.slice(i, i + perTest);
      block.forEach(l => items.push({ kind: 'lesson', lesson: l }));
      i += perTest;
      if (block.length === perTest) {
        const sectionTest = tests.find(t => t.type === 'section' && t.index === level);
        if (sectionTest) items.push({ kind: 'test', test: sectionTest });
        const lastLessonNum = block[block.length - 1].number;
        const cumulative = tests.find(t => t.type === 'cumulative' && t.lessonRange[1] === lastLessonNum);
        if (cumulative) items.push({ kind: 'test', test: cumulative });
      }
      level++;
    }
    return items;
  }

  function lessonNodeHtml(lesson) {
    const complete = ProgressEngine.isLessonComplete(languageCode, lesson.number);
    const unlocked = ProgressEngine.isLessonUnlocked(languageCode, lesson.number);
    const isCurrent = !complete && unlocked;
    const stateClass = complete ? 'is-complete' : (unlocked ? (isCurrent ? 'is-current' : '') : 'is-locked');
    const href = unlocked ? `lesson.html?lang=${languageCode}&lesson=${lesson.number}` : '#';
    return `
      <a class="trail-node ${stateClass}" href="${href}">
        <div class="node-card">
          <div>
            <span class="node-title">${lesson.title}</span>
            <span class="node-sub">${lesson.sentences.length} sentences</span>
          </div>
          <span class="node-status">${complete ? '✓' : (unlocked ? '' : '🔒')}</span>
        </div>
      </a>`;
  }

  function testNodeHtml(test) {
    const complete = ProgressEngine.isTestComplete(test.id);
    const unlocked = ProgressEngine.isTestUnlocked(languageCode, test);
    const stateClass = `is-test ${complete ? 'is-complete' : (unlocked ? 'is-current' : 'is-locked')}`;
    const href = unlocked ? `test.html?lang=${languageCode}&test=${test.id}` : '#';
    const label = test.type === 'cumulative'
      ? `Cumulative Test · Lessons ${test.lessonRange[0]}–${test.lessonRange[1]}`
      : `Test ${test.index} · Lessons ${test.lessonRange[0]}–${test.lessonRange[1]}`;
    return `
      <a class="trail-node ${stateClass}" href="${href}">
        <div class="node-card">
          <div>
            <span class="node-title">${label}</span>
            <span class="node-sub">${test.sentenceIds.length} sentences</span>
          </div>
          <span class="node-status">${complete ? '✓' : (unlocked ? '🔓' : '🔒')}</span>
        </div>
      </a>`;
  }

  function renderTrail() {
    const items = buildTrailItems();
    const html = items.map(item => {
      if (item.kind === 'level-label') return `<div class="trail-level-label">Level ${item.level}</div>`;
      if (item.kind === 'lesson') return lessonNodeHtml(item.lesson);
      return testNodeHtml(item.test);
    }).join('');
    document.getElementById('trail').innerHTML = html;
  }

  // ---- Level badge + per-level progress bars ----
  // Purely additive to the dashboard; reads only the new curriculum
  // metadata (level/unit) and does nothing if content doesn't carry it.
  function renderLevelBadge() {
    const badge = document.getElementById('level-badge');
    const current = ProgressEngine.getCurrentLevelAndUnit(languageCode);
    if (!current.level) { badge.hidden = true; return; }
    document.getElementById('level-code').textContent = current.level;
    document.getElementById('level-unit-name').textContent =
      current.isComplete ? 'All units complete' : (current.unitName || '');
  }

  function renderLevelProgress() {
    const section = document.getElementById('level-progress-section');
    const levels = ProgressEngine.getLevelProgress(languageCode);
    if (!levels.length) { section.hidden = true; return; }
    section.innerHTML = levels.map(l => `
      <div class="lesson-progress" style="margin-bottom:var(--space-3)">
        <span class="count" style="width:2.4em;flex:none">${l.level}</span>
        <div class="bar"><span style="width:${l.percent}%"></span></div>
        <span class="count">${l.percent}%</span>
      </div>`).join('');
  }

  renderHeader();
  renderStats();
  renderLevelBadge();
  renderLevelProgress();
  renderContinueCta();
  renderTrail();
})();
