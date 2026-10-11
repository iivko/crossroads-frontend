"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeftRight,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  Command,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Terminal,
  X,
  RefreshCw,
  Activity,
  ClipboardList,
  ImageOff,
  Plug,
} from "lucide-react";
import {
  api,
  human,
  imageUrl,
  money,
  setWorkspace,
  type Me,
  type Product,
  type PurchaseRequest,
  type Room,
  type Order,
  type AuditEvent,
  type Workspace,
  type Offer,
  type EffectiveRules,
} from "@/lib/api";
import { NegotiationGuidance } from "./negotiation-guidance";
import { NegotiationConversation } from "./negotiation-conversation";
import { OfferNeedsReview, PrivateBrief } from "./negotiation-needs";
import { Brand } from "./brand";
import { WorkspacePulse } from "./workspace-pulse";
import { LiveTradingBoard } from "./live-trading-board";
import { Connections, ProviderSignIn } from "./connections";
import { DemoPreviewSwitch } from "./demo-preview-switch";
import { DemoTradingControl } from "./demo-trading-control";
import { switchDemoRole, type DemoRole } from "@/lib/demo-preview";

type View =
  | "overview"
  | "products"
  | "requests"
  | "negotiations"
  | "approvals"
  | "orders"
  | "activity"
  | "connections";
