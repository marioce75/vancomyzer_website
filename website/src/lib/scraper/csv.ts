/** Quote every cell and neutralize spreadsheet formula prefixes in scraped text. */
export function csvRow(values: unknown[]): string {
  return values.map(value => {
    let text = value == null ? "" : String(value);
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r]/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
  }).join(",");
}
