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
