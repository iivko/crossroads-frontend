"use client";

import { useId, useRef, useState } from "react";
import { ArrowUpRight, Check, Copy, Terminal } from "lucide-react";

const chatgptInstall = `codex plugin marketplace add Sashe-Bashe/neopact-chatgpt
codex plugin add neopact@neopact`;
const claudeInstall = `claude plugin marketplace add AGH2084/crossroads-claude-plugin
claude plugin install neopact@crossroads`;
const chatgptSetup = `git clone https://github.com/Sashe-Bashe/neopact-chatgpt.git
cd neopact-chatgpt
uv run --project plugins/neopact/server --locked --no-dev python plugins/neopact/scripts/configure.py`;

function CommandSnippet({
  command,
  label,
}: {
  command: string;
  label: string;
}) {
  const [state, setState] = useState<"idle" | "copying" | "copied" | "failed">(
    "idle",
  );
  const code = useRef<HTMLPreElement>(null);
  const statusId = useId();

  async function copy() {
    setState("copying");
    try {
      await navigator.clipboard.writeText(command);
      setState("copied");
    } catch {
      setState("failed");
      if (code.current) {
        code.current.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(code.current);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }

  return (
    <div className="plugin-command">
      <div className="plugin-command-heading">
        <span>Run in your terminal</span>
        <button
          type="button"
          className="button quiet plugin-copy"
          aria-label={`Copy ${label}`}
          aria-describedby={statusId}
          disabled={state === "copying"}
          onClick={() => void copy()}
        >
          {state === "copied" ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Copy size={16} aria-hidden="true" />
          )}
          {state === "copied"
            ? "Copied"
            : state === "copying"
              ? "Copying…"
              : "Copy commands"}
        </button>
      </div>
      <pre ref={code} tabIndex={0} aria-label={label}>
        <code>{command}</code>
      </pre>
      <p
        id={statusId}
        className={`plugin-copy-status${state === "failed" ? " plugin-copy-failed" : ""}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {state === "copied"
          ? "Commands copied."
          : state === "failed"
            ? "Clipboard unavailable. Select and copy the commands manually."
            : ""}
      </p>
    </div>
  );
}

export function PluginInstallations() {
  const headingId = useId();
  const chatgptId = useId();
  const claudeId = useId();

  return (
    <section className="plugin-installations" aria-labelledby={headingId}>
      <div className="plugin-section-heading">
        <h2 id={headingId}>1. Install your plugin</h2>
        <p>Choose your local agent, then create workspace access below.</p>
      </div>
      <div className="plugin-grid">
        <article className="plugin-card" aria-labelledby={chatgptId}>
          <header className="plugin-card-heading">
            <Terminal size={24} aria-hidden="true" />
            <div>
              <h3 id={chatgptId}>Neopact for ChatGPT</h3>
              <p>Runs locally in Codex</p>
            </div>
          </header>
          <p className="plugin-requirements">
            Requires Codex CLI, uv and git. uv can provide Python 3.12+.
          </p>
          <a
            className="plugin-repository"
            href="https://github.com/Sashe-Bashe/neopact-chatgpt"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View Neopact for ChatGPT repository (opens in a new tab)"
          >
            View repository <ArrowUpRight size={16} aria-hidden="true" />
          </a>
          <CommandSnippet
            command={chatgptInstall}
            label="ChatGPT install commands"
          />
          <p className="plugin-compatibility">
            ChatGPT web is not supported by this local release.
          </p>
          <details className="plugin-setup">
            <summary>Setup after creating access</summary>
            <div>
              <p>Run the setup wizard from a local copy of the plugin:</p>
              <CommandSnippet
                command={chatgptSetup}
                label="ChatGPT setup commands"
              />
              <p>
                Enter the API URL, workspace ID and token shown below. Token
                input is hidden in your terminal; keep it out of chat.
              </p>
              <p>
                Restart Codex or start a new chat, then ask “Run Neopact setup.”
              </p>
            </div>
          </details>
        </article>
        <article className="plugin-card" aria-labelledby={claudeId}>
          <header className="plugin-card-heading">
            <Terminal size={24} aria-hidden="true" />
            <div>
              <h3 id={claudeId}>Neopact for Claude Code</h3>
              <p>Runs locally in Claude Code</p>
            </div>
          </header>
          <p className="plugin-requirements">
            Requires Claude Code CLI, uv and git.
          </p>
          <a
            className="plugin-repository"
            href="https://github.com/AGH2084/crossroads-claude-plugin"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View Neopact for Claude Code repository (opens in a new tab)"
          >
            View repository <ArrowUpRight size={16} aria-hidden="true" />
          </a>
          <CommandSnippet
            command={claudeInstall}
            label="Claude Code install commands"
          />
          <p className="plugin-compatibility">
            Connects to your workspace through a local MCP process.
          </p>
          <details className="plugin-setup">
            <summary>Setup after creating access</summary>
            <div>
              <p>
                Set <code>NEOPACT_MCP_API_URL</code>,{" "}
                <code>NEOPACT_MCP_WORKSPACE</code> and{" "}
                <code>NEOPACT_MCP_TOKEN</code> in the environment that launches
                Claude Code, using the values below. Keep the token out of chat
                and shell history.
              </p>
              <p>
                For trusted private LAN HTTP only, also set{" "}
                <code>NEOPACT_MCP_ALLOW_LAN_HTTP=true</code>.
              </p>
              <p>
                Restart Claude Code, then run <code>/neopact:setup</code> and{" "}
                <code>/neopact:inbox</code>.
              </p>
            </div>
          </details>
        </article>
      </div>
      <p className="plugin-local-note">
        Your marketplace API must be reachable from the computer running the
        plugin. Each connection uses your own restricted workspace access.
      </p>
    </section>
  );
}
