/**
 * RFC 4180 CSV cell escaping with spreadsheet formula-injection protection.
 * Cells beginning with =, +, -, @, tab, or CR (even after leading spaces) are
 * prefixed with a single quote so Excel/Sheets treat them strictly as text.
 */
const FORMULA_PREFIX = /^[\t\r ]*[=+\-@\t\r]/;

export function escapeCsvCell(value: string | number | null | undefined): string {
  let text = value == null ? "" : String(value);
  if (FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}