export function emptyToNull(v?: unknown): string | null {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}
