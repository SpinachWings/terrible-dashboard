// Colour configuration: a theme (surface colours) and a palette (chart series colours) are chosen independently.

// `base` decides palette adjustments; `chart` is the Highcharts chrome. Surface colours live in App.css under [data-theme].
export const THEMES = [
  { id: 'light', label: 'Light', base: 'light', chart: { text: '#1d2330', muted: '#6b7280', grid: '#e5e7eb', line: '#c3c9d3', bg: '#ffffff' } },
  { id: 'dark', label: 'Dark', base: 'dark', chart: { text: '#e6e9ef', muted: '#a3abb9', grid: '#323a4a', line: '#4a5468', bg: '#1b2130' } },
  { id: 'sepia', label: 'Sepia', base: 'light', chart: { text: '#3b2f23', muted: '#7a6a58', grid: '#e6dac8', line: '#cdbca4', bg: '#fbf3e4' } },
  { id: 'midnight', label: 'Midnight', base: 'dark', chart: { text: '#dbe4ff', muted: '#98a8d6', grid: '#26305a', line: '#3a4880', bg: '#121a3a' } },
  { id: 'forest', label: 'Forest', base: 'dark', chart: { text: '#e2efe4', muted: '#9bb5a0', grid: '#2a3d2f', line: '#41594a', bg: '#18261d' } },
];

// Selectable options in the menu: the concrete themes plus "Match system".
export const THEME_OPTIONS = [...THEMES, { id: 'system', label: 'Match system' }];

const themeById = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0];

export const PALETTES = [
  {
    id: 'default',
    label: 'Default',
    colors: ['#2f6fde', '#e8743b', '#19a979', '#945ecf', '#e6b422', '#13a4b4', '#d6455d', '#6b7280'],
  },
  {
    // Okabe-Ito: distinguishable with deuteranopia, protanopia and tritanopia.
    id: 'colourblind',
    label: 'Colourblind-safe (Okabe-Ito)',
    colors: ['#0072b2', '#e69f00', '#009e73', '#cc79a7', '#56b4e9', '#d55e00', '#f0e442', '#999999'],
  },
  {
    // Blues and oranges only, avoiding red-green confusion.
    id: 'blueOrange',
    label: 'Blue / orange (red-green safe)',
    colors: ['#1f4e9e', '#f28e2b', '#7aa6dc', '#a65a00', '#4d4d4d', '#b3b3b3', '#0b2a5b', '#ffc27a'],
  },
  {
    id: 'highContrast',
    label: 'High contrast',
    colors: ['#0000ff', '#ff8000', '#000000', '#00a000', '#d000d0', '#c00000', '#808080', '#00a0c0'],
  },
];

// On dark surfaces, lift the colours that would otherwise vanish into the background.
const HIGH_CONTRAST_DARK = { '#000000': '#ffffff', '#0000ff': '#6c8cff', '#c00000': '#ff5050' };

export const DEFAULT_COLOUR_SETTINGS = { theme: 'system', palette: 'default' };

export function resolveTheme(theme, systemDark) {
  if (theme === 'system') return systemDark ? 'dark' : 'light';
  return themeById(theme).id;
}

export function paletteColors(paletteId, resolvedTheme) {
  const p = PALETTES.find((x) => x.id === paletteId) ?? PALETTES[0];
  if (p.id === 'highContrast' && themeById(resolvedTheme).base === 'dark') {
    return p.colors.map((c) => HIGH_CONTRAST_DARK[c] ?? c);
  }
  return p.colors;
}

export function highchartsColourOptions(paletteId, resolvedTheme) {
  const t = themeById(resolvedTheme).chart;
  const axis = {
    gridLineColor: t.grid,
    lineColor: t.line,
    tickColor: t.line,
    labels: { style: { color: t.muted } },
    title: { style: { color: t.muted } },
  };
  return {
    colors: paletteColors(paletteId, resolvedTheme),
    chart: { backgroundColor: 'transparent', style: { color: t.text } },
    title: { style: { color: t.text } },
    xAxis: axis,
    yAxis: axis,
    legend: { itemStyle: { color: t.text }, itemHoverStyle: { color: t.text } },
    tooltip: { backgroundColor: t.bg, style: { color: t.text }, borderColor: t.line },
    plotOptions: {
      series: { borderColor: t.bg },
      pie: { borderColor: t.bg, dataLabels: { style: { color: t.text, textOutline: 'none' } } },
    },
  };
}
