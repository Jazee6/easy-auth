import { defaultParseSearch, defaultStringifySearch } from "@tanstack/react-router";

const SIGNATURE_PARAM = "sig";
const SIGNED_PARAMETER_NAME_PARAM = "ba_param";

// Better Auth signs repeated `ba_param` entries. TanStack Router's default
// serializer encodes repeated values as one JSON array, which invalidates the signature.

type SearchValue = string | string[];

function isSignedOAuthUrlSearch(params: URLSearchParams): boolean {
  return params.has(SIGNATURE_PARAM) && params.has(SIGNED_PARAMETER_NAME_PARAM);
}

function isSignedOAuthSearch(search: Record<string, unknown>): boolean {
  const signedParameterNames = search[SIGNED_PARAMETER_NAME_PARAM];
  return (
    typeof search[SIGNATURE_PARAM] === "string" &&
    (typeof signedParameterNames === "string" || Array.isArray(signedParameterNames))
  );
}

function parseStringSearch(params: URLSearchParams): Record<string, SearchValue> {
  const search: Record<string, SearchValue> = Object.create(null);

  for (const [key, value] of params) {
    const current = search[key];
    if (current === undefined) {
      search[key] = value;
    } else if (Array.isArray(current)) {
      current.push(value);
    } else {
      search[key] = [current, value];
    }
  }

  return search;
}

function stringifySearchValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function parseRouterSearch(search: string): Record<string, unknown> {
  const params = new URLSearchParams(search);
  return isSignedOAuthUrlSearch(params) ? parseStringSearch(params) : defaultParseSearch(search);
}

export function stringifyRouterSearch(search: Record<string, unknown>): string {
  if (!isSignedOAuthSearch(search)) return defaultStringifySearch(search);

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, stringifySearchValue(item));
    } else {
      params.set(key, stringifySearchValue(value));
    }
  }

  const result = params.toString();
  return result ? `?${result}` : "";
}
