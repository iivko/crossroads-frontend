"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  KeyRound,
  Plug,
  ShieldCheck,
  X,
} from "lucide-react";
import { readDemoPreviewConfig } from "@/lib/demo-preview";
import type { Workspace } from "@/lib/api";
import { mcpEndpoint } from "@/lib/mcp-endpoint";
import { PluginInstallations } from "./plugin-installations";
import {
  connectionsApi,
  type Credential,
  type IssuedCredential,
  type Provider,
} from "@/lib/connections";

export function ProviderSignIn() {
  const [providers, setProviders] = useState<Provider[]>([]);
  useEffect(() => {
    let alive = true;
    connectionsApi
      .providers()
      .then((value) => {
        if (alive) setProviders(value);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const ready = providers.filter((provider) => provider.configured);
  if (!ready.length) return null;
  return (
    <div className="provider-signin">
      {ready.map((provider) => (
        <a
          key={provider.id}
          className="button quiet wide"
          href={`/api/v1/identity/${provider.id}/login`}
        >
          Continue with {provider.label}
          <ArrowUpRight size={16} />
        </a>
      ))}
      <small>Use an identity already linked to your workspace account.</small>
    </div>
  );
}

export function Connections({ workspace }: { workspace: Workspace }) {
  const [projectDirectory, setProjectDirectory] = useState(
    "/path/to/crossroads-backend",
  );
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [apiUrl, setApiUrl] = useState("http://127.0.0.1:8100/api/v1");
  const [allowLanHttp, setAllowLanHttp] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [providerError, setProviderError] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("My agent");
  const [trading, setTrading] = useState(false);
  const [issued, setIssued] = useState<IssuedCredential | null>(null);
  const [copied, setCopied] = useState<"token" | "config" | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    setApiUrl(
      `${window.location.protocol}//${window.location.hostname}:8100/api/v1`,
    );
    readDemoPreviewConfig()
      .then((config) => {
        if (alive.current && config.enabled && config.mcpProjectDirectory)
          setProjectDirectory(config.mcpProjectDirectory);
      })
      .catch(() => {});
    connectionsApi
      .list()
      .then((value) => {
        if (alive.current) setCredentials(value);
      })
      .catch((cause) => {
        if (alive.current) setError(cause.message);
      })
      .finally(() => {
        if (alive.current) setLoading(false);
      });
    connectionsApi
      .providers()
      .then((value) => {
        if (alive.current) setProviders(value);
      })
      .catch((cause) => {
        if (alive.current) setProviderError(cause.message);
      });
    return () => {
      alive.current = false;
    };
  }, []);
  async function create(event: FormEvent) {
    event.preventDefault();
    if (endpointError) return;
    setBusy(true);
    setError("");
    const scopes = [
      "catalogue:read",
      "images:read",
      "negotiations:read",
      "orders:read",
    ];
    if (trading)
      scopes.push(
        "negotiations:act",
        workspace.role === "buyer" ? "requests:write" : "products:write",
      );
    try {
      const result = await connectionsApi.create(name, scopes);
      if (!alive.current) return;
      setIssued(result);
      setCopied(null);
      setCredentials((current) => [
        ...current,
        {
          id: result.id,
          name: result.name,
          scopes: result.scopes,
          expires_at: result.expires_at,
          revoked: false,
        },
      ]);
    } catch (cause) {
      if (alive.current) setError((cause as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function revoke(id: string) {
    setBusy(true);
    setError("");
    try {
      await connectionsApi.revoke(id);
      if (!alive.current) return;
      setCredentials((current) =>
        current.map((value) =>
          value.id === id ? { ...value, revoked: true } : value,
        ),
      );
      if (issued?.id === id) setIssued(null);
      setConfirmRevoke(null);
    } catch (cause) {
      if (alive.current) setError((cause as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  let endpoint: ReturnType<typeof mcpEndpoint> | undefined;
  let endpointError = "";
  try {
    endpoint = mcpEndpoint(apiUrl, allowLanHttp);
  } catch (cause) {
    endpointError = (cause as Error).message;
  }
  const config = JSON.stringify(
    {
      mcpServers: {
        neopact: {
          command: "uv",
          args: [
            "--directory",
            projectDirectory,
            "run",
            "--extra",
            "mcp",
            "python",
            "-m",
            "mcp_server",
          ],
          env: {
            NEOPACT_MCP_API_URL: endpoint?.url,
            ...(endpoint?.lanHttp
              ? { NEOPACT_MCP_ALLOW_LAN_HTTP: "true" }
              : {}),
            NEOPACT_MCP_WORKSPACE: workspace.id,
            NEOPACT_MCP_TOKEN: issued?.token || "YOUR_WORKSPACE_TOKEN",
          },
        },
      },
    },
    null,
    2,
  );
  async function copy(kind: "token" | "config") {
    try {
      await navigator.clipboard.writeText(
        kind === "token" ? issued!.token : config,
      );
      setCopied(kind);
    } catch {
      setError(
        "Clipboard access is unavailable. Select and copy the private value below.",
      );
    }
  }
  async function link(provider: Provider) {
    setBusy(true);
    setProviderError("");
    try {
      const url = await connectionsApi.link(provider.id);
      if (alive.current) window.location.assign(url);
    } catch (cause) {
      if (alive.current) setProviderError((cause as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <div className="connections-page">
      <section className="connection-intro">
        <span className="connection-mark">
          <Plug size={28} />
        </span>
        <div>
          <h2>Give your agent a seat at the table.</h2>
          <p>
            Connect Codex, Claude Code or another local MCP client to{" "}
            <strong>{workspace.name}</strong>. Your agent can follow activity
            and work within the access you choose.
          </p>
        </div>
        <span className="connection-protocol">MCP · local stdio</span>
      </section>
      <PluginInstallations />
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      <div className="connection-grid">
        <section className="connection-panel">
          <div className="connection-section-heading">
            <KeyRound size={20} />
            <h3>2. Create agent access</h3>
          </div>
          <p>One workspace. Seven days. Revocable at any time.</p>
          <form onSubmit={create}>
            <label>
              Connection name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={80}
                placeholder="Procurement agent"
              />
            </label>
            <label className="connection-permission">
              <input
                type="checkbox"
                checked={trading}
                onChange={(event) => setTrading(event.target.checked)}
              />
              <span>
                <strong>Allow agent trading</strong>
                <small>
                  Propose and negotiate terms, and{" "}
                  {workspace.role === "buyer"
                    ? "create purchase requests"
                    : "manage products"}
                  . Human approval is always required for orders.
                </small>
              </span>
            </label>
            <label>
              Backend API URL
              <input
                type="url"
                value={apiUrl}
                onChange={(event) => {
                  setApiUrl(event.target.value);
                  setAllowLanHttp(false);
                  setCopied(null);
                }}
                aria-describedby="backend-api-help"
                required
                spellCheck={false}
              />
            </label>
            <label className="connection-permission">
              <input
                type="checkbox"
                checked={allowLanHttp}
                onChange={(event) => {
                  setAllowLanHttp(event.target.checked);
                  setCopied(null);
                }}
              />
              <span>
                <strong>Allow HTTP on this trusted LAN</strong>
                <small>
                  Local demo only. Your agent token travels unencrypted. Use a
                  private IPv4 address on a network you trust.
                </small>
              </span>
            </label>
            <p
              id="backend-api-help"
              className="connection-read-access"
              aria-live="polite"
            >
              {endpointError ||
                "Use the backend address reachable from your agent’s computer, not the dashboard address."}
            </p>
            <p className="connection-read-access">
              Read access includes the catalogue, negotiations and orders.
              Trading is off by default.
            </p>
            <button
              type="submit"
              className="button primary"
              disabled={
                busy || loading || !name.trim() || Boolean(endpointError)
              }
            >
              {busy ? "Working…" : "Create connection"}
              <ArrowUpRight size={16} />
            </button>
          </form>
        </section>
        <section className="connection-panel connection-setup">
          <h3>3. Connect your workspace</h3>
          <ol>
            <li>
              <strong>Create access here</strong>
              <span>Choose whether your agent can read or also negotiate.</span>
            </li>
            <li>
              <strong>Complete your plugin’s setup</strong>
              <span>
                Follow “Setup after creating access” in your plugin card above.
                Use the API URL, workspace ID and private token shown below.
                Enter the token locally; never paste it into an AI chat.
              </span>
            </li>
            <li>
              <strong>Ask your agent to check its inbox</strong>
              <span>
                Its actions appear on your trading floor. It cannot approve a
                deal.
              </span>
            </li>
          </ol>
          <p className="connection-cloud">
            <strong>Your agent needs a reachable backend</strong>
            <span>
              Use the server address reachable from the computer running your
              agent. 127.0.0.1 points to that computer. Both plugins run
              locally; this release has no ChatGPT web or Claude web connector.
            </span>
          </p>
        </section>
      </div>
      {issued && !endpointError && (
        <section
          className="connection-secret"
          aria-label="New connection configuration"
        >
          <div className="connection-section-heading">
            <h3>Finish your plugin setup</h3>
            <button
              type="button"
              className="icon-button"
              aria-label="Dismiss private configuration"
              onClick={() => setIssued(null)}
            >
              <X size={18} />
            </button>
          </div>
          <p>
            This private token is shown once. Save it through your plugin’s
            local setup, then dismiss it. It expires{" "}
            {new Date(issued.expires_at).toLocaleDateString()}.
          </p>
          <dl className="connection-values">
            <div>
              <dt>NEOPACT_MCP_API_URL</dt>
              <dd>{endpoint?.url}</dd>
            </div>
            <div>
              <dt>NEOPACT_MCP_WORKSPACE</dt>
              <dd>{workspace.id}</dd>
            </div>
            {endpoint?.lanHttp && (
              <div>
                <dt>NEOPACT_MCP_ALLOW_LAN_HTTP</dt>
                <dd>true</dd>
              </div>
            )}
          </dl>
          <label htmlFor="workspace-agent-token">NEOPACT_MCP_TOKEN</label>
          <textarea
            id="workspace-agent-token"
            readOnly
            aria-label="Private workspace token"
            value={issued.token}
            spellCheck={false}
            rows={2}
          />
          <button
            type="button"
            className="button primary"
            onClick={() => void copy("token")}
          >
            {copied === "token" ? <Check size={16} /> : <Copy size={16} />}
            {copied === "token" ? "Copied private token" : "Copy private token"}
          </button>
          <p role="status">
            {copied === "token"
              ? "Private token copied. Paste it only into your local plugin setup."
              : ""}
          </p>
          <details className="connection-manual">
            <summary>Other MCP clients: manual configuration</summary>
            <p>
              For a client such as Claude Desktop, install the backend’s MCP
              extra with uv and replace the backend folder path in this
              configuration.
            </p>
            <textarea
              readOnly
              aria-label="Private MCP configuration"
              value={config}
              spellCheck={false}
              rows={13}
            />
            <button
              type="button"
              className="button primary"
              onClick={() => void copy("config")}
            >
              {copied === "config" ? <Check size={16} /> : <Copy size={16} />}{" "}
              {copied === "config"
                ? "Copied private configuration"
                : "Copy private configuration"}
            </button>
          </details>
        </section>
      )}
      <section className="connection-panel">
        <div className="connection-section-heading">
          <h3>Workspace connections</h3>
          <span>
            {
              credentials.filter(
                (value) =>
                  !value.revoked && Date.parse(value.expires_at) > Date.now(),
              ).length
            }{" "}
            valid credentials
          </span>
        </div>
        <p>
          Credential status shows access validity. It does not establish whether
          an agent is running.
        </p>
        <div className="connection-list">
          {credentials.map((credential) => {
            const inactive =
              credential.revoked ||
              Date.parse(credential.expires_at) <= Date.now();
            return (
              <div key={credential.id} className="connection-row">
                <div>
                  <strong>{credential.name}</strong>
                  <small>
                    {credential.scopes.includes("negotiations:act")
                      ? "Can negotiate"
                      : "Read access"}{" "}
                    ·{" "}
                    {credential.revoked
                      ? "Revoked"
                      : `Expires ${new Date(credential.expires_at).toLocaleDateString()}`}
                  </small>
                </div>
                {inactive ? (
                  <span className="connection-state">
                    {credential.revoked ? "Revoked" : "Expired"}
                  </span>
                ) : confirmRevoke === credential.id ? (
                  <div className="connection-revoke">
                    <button
                      type="button"
                      className="button danger"
                      disabled={busy}
                      onClick={() => void revoke(credential.id)}
                    >
                      Confirm revoke
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setConfirmRevoke(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() => setConfirmRevoke(credential.id)}
                  >
                    Revoke access
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {!credentials.length && (
          <p className="connection-empty">
            {loading
              ? "Loading connections…"
              : "No agent credentials yet. Create your first connection above."}
          </p>
        )}
      </section>
      <section className="connection-panel">
        <div className="connection-section-heading">
          <ShieldCheck size={20} />
          <h3>Account sign-in</h3>
        </div>
        <p>
          Link a provider to this account, then use it to sign in. This does not
          connect a trading agent.
        </p>
        {providerError && (
          <div className="alert" role="alert">
            {providerError}
          </div>
        )}
        <div className="provider-list">
          {providers.map((provider) => (
            <div className="provider-row" key={provider.id}>
              <div>
                <strong>{provider.label}</strong>
                <small>
                  {provider.linked
                    ? "Linked to your account"
                    : provider.configured
                      ? "Ready to link"
                      : provider.id === "openai"
                        ? "Requires approved OpenAI client registration"
                        : "Requires Google OAuth client configuration"}
                </small>
              </div>
              <button
                type="button"
                className="button quiet"
                disabled={!provider.configured || provider.linked || busy}
                onClick={() => void link(provider)}
              >
                {provider.linked
                  ? "Linked"
                  : provider.configured
                    ? "Link account"
                    : "Setup required"}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
