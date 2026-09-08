/**
 * utils.js — small, dependency-free helpers used across every engine.
 */
const Utils = {
  /**
   * Normalize text before comparing spoken/typed input to an answer key:
   * lowercase, strip accents, drop punctuation, collapse whitespace.
   * This is what lets "¿Cómo estás?" match "como estas".
   */
  normalize(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
      .replace(/[¿?¡!.,;:"'`]/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  },

  /**
   * True if `spoken` matches any accepted answer. Two layers:
   *  1. Exact match after normalization (accents/punctuation/case-insensitive)
   *     — the primary, always-trusted path, unaffected by confidence.
   *  2. A fuzzy fallback for small Speech-Recognition slips (a dropped
   *     letter, a homophone spelling) that only kicks in when nothing
   *     matched exactly. `confidence` (0–1, from the recognition result,
   *     if the browser provides one) acts as a light corroborating
   *     signal on that fallback only: a near-miss paired with a very low
   *     reported confidence is rejected, but a missing/zero confidence
   *     (common on several browsers/langs) never blocks it — recognition
   *     confidence reporting is too inconsistent across browsers to gate
   *     on by itself.
   */
  matchesAnswer(spoken, answers, confidence) {
    const n = this.normalize(spoken);
    if (!n) return false;
    if (answers.some(a => this.normalize(a) === n)) return true;

    const hasUsableConfidence = typeof confidence === 'number' && confidence > 0;
    if (hasUsableConfidence && confidence < 0.5) return false;

    const threshold = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.fuzzyMatchThreshold) || 0.88;
    return answers.some(a => this.similarity(n, this.normalize(a)) >= threshold);
  },

  /** Normalized similarity ratio in [0,1]; 1 = identical strings. */
  similarity(a, b) {
    if (a === b) return 1;
    if (!a.length || !b.length) return 0;
    const distance = this.levenshtein(a, b);
    return 1 - distance / Math.max(a.length, b.length);
  },

  /** Classic edit-distance (single-row rolling array — fine for sentence-length strings). */
  levenshtein(a, b) {
    let prevRow = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const row = [i];
      for (let j = 1; j <= b.length; j++) {
        row[j] = a[i - 1] === b[j - 1]
          ? prevRow[j - 1]
          : 1 + Math.min(prevRow[j - 1], prevRow[j], row[j - 1]);
      }
      prevRow = row;
    }
    return prevRow[b.length];
  },

  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  pickRandom(arr, n) {
    return this.shuffle(arr).slice(0, Math.min(n, arr.length));
  },

  clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  },

  qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  },

  formatPercent(part, total) {
    if (!total) return 0;
    return Math.round((part / total) * 100);
  }
};
