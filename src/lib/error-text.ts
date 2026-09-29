/** Lowercased `code message` text for matching framework errors to friendly copy. */
export function getErrorMatchText(error: unknown): string {
  if (typeof error === "string") return error.toLowerCase();
  if (typeof error !== "object" || error === null) return "";
  const candidate = error as { code?: unknown; message?: unknown };
  return `${String(candidate.code ?? "")} ${String(candidate.message ?? "")}`.toLowerCase();
}
