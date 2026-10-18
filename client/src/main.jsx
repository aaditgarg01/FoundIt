import React, { useState, useEffect, useContext, createContext } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  Navigate,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Search,
  ArrowUpRight,
  ArrowRight,
  Plus,
  MapPin,
  Calendar,
  ShieldCheck,
  Check,
  ChevronRight,
  Package,
  Headphones,
  Laptop,
  KeyRound,
  BookOpen,
  Watch,
  Backpack,
  Glasses,
  Shirt,
  LogOut,
  LayoutDashboard,
  ClipboardList,
  HeartHandshake,
  SlidersHorizontal,
  Menu,
  X,
  ArrowLeft,
  LoaderCircle,
  Bell,
  CheckCircle2,
  Compass,
  LockKeyhole,
  User,
  RefreshCw,
} from "lucide-react";
import { api, session } from "./api";
import "./styles.css";
const Context = createContext();
const useApp = () => useContext(Context);
const date = (v) =>
  v
    ? new Date(
        typeof v === "string" && v.length === 10 ? v + "T12:00:00" : v,
      ).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
const title = (v) =>
  String(v || "")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
function Icon({ name = "", ...props }) {
  const n = name.toLowerCase();
  const I = /ear|headphone/.test(n)
    ? Headphones
    : /laptop|electronic|phone/.test(n)
      ? Laptop
      : /key/.test(n)
        ? KeyRound
        : /book|document|note/.test(n)
          ? BookOpen
          : /watch|jewel/.test(n)
            ? Watch
            : /bag|backpack/.test(n)
              ? Backpack
              : /spectacle|glass/.test(n)
                ? Glasses
                : /cloth|jacket/.test(n)
                  ? Shirt
                  : Package;
  return <I {...props} />;
}
function Badge({ value }) {
  return (
    <span className={"badge " + String(value).toLowerCase()}>
      <span className="dot" />
      {title(value)}
    </span>
  );
}
function Empty({ title: heading, children, to, label = "Report an item" }) {
  return (
    <div className="empty">
      <Compass size={36} />
      <h3>{heading}</h3>
      <p>{children}</p>
      {to && (
        <Link className="button secondary" to={to}>
          {label}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
function ErrorBox({ error, retry }) {
  return (
    <div className="error" role="alert">
      <strong>{error?.message || error}</strong>
      {retry && (
        <button className="text-button" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" /> Loading your campus…
    </div>
  );
}
function useData(path) {
  const [state, set] = useState({ loading: true }),
    [key, reload] = useState(0);
  useEffect(() => {
    let active = true;
    set({ loading: true });
    api(path)
      .then((data) => active && set({ data, loading: false }))
      .catch((error) => active && set({ error, loading: false }));
    return () => {
      active = false;
    };
  }, [path, key]);
  return { ...state, reload: () => reload((x) => x + 1) };
}
function Data({ state, children }) {
  return state.loading ? (
    <Loading />
  ) : state.error ? (
    <ErrorBox error={state.error} retry={state.reload} />
  ) : (
    children(state.data)
  );
}
function Field({ label, help, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {help && <small>{help}</small>}
    </label>
  );
}
function PageHead({ eyebrow, heading, children, action }) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow || "YOUR CAMPUS, CONNECTED"}</div>
        <h1>{heading}</h1>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  );
}
function App() {
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    if (!session.has()) {
      setReady(true);
      return;
    }
    api("/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => session.clear())
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    const f = () => {
      setUser(null);
      setNotice("Your session has ended. Please sign in again.");
    };
    window.addEventListener("foundit:signedout", f);
    return () => window.removeEventListener("foundit:signedout", f);
  }, []);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 6000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  const value = { user, setUser, ready, notify: setNotice };
  return (
    <Context.Provider value={value}>
      <BrowserRouter>
        <Scroll />
        <Shell>
          {ready ? (
            <Routes>
              <Route
                path="/"
                element={user ? <Navigate to="/home" replace /> : <Landing />}
              />
              <Route path="/login" element={<Auth />} />
              <Route path="/register" element={<Auth register />} />
              <Route element={<Protected />}>
                <Route path="/home" element={<Dashboard />} />
                <Route path="/browse" element={<Browse />} />
                <Route path="/browse/:id" element={<FoundDetail />} />
                <Route path="/report" element={<ReportChooser />} />
                <Route path="/report/:kind" element={<Report />} />
                <Route path="/report/success/:kind/:id" element={<Success />} />
                <Route path="/my/reports" element={<MyReports />} />
                <Route path="/my/reports/lost/:id" element={<LostDetail />} />
                <Route
                  path="/my/reports/lost/:id/edit"
                  element={<Report edit />}
                />
                <Route
                  path="/my/reports/lost/:id/matches"
                  element={<MatchList />}
                />
                <Route path="/my/reports/found/:id" element={<OwnFound />} />
                <Route path="/matches/:id" element={<MatchDetail />} />
                <Route path="/claims/new/:id" element={<ClaimForm />} />
                <Route path="/my/claims" element={<Claims />} />
                <Route path="/my/claims/:id" element={<ClaimDetail />} />
                <Route path="/verify" element={<Claims verify />} />
                <Route path="/verify/:id" element={<ClaimDetail />} />
                <Route path="/handover/:id" element={<ClaimDetail />} />
                <Route path="/timeline/:kind/:id" element={<Timeline />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/staff" element={<Staff />} />
                <Route path="/staff/ageing" element={<Staff />} />
                <Route
                  path="/staff/intake"
                  element={<Navigate to="/report/found" replace />}
                />
                <Route path="/admin/config" element={<ScoringAdmin />} />
                <Route path="/admin" element={<Staff />} />
                <Route path="/admin/analytics" element={<Staff />} />
                <Route
                  path="/admin/reference/:kind"
                  element={<ReferenceAdmin />}
                />
              </Route>
              <Route
                path="*"
                element={
                  <Empty
                    title="This page wandered off."
                    to="/"
                    label="Back to home"
                  >
                    The link may have changed. Head home to find what you need.
                  </Empty>
                }
              />
            </Routes>
          ) : (
            <Loading />
          )}
        </Shell>
        {notice && (
          <div className="toast" role="status">
            <CheckCircle2 size={20} />
            {notice}
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </BrowserRouter>
    </Context.Provider>
  );
}
import { Outlet } from "react-router-dom";
function Protected() {
  const { user } = useApp(),
    l = useLocation();
  return user ? (
    <Outlet />
  ) : (
    <Navigate
      to={"/login?return=" + encodeURIComponent(l.pathname + l.search)}
      replace
    />
  );
}
function Scroll() {
  const l = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector("main")?.focus();
  }, [l.pathname]);
  return null;
}
function Shell({ children }) {
  const { user, setUser, notify } = useApp(),
    [open, setOpen] = useState(false),
    l = useLocation(),
    nav = useNavigate();
  useEffect(() => setOpen(false), [l.pathname]);
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST", body: {} });
    } catch (e) {
      notify(e.message);
      return;
    }
    session.clear();
    setUser(null);
    nav("/");
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="header">
        <div className="nav-wrap">
          <Link
            to={user ? "/home" : "/"}
            className="logo"
            aria-label="FoundIt home"
          >
            <span className="logo-mark">
              <Search size={22} strokeWidth={3} />
            </span>
            found<span>it</span>
            <span className="logo-period">.</span>
          </Link>
          <span className="campus-tag">
            VIT VELLORE <span className="dot" />
          </span>
          <nav
            className={open ? "nav open" : "nav"}
            aria-label="Main navigation"
          >
            <NavLink to={user ? "/home" : "/"} end>
              Home
            </NavLink>
            <NavLink to="/browse">Browse items</NavLink>
            {user && (
              <>
                <NavLink to="/my/reports">My reports</NavLink>
                <NavLink to="/my/claims">My claims</NavLink>
                <NavLink to="/verify">Verify</NavLink>
                {["STAFF", "ADMIN"].includes(user.role) && (
                  <NavLink to="/staff">Staff</NavLink>
                )}
              </>
            )}
          </nav>
          <div className="nav-actions">
            {user ? (
              <>
                <Link
                  to="/profile"
                  className="avatar"
                  aria-label="Your profile"
                >
                  {user.full_name?.slice(0, 1)}
                </Link>
                <button
                  className="icon-button"
                  onClick={logout}
                  aria-label="Sign out"
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <Link className="sign-in" to="/login">
                Sign in <ArrowUpRight size={15} />
              </Link>
            )}
            <Link className="button small" to="/report">
              <Plus size={16} />
              <span className="report-desktop-label">Report an item</span>
              <span className="report-mobile-label">Report</span>
            </Link>
            <button
              className="mobile-menu icon-button"
              aria-label="Toggle navigation"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex="-1">
        {children}
      </main>
      <footer>
        <Link to="/" className="logo footer-logo">
          found<span>it.</span>
        </Link>
        <p>Good things find their way back.</p>
        <span>Made for our campus. Built on trust.</span>
      </footer>
    </>
  );
}
function Landing() {
  const s = useData("/dashboard/summary");
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="live-dot" /> A LITTLE LOST. A LOT OF POSSIBILITIES.
          </div>
          <h1>
            Lost happens.
            <br />
            <span>Found starts here.</span>
          </h1>
          <p>
            Your bottle. Your headphones. Your favourite hoodie.
            <br className="desktop" /> Let’s get your things back where they
            belong.
          </p>
          <div className="hero-actions">
            <Link className="button" to="/report/lost">
              <Search size={19} /> I lost something <ArrowUpRight size={18} />
            </Link>
            <Link className="button secondary" to="/report/found">
              <Plus size={19} /> I found something
            </Link>
          </div>
          <div className="hero-trust">
            <span className="mini-avatars">
              <i>A</i>
              <i>R</i>
              <i>S</i>
            </span>
            <span>
              A campus that looks out for each other.
              <br />
              <strong>One small act. One happy reunion.</strong>
            </span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-cross cross-one">+</div>
          <div className="art-cross cross-two">+</div>
          <div className="floating-label label-top">
            <span className="live-dot" /> Somewhere on campus, a reunion begins.
          </div>
          <div className="object-card headphones">
            <div className="object-shape">
              <Headphones strokeWidth={1.4} />
            </div>
            <span>THE DAILY SOUNDTRACK</span>
            <strong>Back in good hands.</strong>
            <span className="object-pill">
              <Check size={12} /> Found it
            </span>
          </div>
          <div className="object-card keys">
            <KeyRound strokeWidth={1.6} />
            <div>
              <span>SMALL THINGS, BIG RELIEF</span>
              <strong>A way back home.</strong>
            </div>
            <span className="key-tag">F</span>
          </div>
          <div className="floating-label label-bottom">
            <HeartHandshake size={18} /> Kind people. Clever matching.
          </div>
          <span className="art-note">a little help goes a long way ↗</span>
        </div>
      </section>
      <section className="stats-band">
        <div>
          <span className="stat-symbol">
            <Package />
          </span>
          <strong>{s.data?.available ?? "—"}</strong>
          <span>items waiting for their people</span>
        </div>
        <div>
          <span className="stat-symbol">
            <HeartHandshake />
          </span>
          <strong>{s.data?.returned_this_month ?? "—"}</strong>
          <span>happy reunions this month</span>
        </div>
        <div>
          <span className="stat-symbol">
            <ShieldCheck />
          </span>
          <strong>100%</strong>
          <span>ownership verified before handover</span>
        </div>
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">SOMEONE FOUND IT. MAYBE IT’S YOURS.</div>
            <h2>Recently found around campus</h2>
          </div>
          <Link className="text-link" to="/browse">
            Explore all items <ArrowUpRight size={17} />
          </Link>
        </div>
        <Data state={s}>
          {(d) =>
            d.recent.length ? (
              <div className="item-grid">
                {d.recent.map((i) => (
                  <ItemCard key={i.found_id} item={i} />
                ))}
              </div>
            ) : (
              <Empty
                title="Be the first to help an item find home."
                to="/report/found"
                label="Report a found item"
              >
                New finds will appear here as soon as someone reports them.
              </Empty>
            )
          }
        </Data>
      </section>
      <section className="how-section">
        <div className="eyebrow">LESS SEARCHING. MORE FINDING.</div>
        <h2>A little detail goes a long way.</h2>
        <div className="steps">
          {[
            [
              ClipboardList,
              "01",
              "Tell us what happened",
              "A few details about what, where and when. That’s all it takes to get started.",
            ],
            [
              Compass,
              "02",
              "Let the dots connect",
              "We compare campus reports and explain every possible match.",
            ],
            [
              HeartHandshake,
              "03",
              "Make a happy reunion",
              "Verify the details only an owner would know, then arrange a safe handover.",
            ],
          ].map(([I, n, h, p]) => (
            <div key={n}>
              <div className="step-top">
                <I />
                <span>{n}</span>
              </div>
              <h3>{h}</h3>
              <p>{p}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="bottom-cta">
        <div>
          <h2>Found something? Make someone’s day.</h2>
          <p>
            That small thing you picked up could mean a whole lot to someone.
          </p>
        </div>
        <Link className="button" to="/report/found">
          Help it find home <ArrowUpRight size={17} />
        </Link>
      </section>
    </>
  );
}
function ItemCard({ item, type = "found", own = false }) {
  const to = own
    ? `/my/reports/${type}/${item[type + "_id"]}`
    : `/browse/${item.found_id}`;
  return (
    <Link className="item-card" to={to}>
      <div
        className={
          "item-visual tone-" + ((item.category_id || item.found_id || 1) % 5)
        }
      >
        <span className="visual-category">{item.category_name}</span>
        <Icon
          name={item.category_name || item.item_name}
          size={76}
          strokeWidth={1.2}
        />
        <span className="visual-arrow">
          <ArrowUpRight size={18} />
        </span>
      </div>
      <div className="item-info">
        <div className="item-title">
          <h3>{item.item_name}</h3>
          <span className="tiny-dot" />
        </div>
        <p>
          <MapPin size={13} />
          {item.location_name || item.building}
        </p>
        <div className="item-meta">
          <span>{date(item[type + "_date"])}</span>
          {item.status && <Badge value={item.status} />}
        </div>
        {item.match_count > 0 && (
          <div className="match-hint">
            {item.match_count} possible{" "}
            {item.match_count === 1 ? "match" : "matches"}{" "}
            <ArrowRight size={13} />
          </div>
        )}
      </div>
    </Link>
  );
}
function Auth({ register = false }) {
  const { user, setUser, notify } = useApp(),
    nav = useNavigate(),
    [params] = useSearchParams(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const ret = params.get("return");
  const destination =
    ret?.startsWith("/") && !ret.startsWith("//") && !ret.includes("\\")
      ? ret
      : "/home";
  if (user) return <Navigate to={destination} replace />;
  async function submit(e) {
    e.preventDefault();
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    if (register && data.password !== data.confirm) {
      setError("Your passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (register) await api("/auth/register", { method: "POST", body: data });
      const d = await api("/auth/login", { method: "POST", body: data });
      session.set(d.token, d.refreshToken);
      setUser(d.user);
      notify(
        register
          ? "Welcome to FoundIt. Let’s help things find home."
          : "Welcome back.",
      );
      nav(destination, { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <div className="auth-story">
        <div className="eyebrow">YOU’RE IN GOOD COMPANY</div>
        <h1>
          Things get lost.
          <br />
          People bring
          <br />
          <span>them back.</span>
        </h1>
        <HeartHandshake size={100} strokeWidth={1} />
        <p>
          A few details. A helpful stranger.
          <br />A little everyday campus magic.
        </p>
        <div className="trust-note">
          <ShieldCheck size={18} /> Your contact details stay private until
          ownership is verified.
        </div>
      </div>
      <div className="auth-form">
        <div className="eyebrow">WELCOME TO FOUNDIT</div>
        <h2>
          {register ? "Join your campus community." : "Good to see you again."}
        </h2>
        <p>
          {register
            ? "Your next small act of kindness starts here."
            : "Sign in to find what matters to you."}
        </p>
        <form onSubmit={submit}>
          {error && <ErrorBox error={error} />}{" "}
          {register && (
            <Field label="Full name">
              <input
                name="full_name"
                autoComplete="name"
                required
                maxLength={120}
              />
            </Field>
          )}
          <Field label="Campus email">
            <input
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={params.get("email") || ""}
              required
              maxLength={160}
            />
          </Field>
          <Field
            label="Password"
            help={register ? "At least 8 characters." : ""}
          >
            <input
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              minLength={register ? 8 : 1}
              maxLength={72}
              required
            />
          </Field>
          {register && (
            <>
              <Field label="Confirm password">
                <input
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </Field>
              <div className="form-grid">
                <Field label="Phone (optional)">
                  <input
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    maxLength={20}
                  />
                </Field>
                <Field label="Department (optional)">
                  <input name="department" maxLength={100} />
                </Field>
              </div>
            </>
          )}
          <button className="button full" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : register ? (
              "Create account"
            ) : (
              "Sign in"
            )}
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="auth-switch">
          {register ? "Already part of the community?" : "New around here?"}{" "}
          <Link
            to={`${register ? "/login" : "/register"}?return=${encodeURIComponent(destination)}`}
          >
            {register ? "Sign in" : "Create an account"}
          </Link>
        </p>
        <small className="muted">
          Staff accounts are provided by your campus administrator.
        </small>
      </div>
    </div>
  );
}
function Dashboard() {
  const { user } = useApp(),
    s = useData("/items/mine"),
    c = useData("/claims");
  return (
    <div className="page">
      <PageHead
        eyebrow="A LITTLE HELP GOES A LONG WAY"
        heading={`Hello, ${user.full_name.split(" ")[0]}.`}
      >
        Let’s get good things back to their people.
      </PageHead>
      <div className="action-grid">
        <Link to="/report/lost" className="action-panel blue">
          <Search size={30} />
          <div>
            <h2>I lost something</h2>
            <p>Tell us about it. We’ll keep looking.</p>
          </div>
          <ArrowUpRight />
        </Link>
        <Link to="/report/found" className="action-panel peach">
          <Plus size={30} />
          <div>
            <h2>I found something</h2>
            <p>Help make someone’s day.</p>
          </div>
          <ArrowUpRight />
        </Link>
      </div>
      <Data state={s}>
        {(d) => (
          <>
            {d.lost
              .filter((x) => x.top_score >= 80 && x.status === "OPEN")
              .map((x) => (
                <Link
                  className="attention"
                  key={x.lost_id}
                  to={`/my/reports/lost/${x.lost_id}/matches`}
                >
                  <Bell />
                  <div>
                    <strong>A strong match for your {x.item_name}</strong>
                    <p>Something familiar is waiting. Take a closer look.</p>
                  </div>
                  <ArrowRight />
                </Link>
              ))}
            <div className="section-heading">
              <h2>Your active reports</h2>
              <Link className="text-link" to="/my/reports">
                View all <ArrowUpRight size={16} />
              </Link>
            </div>
            {d.lost.length + d.found.length ? (
              <div className="item-grid">
                {d.lost
                  .filter((x) => ["OPEN", "MATCHED"].includes(x.status))
                  .slice(0, 3)
                  .map((x) => (
                    <ItemCard key={"l" + x.lost_id} item={x} type="lost" own />
                  ))}
                {d.found
                  .filter((x) => ["AVAILABLE", "CLAIMED"].includes(x.status))
                  .slice(0, 3)
                  .map((x) => (
                    <ItemCard key={"f" + x.found_id} item={x} own />
                  ))}
              </div>
            ) : (
              <Empty
                title="Your first report starts something good."
                to="/report"
              >
                Lost something? We’ll compare it with every new find from now
                on. Found something? We’ll help you find its owner.
              </Empty>
            )}
          </>
        )}
      </Data>
      <div className="section-heading">
        <h2>Awaiting your help</h2>
        <Link className="text-link" to="/verify">
          Verification queue <ArrowUpRight size={16} />
        </Link>
      </div>
      <Data state={c}>
        {(d) => {
          const rows = d.claims.filter(
            (c) => c.can_verify && c.status === "PENDING",
          );
          return rows.length ? (
            <div className="list">
              {rows.map((c) => (
                <ClaimRow key={c.claim_id} claim={c} />
              ))}
            </div>
          ) : (
            <div className="quiet-card">
              <ShieldCheck />
              <div>
                <strong>You’re all caught up.</strong>
                <p>
                  When someone claims an item you found, you’ll see it here.
                </p>
              </div>
            </div>
          );
        }}
      </Data>
    </div>
  );
}
function ReportChooser() {
  return (
    <div className="page narrow">
      <PageHead heading="Every reunion starts here.">
        Which side of the story are you on?
      </PageHead>
      <div className="chooser">
        <Link className="action-panel blue" to="/report/lost">
          <Search />
          <div>
            <h2>I lost something</h2>
            <p>Report it once. We’ll keep looking.</p>
          </div>
          <ArrowRight />
        </Link>
        <Link className="action-panel peach" to="/report/found">
          <Plus />
          <div>
            <h2>I found something</h2>
            <p>A small act that makes a big difference.</p>
          </div>
          <ArrowRight />
        </Link>
      </div>
    </div>
  );
}
function Report({ edit = false }) {
  const p = useParams(),
    kind = edit ? "lost" : p.kind,
    refs = useData("/reference"),
    existing = useData(
      edit ? "/items/mine/lost/" + p.id : "/dashboard/summary",
    );
  const nav = useNavigate(),
    { notify, user } = useApp();
  const key = "foundit.draft." + kind;
  const [form, setForm] = useState(() => {
      try {
        return JSON.parse(sessionStorage.getItem(key)) || {};
      } catch {
        return {};
      }
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (edit && existing.data)
      setForm({
        ...existing.data,
        lost_date: existing.data.lost_date?.slice(0, 10),
      });
  }, [existing.data, edit]);
  function change(k, v) {
    setForm((f) => {
      const n = { ...f, [k]: v };
      if (!edit) sessionStorage.setItem(key, JSON.stringify(n));
      return n;
    });
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = { ...form, is_high_value: form.is_high_value === true };
      if (form.brand_id === "other") {
        body.brand_id = null;
      } else body.brand_other = null;
      const d = await api(edit ? "/items/lost/" + p.id : "/items/" + kind, {
        method: edit ? "PATCH" : "POST",
        body,
      });
      sessionStorage.removeItem(key);
      if (edit) {
        notify("Your report is updated. Matches have been checked again.");
        nav("/my/reports/lost/" + p.id);
      } else nav(`/report/success/${kind}/${d[kind + "_id"]}`, { state: d });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!["lost", "found"].includes(kind)) return <Navigate to="/report" />;
  return (
    <div className="page form-page">
      <Link
        className="back-link"
        to={edit ? "/my/reports/lost/" + p.id : "/report"}
      >
        <ArrowLeft size={16} /> Back
      </Link>
      <PageHead
        eyebrow={
          kind === "lost"
            ? "LET’S START LOOKING"
            : "A SMALL ACT. A BIG DIFFERENCE."
        }
        heading={
          edit
            ? "Update your report."
            : kind === "lost"
              ? "What are you missing?"
              : "What did you find?"
        }
      >
        {kind === "lost"
          ? "The more you remember, the better we can connect the dots."
          : "A few details could lead to someone’s very good day."}
      </PageHead>
      <Data state={refs}>
        {(r) => (
          <form className="report-form" onSubmit={submit}>
            {error && <ErrorBox error={error} />}
            <section className="form-section">
              <div className="form-section-title">
                <span>01</span>
                <div>
                  <h3>The essentials</h3>
                  <p>Start with what, where and when.</p>
                </div>
              </div>
              <Field label="Item name *">
                <input
                  value={form.item_name || ""}
                  onChange={(e) => change("item_name", e.target.value)}
                  placeholder="e.g. Blue steel water bottle"
                  required
                  maxLength={120}
                />
              </Field>
              <div className="form-grid">
                <Field label="Category *">
                  <select
                    required
                    value={form.category_id || ""}
                    onChange={(e) => change("category_id", e.target.value)}
                  >
                    <option value="">Choose a category</option>
                    {r.categories
                      .filter((x) => x.is_active)
                      .map((x) => (
                        <option key={x.category_id} value={x.category_id}>
                          {x.category_name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label={kind === "lost" ? "Date lost *" : "Date found *"}>
                  <input
                    type="date"
                    required
                    value={form[kind + "_date"] || ""}
                    max={new Date().toLocaleDateString("en-CA")}
                    onChange={(e) => change(kind + "_date", e.target.value)}
                  />
                </Field>
              </div>
              <Field label={kind === "lost" ? "Last seen at *" : "Found at *"}>
                <select
                  required
                  value={form.location_id || ""}
                  onChange={(e) => change("location_id", e.target.value)}
                >
                  <option value="">Choose a campus location</option>
                  {[
                    ...new Set(
                      r.locations
                        .filter((x) => x.is_active)
                        .map((x) => x.building),
                    ),
                  ].map((b) => (
                    <optgroup label={b} key={b}>
                      {r.locations
                        .filter((x) => x.is_active && x.building === b)
                        .map((x) => (
                          <option key={x.location_id} value={x.location_id}>
                            {x.location_name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              {kind === "lost" && (
                <div className="form-grid">
                  <Field label="Time from (optional)">
                    <input
                      type="time"
                      value={form.lost_time_from || ""}
                      onChange={(e) => change("lost_time_from", e.target.value)}
                    />
                  </Field>
                  <Field label="Time to (optional)">
                    <input
                      type="time"
                      value={form.lost_time_to || ""}
                      onChange={(e) => change("lost_time_to", e.target.value)}
                    />
                  </Field>
                </div>
              )}
            </section>
            <section className="form-section">
              <div className="form-section-title">
                <span>02</span>
                <div>
                  <h3>A little more detail</h3>
                  <p>Optional details help us find a better match.</p>
                </div>
              </div>
              <Field label="Brand">
                <select
                  value={form.brand_id || ""}
                  onChange={(e) => change("brand_id", e.target.value)}
                >
                  <option value="">Not sure / no brand</option>
                  {r.brands
                    .filter(
                      (x) => x.is_active && !x.brand_name.startsWith("Other"),
                    )
                    .map((x) => (
                      <option value={x.brand_id} key={x.brand_id}>
                        {x.brand_name}
                      </option>
                    ))}
                  <option value="other">Other brand</option>
                </select>
              </Field>
              {form.brand_id === "other" && (
                <Field label="Other brand">
                  <input
                    value={form.brand_other || ""}
                    onChange={(e) => change("brand_other", e.target.value)}
                    maxLength={80}
                    required
                  />
                </Field>
              )}
              <fieldset className="colour-field">
                <legend>Colour</legend>
                <div className="swatches">
                  <button
                    type="button"
                    aria-pressed={!form.colour_id}
                    className={!form.colour_id ? "selected" : ""}
                    onClick={() => change("colour_id", null)}
                  >
                    Not sure
                  </button>
                  {r.colours
                    .filter((x) => x.is_active)
                    .map((x) => (
                      <button
                        key={x.colour_id}
                        type="button"
                        className={
                          String(form.colour_id) === String(x.colour_id)
                            ? "selected"
                            : ""
                        }
                        aria-pressed={
                          String(form.colour_id) === String(x.colour_id)
                        }
                        onClick={() => change("colour_id", x.colour_id)}
                      >
                        <span style={{ background: x.hex_value }} />
                        {x.colour_name}
                      </button>
                    ))}
                </div>
              </fieldset>
              <Field
                label="Public description"
                help="Visible to the campus. Leave out names, ID numbers and private identifying details."
              >
                <textarea
                  rows={4}
                  value={form.description || ""}
                  onChange={(e) => change("description", e.target.value)}
                  maxLength={3000}
                  placeholder="A general description, the condition, or what it looks like…"
                />
              </Field>
            </section>
            {kind === "found" && (
              <>
                <section className="form-section private-section">
                  <div className="form-section-title">
                    <LockKeyhole />
                    <div>
                      <h3>One detail only the owner would know</h3>
                      <p>
                        This stays private. It helps you verify the real owner.
                      </p>
                    </div>
                  </div>
                  <Field
                    label="Private identifying detail *"
                    help="For example, an engraving, a sticker inside, or what was in the bag. Do not repeat this in the public description."
                  >
                    <textarea
                      rows={3}
                      value={form.private_feature || ""}
                      onChange={(e) =>
                        change("private_feature", e.target.value)
                      }
                      maxLength={3000}
                      required
                    />
                  </Field>
                </section>
                <section className="form-section">
                  <div className="form-section-title">
                    <span>03</span>
                    <div>
                      <h3>Keep it in safe hands</h3>
                      <p>Where can the item be collected after verification?</p>
                    </div>
                  </div>
                  <Field label="Who is holding the item? *">
                    <select
                      required
                      value={form.custody || ""}
                      onChange={(e) => change("custody", e.target.value)}
                    >
                      <option value="">Choose custody</option>
                      <option value="WITH_FINDER">I’m keeping it safe</option>
                      <option value="DEPOSITED_SECURITY">
                        Campus security
                      </option>
                      <option value="DEPOSITED_DEPARTMENT">
                        Department office
                      </option>
                      <option value="DEPOSITED_HOSTEL">Hostel office</option>
                    </select>
                  </Field>
                  {form.custody && form.custody !== "WITH_FINDER" && (
                    <Field
                      label="Exact storage location *"
                      help="Only shared after a claim is approved."
                    >
                      <input
                        value={form.storage_location || ""}
                        onChange={(e) =>
                          change("storage_location", e.target.value)
                        }
                        maxLength={160}
                        required
                      />
                    </Field>
                  )}
                  {["STAFF", "ADMIN"].includes(user.role) && (
                    <>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={form.anonymous || false}
                          onChange={(e) =>
                            change("anonymous", e.target.checked)
                          }
                        />{" "}
                        Record on behalf of an anonymous finder
                      </label>
                      {form.anonymous && (
                        <Field label="Finder note (optional)">
                          <input
                            value={form.finder_note || ""}
                            onChange={(e) =>
                              change("finder_note", e.target.value)
                            }
                            maxLength={160}
                          />
                        </Field>
                      )}
                    </>
                  )}
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={form.is_high_value || false}
                      onChange={(e) =>
                        change("is_high_value", e.target.checked)
                      }
                    />{" "}
                    This is a high-value item
                  </label>
                  <p className="hint">
                    Sensitive and high-value items require campus staff
                    verification. Please hand these in to security.
                  </p>
                </section>
              </>
            )}
            <div className="form-submit">
              <span>
                <ShieldCheck size={16} /> Your contact details stay private.
              </span>
              <button className="button" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : edit ? (
                  "Save changes"
                ) : kind === "lost" ? (
                  "Start looking"
                ) : (
                  "Help it find home"
                )}
                <ArrowRight size={17} />
              </button>
            </div>
          </form>
        )}
      </Data>
    </div>
  );
}
function Success() {
  const { kind, id } = useParams(),
    l = useLocation();
  return (
    <div className="page narrow">
      <div className="success-card">
        <div className="success-icon">
          <Check size={36} />
        </div>
        <div className="eyebrow">A GOOD THING JUST STARTED</div>
        <h1>
          {kind === "lost"
            ? "We’re on the lookout."
            : "You made someone’s day a little closer."}
        </h1>
        <p>
          {kind === "lost"
            ? l.state?.topMatch
              ? "We’ve already found a possible match. Take a look and see if it feels familiar."
              : "Your report is now a standing search. We’ll compare every new find with your details. No match today doesn’t mean no match tomorrow."
            : l.state?.custody_instruction ||
              "Keep the item safe. We’ll help connect it with its owner and verify their claim."}
        </p>
        <div className="button-row">
          {kind === "lost" && (
            <Link className="button" to={`/my/reports/lost/${id}/matches`}>
              Check matches <ArrowRight size={16} />
            </Link>
          )}
          <Link className="button secondary" to="/my/reports">
            View my reports
          </Link>
        </div>
      </div>
    </div>
  );
}
function Browse() {
  const [params, setParams] = useSearchParams(),
    [search, setSearch] = useState(params.get("q") || ""),
    refs = useData("/reference"),
    [filters, setFilters] = useState(false);
  const s = useData("/items/found?" + params.toString()),
    offset = Number(params.get("offset") || 0);
  function change(key, value) {
    const p = new URLSearchParams(params);
    value ? p.set(key, value) : p.delete(key);
    p.delete("offset");
    setParams(p);
  }
  return (
    <div className="page">
      <PageHead
        eyebrow="SOMEONE FOUND IT. MAYBE IT’S YOURS."
        heading="A familiar thing could be here."
      >
        Take a look around. Your next happy reunion might be one click away.
      </PageHead>
      <div className="browse-search">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            change("q", search);
          }}
        >
          <Search size={20} />
          <input
            aria-label="Search found items"
            placeholder="What are you looking for?"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="button small">Search</button>
        </form>
        <button
          className="button secondary filter-toggle"
          onClick={() => setFilters(!filters)}
          aria-expanded={filters}
        >
          <SlidersHorizontal size={17} /> Filters
        </button>
      </div>
      <div className="browse-layout">
        <aside className={"filters " + (filters ? "visible" : "")}>
          <div className="section-heading">
            <h3>Narrow it down</h3>
            <button
              className="text-button"
              onClick={() => {
                setParams({});
                setSearch("");
              }}
            >
              Reset
            </button>
          </div>
          {refs.data && (
            <>
              <Field label="Category">
                <select
                  value={params.get("category_id") || ""}
                  onChange={(e) => change("category_id", e.target.value)}
                >
                  <option value="">All categories</option>
                  {refs.data.categories.map((x) => (
                    <option key={x.category_id} value={x.category_id}>
                      {x.category_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Building">
                <select
                  value={params.get("building") || ""}
                  onChange={(e) => change("building", e.target.value)}
                >
                  <option value="">Everywhere on campus</option>
                  {[...new Set(refs.data.locations.map((x) => x.building))].map(
                    (b) => (
                      <option key={b}>{b}</option>
                    ),
                  )}
                </select>
              </Field>
              <Field label="Location">
                <select
                  value={params.get("location_id") || ""}
                  onChange={(e) => change("location_id", e.target.value)}
                >
                  <option value="">All locations</option>
                  {refs.data.locations.map((x) => (
                    <option key={x.location_id} value={x.location_id}>
                      {x.location_name} · {x.building}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Colour">
                <select
                  value={params.get("colour_id") || ""}
                  onChange={(e) => change("colour_id", e.target.value)}
                >
                  <option value="">Any colour</option>
                  {refs.data.colours.map((x) => (
                    <option key={x.colour_id} value={x.colour_id}>
                      {x.colour_name}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
          <Field label="Found after">
            <input
              type="date"
              value={params.get("date_from") || ""}
              onChange={(e) => change("date_from", e.target.value)}
            />
          </Field>
          <Field label="Found before">
            <input
              type="date"
              value={params.get("date_to") || ""}
              onChange={(e) => change("date_to", e.target.value)}
            />
          </Field>
          <div className="filter-note">
            <ShieldCheck />
            <p>
              Private details stay private.
              <br />
              Every handover starts with verified ownership.
            </p>
          </div>
        </aside>
        <div>
          <div className="results-bar">
            <span>
              <strong>{s.data?.total ?? "—"}</strong> items waiting to be
              recognised
            </span>
            <select
              aria-label="Sort items"
              value={params.get("sort") || "newest"}
              onChange={(e) => change("sort", e.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
          <Data state={s}>
            {(d) =>
              d.items.length ? (
                <>
                  <div className="item-grid browse-grid">
                    {d.items.map((i) => (
                      <ItemCard key={i.found_id} item={i} />
                    ))}
                  </div>
                  <div className="pagination">
                    <button
                      className="button secondary"
                      disabled={!offset}
                      onClick={() => {
                        const p = new URLSearchParams(params);
                        p.set("offset", Math.max(0, offset - 12));
                        setParams(p);
                      }}
                    >
                      Previous
                    </button>
                    <span>Page {Math.floor(offset / 12) + 1}</span>
                    <button
                      className="button secondary"
                      disabled={offset + 12 >= d.total}
                      onClick={() => {
                        const p = new URLSearchParams(params);
                        p.set("offset", offset + 12);
                        setParams(p);
                      }}
                    >
                      Next
                    </button>
                  </div>
                </>
              ) : (
                <Empty
                  title={
                    params.size
                      ? "Nothing quite matches these details."
                      : "No found items have been reported yet."
                  }
                  to="/report/lost"
                  label="Report what you lost"
                >
                  {params.size
                    ? "Try fewer filters or a different search. You can also file a lost report so we can keep looking."
                    : "Report your missing item now. We’ll check it against every new find."}
                </Empty>
              )
            }
          </Data>
        </div>
      </div>
    </div>
  );
}
function ItemFacts({ item, kind = "found" }) {
  return (
    <dl className="facts">
      {[
        ["Category", item.category_name],
        ["Location", item.location_name || item.building],
        ["Brand", item.brand_name || item.brand_other || "Not specified"],
        ["Colour", item.colour_name || "Not specified"],
        [kind === "lost" ? "Lost on" : "Found on", date(item[kind + "_date"])],
        ["Status", title(item.status)],
      ].map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
function FoundDetail() {
  const { id } = useParams(),
    s = useData("/items/found/" + id);
  return (
    <div className="page">
      <Link className="back-link" to="/browse">
        <ArrowLeft size={16} /> Browse items
      </Link>
      <Data state={s}>
        {(i) => (
          <div className="detail-layout">
            <div className={"detail-art tone-" + (i.category_id % 5)}>
              <Icon name={i.category_name} size={170} strokeWidth={1} />
              <span>EVERYDAY THINGS. EVERYDAY KINDNESS.</span>
            </div>
            <div>
              <PageHead eyebrow="FOUND ON CAMPUS" heading={i.item_name} />
              <Badge value={i.status} />
              <ItemFacts item={i} />
              <p className="description">
                {i.description ||
                  "No public description was provided. A private identifying detail will help verify the owner."}
              </p>
              <div className="quiet-card">
                <LockKeyhole />
                <p>
                  Looks like yours? File a lost report with the details you
                  remember. We’ll compare it with this and other found items.
                </p>
              </div>
              <Link className="button full" to="/report/lost">
                Report my lost item <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}
      </Data>
    </div>
  );
}
function MyReports() {
  const s = useData("/items/mine"),
    [tab, setTab] = useState("lost");
  return (
    <div className="page">
      <PageHead
        heading="Your reports. Our lookout."
        action={
          <Link className="button" to="/report">
            <Plus size={17} /> New report
          </Link>
        }
      >
        Every report is another chance for things to find their way back.
      </PageHead>
      <div className="tabs">
        <button
          className={tab === "lost" ? "active" : ""}
          onClick={() => setTab("lost")}
        >
          Lost reports
        </button>
        <button
          className={tab === "found" ? "active" : ""}
          onClick={() => setTab("found")}
        >
          Found reports
        </button>
      </div>
      <Data state={s}>
        {(d) =>
          d[tab].length ? (
            <div className="item-grid">
              {d[tab].map((i) => (
                <ItemCard key={i[tab + "_id"]} item={i} type={tab} own />
              ))}
            </div>
          ) : (
            <Empty
              title={`No ${tab} reports yet.`}
              to={"/report/" + tab}
              label={
                tab === "lost" ? "Report a lost item" : "Report a found item"
              }
            >
              {tab === "lost"
                ? "Report what you’re missing and we’ll keep checking new finds."
                : "Found something on campus? A quick report could make someone’s day."}
            </Empty>
          )
        }
      </Data>
    </div>
  );
}
function LostDetail() {
  const { id } = useParams(),
    s = useData("/items/mine/lost/" + id),
    { notify } = useApp(),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false);
  async function withdraw() {
    setBusy(true);
    try {
      await api("/items/lost/" + id + "/withdraw", { method: "POST" });
      setConfirm(false);
      s.reload();
      notify("Your report is withdrawn.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page narrow">
      <Link className="back-link" to="/my/reports">
        <ArrowLeft size={16} /> My reports
      </Link>
      <Data state={s}>
        {(i) => (
          <>
            <PageHead eyebrow="YOUR LOST REPORT" heading={i.item_name} />
            <Badge value={i.status} />
            <ItemFacts item={i} kind="lost" />
            <p>{i.description}</p>
            {error && <ErrorBox error={error} />}
            <div className="button-row">
              <Link className="button" to={`/my/reports/lost/${id}/matches`}>
                View possible matches <ArrowRight size={17} />
              </Link>
              {i.status === "OPEN" && (
                <>
                  <Link
                    className="button secondary"
                    to={`/my/reports/lost/${id}/edit`}
                  >
                    Edit report
                  </Link>
                  <button
                    className="text-button danger"
                    onClick={() => setConfirm(true)}
                  >
                    Withdraw report
                  </button>
                </>
              )}
            </div>
            {confirm && (
              <div className="confirm-panel" role="alert">
                <h3>Stop looking for this item?</h3>
                <p>
                  This closes the report and invalidates its suggested matches.
                </p>
                <div className="button-row">
                  <button
                    disabled={busy}
                    className="button danger-button"
                    onClick={withdraw}
                  >
                    Withdraw report
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => setConfirm(false)}
                  >
                    Keep looking
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Data>
    </div>
  );
}
function OwnFound() {
  const { id } = useParams(),
    s = useData("/items/mine/found/" + id);
  return (
    <div className="page narrow">
      <Data state={s}>
        {(i) => (
          <>
            <PageHead eyebrow="YOUR FOUND REPORT" heading={i.item_name} />
            <Badge value={i.status} />
            <ItemFacts item={i} />
            <p>{i.description}</p>
            <div className="private-section card">
              <LockKeyhole />
              <h3>Your private identifying detail</h3>
              <p>{i.private_feature}</p>
            </div>
            <p>
              Custody: {title(i.custody)}
              {i.storage_location && ` · ${i.storage_location}`}
            </p>
            <Link className="button" to="/verify">
              Review ownership claims <ArrowRight size={17} />
            </Link>
            {i.status === "AVAILABLE" && (
              <CustodyEditor item={i} reload={s.reload} />
            )}
          </>
        )}
      </Data>
    </div>
  );
}
function CustodyEditor({ item, reload }) {
  const { notify } = useApp(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [custody, setCustody] = useState(item.custody);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/items/found/" + item.found_id + "/custody", {
        method: "PATCH",
        body: {
          custody,
          storage_location: new FormData(e.currentTarget).get(
            "storage_location",
          ),
        },
      });
      reload();
      notify("Custody details updated.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="card custody-editor" onSubmit={submit}>
      <h2>Update safe keeping</h2>
      {error && <ErrorBox error={error} />}
      <Field label="Who is holding the item?">
        <select value={custody} onChange={(e) => setCustody(e.target.value)}>
          <option value="WITH_FINDER">The finder</option>
          <option value="DEPOSITED_SECURITY">Campus security</option>
          <option value="DEPOSITED_DEPARTMENT">Department office</option>
          <option value="DEPOSITED_HOSTEL">Hostel office</option>
        </select>
      </Field>
      {custody !== "WITH_FINDER" && (
        <Field label="Exact storage location">
          <input
            name="storage_location"
            defaultValue={item.storage_location || ""}
            maxLength={160}
            required
          />
        </Field>
      )}
      <button className="button secondary" disabled={busy}>
        Update custody
      </button>
    </form>
  );
}
function MatchCard({ match }) {
  return (
    <Link className="match-card" to={"/matches/" + match.match_id}>
      <div className="match-icon">
        <Icon name={match.category_name} />
      </div>
      <div>
        <h3>{match.item_name}</h3>
        <p>
          <MapPin size={13} /> {match.location_name} · {date(match.found_date)}
        </p>
        <div className="match-reasons">
          {match.reason_json.components
            .filter((c) => c.points > 0)
            .slice(0, 3)
            .map((c) => (
              <span key={c.code}>
                <Check size={12} />
                {c.label || title(c.code)}
              </span>
            ))}
        </div>
      </div>
      <div className={"score " + match.match_band.toLowerCase()}>
        <strong>{match.match_score}</strong>
        <span>{title(match.match_band)} match</span>
      </div>
      <ChevronRight />
    </Link>
  );
}
function MatchList() {
  const { id } = useParams(),
    s = useData("/matches/lost/" + id);
  return (
    <div className="page">
      <Link className="back-link" to={"/my/reports/lost/" + id}>
        <ArrowLeft size={16} /> Your report
      </Link>
      <PageHead heading="A few dots connected.">
        Every match comes with a reason. Take a closer look to see what feels
        familiar.
      </PageHead>
      <Data state={s}>
        {(d) =>
          d.matches.length ? (
            <div className="match-list">
              {["STRONG", "POSSIBLE"].map(
                (b) =>
                  d.matches.some((m) => m.match_band === b) && (
                    <section key={b}>
                      <h3 className="group-label">{title(b)} matches</h3>
                      {d.matches
                        .filter((m) => m.match_band === b)
                        .map((m) => (
                          <MatchCard key={m.match_id} match={m} />
                        ))}
                    </section>
                  ),
              )}
              {d.matches.some((m) => m.match_band === "WEAK") && (
                <details>
                  <summary>
                    Show weaker matches (
                    {d.matches.filter((m) => m.match_band === "WEAK").length})
                  </summary>
                  {d.matches
                    .filter((m) => m.match_band === "WEAK")
                    .map((m) => (
                      <MatchCard key={m.match_id} match={m} />
                    ))}
                </details>
              )}
            </div>
          ) : (
            <Empty
              title="Still looking. Still hopeful."
              to="/browse"
              label="Browse found items"
            >
              Your report stays active. Every new found item will be compared
              with your details automatically. Check back as the campus keeps
              finding things.
            </Empty>
          )
        }
      </Data>
    </div>
  );
}
function MatchDetail() {
  const { id } = useParams(),
    s = useData("/matches/" + id),
    [error, setError] = useState(""),
    [dismissed, setDismissed] = useState(false),
    [busy, setBusy] = useState(false);
  async function dismiss(undo = false) {
    setBusy(true);
    try {
      await api("/matches/" + id + (undo ? "/restore" : "/dismiss"), {
        method: "POST",
      });
      setDismissed(!undo);
      s.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page narrow">
      <Data state={s}>
        {(m) => (
          <>
            <Link
              className="back-link"
              to={`/my/reports/lost/${m.lost_id}/matches`}
            >
              <ArrowLeft size={16} /> All matches
            </Link>
            <PageHead
              eyebrow="THE DETAILS TELL THE STORY"
              heading="Does this look like yours?"
            />
            {error && <ErrorBox error={error} />}
            <div className="comparison">
              <div className="card">
                <div className="eyebrow">YOUR REPORT</div>
                <h2>{m.lost_name}</h2>
                <p>
                  <Calendar size={14} /> Lost {date(m.lost_date)}
                </p>
                <p>{m.lost_description || "No description provided."}</p>
              </div>
              <div className="card blue-card">
                <div className="eyebrow">THE FOUND ITEM</div>
                <h2>{m.item_name}</h2>
                <p>
                  <Calendar size={14} /> Found {date(m.found_date)}
                </p>
                <p>
                  <MapPin size={14} /> {m.location_name}
                </p>
                <p>{m.description}</p>
              </div>
            </div>
            <section className="score-breakdown">
              <h3>Why we connected these dots</h3>
              {m.reason_json.components.map((c) => (
                <div className="reason-row" key={c.code}>
                  <span>
                    {c.label || title(c.code)}
                    {c.gap !== undefined &&
                      ` · ${c.gap} day${c.gap === 1 ? "" : "s"} apart`}
                  </span>
                  <strong>+{c.points}</strong>
                </div>
              ))}
              <div className="reason-total">
                <span>Match score</span>
                <div>
                  <strong>{m.reason_json.total}</strong>
                  <Badge value={m.match_band} />
                </div>
              </div>
              <small>
                These reasons are calculated from your report details. They are
                a guide, not proof of ownership.
              </small>
            </section>
            {dismissed ? (
              <div className="attention">
                <p>Match dismissed. Changed your mind?</p>
                <button
                  className="button secondary"
                  onClick={() => dismiss(true)}
                  disabled={busy}
                >
                  Undo dismissal
                </button>
              </div>
            ) : (
              <div className="button-row">
                {m.status === "SUGGESTED" && m.found_status === "AVAILABLE" && (
                  <>
                    <Link className="button" to={"/claims/new/" + id}>
                      This could be mine <ArrowRight size={17} />
                    </Link>
                    <button
                      className="button secondary"
                      onClick={() => dismiss()}
                      disabled={busy}
                    >
                      Not my item
                    </button>
                  </>
                )}
                {m.status === "CLAIMED" && (
                  <Link className="button" to="/my/claims">
                    View your pending claim
                  </Link>
                )}
                {m.found_status !== "AVAILABLE" && (
                  <p>This item is no longer available for a new claim.</p>
                )}
              </div>
            )}
          </>
        )}
      </Data>
    </div>
  );
}
function ClaimForm() {
  const { id } = useParams(),
    s = useData("/matches/" + id),
    nav = useNavigate(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const d = await api("/claims", {
        method: "POST",
        body: {
          match_id: Number(id),
          proof_text: new FormData(e.currentTarget).get("proof_text"),
        },
      });
      nav("/my/claims/" + d.claim_id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page narrow">
      <Data state={s}>
        {(m) => (
          <>
            <PageHead
              eyebrow="A LITTLE PROOF PROTECTS EVERYONE"
              heading="Tell us what makes it yours."
            >
              Claiming: {m.item_name}
            </PageHead>
            <div className="quiet-card">
              <ShieldCheck />
              <p>
                The finder shared one detail that isn’t public. Describe a mark,
                an engraving, what’s inside, or something else only the owner
                would know. Your answer goes only to the verifier.
              </p>
            </div>
            <form className="card" onSubmit={submit}>
              {error && <ErrorBox error={error} />}
              <Field
                label="Proof of ownership *"
                help="At least 10 characters. Be specific. Your contact details remain private until approval."
              >
                <textarea
                  name="proof_text"
                  rows={6}
                  minLength={10}
                  maxLength={3000}
                  required
                  placeholder="The detail that makes this unmistakably yours…"
                />
              </Field>
              <button
                className="button"
                disabled={
                  busy ||
                  m.status !== "SUGGESTED" ||
                  m.found_status !== "AVAILABLE"
                }
              >
                {busy ? "Submitting…" : "Submit ownership claim"}
                <ArrowRight size={17} />
              </button>
            </form>
          </>
        )}
      </Data>
    </div>
  );
}
function ClaimRow({ claim: c }) {
  return (
    <Link className="list-row" to={"/my/claims/" + c.claim_id}>
      <span className="list-icon">
        <Icon name={c.category_name} />
      </span>
      <div>
        <h3>{c.item_name}</h3>
        <p>
          {c.is_claimant
            ? "Your ownership claim"
            : c.can_verify
              ? "Waiting for your verification"
              : "Reported by you"}{" "}
          · {date(c.claimed_at)}
        </p>
      </div>
      <Badge value={c.status} />
      <ChevronRight size={18} />
    </Link>
  );
}
function Claims({ verify = false }) {
  const s = useData("/claims");
  return (
    <div className="page">
      <PageHead
        eyebrow={
          verify
            ? "HELP THE RIGHT PERSON FIND THEIR THING"
            : "ONE STEP CLOSER TO HOME"
        }
        heading={
          verify
            ? "A little care. A lot of trust."
            : "Your claims, at a glance."
        }
      >
        {verify
          ? "Compare the private details carefully before approving ownership."
          : "Follow your ownership claims from proof to happy reunion."}
      </PageHead>
      <Data state={s}>
        {(d) => {
          const rows = d.claims.filter(
            (c) => !verify || (c.can_verify && c.status === "PENDING"),
          );
          return rows.length ? (
            <div className="list">
              {rows.map((c) => (
                <ClaimRow key={c.claim_id} claim={c} />
              ))}
            </div>
          ) : (
            <Empty
              title={
                verify
                  ? "You’re all caught up."
                  : "No claims yet. The search continues."
              }
              to={verify ? "/home" : "/my/reports"}
              label={verify ? "Back to home" : "Check your reports"}
            >
              {verify
                ? "When someone claims an item you can verify, their request will appear here."
                : "Find a possible match for your lost report, then share a detail only you would know."}
            </Empty>
          );
        }}
      </Data>
    </div>
  );
}
function ClaimDetail() {
  const { id } = useParams(),
    s = useData("/claims/" + id),
    { notify } = useApp(),
    [error, setError] = useState(""),
    [action, setAction] = useState(""),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState("");
  async function perform() {
    setBusy(true);
    setError("");
    try {
      await api(`/claims/${id}/${action}`, {
        method: "POST",
        body: { decision_note: note || undefined },
      });
      setAction("");
      s.reload();
      notify("Claim updated. Thank you for taking care.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page narrow">
      <Link className="back-link" to="/my/claims">
        <ArrowLeft size={16} /> Your claims
      </Link>
      <Data state={s}>
        {(c) => (
          <>
            <PageHead
              eyebrow={"OWNERSHIP CLAIM #" + c.claim_id}
              heading={c.item_name}
            />
            <Badge value={c.status} />
            <p className="muted">
              Submitted {date(c.claimed_at)}
              {c.decided_at && ` · Decided ${date(c.decided_at)}`}
            </p>
            {error && <ErrorBox error={error} />}
            <div className="claim-progress">
              {["PENDING", "APPROVED", "COMPLETED"].map((v, i) => (
                <div
                  key={v}
                  className={
                    (["APPROVED", "COMPLETED"].includes(c.status) &&
                      i <=
                        ["PENDING", "APPROVED", "COMPLETED"].indexOf(
                          c.status,
                        )) ||
                    c.status === v
                      ? "done"
                      : ""
                  }
                >
                  <span>{i + 1}</span>
                  {
                    [
                      "Proof submitted",
                      "Ownership verified",
                      "Back in good hands",
                    ][i]
                  }
                </div>
              ))}
            </div>
            {c.status === "PENDING" &&
              (c.can_verify ? (
                <>
                  <h2>Is this their item?</h2>
                  <div className="comparison">
                    <blockquote>
                      <span className="eyebrow">
                        THE PRIVATE IDENTIFYING DETAIL
                      </span>
                      <p>{c.private_feature}</p>
                    </blockquote>
                    <blockquote className="blue-card">
                      <span className="eyebrow">THE CLAIMANT’S ANSWER</span>
                      <p>{c.proof_text}</p>
                    </blockquote>
                  </div>
                  <p>
                    Only approve if the details establish ownership. If you’re
                    unsure, ask campus security to review it.
                  </p>
                  <div className="button-row">
                    <button
                      className="button"
                      onClick={() => setAction("approve")}
                    >
                      <ShieldCheck size={17} /> Yes, it’s theirs
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setAction("reject")}
                    >
                      Details don’t match
                    </button>
                  </div>
                </>
              ) : (
                <div className="quiet-card">
                  <ShieldCheck />
                  <div>
                    <h3>Your proof is being reviewed.</h3>
                    <p>
                      The finder or campus staff will compare your answer with
                      the private identifying detail. Your contact information
                      stays private until approval.
                    </p>
                    {c.is_claimant && (
                      <button
                        className="text-button"
                        onClick={() => setAction("withdraw")}
                      >
                        Withdraw this claim
                      </button>
                    )}
                  </div>
                </div>
              ))}
            {c.status === "REJECTED" && (
              <div className="quiet-card">
                <p>
                  {c.decision_note ||
                    "The identifying details did not establish ownership. Check your other matches or ask campus security for help."}
                </p>
              </div>
            )}
            {["APPROVED", "COMPLETED"].includes(c.status) && (
              <>
                <section className="card">
                  <h2>
                    {c.status === "COMPLETED"
                      ? "A happy reunion."
                      : "Ownership verified. Time to reconnect."}
                  </h2>
                  <p>
                    {c.status === "COMPLETED"
                      ? "This item is back with its person. Thank you for making it happen."
                      : "Arrange a handover at a safe campus location. Confirm completion after the item has been received."}
                  </p>
                  <div className="comparison">
                    {[
                      ["Owner", c.claimant_contact],
                      ["Finder", c.finder_contact],
                    ].map(([label, contact]) => (
                      <div key={label}>
                        <div className="eyebrow">{label}</div>
                        {contact?.email ? (
                          <>
                            <h3>{contact.full_name}</h3>
                            <p>
                              <a href={"mailto:" + contact.email}>
                                {contact.email}
                              </a>
                            </p>
                            {contact.phone && (
                              <a href={"tel:" + contact.phone}>
                                {contact.phone}
                              </a>
                            )}
                          </>
                        ) : (
                          <p>Contact campus security for collection.</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {c.storage_location && (
                    <p>
                      <strong>Collection location:</strong> {c.storage_location}
                    </p>
                  )}
                  {c.status === "APPROVED" && (
                    <button
                      className="button"
                      onClick={() => setAction("handover")}
                    >
                      <HeartHandshake size={18} /> Confirm physical handover
                    </button>
                  )}
                </section>
              </>
            )}
            <Link className="text-link" to={"/timeline/claim/" + id}>
              View the full timeline <ArrowRight size={16} />
            </Link>
            {action && (
              <div className="confirm-panel" role="alert">
                <h3>
                  {action === "approve"
                    ? "Approve this ownership claim?"
                    : action === "reject"
                      ? "Reject this claim?"
                      : action === "withdraw"
                        ? "Withdraw your claim?"
                        : "Has the item been handed over?"}
                </h3>
                <p>
                  {action === "approve"
                    ? "This shares contact details and rejects competing pending claims. Only continue if the private detail matches."
                    : action === "handover"
                      ? "Confirm only after the owner has physically received the item."
                      : "Confirm your decision below."}
                </p>
                {action === "reject" && (
                  <Field label="Reason (optional)">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={300}
                    />
                  </Field>
                )}
                <div className="button-row">
                  <button className="button" disabled={busy} onClick={perform}>
                    {busy ? "Updating…" : "Confirm " + title(action)}
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => setAction("")}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Data>
    </div>
  );
}
function Timeline() {
  const { id } = useParams(),
    s = useData("/claims/timeline/" + id);
  return (
    <div className="page narrow">
      <PageHead
        eyebrow="EVERY STEP, ACCOUNTED FOR"
        heading="The story so far."
      />
      <Data state={s}>
        {(d) => (
          <ol className="timeline">
            {d.timeline.map((e) => (
              <li key={e.audit_id}>
                <span className="timeline-node">
                  <Check size={13} />
                </span>
                <div>
                  <small>
                    {new Date(e.changed_at).toLocaleString("en-IN")}
                  </small>
                  <h3>
                    {title(e.entity_type)} ·{" "}
                    {e.old_status
                      ? `${title(e.old_status)} → ${title(e.new_status)}`
                      : title(e.action)}
                  </h3>
                  <p>{e.actor}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Data>
    </div>
  );
}
function Profile() {
  const { user, setUser, notify } = useApp(),
    nav = useNavigate(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const d = await api("/auth/me", {
        method: "PATCH",
        body: Object.fromEntries(new FormData(e.currentTarget)),
      });
      setUser(d.user);
      notify("Your profile is updated.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page narrow">
      <PageHead heading="A little about you.">
        Your contact details are shared only after verified ownership.
      </PageHead>
      <form className="card" onSubmit={submit}>
        {error && <ErrorBox error={error} />}
        <Field label="Full name">
          <input
            name="full_name"
            defaultValue={user.full_name}
            maxLength={120}
            required
          />
        </Field>
        <Field label="Email">
          <input value={user.email} disabled />
        </Field>
        <div className="form-grid">
          <Field label="Phone">
            <input
              name="phone"
              type="tel"
              defaultValue={user.phone || ""}
              maxLength={20}
            />
          </Field>
          <Field label="Department">
            <input
              name="department"
              defaultValue={user.department || ""}
              maxLength={100}
            />
          </Field>
        </div>
        <p>
          Account type: <Badge value={user.role} />
        </p>
        <div className="button-row">
          <button className="button" disabled={busy}>
            {busy ? "Saving…" : "Save profile"}
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={async () => {
              try {
                await api("/auth/logout", { method: "POST", body: {} });
                session.clear();
                setUser(null);
                nav("/");
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </form>
    </div>
  );
}
function Staff() {
  const { user } = useApp(),
    s = useData("/dashboard/analytics"),
    reports = useData("/items/mine?all=true");
  if (!["STAFF", "ADMIN"].includes(user.role)) return <Navigate to="/home" />;
  return (
    <div className="page">
      <PageHead
        eyebrow="CAMPUS CARE, AT A GLANCE"
        heading="A clearer view of your campus."
        action={
          <Link className="button" to="/staff/intake">
            <Plus size={17} /> Record a found item
          </Link>
        }
      />
      <div className="button-row">
        <Link className="button secondary" to="/verify">
          Review claims
        </Link>
        {user.role === "ADMIN" && (
          <Link className="button secondary" to="/admin/config">
            Matching settings
          </Link>
        )}
        {user.role === "ADMIN" &&
          ["categories", "locations", "brands", "colours"].map((k) => (
            <Link
              key={k}
              className="button secondary"
              to={"/admin/reference/" + k}
            >
              {title(k)}
            </Link>
          ))}
      </div>
      <Data state={s}>
        {(d) => (
          <>
            <div className="metric-grid">
              {[
                ["Available items", d.available],
                ["Returned to owners", d.returned],
                ["Open lost reports", d.open_reports],
                ["Returned this month", d.returned_this_month],
              ].map(([l, n]) => (
                <div className="metric" key={l}>
                  <strong>{n}</strong>
                  <span>{l}</span>
                </div>
              ))}
            </div>
            <div className="comparison">
              <section className="card">
                <h2>Campus loss hotspots</h2>
                {d.hotspots.map((x) => (
                  <div className="bar-row" key={x.building}>
                    <span>{x.building}</span>
                    <div>
                      <i
                        style={{
                          width: `${(x.reports / Math.max(1, d.hotspots[0]?.reports)) * 100}%`,
                        }}
                      />
                    </div>
                    <strong>{x.reports}</strong>
                  </div>
                ))}
              </section>
              <section className="card">
                <h2>Reports by category</h2>
                {d.categories.map((x) => (
                  <div className="reason-row" key={x.category_name}>
                    <span>{x.category_name}</span>
                    <strong>
                      {x.returned} returned / {x.reported}
                    </strong>
                  </div>
                ))}
              </section>
            </div>
            <section className="card">
              <h2>Items waiting more than 30 days</h2>
              {d.ageing.length ? (
                d.ageing.map((x) => (
                  <div className="reason-row" key={x.found_id}>
                    <span>
                      {x.item_name}
                      <small>{x.storage_location || title(x.custody)}</small>
                    </span>
                    <strong>{x.days_held} days</strong>
                  </div>
                ))
              ) : (
                <p>No available items have been waiting more than 30 days.</p>
              )}
            </section>
            <section className="card">
              <h2>Accounts for review</h2>
              {d.flagged_users.length ? (
                d.flagged_users.map((x) => (
                  <p key={x.user_id}>
                    {x.full_name} · {x.flagged_count} rejected claims
                  </p>
                ))
              ) : (
                <p>No accounts are flagged for review.</p>
              )}
            </section>
          </>
        )}
      </Data>
      <section className="section">
        <h2>All campus reports</h2>
        <Data state={reports}>
          {(d) => (
            <div className="item-grid">
              {d.lost.map((x) => (
                <ItemCard key={"l" + x.lost_id} item={x} type="lost" own />
              ))}
              {d.found.map((x) => (
                <ItemCard key={"f" + x.found_id} item={x} own />
              ))}
            </div>
          )}
        </Data>
      </section>
    </div>
  );
}
function ReferenceAdmin() {
  const { kind } = useParams(),
    { user, notify } = useApp(),
    s = useData("/reference"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const columns = {
    categories: "category_name",
    locations: "location_name",
    brands: "brand_name",
    colours: "colour_name",
  };
  if (user.role !== "ADMIN") return <Navigate to="/home" />;
  if (!columns[kind]) return <Navigate to="/admin" />;
  async function save(body, id) {
    setBusy(true);
    setError("");
    try {
      await api("/reference/" + kind + (id ? "/" + id : ""), {
        method: id ? "PATCH" : "POST",
        body,
      });
      s.reload();
      notify("Reference data updated.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page narrow">
      <PageHead eyebrow="ADMINISTRATION" heading={"Manage " + kind} />
      {error && <ErrorBox error={error} />}
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          const body = Object.fromEntries(new FormData(e.currentTarget));
          save(body);
        }}
      >
        <Field label="Name">
          <input
            name={columns[kind]}
            required
            maxLength={
              kind === "brands" || kind === "categories"
                ? 80
                : kind === "colours"
                  ? 40
                  : 120
            }
          />
        </Field>
        {kind === "locations" && (
          <Field label="Building">
            <input name="building" required maxLength={80} />
          </Field>
        )}
        {kind === "colours" && (
          <Field label="Colour">
            <input name="hex_value" type="color" defaultValue="#14568a" />
          </Field>
        )}
        {kind === "categories" && (
          <>
            <label className="checkbox">
              <input name="requires_staff" type="checkbox" value="true" />{" "}
              Requires staff verification
            </label>
            <label className="checkbox">
              <input name="is_sensitive" type="checkbox" value="true" />{" "}
              Sensitive category
            </label>
          </>
        )}
        <button className="button" disabled={busy}>
          Add {kind.replace(/ies$/, "y").replace(/s$/, "")}
        </button>
      </form>
      <Data state={s}>
        {(d) => (
          <div className="list">
            {d[kind].map((x) => {
              const id =
                x[
                  kind === "categories"
                    ? "category_id"
                    : kind === "colours"
                      ? "colour_id"
                      : kind === "locations"
                        ? "location_id"
                        : "brand_id"
                ];
              return (
                <div className="list-row" key={id}>
                  <div>
                    <strong>{x[columns[kind]]}</strong>
                    {x.building && <p>{x.building}</p>}
                  </div>
                  <button
                    className="button secondary small"
                    disabled={busy}
                    onClick={() => save({ is_active: !x.is_active }, id)}
                  >
                    {x.is_active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Data>
    </div>
  );
}
function ScoringAdmin() {
  const { user, notify } = useApp(),
    s = useData("/config"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (user.role !== "ADMIN") return <Navigate to="/home" />;
  async function submit(e) {
    e.preventDefault();
    const body = Object.fromEntries(
      [...new FormData(e.currentTarget)].map(([k, v]) => [k, Number(v)]),
    );
    setBusy(true);
    try {
      await api("/config", { method: "PATCH", body });
      s.reload();
      notify("Matching settings saved. New matches use this configuration.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page narrow">
      <PageHead eyebrow="ADMINISTRATION" heading="Matching, in plain numbers.">
        Weights must add up to 100. Existing matches preserve their original
        explanation; new matches use these settings.
      </PageHead>
      {error && <ErrorBox error={error} />}
      <Data state={s}>
        {(d) => (
          <form className="card" onSubmit={submit}>
            <div className="form-grid">
              {d.config.map((c) => (
                <Field
                  label={c.description}
                  key={c.config_key}
                  help={c.config_key}
                >
                  <input
                    name={c.config_key}
                    type="number"
                    min="0"
                    max="365"
                    required
                    defaultValue={c.config_value}
                  />
                </Field>
              ))}
            </div>
            <button className="button" disabled={busy}>
              {busy ? "Saving…" : "Save matching settings"}
            </button>
          </form>
        )}
      </Data>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
