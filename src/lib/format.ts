export function formatNumber(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }
  const fixed = value.toFixed(decimals);
  if (decimals === 0) {
    return fixed;
  }
  return fixed.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

