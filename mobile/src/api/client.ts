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

// Called when a request fails with 401 while we believed we were logged in
// (i.e. the session expired or was revoked server-side). The auth layer
// registers a handler that clears the stored session.
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE" | "PATCH";
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
    // A 401 on a non-auth endpoint while a token is set means our session
    // expired or was revoked — clear it so the UI reflects logged-out state.
    if (
      res.status === 401 &&
      authToken &&
      !path.startsWith("/api/auth/") &&
      onUnauthorized
    ) {
      onUnauthorized();
    }
    const message =
      (data as { error?: string }).error ?? "요청을 처리하지 못했습니다.";
    throw new ApiError(res.status, message);
  }
  return data as T;
}

// Upload a local image (a device file:// URI from the image picker) to the
// backend via multipart/form-data. `apiRequest` is JSON-only, so uploads need
// their own path — but they still reuse the module-scope bearer token.
export async function uploadImage(uri: string): Promise<{ url: string }> {
  const form = new FormData();
  // RN FormData 파일 형식
  const name = uri.split("/").pop() || "photo.jpg";
  const ext = (name.split(".").pop() || "jpg").toLowerCase();
  const mime =
    ext === "png"
      ? "image/png"
      : ext === "webp"
        ? "image/webp"
        : ext === "gif"
          ? "image/gif"
          : "image/jpeg";
  // @ts-expect-error RN FormData의 파일 객체
  form.append("file", { uri, name, type: mime });
  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/upload`, {
      method: "POST",
      headers,
      body: form,
    });
  } catch {
    throw new ApiError(0, "서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.");
  }
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : {};
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string }).error ?? "업로드 실패");
  }
  return data as { url: string };
}

// The backend returns server-relative image paths (e.g. "/uploads/ab12.jpg").
// RN <Image> needs an absolute URL, so prefix relative paths with the API host.
// Absolute URLs (http(s)://) and empty strings pass through unchanged.
export function imageUri(url: string): string {
  return url && url.startsWith("/") ? `${API_BASE_URL}${url}` : url;
}
