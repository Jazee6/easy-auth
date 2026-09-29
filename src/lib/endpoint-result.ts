import { isAPIError } from "better-auth/api";

/** Whether an auth endpoint's `returned` value, seen from an after hook, succeeded. */
export function isSuccessfulEndpointResult(result: unknown): boolean {
  if (result === undefined || result === null || isAPIError(result)) return false;
  return !(result instanceof Response) || (result.status >= 200 && result.status < 300);
}
