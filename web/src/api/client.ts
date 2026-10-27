export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Calls the API relative to the page (`api/...`), so the app works under any
 * path as long as `api/` next to it is proxied to the backend.
 */
export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Is the API running (uvicorn src.api:app)?");
  }
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const data = await response.json();
      if (data && typeof data.detail === 'string') message = data.detail;
      else if (data && data.detail) message = JSON.stringify(data.detail);
    } catch {
      // Not JSON: keep the status line.
    }
    throw new ApiError(response.status, message);
  }
  return (await response.json()) as T;
}
