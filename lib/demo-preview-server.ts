import type { NextRequest } from "next/server";

// Route-handler-only module: never import server configuration into a client component.
if (typeof window !== "undefined")
  throw new Error("Demo server configuration cannot run in a browser.");

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
export const responseHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function localHttpUrl(url: URL) {
  return (
    ["http:", "https:"].includes(url.protocol) &&
    loopbackHosts.has(url.hostname) &&
    !url.username &&
    !url.password
  );
}

export function configuration() {
  const password = process.env.NEOPACT_DEMO_PASSWORD;
  if (process.env.NEOPACT_DEMO_PREVIEW !== "true" || !password) return null;
  try {
    const upstream = new URL(
      process.env.API_INTERNAL_URL || "http://127.0.0.1:8100",
    );
    if (
      !localHttpUrl(upstream) ||
      upstream.pathname !== "/" ||
      upstream.search ||
      upstream.hash
    ) {
      return null;
    }
    return { upstream: upstream.origin, password };
  } catch {
    return null;
  }
}

export function trustedOrigin(request: NextRequest, requireOrigin: boolean) {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  if (!host || !localHttpUrl(url)) return null;
  try {
    // NextRequest normalizes loopback addresses to localhost. Host retains the
    // browser's actual address, which must still match Origin exactly.
    const browserUrl = new URL(`${url.protocol}//${host}`);
    return localHttpUrl(browserUrl) &&
      browserUrl.host === host.toLowerCase() &&
      browserUrl.port === url.port &&
      request.headers.get("sec-fetch-site") !== "cross-site" &&
      (origin === browserUrl.origin || (!requireOrigin && !origin))
      ? browserUrl.origin
      : null;
  } catch {
    return null;
  }
}

export function failure(status: number, code: string, message: string) {
  return Response.json(
    { status_code: status, error: { code, message, details: null } },
    { status, headers: responseHeaders },
  );
}
