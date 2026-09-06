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

  /** True if `spoken` matches any accepted answer, after normalization. */
  matchesAnswer(spoken, answers) {
    const n = this.normalize(spoken);
    if (!n) return false;
    return answers.some(a => this.normalize(a) === n);
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
