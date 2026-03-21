// =============================================================================
// Shared Utilities
// =============================================================================
// Common formatting, cloning, and helper functions used across all views.
// =============================================================================

const Utils = {

  /**
   * Format a number in compact form: 1234567 → "1.2M", 45000 → "45k", 999 → "999".
   */
  fmtK(n) {
    const abs = Math.abs(n);
    if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return (n / 1e3).toFixed(0) + 'k';
    return Math.round(n).toString();
  },

  /**
   * Format a number with locale separators: 1234567 → "1,234,567".
   */
  fmtNum(n) {
    return Math.round(n).toLocaleString();
  },

  /**
   * Format a gold value: 1234567 → "1,234,567 gc".
   */
  fmtGc(n) {
    return Math.round(n).toLocaleString() + ' gc';
  },

  /**
   * Format a percentage: 24.5 → "24.5%".
   */
  fmtPct(n) {
    return n.toFixed(1) + '%';
  },

  /**
   * Deep clone a plain object (no functions, no circular refs).
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },
};
