"use client";

import { useEffect, useState } from "react";
import {
  readDemoPreviewConfig,
  type DemoPreviewConfig,
  type DemoRole,
} from "@/lib/demo-preview";

export type DemoPreviewSwitchProps = {
  currentRole?: DemoRole;
  busy?: boolean;
  disabled?: boolean;
  onSwitch: (role: DemoRole) => void;
};

export function DemoPreviewSwitch({
  currentRole,
  busy = false,
  disabled = false,
  onSwitch,
}: DemoPreviewSwitchProps) {
  const [config, setConfig] = useState<DemoPreviewConfig | null>(null);
  const [requestedRole, setRequestedRole] = useState<DemoRole | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    readDemoPreviewConfig(controller.signal)
      .then(setConfig)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  if (!config?.enabled) return null;

  return (
    <div className="demo-preview">
      <span className="demo-preview-label">Local demo</span>
      <div
        className="demo-preview-controls"
        role="group"
        aria-label="Local demo perspective"
        aria-busy={busy}
      >
        {(["buyer", "seller"] as const).map((role) => (
          <button
            key={role}
            type="button"
            aria-pressed={currentRole === role}
            disabled={busy || disabled}
            onClick={() => {
              if (role === currentRole) return;
              setRequestedRole(role);
              onSwitch(role);
            }}
          >
            {config.labels[role]}
          </button>
        ))}
      </div>
      <span className="demo-preview-status" role="status">
        {busy &&
          (requestedRole
            ? `Opening ${requestedRole} preview…`
            : "Opening demo preview…")}
      </span>
    </div>
  );
}
