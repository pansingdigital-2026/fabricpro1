/** MySQL DATETIME columns do not accept the ISO strings returned to the editor. */
export function mysqlDateTime(value: unknown): unknown {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date.toISOString().slice(0, 19).replace("T", " ");
}
