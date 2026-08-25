import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Adds permissive CORS headers to /api/* responses.
//
// The mobile app uses Bearer-token auth (not cookies), so it does not send
// cross-origin credentials — `Access-Control-Allow-Origin: *` is safe here.
// Native iOS/Android networking does not enforce CORS, but these headers let
// the same API be called from Expo Web and browser-based tools during
// development.
export function middleware(request: NextRequest) {
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders() });
  }
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(corsHeaders())) {
    response.headers.set(key, value);
  }
  return response;
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export const config = {
  matcher: "/api/:path*",
};
