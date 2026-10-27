import { useEffect, useMemo, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { downloadCsv, parseCsv, toCsv } from './csv';
import { DEFAULT_SETTINGS, loadSettings, newChart, saveSettings } from './storage';
import { PALETTES, THEME_OPTIONS, highchartsColourOptions, resolveTheme } from './colours';

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

// Resolve a chart's saved column choices against the current data.
function resolveColumns(chart, { columns, numericColumns }) {
  // Category (x-axis / slice label) column: saved choice if still valid, else first non-numeric column.
  const xCol = columns.includes(chart.xColumn)
    ? chart.xColumn
    : columns.find((c) => !numericColumns.includes(c)) ?? columns[0];
  const valueOptions = numericColumns.filter((c) => c !== xCol);
  const yCols =
    chart.yColumns === null ? valueOptions : chart.yColumns.filter((c) => valueOptions.includes(c));
  return { xCol, valueOptions, yCols };
}

function CsvIcon() {
  return (
    <svg className="menu-icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="csv-sheet" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4facfe" />
          <stop offset="1" stopColor="#7b61ff" />
        </linearGradient>
      </defs>
      <path d="M5 2h9l5 5v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="url(#csv-sheet)" />
      <path d="M14 2l5 5h-4a1 1 0 0 1-1-1z" fill="#fff" opacity="0.55" />
      <path d="M6 9h7M6 11.5h7" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
      <circle cx="16.5" cy="17.5" r="5.5" fill="#2ecc71" stroke="#fff" strokeWidth="1.2" />
      <path d="M16.5 14.8v5M14.3 18l2.2 2.3 2.2-2.3" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function chartCardClassName({ selected, dragging, over }) {
  return ['chart-card', selected && 'selected', dragging && 'dragging', over && 'drop-target']
    .filter(Boolean)
    .join(' ');
}

function ChartPanel({ chart, data, height, palette, resolvedTheme, selected, canRemove, reorder, onSelect, onRemove }) {
  const { rows } = data;
  const { chartType, title } = chart;
  const { xCol, yCols } = resolveColumns(chart, data);

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
      chart: { ...colour.chart, style: { ...colour.chart.style, fontFamily: 'inherit' } },
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const withHeight = (h) => ({ ...options, chart: { ...options.chart, height: h } });

  const exportCsv = () => {
    const cols = [xCol, ...(chartType === 'pie' ? yCols.slice(0, 1) : yCols)];
    const name = (title || 'chart').trim().replace(/[^\w.-]+/g, '_') || 'chart';
    downloadCsv(`${name}.csv`, toCsv(cols, rows));
    setMenuOpen(false);
  };

  useEffect(() => {
    if (!fullscreen && !menuOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setFullscreen(false);
      setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen, menuOpen]);

  return (
    <section
      className={chartCardClassName({ selected, dragging: reorder.dragging, over: reorder.over })}
      onClick={onSelect}
      onDragOver={reorder.onDragOver}
      onDrop={reorder.onDrop}
    >
      {canRemove && (
        <span
          className="drag-handle"
          draggable
          role="button"
          aria-label="Drag to reorder chart"
          title="Drag to reorder"
          onDragStart={reorder.onDragStart}
          onDragEnd={reorder.onDragEnd}
          onClick={(e) => e.stopPropagation()}
        >
          ⠿
        </span>
      )}
      <div className="chart-menu">
        <button
          className="chart-menu-btn"
          aria-label="Chart options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="Chart options"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
        >
          ⋯
        </button>
        {menuOpen && (
          <>
            <div
              className="chart-menu-backdrop"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
              }}
            />
            <div className="chart-menu-list" role="menu">
              <button
                role="menuitem"
                disabled={!hasChart}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  setFullscreen(true);
                }}
              >
                View fullscreen
              </button>
              <button
                role="menuitem"
                disabled={!hasChart}
                onClick={(e) => {
                  e.stopPropagation();
                  exportCsv();
                }}
              >
                <CsvIcon />
                Download as CSV
              </button>
              {canRemove && (
                <button
                  role="menuitem"
                  className="danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onRemove();
                  }}
                >
                  Remove chart
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {hasChart ? (
        <HighchartsReact key={chartType} highcharts={Highcharts} options={withHeight(height)} />
      ) : (
        <p className="empty">
          {rows.length === 0
            ? 'Paste or upload a CSV with a header row to get started.'
            : 'Select at least one value column to plot.'}
        </p>
      )}
      {fullscreen && hasChart && (
        <div
          className="fullscreen-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={title || 'Chart'}
          onClick={(e) => {
            e.stopPropagation();
            setFullscreen(false);
          }}
        >
          <div className="fullscreen-card" onClick={(e) => e.stopPropagation()}>
            <button
              className="fullscreen-close"
              aria-label="Exit fullscreen"
              title="Exit fullscreen"
              onClick={() => setFullscreen(false)}
            >
              ×
            </button>
            <HighchartsReact
              key={chartType}
              highcharts={Highcharts}
              options={withHeight(Math.max(300, window.innerHeight - 120))}
            />
          </div>
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const { csvText, charts, selectedId, theme, palette } = settings;
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

  const data = useMemo(() => parseCsv(csvText), [csvText]);
  const { columns, rows, error } = data;

  const selected = charts.find((c) => c.id === selectedId) ?? charts[0];
  const { chartType, title } = selected;
  const { xCol, valueOptions, yCols } = resolveColumns(selected, data);

  const select = (id) => setSettings((s) => ({ ...s, selectedId: id }));

  const updateSelected = (patch) =>
    setSettings((s) => ({
      ...s,
      charts: s.charts.map((c) => (c.id === selected.id ? { ...c, ...patch } : c)),
    }));

  const addChart = () =>
    setSettings((s) => {
      const chart = newChart({ title: `Chart ${s.charts.length + 1}` });
      return { ...s, charts: [...s.charts, chart], selectedId: chart.id };
    });

  const removeChart = (id) =>
    setSettings((s) => {
      if (s.charts.length <= 1) return s;
      const remaining = s.charts.filter((c) => c.id !== id);
      return {
        ...s,
        charts: remaining,
        selectedId: s.selectedId === id ? remaining[0].id : s.selectedId,
      };
    });

  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  // Move a chart to the position of the chart it was dropped on (grid order follows array order).
  const moveChart = (fromId, toId) =>
    setSettings((s) => {
      const from = s.charts.findIndex((c) => c.id === fromId);
      const to = s.charts.findIndex((c) => c.id === toId);
      if (from < 0 || to < 0 || from === to) return s;
      const next = [...s.charts];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return { ...s, charts: next };
    });

  const toggleY =(col) => {
    const next = yCols.includes(col) ? yCols.filter((c) => c !== col) : [...yCols, col];
    updateSelected({ yColumns: valueOptions.filter((c) => next.includes(c)) }); // keep column order
  };

  // New data invalidates every chart's column choices.
  const loadText = (text) =>
    setSettings((s) => ({
      ...s,
      csvText: text,
      charts: s.charts.map((c) => ({ ...c, xColumn: null, yColumns: null })),
    }));

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadText(await file.text());
    e.target.value = ''; // allow re-uploading the same file
  };

  const multi = charts.length > 1;

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
              <div className="segmented wrap" role="radiogroup" aria-label="Theme">
                {THEME_OPTIONS.map((t) => (
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
            <h2>Charts</h2>
            <div className="chart-tabs" role="tablist" aria-label="Charts">
              {charts.map((c, i) => (
                <button
                  key={c.id}
                  role="tab"
                  aria-selected={c.id === selected.id}
                  className={c.id === selected.id ? 'active' : ''}
                  onClick={() => select(c.id)}
                >
                  {c.title || `Chart ${i + 1}`}
                </button>
              ))}
              <button className="add-chart" onClick={addChart}>
                + Add chart
              </button>
            </div>

            <div className="segmented" role="radiogroup" aria-label="Chart type">
              {CHART_TYPES.map((t) => (
                <button
                  key={t.id}
                  role="radio"
                  aria-checked={chartType === t.id}
                  className={chartType === t.id ? 'active' : ''}
                  onClick={() => updateSelected({ chartType: t.id })}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <label className="field">
              Title
              <input value={title} onChange={(e) => updateSelected({ title: e.target.value })} />
            </label>

            <label className="field">
              {chartType === 'pie' ? 'Slice labels' : 'X-axis (categories)'}
              <select
                value={xCol ?? ''}
                onChange={(e) => updateSelected({ xColumn: e.target.value, yColumns: null })}
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

        <main className={`chart-grid${multi ? ' multi' : ''}`}>
          {charts.map((c) => (
            <ChartPanel
              key={c.id}
              chart={c}
              data={data}
              height={multi ? 340 : 480}
              palette={palette}
              resolvedTheme={resolvedTheme}
              selected={multi && c.id === selected.id}
              canRemove={multi}
              reorder={{
                dragging: dragId === c.id,
                over: dragId !== null && overId === c.id && dragId !== c.id,
                onDragStart: (e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', c.id);
                  const card = e.currentTarget.closest('.chart-card');
                  if (card) e.dataTransfer.setDragImage(card, 20, 20);
                  setDragId(c.id);
                },
                onDragEnd: () => {
                  setDragId(null);
                  setOverId(null);
                },
                onDragOver: (e) => {
                  if (dragId === null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (overId !== c.id) setOverId(c.id);
                },
                onDrop: (e) => {
                  e.preventDefault();
                  if (dragId !== null) moveChart(dragId, c.id);
                  setDragId(null);
                  setOverId(null);
                },
              }}
              onSelect={() => select(c.id)}
              onRemove={() => removeChart(c.id)}
            />
          ))}
        </main>
      </div>
    </div>
  );
}
