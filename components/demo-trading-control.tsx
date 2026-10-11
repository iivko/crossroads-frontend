"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Play } from "lucide-react";
import { readDemoPreviewConfig } from "@/lib/demo-preview";
import type { DemoTradingResult } from "@/lib/demo-trading";

export type DemoTradingControlProps = {
  disabled?: boolean;
  onComplete?: (result: DemoTradingResult) => void;
  onRunningChange?: (running: boolean) => void;
};

export function DemoTradingControl({
  disabled = false,
  onComplete,
  onRunningChange,
}: DemoTradingControlProps) {
  const [enabled, setEnabled] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    readDemoPreviewConfig(controller.signal)
      .then((config) => setEnabled(config.enabled))
      .catch(() => {});
    return () => {
      controller.abort();
      active.current?.abort();
    };
  }, []);

  async function run() {
    if (active.current || disabled) return;
    const controller = new AbortController();
    active.current = controller;
    setRunning(true);
    onRunningChange?.(true);
    setError("");
    setStatus(
      "Agents are negotiating. Allow about 30 seconds; the activity updates as each turn is recorded.",
    );
    try {
      const csrf = decodeURIComponent(
        document.cookie
          .split("; ")
          .find((cookie) => cookie.startsWith("market_csrf="))
          ?.slice("market_csrf=".length) || "",
      );
      const response = await fetch("/api/demo/trading", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: "{}",
        signal: controller.signal,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          body?.error?.message ||
            "The demo could not finish. Check the local backend and try again.",
        );
      if (
        body?.demo?.status !== "awaiting_human_approval" ||
        typeof body.demo.room_id !== "string" ||
        typeof body.demo.request_id !== "string"
      ) {
        throw new Error(
          "The demo result could not be confirmed. Refresh the negotiations before trying again.",
        );
      }
      setStatus(
        "The scripted agents reached an agreement. The offer is ready for human review.",
      );
      onComplete?.(body.demo);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setStatus("");
        setError(
          cause instanceof Error
            ? cause.message
            : "The demo stopped. Check the local backend and try again.",
        );
      }
    } finally {
      active.current = null;
      setRunning(false);
      onRunningChange?.(false);
    }
  }

  if (!enabled) return null;
  return (
    <div className="demo-trading-control">
      <div className="demo-trading-action">
        <button
          type="button"
          className="button secondary"
          disabled={disabled || running}
          aria-busy={running}
          onClick={run}
        >
          {running ? (
            <LoaderCircle size={16} aria-hidden="true" />
          ) : (
            <Play size={16} aria-hidden="true" />
          )}
          {running ? "Running live demo…" : "Run live demo"}
        </button>
        <p>Scripted agents · real local backend · stops for your approval</p>
      </div>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
