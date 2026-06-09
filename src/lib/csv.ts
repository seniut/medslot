// Minimal, dependency-free CSV builder with two safety properties:
//
// 1. Standard RFC-4180 quoting (fields containing quotes, commas, or newlines
//    are wrapped in double quotes and internal quotes are doubled).
// 2. CSV/formula-injection protection: a leading "=", "+", "-", "@", tab, or
//    carriage return can cause spreadsheet apps to execute the cell as a
//    formula. Such cells are prefixed with a single quote to neutralize them.
//
// Rows are joined with CRLF, which Excel and most spreadsheet tools expect.

const FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r"]);

function escapeCsvCell(value: string): string {
  let cell = value;

  if (cell.length > 0 && FORMULA_TRIGGERS.has(cell[0])) {
    cell = `'${cell}`;
  }

  if (/[",\r\n]/.test(cell)) {
    cell = `"${cell.replace(/"/g, '""')}"`;
  }

  return cell;
}

/** Build a CSV document (CRLF line endings) from a header row and data rows. */
export function buildCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) =>
    row.map(escapeCsvCell).join(","),
  );
  return lines.join("\r\n");
}