const titles: Record<View, string> = {
  overview: "Your commerce, in view.",
  products: "The product catalogue.",
  requests: "Every purchase starts here.",
  negotiations: "A place to find agreement.",
  approvals: "The final decision is yours.",
  orders: "Agreed. Approved. Recorded.",
  activity: "Every action, accounted for.",
  connections: "Your agents, connected.",
};
const subtitles: Record<View, string> = {
  overview: "Follow your agents’ work and step in when it matters.",
  products: "Explore the products and evidence behind each offer.",
  requests: "Requirements, supplier matches and the progress of each purchase.",
  negotiations: "Follow offers, counteroffers and the terms taking shape.",
  approvals:
    "Review the exact terms. Both businesses approve before an order is confirmed.",
  orders: "A lasting record of each deal and the people who approved it.",
  activity: "A shared timeline of the actions recorded in your workspace.",
  connections: "Manage agent access and the identities you use to sign in.",
};
const icons = {
  overview: LayoutDashboard,
  products: Package,
  requests: ClipboardList,
  negotiations: ArrowLeftRight,
  approvals: ShieldCheck,
  orders: ShoppingBag,
  activity: Activity,
  connections: Plug,
};
function Badge({ value }: { value: string }) {
  return <span className={`badge badge-${value}`}>{human(value)}</span>;
}
function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty">
      <Command size={30} />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const d = ref.current;
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-heading">
        <Brand />
        <button
          className="icon-button"
          aria-label="Close details"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </div>
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
function Gallery({ product }: { product: Product }) {
  const images = product.images.filter((i) => i.status === "ready");
  const [selected, setSelected] = useState(product.cover_id || images[0]?.id);
  const current = images.find((i) => i.id === selected) || images[0];
  return (
    <div className="gallery">
      <div className="gallery-main">
        {current ? (
          <img src={imageUrl(current)} alt={current.caption || product.name} />
        ) : (
          <ImageOff size={40} />
        )}
      </div>
      {images.length > 1 && (
        <div className="thumbnails">
          {images.map((i) => (
            <button
              key={i.id}
              className={i.id === current?.id ? "selected" : ""}
              aria-label={i.caption || "Product image"}
              onClick={() => setSelected(i.id)}
            >
              <img src={imageUrl(i, true)} alt={i.caption} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function TermsGrid({ offer }: { offer: Offer }) {
  return (
    <div className="terms-grid">
      <div>
        <span>Total including delivery</span>
        <strong>{money(offer.terms.total)}</strong>
      </div>
      <div>
        <span>Deposit</span>
        <strong>{offer.terms.deposit_percent}%</strong>
      </div>
      <div>
        <span>Delivery by</span>
        <strong>{offer.terms.delivery_date}</strong>
      </div>
      <div>
        <span>Quantity × unit price</span>
        <strong>
          {offer.terms.quantity} × {money(offer.terms.unit_price)}
        </strong>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [me, setMe] = useState<Me | null>(null),
    [booting, setBooting] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [view, setView] = useState<View>("overview"),
    [navOpen, setNavOpen] = useState(false),
    [search, setSearch] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]),
    [products, setProducts] = useState<Product[]>([]),
    [requests, setRequests] = useState<PurchaseRequest[]>([]),
    [rooms, setRooms] = useState<Room[]>([]),
    [orders, setOrders] = useState<Order[]>([]),
    [events, setEvents] = useState<AuditEvent[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null),
    [selectedRoom, setSelectedRoom] = useState<Room | null>(null),
    [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(
      null,
    ),
    [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [reviewed, setReviewed] = useState(false),
    [notice, setNotice] = useState(""),
    [guardrails, setGuardrails] = useState<EffectiveRules | null>(null);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [guidanceBusy, setGuidanceBusy] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncFailed, setSyncFailed] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const workspaceRef = useRef<string | null>(null);
  const selectedRoomRef = useRef<Room | null>(null);
  const loadSequence = useRef(0);
  selectedRoomRef.current = selectedRoom;
  useEffect(() => {
    setReviewed(false);
  }, [selectedRoom?.id, selectedRoom?.version]);
  const load = useCallback(async (identity: Me) => {
    const sequence = ++loadSequence.current;
    const roomId = selectedRoomRef.current?.id;
    const [ps, ns, os, es, rs, detail] = await Promise.all([
      api.products(),
      api.rooms(),
      api.orders(),
      api.activity(),
      identity.workspace.role === "buyer"
        ? api.requests()
        : Promise.resolve([]),
      roomId ? api.room(roomId) : Promise.resolve(null),
    ]).catch((cause: unknown) => {
      if (
        workspaceRef.current === identity.workspace.id &&
        sequence === loadSequence.current
      ) {
        setSyncFailed(true);
      }
      throw cause;
    });
    if (
      workspaceRef.current !== identity.workspace.id ||
      sequence !== loadSequence.current
    )
      return;
    setProducts(ps);
    setRooms(ns);
    setOrders(os);
    setEvents(es);
    setRequests(rs);
    setLastSynced(new Date());
    setSyncFailed(false);
    if (detail)
      setSelectedRoom((current) =>
        current?.id === detail.id && current.version <= detail.version
          ? detail
          : current,
      );
  }, []);
  const initialize = useCallback(async () => {
    try {
      let identity: Me;
      try {
        identity = await api.me();
      } catch {
        localStorage.removeItem("market_workspace");
        identity = await api.me();
      }
      setWorkspace(identity.workspace.id);
      workspaceRef.current = identity.workspace.id;
      setMe(identity);
      setWorkspaces(await api.workspaces());
      await load(identity);
      const params = new URLSearchParams(location.search);
      const initial = params.get("view");
      if (initial && initial in titles) setView(initial as View);
      if (params.get("room")) {
        setSelectedRoom(await api.room(params.get("room")!));
      }
    } catch {
      setMe(null);
    } finally {
      setBooting(false);
    }
  }, [load]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has("identity") || params.has("identity_error")) {
      localStorage.removeItem("market_workspace");
      const failures: Record<string, string> = {
        account_not_linked:
          "This identity is not linked yet. Sign in with your password, then link it in Connections.",
        identity_already_linked:
          "This identity is already linked to another account.",
        link_session_expired:
          "Your linking session expired. Sign in and try linking again.",
        provider_declined:
          "Sign-in was cancelled at the provider. You can try again.",
      };
      const failure = params.get("identity_error");
      if (failure)
        setError(
          failures[failure] ||
            "Sign-in could not be verified. Please start again.",
        );
      else if (params.get("identity") === "linked")
        setNotice("Sign-in identity linked to your account.");
      params.delete("identity");
      params.delete("identity_error");
      window.history.replaceState({}, "", `/?${params}`);
    }
    void initialize();
  }, [initialize]);
  useEffect(() => {
    if (!me) return;
    const id = setInterval(() => {
      // load owns sync status; transient polling errors must not overwrite
      // a user's action error or remain visible after the feed recovers.
      void load(me).catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [me, load]);
  async function signIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      localStorage.removeItem("market_workspace");
      await api.signIn(email, password);
      setPassword("");
      await initialize();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function clearSnapshot() {
    workspaceRef.current = null;
    ++loadSequence.current;
    setMe(null);
    setWorkspaces([]);
    setProducts([]);
    setRooms([]);
    setOrders([]);
    setEvents([]);
    setRequests([]);
    setSelectedRoom(null);
    setSelectedProduct(null);
    setSelectedRequest(null);
    setSelectedOrder(null);
    setGuardrails(null);
    setGuidanceBusy(false);
    setReviewed(false);
    setSearch("");
    setNotice("");
    setLastSynced(null);
    setSyncFailed(false);
    localStorage.removeItem("market_workspace");
  }
  async function previewRole(role: DemoRole) {
    setBusy(true);
    setError("");
    clearSnapshot();
    setBooting(true);
    window.history.replaceState({}, "", "/?view=overview");
    setView("overview");
    try {
      await switchDemoRole(role);
      await initialize();
    } catch (cause) {
      await initialize();
      setError((cause as Error).message);
    } finally {
      setBusy(false);
      setBooting(false);
    }
  }
  async function signOut() {
    workspaceRef.current = null;
    ++loadSequence.current;
    try {
      await api.signOut();
    } finally {
      clearSnapshot();
      setSelectedRoom(null);
      setSelectedOrder(null);
      setSelectedProduct(null);
      setSelectedRequest(null);
      setGuidanceBusy(false);
      setBusy(false);
      setLastSynced(null);
      setSyncFailed(false);
      localStorage.removeItem("market_workspace");
    }
  }
  async function switchWorkspace(id: string) {
    workspaceRef.current = id;
    ++loadSequence.current;
    setWorkspace(id);
    setSelectedRoom(null);
    setSelectedProduct(null);
    setSelectedRequest(null);
    setSelectedOrder(null);
    setError("");
    setNotice("");
    setGuardrails(null);
    setGuidanceBusy(false);
    setBusy(false);
    setProducts([]);
    setRooms([]);
    setOrders([]);
    setEvents([]);
    setRequests([]);
    setLastSynced(null);
    setSyncFailed(false);
    const identity = await api.me();
    if (workspaceRef.current !== id) return;
    setMe(identity);
    await load(identity);
  }
  async function openRoom(room: Room) {
    const workspaceId = workspaceRef.current;
    setSelectedRoom(room);
    setReviewed(false);
    setError("");
    setGuardrails(null);
    try {
      const r = await api.rules(
        me?.workspace.role === "seller" ? room.product_id : undefined,
      );
      if (
        workspaceRef.current === workspaceId &&
        selectedRoomRef.current?.id === room.id
      )
        setGuardrails(r.effective);
    } catch {}
  }
  async function decide(reject = false) {
    if (!selectedRoom?.current_offer || !me) return;
    const workspaceId = me.workspace.id;
    setBusy(true);
    setError("");
    try {
      const decideOffer = reject ? api.reject : api.approve;
      const result = await decideOffer(
        selectedRoom.id,
        selectedRoom.current_offer.id,
        selectedRoom.version,
      );
      if (workspaceRef.current !== workspaceId) return;
      setNotice(
        reject
          ? "Offer rejected. Both agents can see your decision."
          : result.state === "ordered"
            ? "Both businesses approved. Your demo order is confirmed."
            : "Your approval is recorded. Waiting for the other business.",
      );
      await refreshSelectedRoom(selectedRoom.id);
      setReviewed(false);
      await load(me);
    } catch (e) {
      if (workspaceRef.current === workspaceId) setError((e as Error).message);
    } finally {
      if (workspaceRef.current === workspaceId) setBusy(false);
    }
  }
  async function refreshSelectedRoom(roomId: string) {
    const workspaceId = workspaceRef.current;
    const updated = await api.room(roomId);
    if (workspaceRef.current !== workspaceId) return;
    setSelectedRoom((current) =>
      current?.id === roomId && current.version <= updated.version
        ? updated
        : current,
    );
    setReviewed(false);
  }
  const pending = rooms.filter((r) => r.state === "awaiting_approval"),
    active = rooms.filter((r) =>
      ["negotiating", "needs_revision"].includes(r.state),
    );
  const myReviews = pending.filter(
    (room) =>
      room.current_offer &&
      !room.current_offer.approvals.some(
        (approval) => approval.workspace_id === me?.workspace.id,
      ),
  );
  const filteredProducts = products.filter((p) =>
    `${p.name} ${p.supplier} ${p.sku}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const filteredRooms = (view === "approvals" ? pending : rooms).filter((r) =>
    `${r.supplier} ${r.request.title} ${r.state}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const total = orders.reduce((n, o) => n + o.offer.terms.total, 0);
  function navigate(next: View) {
    setView(next);
    setSearch("");
    setNavOpen(false);
    setNotice("");
    setError("");
    history.replaceState(null, "", `/?view=${next}`);
  }
  function roomTable(rows: Room[], emphasize = false) {
    return rows.length ? (
      <div
        className="table-wrap"
        role="region"
        aria-label="Negotiation offers"
        tabIndex={0}
      >
        <table className="room-table">
          <thead>
            <tr>
              <th scope="col">Request / supplier</th>
              <th scope="col">Status</th>
              <th scope="col" className="numeric">
                Current total
              </th>
              <th scope="col" className="numeric">
                Deposit
              </th>
              <th scope="col">Delivery</th>
              <th scope="col" className="row-action" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="record-cell">
                  <strong>{r.request.title}</strong>
                  <span>{r.supplier}</span>
                  {r.current_offer && (
                    <span className="mobile-offer-summary" aria-hidden="true">
                      <b>{money(r.current_offer.terms.total)}</b>
                      <span>
                        {r.current_offer.terms.deposit_percent}% deposit ·
                        Delivery {r.current_offer.terms.delivery_date}
                      </span>
                    </span>
                  )}
                </td>
                <td>
                  <Badge value={r.state} />
                </td>
                <td className="numeric">
                  {r.current_offer ? money(r.current_offer.terms.total) : "—"}
                </td>
                <td className="numeric">
                  {r.current_offer
                    ? `${r.current_offer.terms.deposit_percent}%`
                    : "—"}
                </td>
                <td>{r.current_offer?.terms.delivery_date || "—"}</td>
                <td className="row-action">
                  <button
                    className={emphasize ? "button primary" : "text-button"}
                    onClick={() => void openRoom(r)}
                  >
                    Review <ArrowUpRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title="Nothing here yet"
        detail="Your agents’ negotiations will appear here as they work through the marketplace."
      />
    );
  }

  if (booting)
    return (
      <div className="loading-screen">
        <Brand />
        <p>Opening your workspace…</p>
      </div>
    );
  if (!me)
    return (
      <main className="login-page">
        <section className="login-story">
          <div className="login-brand-row">
            <Brand inverse />
            <span>Business, in agreement.</span>
          </div>
          <div className="login-proposition">
            <h1>
              Terms aligned.
              <br />
              <span>Business moving.</span>
            </h1>
            <p>Your agents negotiate. Your business decides.</p>
            <ol className="agreement-flow" aria-label="How agreements work">
              <li>
                <Package size={20} aria-hidden="true" />
                <div>
                  <strong>Find the right fit</strong>
                  <span>Products, requirements and supplier matches.</span>
                </div>
              </li>
              <li>
                <ArrowLeftRight size={20} aria-hidden="true" />
                <div>
                  <strong>Bring the terms together</strong>
                  <span>Follow offers and guide your agent privately.</span>
                </div>
              </li>
              <li>
                <ShieldCheck size={20} aria-hidden="true" />
                <div>
                  <strong>Make the final call</strong>
                  <span>Both businesses approve the exact offer.</span>
                </div>
              </li>
            </ol>
          </div>
          <div className="login-footer">
            <span>Built for business-to-business commerce.</span>
            <span>Human approval, always.</span>
          </div>
        </section>
        <section className="login-form-wrap">
          <form onSubmit={signIn}>
            <h2>Your next agreement starts here.</h2>
            <p>Sign in to follow your agents and review proposed deals.</p>
            {error && (
              <div role="alert" className="alert">
                {error}
              </div>
            )}
            <ProviderSignIn />
            <DemoPreviewSwitch
              busy={busy}
              onSwitch={(role) => void previewRole(role)}
            />
            <label>
              Email address
              <input
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button className="button primary wide" disabled={busy}>
              {busy ? "Signing in…" : "Open workspace"}
              <ArrowRight size={18} />
            </button>
            <div className="login-note">
              <ShieldCheck size={20} />
              <p>
                Agent credentials are separate from your account. Only
                authorized people can approve a deal.
              </p>
            </div>
          </form>
        </section>
      </main>
    );

  return (
    <div className="app-shell">
      <aside className={navOpen ? "sidebar open" : "sidebar"}>
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
        >
          <Brand />
        </a>
        <div className="workspace-select">
          <span className="avatar">{me.workspace.name.slice(0, 1)}</span>
          <div>
            <select
              aria-label="Workspace"
              disabled={demoRunning}
              value={me.workspace.id}
              onChange={(e) =>
                void switchWorkspace(e.target.value).catch((e) =>
                  setError(e.message),
                )
              }
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <span>{me.workspace.role} workspace</span>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav id="workspace-navigation">
          {(Object.keys(titles) as View[])
            .filter((v) => v !== "requests" || me.workspace.role === "buyer")
            .map((v) => {
              const Icon = icons[v];
              return (
                <button
                  className={view === v ? "active" : ""}
                  aria-current={view === v ? "page" : undefined}
                  key={v}
                  onClick={() => navigate(v)}
                >
                  <Icon size={19} />
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                  {v === "approvals" && pending.length > 0 && (
                    <b>{pending.length}</b>
                  )}
                </button>
              );
            })}
        </nav>
        <div className="sidebar-bottom">
          <div className="agent-card">
            <div>
              <Terminal size={18} />
              <strong>Your agent workflow</strong>
            </div>
            <p>Connect a client and follow your agents’ work here.</p>
            <button
              type="button"
              className="text-button"
              onClick={() => navigate("connections")}
            >
              Manage connections <ArrowRight size={14} />
            </button>
          </div>
          <button className="profile" onClick={() => void signOut()}>
            <span className="avatar small">
              {me.user.name
                .split(" ")
                .map((x) => x[0])
                .join("")}
            </span>
            <span>
              <strong>{me.user.name}</strong>
              <small>Sign out</small>
            </span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      {navOpen && (
        <button
          aria-label="Close navigation"
          className="nav-backdrop"
          onClick={() => setNavOpen(false)}
        />
      )}
      <div className="main-wrap">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setNavOpen(!navOpen)}
            aria-label="Open navigation"
            aria-expanded={navOpen}
            aria-controls="workspace-navigation"
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            <span className="desktop-workspace-label">Workspace</span>
            <span className="mobile-workspace-brand">
              <img
                src="/brand/neopact-mark-ink.svg"
                width={32}
                height={32}
                alt="neopact"
              />
            </span>
            <ChevronRight size={14} />
            <strong>{human(view)}</strong>
          </div>
          <div className="topbar-right">
            <span
              className={`live-pill${syncFailed ? " sync-stale" : ""}`}
              role="status"
            >
              <span className="live-dot" />{" "}
              {syncFailed
                ? "Sync paused · showing last snapshot"
                : lastSynced
                  ? `Updated ${lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : "Loading workspace…"}
            </span>
            <span className="avatar small">{me.user.name[0]}</span>
          </div>
        </header>
        <div className="preview-toolbar">
          <DemoTradingControl
            key={me.workspace.id}
            disabled={busy}
            onRunningChange={setDemoRunning}
            onComplete={() => {
              void load(me).catch(() => {});
            }}
          />
          <DemoPreviewSwitch
            currentRole={me.workspace.role}
            busy={busy}
            disabled={demoRunning}
            onSwitch={(role) => void previewRole(role)}
          />
        </div>
        <main className="content">
          <div className="page-heading">
            <div>
              <h1>{titles[view]}</h1>
              <p>{subtitles[view]}</p>
            </div>
            <button
              className="button quiet"
              aria-label="Refresh"
              onClick={() => void load(me).catch(() => {})}
            >
              <RefreshCw size={16} aria-hidden="true" />
              <span className="refresh-label">Refresh</span>
            </button>
          </div>
          {error && !selectedRoom && (
            <div className="alert" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              <CheckCheck size={18} />
              {notice}
            </div>
          )}
          {view === "overview" && (
            <>
              <div className="stats">
                <button
                  type="button"
                  className="stat"
                  onClick={() => navigate("negotiations")}
                >
                  <span>
                    Active negotiations
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </span>
                  <strong>{active.length}</strong>
                  <small>Conversations in progress</small>
                </button>
                <button
                  type="button"
                  className="stat accent"
                  onClick={() => navigate("approvals")}
                >
                  <span>
                    Needs your review
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </span>
                  <strong>{myReviews.length}</strong>
                  <small>
                    {pending.length - myReviews.length} already approved by your
                    business
                  </small>
                </button>
                <button
                  type="button"
                  className="stat"
                  onClick={() => navigate("orders")}
                >
                  <span>
                    Demo orders
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </span>
                  <strong>{orders.length}</strong>
                  <small>Approved by both businesses</small>
                </button>
                <button
                  type="button"
                  className="stat"
                  onClick={() => navigate("orders")}
                >
                  <span>
                    {me.workspace.role === "seller"
                      ? "Agreed sales value"
                      : "Agreed purchase value"}
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </span>
                  <strong className="money-stat">{money(total)}</strong>
                  <small>Internal demo order totals</small>
                </button>
              </div>
              <p className="snapshot-scope">
                Current snapshot · up to 100 recent negotiations and 100 orders.
                Demo totals do not represent payments.
              </p>
              <LiveTradingBoard
                key={me.workspace.id}
                rooms={rooms}
                events={events}
                orders={orders}
                workspace={me.workspace}
                synced={lastSynced}
                stale={syncFailed}
                onOpenRoom={(room) => void openRoom(room)}
                onConnect={() => navigate("connections")}
              />
              <div className="section-heading">
                <div>
                  <h2>Offers awaiting approval</h2>
                  <p>Review the exact terms before you decide.</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate("approvals")}
                >
                  All approvals <ArrowRight size={16} />
                </button>
              </div>
              <section
                className="panel decision-panel"
                aria-label="Offers awaiting approval"
              >
                {roomTable(pending.slice(0, 4), true)}
              </section>
              <WorkspacePulse
                rooms={rooms}
                workspace={me.workspace}
                onOpenRoom={(room) => void openRoom(room)}
                onNavigate={navigate}
              />
              <div className="overview-bottom">
                <section>
                  <div className="section-heading">
                    <h2>Catalogue preview</h2>
                    <button
                      className="text-button"
                      onClick={() => navigate("products")}
                    >
                      Explore <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="mini-products">
                    {products.slice(0, 3).map((p) => {
                      const image =
                        p.images.find((i) => i.id === p.cover_id) ||
                        p.images[0];
                      return (
                        <button
                          key={p.id}
                          className="mini-product"
                          onClick={() => setSelectedProduct(p)}
                        >
                          <div>
                            {image ? (
                              <img src={imageUrl(image, true)} alt={p.name} />
                            ) : (
                              <Package />
                            )}
                          </div>
                          <strong>{p.name}</strong>
                          <span>{p.supplier}</span>
                          <b>
                            {money(p.unit_price)} <small>asking / unit</small>
                          </b>
                        </button>
                      );
                    })}
                  </div>
                </section>
                <section>
                  <div className="section-heading">
                    <h2>Latest activity</h2>
                    <button
                      className="text-button"
                      aria-label="View all activity"
                      onClick={() => navigate("activity")}
                    >
                      <ArrowUpRight size={18} />
                    </button>
                  </div>
                  <div className="panel activity-list">
                    {events.slice(0, 5).map((e) => (
                      <div className="event" key={e.id}>
                        <span className="event-dot">
                          <Activity size={15} />
                        </span>
                        <div>
                          <strong>{human(e.type)}</strong>
                          <small>{new Date(e.at).toLocaleString()}</small>
                        </div>
                      </div>
                    ))}
                    {events.length === 0 && (
                      <p className="muted">
                        Recorded agent actions will appear here.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </>
          )}
          {view === "products" && (
            <>
              <div className="toolbar">
                <label className="search">
                  <Search size={18} />
                  <input
                    placeholder="Search products, suppliers or SKU…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <span className="muted">
                  {filteredProducts.length} products
                </span>
              </div>
              <div className="product-grid">
                {filteredProducts.map((p) => {
                  const image =
                    p.images.find((i) => i.id === p.cover_id) ||
                    p.images.find((i) => i.status === "ready");
                  return (
                    <button
                      key={p.id}
                      className="product-card"
                      onClick={() => setSelectedProduct(p)}
                    >
                      <div className="product-image">
                        {image ? (
                          <img src={imageUrl(image)} alt={p.name} />
                        ) : (
                          <Package size={48} />
                        )}
                        <span className="stock-tag">{p.stock} available</span>
                      </div>
                      <div className="product-body">
                        <div className="product-title">
                          <h3>{p.name}</h3>
                          <ArrowUpRight size={20} />
                        </div>
                        <p className="supplier-label">{p.supplier}</p>
                        <p>
                          {p.attributes.material} · {p.attributes.color}
                        </p>
                        <div className="product-price">
                          <strong>
                            {money(p.unit_price)} <small>/ unit</small>
                          </strong>
                          <span>{p.lead_days}-day delivery</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {filteredProducts.length === 0 && (
                <Empty
                  title="No products found"
                  detail="Try a different search. Sellers publish products through the CLI."
                />
              )}
            </>
          )}
          {view === "requests" && (
            <section className="panel">
              {requests.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Purchase request</th>
                        <th className="numeric">Quantity</th>
                        <th>Destination</th>
                        <th className="numeric">Private budget</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.title}</strong>
                            <span>Delivery by {r.latest_delivery}</span>
                          </td>
                          <td className="numeric">{r.quantity}</td>
                          <td>{r.destination}</td>
                          <td className="numeric">{money(r.max_total || 0)}</td>
                          <td>
                            <Badge value={r.state} />
                          </td>
                          <td>
                            <button
                              className="text-button"
                              onClick={() => setSelectedRequest(r)}
                            >
                              Inspect <ArrowUpRight size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Your first request starts with your agent"
                  detail="Create and launch a purchase request through the CLI. Requirements and supplier matches will appear here."
                />
              )}
            </section>
          )}
          {(view === "negotiations" || view === "approvals") && (
            <>
              <div className="toolbar">
                <label className="search">
                  <Search size={18} />
                  <input
                    placeholder="Search requests or suppliers…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <span className="muted">
                  {filteredRooms.length} {view}
                </span>
              </div>
              <section className="panel">{roomTable(filteredRooms)}</section>
              <div className="quiet-note">
                <ShieldCheck size={18} /> Agent agreement prepares a deal. Two
                human approvals confirm it.
              </div>
            </>
          )}
          {view === "orders" && (
            <section className="panel">
              {orders.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Product / order</th>
                        <th>Counterparty</th>
                        <th className="numeric">Total</th>
                        <th>Confirmed</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id}>
                          <td>
                            <strong>{o.offer.product.name}</strong>
                            <span>#{o.id.slice(0, 8)}</span>
                          </td>
                          <td>
                            {me.workspace.role === "buyer" ? o.seller : o.buyer}
                          </td>
                          <td className="numeric">
                            {money(o.offer.terms.total)}
                          </td>
                          <td>{new Date(o.created_at).toLocaleDateString()}</td>
                          <td>
                            <button
                              className="text-button"
                              onClick={() => setSelectedOrder(o)}
                            >
                              View order <ArrowUpRight size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Agreements will become orders here"
                  detail="An order is recorded once both businesses approve the same valid offer."
                />
              )}
            </section>
          )}
          {view === "activity" && (
            <LiveTradingBoard
              key={me.workspace.id}
              expanded
              rooms={rooms}
              events={events}
              orders={orders}
              workspace={me.workspace}
              synced={lastSynced}
              stale={syncFailed}
              onOpenRoom={(room) => void openRoom(room)}
              onConnect={() => navigate("connections")}
            />
          )}
          {view === "activity" && (
            <details className="audit-detail">
              <summary>
                Workspace audit trail{" "}
                <small>Up to 100 recent recorded events</small>
              </summary>
              <section className="panel activity-list">
                {events.map((e) => (
                  <div className="event" key={e.id}>
                    <span className="event-dot">
                      <Activity size={16} />
                    </span>
                    <div>
                      <strong>{human(e.type)}</strong>
                      <small>
                        Record {e.resource_id.slice(0, 8)} · Actor{" "}
                        {e.actor_id.slice(0, 12)}
                      </small>
                      {Object.keys(e.data).length > 0 && (
                        <span className="event-data">
                          {Object.entries(e.data)
                            .map(
                              ([k, v]) =>
                                `${human(k)}: ${Array.isArray(v) ? v.join(", ") : String(v)}`,
                            )
                            .join(" · ")}
                        </span>
                      )}
                    </div>
                    <time>{new Date(e.at).toLocaleString()}</time>
                  </div>
                ))}
                {events.length === 0 && (
                  <Empty
                    title="A clean slate"
                    detail="Your workspace’s recorded actions will appear here."
                  />
                )}
              </section>{" "}
            </details>
          )}
          {view === "connections" && (
            <Connections key={me.workspace.id} workspace={me.workspace} />
          )}
          <footer className="page-footer">
            <span>neopact / terms aligned. business moving.</span>
            <span>Local marketplace · EUR · Demo orders</span>
          </footer>
        </main>
      </div>
      {selectedProduct && (
        <Modal
          title={selectedProduct.name}
          onClose={() => setSelectedProduct(null)}
        >
          <Gallery product={selectedProduct} />
          <div className="detail-meta">
            <span>{selectedProduct.supplier}</span>
            <Badge value={selectedProduct.published ? "published" : "draft"} />
          </div>
          <p className="description">{selectedProduct.description}</p>
          <div className="terms-grid">
            <div>
              <span>Asking price per unit</span>
              <strong>{money(selectedProduct.unit_price)}</strong>
            </div>
            <div>
              <span>Available stock</span>
              <strong>{selectedProduct.stock}</strong>
            </div>
            <div>
              <span>Delivery charge</span>
              <strong>{money(selectedProduct.delivery_charge)}</strong>
            </div>
            <div>
              <span>Lead time</span>
              <strong>{selectedProduct.lead_days} days</strong>
            </div>
          </div>
          <dl className="details">
            <div>
              <dt>Material</dt>
              <dd>{selectedProduct.attributes.material}</dd>
            </div>
            <div>
              <dt>Stackable</dt>
              <dd>{selectedProduct.attributes.stackable ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>Delivery coverage</dt>
              <dd>{selectedProduct.destinations.join(", ")}</dd>
            </div>
            <div>
              <dt>SKU / revision</dt>
              <dd>
                {selectedProduct.sku} / v{selectedProduct.version}
              </dd>
            </div>
          </dl>
        </Modal>
      )}
      {selectedRequest && (
        <Modal
          title={selectedRequest.title}
          onClose={() => setSelectedRequest(null)}
        >
          <Badge value={selectedRequest.state} />
          <p className="description">{selectedRequest.description}</p>
          <div className="terms-grid">
            <div>
              <span>Private maximum total</span>
              <strong>{money(selectedRequest.max_total || 0)}</strong>
            </div>
            <div>
              <span>Maximum deposit</span>
              <strong>{selectedRequest.max_deposit_percent}%</strong>
            </div>
            <div>
              <span>Destination</span>
              <strong>{selectedRequest.destination}</strong>
            </div>
            <div>
              <span>Delivery by</span>
              <strong>{selectedRequest.latest_delivery}</strong>
            </div>
          </div>
          <h3>Supplier matching</h3>
          {selectedRequest.matches?.map((m) => (
            <div key={m.product_id} className="match">
              <span className={m.eligible ? "success-text" : "muted"}>
                {m.eligible ? <Check size={18} /> : <X size={18} />}
              </span>
              <div>
                <strong>{m.supplier}</strong>
                <p>{m.reasons.join(" · ")}</p>
              </div>
            </div>
          ))}
          <h3>Compare offers</h3>
          {roomTable(rooms.filter((r) => r.request_id === selectedRequest.id))}
        </Modal>
      )}
      {selectedRoom && (
        <Modal
          title={selectedRoom.request.title}
          onClose={() => {
            setSelectedRoom(null);
            setGuidanceBusy(false);
            setError("");
          }}
        >
          <div className="detail-meta">
            <span>
              {selectedRoom.supplier} · {selectedRoom.product.name}
            </span>
            <Badge value={selectedRoom.state} />
          </div>
          {error && (
            <div role="alert" className="alert">
              {error}
            </div>
          )}
          {syncFailed && (
            <div role="alert" className="alert">
              Workspace sync paused. These are the last retrieved terms; refresh
              before making a decision.
            </div>
          )}
          <NegotiationConversation
            key={`conversation:${me.workspace.id}:${selectedRoom.id}`}
            room={selectedRoom}
          />
          <PrivateBrief room={selectedRoom} />
          {selectedRoom.current_offer ? (
            <>
              <div className="offer-heading">
                <strong>Offer v{selectedRoom.current_offer.version}</strong>
                <span>Proposed by {selectedRoom.current_offer.sender}</span>
                <button
                  className="text-button"
                  onClick={() =>
                    void refreshSelectedRoom(selectedRoom.id).catch((e) =>
                      setError(e.message),
                    )
                  }
                >
                  <RefreshCw size={14} />
                  Refresh terms
                </button>
              </div>
              <TermsGrid offer={selectedRoom.current_offer} />
              <OfferNeedsReview offer={selectedRoom.current_offer} />
              {selectedRoom.offers.length > 1 && (
                <div className="change-note">
                  <strong>Since the previous offer</strong>
                  <span>
                    Total: {money(selectedRoom.offers.at(-2)!.terms.total)} →{" "}
                    {money(selectedRoom.current_offer.terms.total)}
                  </span>
                  <span>
                    Deposit: {selectedRoom.offers.at(-2)!.terms.deposit_percent}
                    % → {selectedRoom.current_offer.terms.deposit_percent}%
                  </span>
                  <span>
                    Delivery: {selectedRoom.offers.at(-2)!.terms.delivery_date}{" "}
                    → {selectedRoom.current_offer.terms.delivery_date}
                  </span>
                </div>
              )}
              <details>
                <summary>Product images and specifications</summary>
                <Gallery product={selectedRoom.current_offer.product} />
                <p>
                  {selectedRoom.current_offer.product.attributes.material} ·{" "}
                  {selectedRoom.current_offer.product.attributes.color} ·{" "}
                  {selectedRoom.current_offer.product.attributes.stackable
                    ? "Stackable"
                    : "Not stackable"}
                </p>
              </details>
              {guardrails && (
                <details>
                  <summary>Your private negotiation limits</summary>
                  <dl className="details">
                    {Object.entries(guardrails).map(([k, v]) => (
                      <div key={k}>
                        <dt>{human(k)}</dt>
                        <dd>
                          {["min_unit_price", "max_total"].includes(k)
                            ? money(v)
                            : v}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
              {selectedRoom.invalid_reasons.length > 0 &&
                selectedRoom.state !== "ordered" && (
                  <div className="alert">
                    {selectedRoom.invalid_reasons.join(". ")}
                  </div>
                )}
              <div className="approval-status">
                {[
                  selectedRoom.request.workspace_id,
                  selectedRoom.seller_id,
                ].map((id, i) => {
                  const approved = selectedRoom.current_offer!.approvals.some(
                    (a) => a.workspace_id === id,
                  );
                  return (
                    <div
                      key={id || i}
                      className={`approval-party ${approved ? "approved" : "pending"}`}
                    >
                      {approved ? (
                        <CheckCheck size={19} />
                      ) : (
                        <Clock3 size={19} />
                      )}
                      <span>
                        {i === 0 ? "Buyer" : "Seller"}:{" "}
                        {approved
                          ? "approved"
                          : selectedRoom.state === "awaiting_approval"
                            ? "awaiting approval"
                            : "agent agreement pending"}
                      </span>
                    </div>
                  );
                })}
              </div>
              {selectedRoom.state === "awaiting_approval" && me.can_approve && (
                <div className="approval-box">
                  <h3>Review before you authorize</h3>
                  <p className="approval-request-note">
                    Both agents agreed. Each business must now review and
                    approve this offer.
                  </p>
                  <p>
                    This is offer v{selectedRoom.current_offer.version},
                    expiring{" "}
                    {new Date(
                      selectedRoom.current_offer.expires_at,
                    ).toLocaleString()}
                    . Both businesses must approve these exact terms.
                  </p>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={reviewed}
                      onChange={(e) => setReviewed(e.target.checked)}
                    />
                    I have reviewed this offer, its needs review and product
                    evidence.
                  </label>
                  <div className="approval-actions">
                    <button
                      className="button secondary"
                      disabled={busy || guidanceBusy || !reviewed}
                      onClick={() => void decide(true)}
                    >
                      Reject offer
                    </button>
                    <button
                      className="button primary"
                      disabled={
                        busy ||
                        guidanceBusy ||
                        !reviewed ||
                        !selectedRoom.valid ||
                        selectedRoom.current_offer.approvals.some(
                          (a) => a.workspace_id === me.workspace.id,
                        )
                      }
                      onClick={() => void decide()}
                    >
                      <ShieldCheck size={17} />
                      {busy ? "Recording…" : "Approve exact offer"}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <Empty
              title="Waiting for the first offer"
              detail={`The ${selectedRoom.next_role} agent can claim the next turn.`}
            />
          )}
          <NegotiationGuidance
            key={`${me.workspace.id}:${selectedRoom.id}`}
            room={selectedRoom}
            role={me.workspace.role}
            disabled={busy}
            onBusy={(value) => {
              if (
                workspaceRef.current === me.workspace.id &&
                selectedRoomRef.current?.id === selectedRoom.id
              )
                setGuidanceBusy(value);
            }}
            onStale={() =>
              workspaceRef.current === me.workspace.id
                ? refreshSelectedRoom(selectedRoom.id)
                : Promise.resolve()
            }
            onSubmitted={(updated) => {
              if (workspaceRef.current !== me.workspace.id) return;
              setSelectedRoom((current) =>
                current?.id === updated.id && current.version <= updated.version
                  ? updated
                  : current,
              );
              setReviewed(false);
              void load(me).catch((cause) => {
                if (workspaceRef.current === me.workspace.id)
                  setError(cause.message);
              });
            }}
          />
          {selectedRoom.reason && (
            <p className="quiet-note">{selectedRoom.reason}</p>
          )}
        </Modal>
      )}
      {selectedOrder && (
        <Modal
          title={`Order #${selectedOrder.id.slice(0, 8)}`}
          onClose={() => setSelectedOrder(null)}
        >
          <Badge value="confirmed_demo" />
          <p className="description">
            {selectedOrder.buyer} → {selectedOrder.seller}
          </p>
          <TermsGrid offer={selectedOrder.offer} />
          <OfferNeedsReview
            offer={{
              ...selectedOrder.offer,
              private_brief_review: selectedOrder.private_brief_review,
              shared_brief_review: selectedOrder.shared_brief_review,
            }}
          />
          <Gallery product={selectedOrder.offer.product} />
          <h3>Recorded approvals</h3>
          {selectedOrder.offer.approvals.map((a) => (
            <div className="match" key={a.workspace_id}>
              <CheckCheck className="success-text" />
              <div>
                <strong>
                  {a.workspace_id === selectedOrder.buyer_id
                    ? "Buyer"
                    : "Seller"}{" "}
                  approval
                </strong>
                <p>{new Date(a.at).toLocaleString()}</p>
              </div>
            </div>
          ))}
          <p className="quiet-note">
            This internal demo order records the approved agreement. Payment and
            fulfilment are not executed.
          </p>
        </Modal>
      )}
    </div>
  );
}
