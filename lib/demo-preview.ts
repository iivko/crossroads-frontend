export type DemoRole = "buyer" | "seller";

export type DemoPreviewConfig = {
  enabled: boolean;
  mcpProjectDirectory?: string;
  labels: Record<DemoRole, string>;
};

export async function readDemoPreviewConfig(
  signal?: AbortSignal,
): Promise<DemoPreviewConfig> {
  const response = await fetch("/api/demo/session", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("Demo preview is unavailable.");
  const body = await response.json();
  if (
    typeof body.enabled !== "boolean" ||
    typeof body.labels?.buyer !== "string" ||
    typeof body.labels?.seller !== "string"
  ) {
    throw new Error("Demo preview is unavailable.");
  }
  return body;
}

/** Browser requests carry only a role; fixed demo credentials remain on the server. */
export async function switchDemoRole(role: DemoRole): Promise<void> {
  const response = await fetch("/api/demo/session", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof body?.error?.message === "string"
        ? body.error.message
        : "The demo account could not be opened. Please retry.",
    );
  }
  if (body?.role !== role || body?.status_code !== response.status) {
    throw new Error("The demo session could not be confirmed. Please retry.");
  }
}
