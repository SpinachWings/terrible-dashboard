import { useEffect, useMemo, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { parseCsv } from './csv';
import { DEFAULT_SETTINGS, loadSettings, newChart, saveSettings } from './storage';

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

function ChartPanel({ chart, data, height, selected, canRemove, onSelect, onRemove }) {
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

    return {
      chart: { height, style: { fontFamily: 'inherit' } },
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
  }, [rows, xCol, yCols.join('|'), chartType, title, height]);

  const hasChart = rows.length > 0 && yCols.length > 0;

  return (
    <section className={`chart-card${selected ? ' selected' : ''}`} onClick={onSelect}>
      {canRemove && (
        <button
          className="remove-chart"
          aria-label="Remove chart"
          title="Remove chart"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      )}
      {hasChart ? (
        <HighchartsReact key={chartType} highcharts={Highcharts} options={options} />
      ) : (
        <p className="empty">
          {rows.length === 0
            ? 'Paste or upload a CSV with a header row to get started.'
            : 'Select at least one value column to plot.'}
        </p>
      )}
    </section>
  );
}

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const { csvText, charts, selectedId } = settings;

  // Persist every change to localStorage.
  useEffect(() => saveSettings(settings), [settings]);

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

  const toggleY = (col) => {
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
              selected={multi && c.id === selected.id}
              canRemove={multi}
              onSelect={() => select(c.id)}
              onRemove={() => removeChart(c.id)}
            />
          ))}
        </main>
      </div>
    </div>
  );
}
