import { SAMPLE_CSV } from './sampleData';
import { DEFAULT_COLOUR_SETTINGS } from './colours';

const STORAGE_KEY = 'terrible-dashboard:v1';

let counter = 1;
export const newChart = (patch = {}) => ({
  id: `c${Date.now().toString(36)}${counter++}`,
  chartType: 'bar', // 'bar' | 'line' | 'pie'
  xColumn: null, // null = pick automatically
  yColumns: null, // null = pick automatically
  title: '',
  ...patch,
});

export const DEFAULT_SETTINGS = {
  csvText: SAMPLE_CSV,
  charts: [newChart({ id: 'c0', title: 'Monthly performance' })],
  selectedId: 'c0',
  ...DEFAULT_COLOUR_SETTINGS, // theme + palette, dashboard-wide
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const saved = JSON.parse(raw);
    // Older versions stored a single chart's settings at the top level.
    if (!Array.isArray(saved.charts)) {
      const { csvText, theme, palette, ...chart } = saved;
      return {
        csvText: csvText ?? SAMPLE_CSV,
        charts: [newChart({ ...chart, id: 'c0' })],
        selectedId: 'c0',
        theme: theme ?? DEFAULT_SETTINGS.theme,
        palette: palette ?? DEFAULT_SETTINGS.palette,
      };
    }
    if (saved.charts.length === 0) return DEFAULT_SETTINGS;
    const selectedId = saved.charts.some((c) => c.id === saved.selectedId)
      ? saved.selectedId
      : saved.charts[0].id;
    return { ...DEFAULT_SETTINGS, ...saved, selectedId };
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
