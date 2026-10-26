import { useEffect, useMemo, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { parseCsv } from './csv';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './storage';

const CHART_TYPES = [
  { id: 'bar', label: 'Bar' },
  { id: 'line', label: 'Line' },
  { id: 'pie', label: 'Pie' },
];

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const { csvText, chartType, xColumn, yColumns, title } = settings;

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

    return {
      chart: { height: 480, style: { fontFamily: 'inherit' } },
      title: { text: title || null },
      credits: { enabled: false },
      xAxis: { categories: rows.map(label), title: { text: xCol } },
      yAxis: { title: { text: null } },
      tooltip: { shared: chartType !== 'pie' },
      plotOptions: {
        pie: {
          allowPointSelect: true,
          dataLabels: { enabled: true, format: '{point.name}: {point.percentage:.1f}%' },
        },
      },
      series,
    };
  }, [rows, xCol, yCols.join('|'), chartType, title]);

  const hasChart = rows.length > 0 && yCols.length > 0;

  return (
    <div className="app">
      <header className="header">
        <h1>Terrible Dashboard</h1>
        <span className="muted">Saved automatically in this browser</span>
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
              <button className="link" onClick={() => setSettings(DEFAULT_SETTINGS)}>
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
