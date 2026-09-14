import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  useNavigate,
  useLocation,
  useParams,
} from "react-router-dom";
import {
  Sun,
  Moon,
  UserRound,
  Plus,
  House,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  LogOut,
  Monitor,
  Share2,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { db, demo, rpc, loadPublic, ownSubmissions, errorMessage } from "./api";
import {
  type Quote,
  type Daily,
  type Submission,
  statusLabel,
  validateText,
  pragueDate,
} from "./domain";
import {
  initNative,
  setDailyReminder,
  native,
  getPermissions,
  setNewQuotes,
  syncWidgetPlan,
} from "./native";
import "./style.css";
function Owl({ size = 48 }: { size?: number }) {
  return (
    <img src="/owl.svg" alt="" width={size} height={size} className="owl" />
  );
}
function Message({ children }: { children: ReactNode }) {
  return (
    <p className="notice" role="status">
      {children}
    </p>
  );
}
function App() {
  const [session, setSession] = useState<Session | null>(null),
    [admin, setAdmin] = useState(false),
    [authReady, setAuthReady] = useState(!db);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("hm-theme") || "system",
  );
  const navigate = useNavigate();
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
      localStorage.setItem("hm-theme", theme);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    if (!db) return;
    db.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setAuthReady(true);
      setAdmin(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let active = true;
    if (session)
      rpc<boolean>("hm_is_admin")
        .then((v) => {
          if (active) setAdmin(v);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [session]);
  useEffect(() => initNative(navigate), [navigate]);
  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="brand">
            <Owl />
            <span>Honzíkova moudra</span>
          </Link>
          <div className="header-actions">
            <Link
              className="icon-button"
              to="/nastaveni"
              aria-label="Nastavení vzhledu"
            >
              {theme === "dark" ? (
                <Moon size={21} />
              ) : theme === "light" ? (
                <Sun size={21} />
              ) : (
                <Monitor size={21} />
              )}
            </Link>
            <Link
              className="account-button"
              to={session ? "/ucet" : "/prihlaseni"}
            >
              <UserRound size={20} />
              <span>{session ? "Můj účet" : "Přihlásit se"}</span>
            </Link>
            <Link className="primary header-add" to="/pridat">
              Přidat moudro
            </Link>
          </div>
        </div>
      </header>
      {demo && (
        <div className="demo-banner">
          Ukázkový režim · 3 příklady ze zadání · Supabase není připojeno
        </div>
      )}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/denni" element={<Home dailyOnly />} />
          <Route path="/moudra/:id" element={<Detail />} />
          <Route path="/davky/:id" element={<Batch />} />
          <Route path="/prihlaseni" element={<Auth session={session} />} />
          <Route
            path="/auth/callback"
            element={<Auth session={session} callback />}
          />
          <Route
            path="/pridat"
            element={<Submit session={session} ready={authReady} />}
          />
          <Route
            path="/ucet"
            element={<Account session={session} admin={admin} />}
          />
          <Route
            path="/nastaveni"
            element={<Settings theme={theme} setTheme={setTheme} />}
          />
          <Route
            path="/admin"
            element={
              admin ? (
                <Admin />
              ) : (
                <Panel title="Administrace">
                  <Message>
                    {authReady
                      ? "Tato část je dostupná pouze administrátorovi."
                      : "Ověřuji oprávnění…"}
                  </Message>
                </Panel>
              )
            }
          />
          <Route
            path="*"
            element={
              <Panel title="Stránka není dostupná">
                <Link to="/">Zpět na moudra</Link>
              </Panel>
            }
          />
        </Routes>
      </main>
      <nav className="bottom-nav" aria-label="Hlavní navigace">
        <NavLink to="/" end>
          <House />
          <span>Moudra</span>
        </NavLink>
        <NavLink to="/pridat">
          <Plus />
          <span>Přidat</span>
        </NavLink>
        <NavLink to="/nastaveni">
          <SettingsIcon />
          <span>Nastavení</span>
        </NavLink>
      </nav>
    </>
  );
}
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <Link className="back" to="/">
        <ArrowLeft size={18} /> Zpět na moudra
      </Link>
      <h1>{title}</h1>
      {children}
    </section>
  );
}
function QuoteCard({
  quote,
  daily = false,
  side = false,
}: {
  quote: Quote;
  daily?: boolean;
  side?: boolean;
}) {
  return (
    <article className={`quote-card ${side ? "side-card" : ""}`}>
      <span className="eyebrow">
        {daily ? "Moudro dne" : side ? "" : "Honzíkovo moudro"}
      </span>
      {quote.image_path && (
        <img
          className="quote-image"
          src={quote.image_path}
          alt={quote.image_alt}
        />
      )}
      <Link
        tabIndex={side ? -1 : 0}
        to={`/moudra/${quote.id}`}
        className={`quote-text ${quote.text.length > 100 ? "long" : ""}`}
      >
        „{quote.text}“
      </Link>
      <Owl size={side ? 56 : 76} />
    </article>
  );
}
function Home({ dailyOnly = false }: { dailyOnly?: boolean }) {
  const [quotes, setQuotes] = useState<Quote[]>([]),
    [daily, setDaily] = useState<Daily[]>([]),
    [index, setIndex] = useState(0),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [offline, setOffline] = useState(false);
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const data = await loadPublic();
      const today = data.daily.find((d) => d.date === pragueDate());
      setQuotes(
        [...data.quotes].sort((a, b) =>
          a.id === today?.quote_id ? -1 : b.id === today?.quote_id ? 1 : 0,
        ),
      );
      setDaily(data.daily);
      setOffline(data.offline);
      setIndex(0);
      await syncWidgetPlan(data.daily).catch(() => {});
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    const online = () => void refresh();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, []);
  const move = (n: number) =>
    setIndex((i) => (i + n + quotes.length) % quotes.length);
  const current = quotes[index];
  let start: { x: number; y: number } | null = null;
  return (
    <section className="home">
      <h1>Dnešní dávka moudrosti</h1>
      <p className="subtitle">Krátká moudra pro delší úsměvy.</p>
      {offline && (
        <Message>Jsi offline. Zobrazujeme uložený veřejný obsah.</Message>
      )}
      {error && (
        <Message>
          {error} <button onClick={refresh}>Zkusit znovu</button>
        </Message>
      )}
      {loading ? (
        <Message>Načítám moudra…</Message>
      ) : !current ? (
        <Message>Zatím tu žádné moudro není. Vrať se brzy.</Message>
      ) : (
        <>
          <div
            className="carousel"
            role="region"
            aria-label="Moudra"
            aria-roledescription="karusel"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                move(1);
              }
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                move(-1);
              }
            }}
            onTouchStart={(e) => {
              start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }}
            onTouchEnd={(e) => {
              if (start) {
                const x = e.changedTouches[0].clientX - start.x,
                  y = e.changedTouches[0].clientY - start.y;
                if (Math.abs(x) > 60 && Math.abs(x) > Math.abs(y) * 1.4)
                  move(x < 0 ? 1 : -1);
                start = null;
              }
            }}
          >
            {quotes.length > 1 && (
              <div className="previous" aria-hidden="true">
                <QuoteCard
                  quote={quotes[(index + quotes.length - 1) % quotes.length]}
                  side
                />
              </div>
            )}
            <div className="current">
              <QuoteCard
                quote={current}
                daily={daily.some(
                  (d) => d.date === pragueDate() && d.quote_id === current.id,
                )}
              />
            </div>
            {quotes.length > 1 && (
              <div className="next" aria-hidden="true">
                <QuoteCard quote={quotes[(index + 1) % quotes.length]} side />
              </div>
            )}
            {quotes.length > 1 && (
              <>
                <button
                  className="carousel-arrow left"
                  aria-label="Předchozí moudro"
                  onClick={() => move(-1)}
                >
                  <ChevronLeft />
                </button>
                <button
                  className="carousel-arrow right"
                  aria-label="Další moudro"
                  onClick={() => move(1)}
                >
                  <ChevronRight />
                </button>
              </>
            )}
          </div>
          <div className="position" aria-live="polite">
            <div className="dots" aria-hidden="true">
              {Array.from({ length: Math.min(quotes.length, 5) }, (_, i) => (
                <span key={i} className={i === index % 5 ? "selected" : ""} />
              ))}
            </div>
            <span>
              {index + 1} / {quotes.length} mouder
            </span>
          </div>
        </>
      )}
      {dailyOnly && (
        <p className="muted">Společné moudro podle data v Praze.</p>
      )}
      <div className="home-cta">
        <Link to="/pridat" className="primary">
          Navrhnout vlastní moudro
        </Link>
        <p>Nová moudra nejprve schválíme.</p>
      </div>
    </section>
  );
}
function Detail() {
  const { id } = useParams();
  const [quote, setQuote] = useState<Quote | null>(),
    [error, setError] = useState("");
  useEffect(() => {
    setQuote(undefined);
    if (demo)
      loadPublic().then((d) =>
        setQuote(d.quotes.find((q) => q.id === id) || null),
      );
    else
      rpc<Quote[]>("hm_get_published_quote", { p_id: id })
        .then((d) => setQuote(d[0] || null))
        .catch(() => {
          setQuote(null);
          setError("Obsah nelze načíst.");
        });
  }, [id]);
  return (
    <Panel title="Detail moudra">
      {quote === undefined ? (
        <Message>Načítám…</Message>
      ) : quote ? (
        <>
          <QuoteCard quote={quote} />
          <button
            className="secondary mt-6"
            onClick={async () => {
              try {
                const url = new URL(
                  `/moudra/${id}`,
                  import.meta.env.VITE_SITE_URL || location.origin,
                ).href;
                if (navigator.share)
                  await navigator.share({ title: "Honzíkova moudra", url });
                else {
                  await navigator.clipboard.writeText(url);
                  setError("Odkaz zkopírován.");
                }
              } catch {
                setError("Sdílení nebylo dokončeno.");
              }
            }}
          >
            <Share2 size={18} /> Sdílet odkaz
          </button>
          {error && <Message>{error}</Message>}
        </>
      ) : (
        <Message>Moudro není dostupné. {error}</Message>
      )}
    </Panel>
  );
}
function Batch() {
  const { id } = useParams();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  useEffect(() => {
    rpc<Quote[]>("hm_get_publication_batch", { p_id: id })
      .then(setQuotes)
      .catch(() => {});
  }, [id]);
  return (
    <Panel title="Nová moudra">
      {quotes.length ? (
        quotes.map((q) => <QuoteCard key={q.id} quote={q} />)
      ) : (
        <Message>Žádná dostupná moudra v této dávce.</Message>
      )}
    </Panel>
  );
}
function Auth({
  session,
  callback = false,
}: {
  session: Session | null;
  callback?: boolean;
}) {
  const [mode, setMode] = useState<"login" | "register" | "reset" | "password">(
      callback && location.search.includes("recovery") ? "password" : "login",
    ),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const navigate = useNavigate(),
    loc = useLocation();
  const target =
    new URLSearchParams(loc.search).get("next") === "/pridat"
      ? "/pridat"
      : "/ucet";
  useEffect(() => {
    if (session && mode !== "password") navigate(target, { replace: true });
  }, [session, mode, target, navigate]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!db) return;
    setBusy(true);
    setMessage("");
    const f = new FormData(e.currentTarget),
      email = String(f.get("email")),
      password = String(f.get("password"));
    const redirect = native
      ? "honzikovamoudra://auth/callback"
      : new URL(
          "/auth/callback",
          import.meta.env.VITE_SITE_URL || location.origin,
        ).href;
    try {
      const result =
        mode === "register"
          ? await db.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: redirect + "?next=/pridat" },
            })
          : mode === "reset"
            ? await db.auth.resetPasswordForEmail(email, {
                redirectTo: redirect + "?recovery=1",
              })
            : mode === "password"
              ? await db.auth.updateUser({ password })
              : await db.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      setMessage(
        mode === "register"
          ? "Zkontroluj e-mail a potvrď registraci."
          : mode === "reset"
            ? "Pokud účet existuje, poslali jsme odkaz pro obnovu."
            : mode === "password"
              ? "Heslo bylo změněno."
              : "Přihlášeno.",
      );
    } catch {
      setMessage(
        "Akci se nepodařilo dokončit. Zkontroluj údaje, ověření e-mailu a připojení.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    if (!db) return;
    setBusy(true);
    setMessage("");
    // Web: full redirect to Google, back to /auth/callback where supabase-js (PKCE,
    // detectSessionInUrl) exchanges the code. Native still needs @capacitor/browser to
    // avoid Google's embedded-webview block; see docs/decisions.md.
    const redirect = native
      ? "honzikovamoudra://auth/callback"
      : new URL(
          "/auth/callback",
          import.meta.env.VITE_SITE_URL || location.origin,
        ).href;
    const { error } = await db.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirect + (target === "/pridat" ? "?next=/pridat" : ""),
      },
    });
    if (error) {
      setBusy(false);
      setMessage("Přihlášení přes Google se teď nepodařilo. Zkus to znovu.");
    }
  }
  return (
    <Panel
      title={
        mode === "register"
          ? "Vytvořit účet"
          : mode === "reset"
            ? "Obnovit heslo"
            : mode === "password"
              ? "Nové heslo"
              : "Vítej zpátky"
      }
    >
      <p className="muted">Účet potřebuješ jen pro navrhování mouder.</p>
      {demo ? (
        <Message>
          Přihlášení bude dostupné po připojení Supabase. Ukázka nevytváří
          skutečné účty.
        </Message>
      ) : (
        <>
        <form onSubmit={submit}>
          {mode !== "password" && (
            <label>
              E-mail
              <input type="email" name="email" autoComplete="email" required />
            </label>
          )}
          {mode !== "reset" && (
            <label>
              Heslo
              <input
                type="password"
                name="password"
                minLength={8}
                required
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </label>
          )}
          <button className="primary" disabled={busy}>
            {busy
              ? "Čekej…"
              : mode === "login"
                ? "Přihlásit se"
                : mode === "register"
                  ? "Registrovat se"
                  : "Potvrdit"}
          </button>
        </form>
        {(mode === "login" || mode === "register") && (
          <>
            <div className="oauth-divider">
              <span>nebo</span>
            </div>
            <button
              type="button"
              className="oauth"
              onClick={google}
              disabled={busy}
            >
              Pokračovat přes Google
            </button>
          </>
        )}
        </>
      )}
      {message && <Message>{message}</Message>}
      <div className="flex flex-wrap gap-4 mt-6">
        <button onClick={() => setMode("login")}>Přihlášení</button>
        <button onClick={() => setMode("register")}>Registrace</button>
        <button onClick={() => setMode("reset")}>Zapomenuté heslo</button>
      </div>
    </Panel>
  );
}
function Submit({
  session,
  ready,
}: {
  session: Session | null;
  ready: boolean;
}) {
  const [text, setText] = useState(""),
    [requestId, setRequestId] = useState(crypto.randomUUID()),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function send(e: FormEvent) {
    e.preventDefault();
    const err = validateText(text);
    if (err) {
      setMessage(err);
      return;
    }
    setBusy(true);
    try {
      await rpc("hm_submit_quote", {
        p_text: text.trim(),
        p_request_id: requestId,
      });
      setMessage("Moudro čeká na schválení.");
      setText("");
      setRequestId(crypto.randomUUID());
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title="Máš vlastní moudro?">
      <p className="muted">
        Pošli ho do sbírky. Před zveřejněním ho zkontroluje administrátor.
      </p>
      {!ready ? (
        <Message>Ověřuji přihlášení…</Message>
      ) : !session ? (
        <Message>
          Pro odeslání je potřeba ověřený účet.{" "}
          <Link to="/prihlaseni?next=/pridat">Přihlásit se</Link>
        </Message>
      ) : null}
      <form onSubmit={send}>
        <label>
          Tvoje moudro
          <textarea
            rows={6}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setRequestId(crypto.randomUUID());
            }}
            placeholder="Někdy stačí jedna věta…"
            required
          />
        </label>
        <p className="counter">{[...text.trim()].length} / 500 znaků</p>
        <p className="muted">
          Po odeslání už moudro nepůjde upravit ani smazat.
        </p>
        <button
          className="primary"
          disabled={!session || busy || !!validateText(text)}
        >
          {busy ? "Odesílám…" : "Odeslat ke schválení"}
        </button>
      </form>
      {message && <Message>{message}</Message>}
    </Panel>
  );
}
function Account({
  session,
  admin,
}: {
  session: Session | null;
  admin: boolean;
}) {
  const [items, setItems] = useState<Submission[]>([]),
    [message, setMessage] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    setItems([]);
    if (session)
      ownSubmissions()
        .then(setItems)
        .catch((e) => setMessage(errorMessage(e)));
  }, [session]);
  return (
    <Panel title="Můj účet">
      {session ? (
        <>
          <p>{session.user.email}</p>
          <div className="flex gap-4 flex-wrap my-6">
            {admin && (
              <Link className="primary" to="/admin">
                Administrace
              </Link>
            )}
            <button
              className="secondary"
              onClick={async () => {
                await db!.auth.signOut();
                setItems([]);
                navigate("/");
              }}
            >
              <LogOut size={18} /> Odhlásit se
            </button>
          </div>
          <h2>Moje návrhy</h2>
          {items.length ? (
            items.map((q) => (
              <article className="submission" key={q.id}>
                <p>{q.text}</p>
                <small>
                  {statusLabel[q.status]} ·{" "}
                  {new Date(q.created_at).toLocaleDateString("cs")}
                </small>
              </article>
            ))
          ) : (
            <p className="muted">Zatím nemáš žádné návrhy.</p>
          )}
          <details className="mt-8">
            <summary>Zrušení účtu</summary>
            <p>
              Smazání účtu odvolá přístup a anonymizuje vazby na moudra.
              Publikovaná moudra zůstávají ve sbírce.
            </p>
            <button
              className="secondary"
              onClick={async () => {
                if (!confirm("Trvale zrušit účet a odhlásit všechna zařízení?"))
                  return;
                try {
                  const { error } =
                    await db!.functions.invoke("hm-delete-account");
                  if (error) throw error;
                  await db!.auth.signOut();
                  navigate("/");
                } catch (e) {
                  setMessage(errorMessage(e));
                }
              }}
            >
              Trvale zrušit účet
            </button>
          </details>
        </>
      ) : (
        <Link to="/prihlaseni">Přihlásit se</Link>
      )}
      {message && <Message>{message}</Message>}
    </Panel>
  );
}
function Settings({
  theme,
  setTheme,
}: {
  theme: string;
  setTheme: (v: string) => void;
}) {
  const [daily, setDaily] = useState(
      localStorage.getItem("hm-daily") === "true",
    ),
    [news, setNews] = useState(localStorage.getItem("hm-news") === "true"),
    [time, setTime] = useState(localStorage.getItem("hm-time") || "08:00"),
    [permission, setPermission] = useState("Nezjištěno"),
    [message, setMessage] = useState("");
  useEffect(() => {
    getPermissions().then(setPermission);
  }, []);
  async function updateDaily(enabled: boolean, t = time) {
    try {
      await setDailyReminder(enabled, t);
      setDaily(enabled);
      setTime(t);
      localStorage.setItem("hm-daily", String(enabled));
      localStorage.setItem("hm-time", t);
      setPermission(await getPermissions());
    } catch (e) {
      setMessage(errorMessage(e));
    }
  }
  return (
    <Panel title="Nastavení">
      <h2>Vzhled aplikace</h2>
      <fieldset className="theme-options">
        <legend className="sr-only">Barevný režim</legend>
        {[
          ["light", "Světlý", Sun],
          ["dark", "Tmavý", Moon],
          ["system", "Podle systému", Monitor],
        ].map(([value, label, Icon]) => {
          const I = Icon as typeof Sun;
          return (
            <label
              key={String(value)}
              className={theme === value ? "chosen" : ""}
            >
              <input
                type="radio"
                name="theme"
                value={String(value)}
                checked={theme === value}
                onChange={() => setTheme(String(value))}
              />
              <I size={22} />
              {String(label)}
            </label>
          );
        })}
      </fieldset>
      <h2>Upozornění</h2>
      <p className="muted">
        Denní připomínka používá místní čas zařízení. Moudro dne se vybírá podle
        data v Praze.
      </p>
      {!native && (
        <Message>
          Upozornění jsou dostupná v nativní iOS aplikaci. Web funguje bez nich.
        </Message>
      )}
      <label className="switch-row">
        <span>Moudro dne</span>
        <input
          type="checkbox"
          disabled={!native}
          checked={daily}
          onChange={(e) => void updateDaily(e.target.checked)}
        />
      </label>
      <label>
        Čas připomínky
        <input
          type="time"
          value={time}
          disabled={!native}
          onChange={(e) => void updateDaily(daily, e.target.value)}
        />
      </label>
      <label className="switch-row">
        <span>Nově publikovaná moudra</span>
        <input
          type="checkbox"
          disabled={!native || demo}
          checked={news}
          onChange={async (e) => {
            const enabled = e.target.checked;
            try {
              await setNewQuotes(enabled);
              setNews(enabled);
              localStorage.setItem("hm-news", String(enabled));
              setPermission(await getPermissions());
            } catch (err) {
              setMessage(errorMessage(err));
            }
          }}
        />
      </label>
      <p className="muted">
        Systémové oprávnění: {permission}. Změnit ho můžeš v Nastavení iOS →
        Oznámení.
      </p>
      {message && <Message>{message}</Message>}
    </Panel>
  );
}
function Admin() {
  const [items, setItems] = useState<Submission[]>([]),
    [filter, setFilter] = useState("pending"),
    [selected, setSelected] = useState<string[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState<Submission | null>(null),
    [date, setDate] = useState(pragueDate()),
    [dailyId, setDailyId] = useState("");
  async function refresh() {
    try {
      setItems(
        await rpc<Submission[]>("hm_admin_list_quotes", { p_status: filter }),
      );
      setSelected([]);
    } catch (e) {
      setMessage(errorMessage(e));
    }
  }
  useEffect(() => {
    void refresh();
  }, [filter]);
  async function moderate(action: string) {
    setBusy(true);
    try {
      await rpc("hm_moderate_quotes", {
        p_ids: selected,
        p_action: action,
        p_versions: selected.map(
          (id) => items.find((q) => q.id === id)!.version,
        ),
      });
      await refresh();
      setMessage("Změny uloženy.");
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title="Administrace">
      <div className="flex flex-wrap gap-2 my-6">
        {Object.entries(statusLabel).map(([k, v]) => (
          <button
            className={filter === k ? "primary" : "secondary"}
            key={k}
            onClick={() => setFilter(k)}
          >
            {v}
          </button>
        ))}
      </div>
      {message && <Message>{message}</Message>}
      <div className="flex flex-wrap gap-2 mb-6">
        {["approve", "reject", "hide"].map((a, i) => (
          <button
            className="secondary"
            key={a}
            disabled={busy || !selected.length}
            onClick={() => {
              if (confirm(`Potvrdit akci pro ${selected.length} mouder?`))
                void moderate(a);
            }}
          >
            {["Schválit vybrané", "Zamítnout", "Skrýt"][i]}
          </button>
        ))}
      </div>
      {items.map((q) => (
        <article className="submission" key={q.id}>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={selected.includes(q.id)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, q.id]
                    : selected.filter((id) => id !== q.id),
                )
              }
            />
            <span>{q.text}</span>
          </label>
          <small>
            {q.duplicate ? "Možná duplicita · " : ""}
            {statusLabel[q.status]} · verze {q.version}
          </small>
          <button className="secondary mt-3" onClick={() => setEdit(q)}>
            Upravit
          </button>
        </article>
      ))}
      {!items.length && <p>V tomto seznamu není žádné moudro.</p>}
      {edit && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await rpc("hm_edit_quote", {
                p_id: edit.id,
                p_text: edit.text,
                p_alt: edit.image_alt,
                p_version: edit.version,
              });
              setEdit(null);
              await refresh();
            } catch (err) {
              setMessage(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Úprava moudra</h2>
          <textarea
            value={edit.text}
            onChange={(e) => setEdit({ ...edit, text: e.target.value })}
          />
          <label>
            Alternativní popis obrázku
            <input
              value={edit.image_alt}
              onChange={(e) => setEdit({ ...edit, image_alt: e.target.value })}
            />
          </label>
          <label>
            Obrázek (JPEG, PNG, WebP, do 10 MB)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 10 * 1024 * 1024) {
                  setMessage("Obrázek je větší než 10 MB.");
                  return;
                }
                setBusy(true);
                try {
                  const form = new FormData();
                  form.set("file", file);
                  form.set("quoteId", edit.id);
                  form.set("version", String(edit.version));
                  const { data, error } = await db!.functions.invoke(
                    "hm-upload-image",
                    { body: form },
                  );
                  if (error) throw error;
                  setEdit({
                    ...edit,
                    version: data.version,
                    image_path: data.path,
                  });
                  setMessage("Obrázek uložen.");
                } catch (err) {
                  setMessage(errorMessage(err));
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
          <div className="flex gap-3">
            <button className="primary" disabled={busy}>
              Uložit text a popis
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setEdit(null)}
            >
              Zavřít
            </button>
          </div>
        </form>
      )}
      <h2 className="mt-8">Denní plán</h2>
      <p className="muted">
        Vyber schválené moudro v seznamu a použij jeho ID. Datum podle
        Europe/Prague.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await rpc("hm_set_daily_quote", { p_date: date, p_quote_id: dailyId });
            setMessage("Denní plán uložen.");
          } catch (err) {
            setMessage(errorMessage(err));
          }
        }}
      >
        <label>
          Den
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <label>
          Schválené moudro
          <select
            value={dailyId}
            onChange={(e) => setDailyId(e.target.value)}
            required
          >
            <option value="">Vyber ve schváleném seznamu</option>
            {items
              .filter((q) => q.status === "approved")
              .map((q) => (
                <option value={q.id} key={q.id}>
                  {q.text}
                </option>
              ))}
          </select>
        </label>
        <button className="primary">Nastavit moudro dne</button>
      </form>
    </Panel>
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
if ("serviceWorker" in navigator && !native)
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {}),
  );
