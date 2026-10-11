import { NextRequest } from "next/server";
import type { components } from "@/lib/generated/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function proxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const route = path.join("/");
  const isRead = req.method === "GET" || req.method === "HEAD";
  if (
    !isRead &&
    !(
      req.method === "POST" &&
      /^(auth\/(session|logout)|credentials|identity\/(google|openai)\/link|approvals\/[^/]+\/(approve|reject)|negotiations\/[^/]+\/guidance)$/.test(
        route,
      )
    ) &&
    !(req.method === "DELETE" && /^credentials\/[^/]+$/.test(route))
  ) {
    return Response.json(
      {
        status_code: 405,
        error: {
          code: "unsupported_dashboard_action",
          message: "Use the CLI for marketplace operations",
          details: null,
        },
      } satisfies components["schemas"]["ErrorResponse"],
      { status: 405, headers: { Allow: "GET, HEAD, POST" } },
    );
  }
  const headers = new Headers();
  for (const name of [
    "cookie",
    "content-type",
    "origin",
    "x-csrf-token",
    "x-workspace-id",
    "idempotency-key",
  ]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const upstream = await fetch(
      `${process.env.API_INTERNAL_URL || "http://127.0.0.1:8100"}/api/v1/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`,
      {
        method: req.method,
        headers,
        body: isRead ? undefined : await req.arrayBuffer(),
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(30000),
      },
    );
    const outgoing = new Headers({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    for (const name of ["content-type", "content-disposition", "location"]) {
      const value = upstream.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie())
      outgoing.append("set-cookie", cookie);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: outgoing,
    });
  } catch {
    return Response.json(
      {
        status_code: 503,
        error: {
          code: "backend_unavailable",
          message: "The marketplace API is unavailable. Please retry.",
          details: null,
        },
      } satisfies components["schemas"]["ErrorResponse"],
      { status: 503 },
    );
  }
}
export {
  proxy as GET,
  proxy as HEAD,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
  proxy as OPTIONS,
};
