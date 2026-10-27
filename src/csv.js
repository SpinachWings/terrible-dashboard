import Papa from 'papaparse';

const isBlank = (v) => v === null || v === undefined || v === '';

export function parseCsv(text) {
  const result = Papa.parse(text.trim(), {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  const columns = (result.meta.fields ?? []).filter((c) => c !== '');
  const rows = result.data;

  // A column is numeric if every non-blank value parsed as a number (and there is at least one).
  const numericColumns = columns.filter(
    (col) =>
      rows.some((r) => typeof r[col] === 'number') &&
      rows.every((r) => isBlank(r[col]) || typeof r[col] === 'number')
  );

  return { columns, rows, numericColumns, error: result.errors[0]?.message ?? null };
}

// Serialise the given columns of the rows back to CSV text.
export function toCsv(columns, rows) {
  return Papa.unparse({ fields: columns, data: rows.map((r) => columns.map((c) => r[c] ?? '')) });
}

export function downloadCsv(filename, text) {
  // BOM so Excel reads UTF-8 correctly.
  const url = URL.createObjectURL(new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
