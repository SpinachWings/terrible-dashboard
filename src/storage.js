import { SAMPLE_CSV } from './sampleData';

const STORAGE_KEY = 'terrible-dashboard:v1';

export const DEFAULT_SETTINGS = {
  csvText: SAMPLE_CSV,
  chartType: 'bar', // 'bar' | 'line' | 'pie'
  xColumn: null, // null = pick automatically
  yColumns: null, // null = pick automatically
  title: 'Monthly performance',
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or blocked (e.g. private mode) — the dashboard still works, it just won't persist.
  }
}
