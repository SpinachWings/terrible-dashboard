# Terrible Dashboard

A tiny, backend-free data visualisation dashboard: paste or upload a CSV and view it as a bar, line or pie chart (React + Highcharts). Everything is saved in your browser's localStorage.

## Run it

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Then open http://localhost:5173 (it should open automatically).

## Using it

- A sample CSV loads on first visit. **Reset to sample** brings it back.
- **Upload CSV…** or edit the text box directly. The first row must be column headers.
- Pick the chart type, the category column (x-axis / pie slices), and which numeric columns to plot.
- Pie charts use the first selected value column.
- Your data and settings persist in localStorage until you reset or clear site data.

## Production build

```bash
npm run build     # outputs to dist/
npm run preview   # serves the built files on http://localhost:4173
```
