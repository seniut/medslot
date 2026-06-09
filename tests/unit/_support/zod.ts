// Small structural helpers for asserting on Zod safeParse results without
// depending on Zod's internal type names.

type ParseResult = {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
};

/** All error codes (issue messages) from a failed parse, in order. */
export function errorCodes(result: ParseResult): string[] {
  return result.success ? [] : (result.error?.issues.map((i) => i.message) ?? []);
}

/** The error code reported for a specific field path (dot-joined), if any. */
export function codeForPath(result: ParseResult, path: string): string | undefined {
  if (result.success) {
    return undefined;
  }
  return result.error?.issues.find((i) => i.path.join(".") === path)?.message;
}
