import { API_BASE_URL } from "./config";

// Thrown when the backend responds with a non-2xx status. `message` carries the
// server's Korean error text so screens can show it directly.
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

// The current bearer token. Set by the auth layer after login/register and
// cleared on logout. Kept in module scope so every request can attach it
// without threading it through call sites.
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.");
  }

  // Some endpoints (logout) may return an empty body.
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : {};

  if (!res.ok) {
    const message =
      (data as { error?: string }).error ?? "요청을 처리하지 못했습니다.";
    throw new ApiError(res.status, message);
  }
  return data as T;
}
