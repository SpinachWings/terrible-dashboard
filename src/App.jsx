import { useEffect, useMemo, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { parseCsv } from './csv';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './storage';
import { PALETTES, THEMES, highchartsColourOptions, resolveTheme } from './colours';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function useSystemDark() {
  const [dark, setDark] = useState(() => window.matchMedia?.(DARK_QUERY).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(DARK_QUERY);
    if (!mq) return undefined;
    const onChange = (e) => setDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return dark;
}

const CHART_TYPES = [
  { id: 'bar', label: 'Bar' },
  { id: 'line', label: 'Line' },
  { id: 'pie', label: 'Pie' },
];

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const { csvText, chartType, xColumn, yColumns, title, theme, palette } = settings;
  const [menuOpen, setMenuOpen] = useState(false);
  const systemDark = useSystemDark();
  const resolvedTheme = resolveTheme(theme, systemDark);

  // Apply the theme dashboard-wide via a data attribute read by the CSS variables.
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  // Persist every change to localStorage.
  useEffect(() => saveSettings(settings), [settings]);

  const update = (patch) => setSettings((s) => ({ ...s, ...patch }));

  const { columns, rows, numericColumns, error } = useMemo(() => parseCsv(csvText), [csvText]);

  // Category (x-axis / slice label) column: saved choice if still valid, else first non-numeric column.
  const xCol = columns.includes(xColumn)
    ? xColumn
    : columns.find((c) => !numericColumns.includes(c)) ?? columns[0];

  const valueOptions = numericColumns.filter((c) => c !== xCol);
  const yCols =
    yColumns === null ? valueOptions : yColumns.filter((c) => valueOptions.includes(c));

  const toggleY = (col) => {
    const next = yCols.includes(col) ? yCols.filter((c) => c !== col) : [...yCols, col];
    update({ yColumns: valueOptions.filter((c) => next.includes(c)) }); // keep column order
  };

  const loadText = (text) => update({ csvText: text, xColumn: null, yColumns: null });

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadText(await file.text());
    e.target.value = ''; // allow re-uploading the same file
  };

  const options = useMemo(() => {
    const label = (r) => String(r[xCol] ?? '');
    const series =
      chartType === 'pie'
        ? yCols.slice(0, 1).map((col) => ({
            type: 'pie',
            name: col,
            data: rows.map((r) => ({ name: label(r), y: Number(r[col]) || 0 })),
          }))
        : yCols.map((col) => ({
            // Highcharts calls vertical bars "column"; its "bar" type is horizontal.
            type: chartType === 'bar' ? 'column' : 'line',
            name: col,
            data: rows.map((r) => (typeof r[col] === 'number' ? r[col] : null)),
          }));

    const colour = highchartsColourOptions(palette, resolvedTheme);
    return {
      colors: colour.colors,
      chart: { ...colour.chart, height: 480, style: { ...colour.chart.style, fontFamily: 'inherit' } },
      title: { ...colour.title, text: title || null },
      credits: { enabled: false },
      xAxis: { ...colour.xAxis, categories: rows.map(label), title: { ...colour.xAxis.title, text: xCol } },
      yAxis: { ...colour.yAxis, title: { ...colour.yAxis.title, text: null } },
      legend: colour.legend,
      tooltip: { ...colour.tooltip, shared: chartType !== 'pie' },
      plotOptions: {
        series: colour.plotOptions.series,
        pie: {
          ...colour.plotOptions.pie,
          allowPointSelect: true,
          dataLabels: {
            ...colour.plotOptions.pie.dataLabels,
            enabled: true,
            format: '{point.name}: {point.percentage:.1f}%',
          },
        },
      },
      series,
    };
  }, [rows, xCol, yCols.join('|'), chartType, title, palette, resolvedTheme]);

  const hasChart = rows.length > 0 && yCols.length > 0;

  return (
    <div className="app">
      <header className="header">
        <h1>Terrible Dashboard</h1>
        <span className="muted">Saved automatically in this browser</span>
        <div className="settings-menu">
          <button
            className="settings-btn"
            aria-expanded={menuOpen}
            aria-controls="settings-popover"
            onClick={() => setMenuOpen((o) => !o)}
          >
            ⚙ Settings
          </button>
          {menuOpen && (
            <div id="settings-popover" className="popover" role="dialog" aria-label="Colour settings">
              <h2>Theme</h2>
              <div className="segmented" role="radiogroup" aria-label="Theme">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={theme === t.id}
                    className={theme === t.id ? 'active' : ''}
                    onClick={() => update({ theme: t.id })}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <h2>Chart colours</h2>
              <div role="radiogroup" aria-label="Chart colour palette">
                {PALETTES.map((p) => (
                  <label key={p.id} className="check palette-option">
                    <input
                      type="radio"
                      name="palette"
                      checked={palette === p.id}
                      onChange={() => update({ palette: p.id })}
                    />
                    <span>{p.label}</span>
                    <span className="swatches" aria-hidden="true">
                      {p.colors.slice(0, 5).map((c) => (
                        <i key={c} style={{ background: c }} />
                      ))}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="layout">
        <aside className="panel">
          <section>
            <h2>Data</h2>
            <label className="file-btn">
              Upload CSV…
              <input type="file" accept=".csv,text/csv" onChange={onFile} hidden />
            </label>
            <textarea
              value={csvText}
              onChange={(e) => loadText(e.target.value)}
              spellCheck={false}
              rows={12}
              aria-label="CSV data"
            />
            <div className="row">
              <span className="muted">
                {rows.length} rows · {columns.length} columns
              </span>
              <button className="link" onClick={() => setSettings((s) => ({ ...DEFAULT_SETTINGS, theme: s.theme, palette: s.palette }))}>
                Reset to sample
              </button>
            </div>
            {error && <p className="error">CSV warning: {error}</p>}
          </section>

          <section>
            <h2>Chart</h2>
            <div className="segmented" role="radiogroup" aria-label="Chart type">
              {CHART_TYPES.map((t) => (
                <button
                  key={t.id}
                  role="radio"
                  aria-checked={chartType === t.id}
                  className={chartType === t.id ? 'active' : ''}
                  onClick={() => update({ chartType: t.id })}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <label className="field">
              Title
              <input value={title} onChange={(e) => update({ title: e.target.value })} />
            </label>

            <label className="field">
              {chartType === 'pie' ? 'Slice labels' : 'X-axis (categories)'}
              <select
                value={xCol ?? ''}
                onChange={(e) => update({ xColumn: e.target.value, yColumns: null })}
              >
                {columns.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>

            <fieldset className="field">
              <legend>Values</legend>
              {valueOptions.length === 0 && <p className="muted">No numeric columns found.</p>}
              {valueOptions.map((c) => (
                <label key={c} className="check">
                  <input type="checkbox" checked={yCols.includes(c)} onChange={() => toggleY(c)} />
                  {c}
                </label>
              ))}
              {chartType === 'pie' && yCols.length > 1 && (
                <p className="muted">Pie charts show the first selected column ({yCols[0]}).</p>
              )}
            </fieldset>
          </section>
        </aside>

        <main className="chart-card">
          {hasChart ? (
            <HighchartsReact key={chartType} highcharts={Highcharts} options={options} />
          ) : (
            <p className="empty">
              {rows.length === 0
                ? 'Paste or upload a CSV with a header row to get started.'
                : 'Select at least one value column to plot.'}
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
