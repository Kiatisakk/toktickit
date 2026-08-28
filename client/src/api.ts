const API_BASE_URL =
  import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:3000";

/**
 * Raised when the TokTickIT API cannot be reached or answers with an error.
 * The message is written for a human reading the screen, not for a developer.
 */
export class ApiError extends Error {}

async function getJson<T>(path: string, failureMessage: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`);
  } catch {
    // fetch only rejects when the request never reached a server at all.
    throw new ApiError(failureMessage);
  }

  if (!response.ok) {
    throw new ApiError(failureMessage);
  }

  return (await response.json()) as T;
}

export interface HealthResponse {
  status: string;
  service: string;
}

export function fetchHealth(): Promise<HealthResponse> {
  return getJson<HealthResponse>(
    "/api/health",
    "Unable to connect to TokTickIT API"
  );
}

export interface Category {
  id: number;
  name: string;
}

export function fetchCategories(): Promise<Category[]> {
  // A different message from the health check on purpose: knowing *which* leg
  // of the stack failed is the whole point of checking both.
  return getJson<Category[]>(
    "/api/categories",
    "Unable to load request categories from the database"
  );
}
