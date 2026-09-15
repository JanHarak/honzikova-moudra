import {
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  getInstallBannerState,
  INSTALL_BANNER_STORAGE_KEY,
  type BeforeInstallPromptEvent,
  setWebDaily,
  setWebPush,
  ensureWebPush,
  webPushAvailable,
} from "./pwa";
import { createRoot } from "react-dom/client";
import {
  HashRouter,
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
  Pencil,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import useEmblaCarousel from "embla-carousel-react";
import { db, demo, rpc, loadPublic, ownSubmissions, errorMessage } from "./api";
import {
  type Quote,
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
  showTestNativeNotification,
} from "./native";
import { showTestWebNotification } from "./pwa";
import "./style.css";
function Owl({ size = 48 }: { size?: number }) {
  return (
    <img src="/owl.svg" alt="" width={size} height={size} className="owl" />
  );
}
function userInitials(email: string | undefined) {
  return (
    email?.split("@")[0].replace(/[^a-zA-ZÀ-ž]/g, "").slice(0, 2) || "U"
  ).toUpperCase();
}
function AccountAvatar({ session }: { session: Session | null }) {
  const [imageError, setImageError] = useState(false);
  const avatarValue =
    session?.user.user_metadata?.avatar_url ?? session?.user.user_metadata?.picture;
  const avatarUrl = typeof avatarValue === "string" ? avatarValue : "";
  if (!session)
    return (
      <span className="account-avatar" aria-hidden="true">
        <UserRound size={20} />
      </span>
    );
  if (avatarUrl && !imageError)
    return (
      <img
        className="account-avatar"
        src={avatarUrl}
        alt=""
        aria-hidden="true"
        onError={() => setImageError(true)}
      />
    );
  return (
    <span className="account-avatar" aria-hidden="true">
      {userInitials(session.user.email)}
    </span>
  );
}
// Brand glyphs are inlined because this lucide version ships no brand icons.
function FacebookIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}
function LinkedinIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
    </svg>
  );
}
function Message({ children }: { children: ReactNode }) {
  return (
    <p className="notice" role="status">
      {children}
    </p>
  );
}
function InstallBanner() {
  const [installState, setInstallState] = useState(() => {
    const hidden = localStorage.getItem(INSTALL_BANNER_STORAGE_KEY) === "1";
    return hidden
      ? { show: false, mode: "hidden" as const }
      : getInstallBannerState({
          standalone: window.matchMedia("(display-mode: standalone)").matches,
          ios: /iPhone|iPad|iPod/i.test(navigator.userAgent),
          hasBeforeInstallPrompt: false,
        });
  });
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    const updateState = () => {
      const hidden = localStorage.getItem(INSTALL_BANNER_STORAGE_KEY) === "1";
      const next = hidden
        ? { show: false, mode: "hidden" as const }
        : getInstallBannerState({
            standalone: window.matchMedia("(display-mode: standalone)").matches,
            ios: /iPhone|iPad|iPod/i.test(navigator.userAgent),
            hasBeforeInstallPrompt: !!deferredPrompt,
          });
      setInstallState(next);
    };

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      const hidden = localStorage.getItem(INSTALL_BANNER_STORAGE_KEY) === "1";
      if (!hidden) {
        setInstallState(
          getInstallBannerState({
            standalone: false,
            ios: /iPhone|iPad|iPod/i.test(navigator.userAgent),
            hasBeforeInstallPrompt: true,
          }),
        );
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", () => {
      localStorage.setItem(INSTALL_BANNER_STORAGE_KEY, "1");
      setInstallState({ show: false, mode: "standalone" });
    });
    updateState();

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, [deferredPrompt]);

  if (!installState.show) return null;

  const triggerInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setInstallState({ show: false, mode: "standalone" });
  };

  const dismiss = () => {
    localStorage.setItem(INSTALL_BANNER_STORAGE_KEY, "1");
    setInstallState({ show: false, mode: "hidden" });
  };

  return (
    <div className="install-banner" role="status" aria-live="polite">
      <div className="install-banner__content">
        <div>
          <strong>Nainstalovat aplikaci</strong>
          <p>
            {installState.mode === "ios"
              ? "Na iPhone/iPad otevřete Sdílet a vyberte Přidat na plochu."
              : "Přidejte si aplikaci na plochu a používejte ji jako nativní app."}
          </p>
        </div>
        <div className="install-banner__actions">
          {installState.mode === "prompt" && (
            <button type="button" className="primary" onClick={triggerInstall}>
              Nainstalovat
            </button>
          )}
          <button
            type="button"
            className="install-banner__close"
            onClick={dismiss}
            aria-label="Skrýt banner instalace"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
function NotificationPrompt() {
  const [visible, setVisible] = useState(() =>
    window.matchMedia("(display-mode: standalone)").matches &&
    "Notification" in window &&
    Notification.permission !== "granted" &&
    localStorage.getItem("hm-notification-prompt-dismissed") !== "1",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dailyTime = localStorage.getItem("hm-time") || "08:00";
  if (!visible) return null;

  async function enable() {
    setBusy(true);
    setMessage("");
    try {
      await setWebPush(true);
      localStorage.setItem("hm-news", "true");
      await setWebDaily(true, dailyTime);
      localStorage.setItem("hm-web-daily", "true");
      localStorage.setItem("hm-time", dailyTime);
      localStorage.setItem("hm-notification-prompt-dismissed", "1");
      setVisible(false);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    localStorage.setItem("hm-notification-prompt-dismissed", "1");
    setVisible(false);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="notification-dialog" role="dialog" aria-modal="true" aria-labelledby="notification-dialog-title">
        <h2 id="notification-dialog-title">Povolit upozornění?</h2>
        <p>
          Každý den v {dailyTime} ti připomeneme moudro dne a upozorníme tě, když přibude nové schválené moudro. Čas i upozornění můžeš kdykoli změnit v nastavení.
        </p>
        {message && <Message>{message}</Message>}
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={dismiss} disabled={busy}>
            Později
          </button>
          <button type="button" className="primary" onClick={() => void enable()} disabled={busy}>
            {busy ? <><span className="spinner" aria-hidden="true" /> Nastavuji…</> : "Povolit upozornění"}
          </button>
        </div>
      </section>
    </div>
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
  const headerTheme =
    theme === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  const toggleTheme = () =>
    setTheme((current) => {
      const activeTheme =
        current === "system"
          ? matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : current;
      return activeTheme === "dark" ? "light" : "dark";
    });
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
      <InstallBanner />
      <NotificationPrompt />
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="brand">
            <Owl />
            <span>Honzíkova moudra</span>
          </Link>
          <div className="header-actions">
            <button
              type="button"
              className="icon-button"
              onClick={toggleTheme}
              aria-label={`Přepnout na ${headerTheme === "dark" ? "světlý" : "tmavý"} režim`}
            >
              {headerTheme === "dark" ? (
                <Moon size={21} />
              ) : (
                <Sun size={21} />
              )}
            </button>
            <Link
              className="account-button"
              to={session ? "/ucet" : "/prihlaseni"}
              aria-label={session ? "Můj účet" : "Přihlásit se"}
            >
              <AccountAvatar session={session} />
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
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
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
            element={
              session ? (
                <Settings theme={theme} setTheme={setTheme} />
              ) : (
                <Panel title="Nastavení">
                  <Message>
                    Nastavení je dostupné po přihlášení.{" "}
                    <Link to="/prihlaseni?next=/nastaveni">Přihlásit se</Link>
                  </Message>
                </Panel>
              )
            }
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
      <footer className="site-footer">
        <a
          className="footer-side"
          href="https://www.facebook.com/groups/472719120086446"
          target="_blank"
          rel="noopener noreferrer"
        >
          <FacebookIcon size={22} />
          <span>Honzíkova moudra</span>
        </a>
        <Link className="footer-add" to="/pridat" aria-label="Přidat moudro">
          <Plus size={24} />
        </Link>
        <a
          className="footer-side right"
          href="https://www.linkedin.com/in/jan-har%C3%A1k/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>Jan Harák</span>
          <LinkedinIcon size={22} />
        </a>
      </footer>
      <nav className="bottom-nav" aria-label="Hlavní navigace">
        <NavLink to="/" end>
          <House />
          <span>Moudra</span>
        </NavLink>
        <NavLink to="/pridat">
          <Plus />
          <span>Přidat</span>
        </NavLink>
        {session && (
          <NavLink to="/nastaveni">
            <SettingsIcon />
            <span>Nastavení</span>
          </NavLink>
        )}
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
  initial = false,
  side = false,
}: {
  quote: Quote;
  initial?: boolean;
  side?: boolean;
}) {
  return (
    <article className={`quote-card ${side ? "side-card" : ""}`}>
      <span className="eyebrow">
        {initial
          ? "Honzíkovo moudro pro dnešní den"
          : side
            ? ""
            : "Honzíkovo moudro"}
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
        className={`quote-text ${
          quote.text.length > 360
            ? "extra-long"
            : quote.text.length > 240
              ? "very-long"
              : quote.text.length > 150
                ? "long"
                : quote.text.length > 100
                  ? "medium"
                  : ""
        }`}
                  style={{ "--quote-length": quote.text.length } as CSSProperties}
      >
        „{quote.text}“
      </Link>
      <img className="quote-logo" src="/hm_logo.png" alt="HM" />
    </article>
  );
}
function PrivacyPolicy() {
  return (
    <Panel title="Ochrana soukromí">
      <p>Aplikace Honzíkova moudra chrání vaše soukromí a zpracovává pouze údaje potřebné pro svůj provoz.</p>
      <h2>Jaké údaje zpracováváme</h2>
      <p>Při vytvoření účtu můžeme zpracovávat e-mailovou adresu a údaje poskytnuté přihlašovací službou, například jméno nebo profilový obrázek. Pokud odešlete vlastní moudro, zpracováváme také jeho text a případné obrázky či alternativní popisy.</p>
      <h2>Proč údaje používáme</h2>
      <p>Údaje používáme pro přihlášení, správu účtu, zveřejnění schváleného obsahu, komunikaci související s účtem a zabezpečení aplikace. Údaje neprodáváme ani nepoužíváme pro zasílání nevyžádané reklamy.</p>
      <h2>Uchovávání a vaše práva</h2>
      <p>Údaje uchováváme jen po dobu potřebnou pro uvedené účely nebo po dobu vyžadovanou právními předpisy. Můžete požádat o přístup, opravu nebo odstranění svých údajů. Účet lze odstranit v nastavení aplikace.</p>
      <h2>Cookies a technické údaje</h2>
      <p>Aplikace používá technické úložiště pro přihlášení, nastavení a fungování instalované webové aplikace. Můžeme také zpracovávat základní technické údaje potřebné pro bezpečnost a provoz služby.</p>
      <p className="muted">Tato stránka je obecná informace a může být doplněna podle skutečného provozovatele aplikace.</p>
    </Panel>
  );
}
function Terms() {
  return (
    <Panel title="Podmínky používání">
      <p>Používáním aplikace Honzíkova moudra souhlasíte s těmito obecnými podmínkami. Aplikace slouží ke čtení, sdílení a navrhování krátkých textů a obrázků.</p>
      <h2>Účet a bezpečnost</h2>
      <p>Za údaje použité při přihlášení odpovídáte vy. Přístupové údaje chraňte před zneužitím a při podezření na zneužití nás informujte.</p>
      <h2>Vlastní obsah</h2>
      <p>Odesláním obsahu potvrzujete, že k němu máte potřebná práva a že jeho zveřejnění neporušuje zákon ani práva jiných osob. Pro účely provozu aplikace poskytujete nevýhradní oprávnění obsah zobrazovat, upravit jeho formát a moderovat jej.</p>
      <h2>Moderace</h2>
      <p>Provozovatel může obsah před zveřejněním schválit, upravit, odmítnout nebo odstranit, zejména pokud je protiprávní, urážlivý, zavádějící nebo nesouvisí se zaměřením aplikace.</p>
      <h2>Dostupnost služby</h2>
      <p>Aplikace je poskytována s přiměřenou péčí, ale nelze zaručit její nepřetržitou dostupnost ani bezchybný provoz. Provozovatel může službu měnit, aktualizovat nebo dočasně omezit.</p>
      <p className="muted">Tyto podmínky jsou obecný vzor a před ostrým použitím je vhodné doplnit identifikační údaje provozovatele.</p>
    </Panel>
  );
}
function Home({ dailyOnly = false }: { dailyOnly?: boolean }) {
  const [quotes, setQuotes] = useState<Quote[]>([]),
    [index, setIndex] = useState(0),
    [initialQuoteId, setInitialQuoteId] = useState<string>(),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [offline, setOffline] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
    skipSnaps: false,
    duration: 35,
  });
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
      setOffline(data.offline);
      // Start on a random quote every page load (per product owner).
      const initialIndex = data.quotes.length
        ? Math.floor(Math.random() * data.quotes.length)
        : 0;
      setIndex(initialIndex);
      setInitialQuoteId(data.quotes[initialIndex]?.id);
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
  useEffect(() => {
    if (!emblaApi || !quotes.length) return;
    emblaApi.reInit();
    emblaApi.scrollTo(index, true);
  }, [emblaApi, quotes]);
  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      setIndex(emblaApi.selectedScrollSnap());
    };
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);
  const move = (n: number) => {
    if (n > 0) emblaApi?.scrollNext();
    else emblaApi?.scrollPrev();
  };
  const current = quotes[index];
  return (
    <section className="home">
      <h1>Dnešní dávka Honzíkovi moudrosti</h1>
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
          >
            <div className="carousel-viewport" ref={emblaRef}>
              <div className="carousel-track">
                {quotes.map((quote, quoteIndex) => (
                  <div
                    className={`carousel-slide ${quoteIndex === index ? "active" : ""}`}
                    key={quote.id}
                  >
                    <QuoteCard
                      quote={quote}
                      initial={quote.id === initialQuoteId}
                      side={quoteIndex !== index}
                    />
                  </div>
                ))}
              </div>
            </div>
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
          <div className="position">
            <div className="dots" aria-hidden="true">
              {Array.from({ length: Math.min(quotes.length, 5) }, (_, i) => (
                <span key={i} className={i === index % 5 ? "selected" : ""} />
              ))}
            </div>
          </div>
        </>
      )}
      {dailyOnly && (
        <p className="muted">Společné moudro podle data v Praze.</p>
      )}
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
      : "/";
  useEffect(() => {
    if (session && mode !== "password") navigate(target, { replace: true });
  }, [session, mode, target, navigate]);
  useEffect(() => {
    if (!callback || !db) return;
    const params = new URLSearchParams(loc.search);
    const code = params.get("code");
    const errorDescription = params.get("error_description") || params.get("error");
    if (!code && !errorDescription) return;
    if (errorDescription) {
      setMessage("Přihlášení přes Google bylo zrušeno nebo zamítnuto. Zkus to znovu.");
      return;
    }
    void (async () => {
      try {
        setBusy(true);
        const { error } = await db.auth.exchangeCodeForSession(code!);
        if (error) throw error;
        navigate(target, { replace: true });
      } catch {
        setMessage("Přihlášení přes Google se nepodařilo dokončit. Zkus to znovu.");
      } finally {
        setBusy(false);
      }
    })();
  }, [callback, loc.search, navigate, target]);
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
          "/#/auth/callback",
          import.meta.env.VITE_SITE_URL || location.origin,
        ).href;
    try {
      const result =
        mode === "register"
          ? await db.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo:
                  redirect + (target === "/pridat" ? "?next=/pridat" : ""),
              },
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
    // Web: full redirect to Google, back to #/auth/callback where the app exchanges
    // the PKCE code. Native still needs @capacitor/browser to
    // avoid Google's embedded-webview block; see docs/decisions.md.
    const redirect = native
      ? "honzikovamoudra://auth/callback"
      : new URL(
          "/#/auth/callback",
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
              <img className="oauth-logo" src="/google-g.png" width="20" height="20" alt="" aria-hidden="true" />
              <span>Pokračovat přes Google</span>
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
      <p className="muted auth-privacy-link">
        Přihlášením souhlasíš s podmínkami zpracování osobních údajů. <Link to="/privacy-policy">Ochrana soukromí</Link> a <Link to="/terms">Podmínky používání</Link>.
      </p>
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
    <Panel title="Máš Honzíkovo moudro?">
      <p className="muted">
        Pošli ho do sbírky. Před zveřejněním ho Honzík zkontroluje.
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
          Moudro
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
            <Link className="secondary" to="/nastaveni">
              <SettingsIcon size={18} /> Nastavení
            </Link>
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
      localStorage.getItem(native ? "hm-daily" : "hm-web-daily") === "true",
    ),
    [news, setNews] = useState(localStorage.getItem("hm-news") === "true"),
    [time, setTime] = useState(localStorage.getItem("hm-time") || "08:00"),
    [permission, setPermission] = useState("Nezjištěno"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState<"daily" | "news" | null>(null);
  useEffect(() => {
    if (native) getPermissions().then(setPermission);
    else if ("Notification" in window) setPermission(Notification.permission);
  }, []);
  async function updateDaily(enabled: boolean, t = time) {
    setBusy("daily");
    try {
      if (native) await setDailyReminder(enabled, t);
      else {
        if (enabled && !webPushAvailable()) throw Error("WEB_PUSH_UNAVAILABLE");
        if (enabled) await ensureWebPush();
        await setWebDaily(enabled, t);
      }
      setDaily(enabled);
      setTime(t);
      localStorage.setItem(native ? "hm-daily" : "hm-web-daily", String(enabled));
      localStorage.setItem("hm-time", t);
      setPermission(native ? await getPermissions() : Notification.permission);
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  async function sendTestNotification() {
    try {
      if (native) await showTestNativeNotification();
      else await showTestWebNotification();
      setPermission(native ? await getPermissions() : Notification.permission);
      setMessage("Testovací upozornění bylo odesláno.");
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
          Upozornění vyžadují instalovanou mobilní aplikaci nebo PWA a povolení oznámení.
        </Message>
      )}
      <label className="switch-row">
        <span>Moudro dne</span>
        <input
          type="checkbox"
          disabled={demo || busy !== null}
          aria-busy={busy === "daily"}
          checked={daily}
          onChange={(e) => void updateDaily(e.target.checked)}
        />
      </label>
      {busy === "daily" && <p className="setting-progress" role="status"><span className="spinner" aria-hidden="true" /> Ukládám nastavení…</p>}
      <label>
        Čas připomínky
        <input
          type="time"
          value={time}
          disabled={demo || busy !== null}
          aria-busy={busy === "daily"}
          onChange={(e) => setTime(e.target.value)}
          onBlur={(e) => {
            const value = e.target.value;
            if (value && value !== (localStorage.getItem("hm-time") || "08:00")) {
              void updateDaily(daily, value);
            }
          }}
        />
      </label>
      <label className="switch-row">
        <span>Nově publikovaná moudra</span>
        <input
          type="checkbox"
          disabled={demo || busy !== null}
          aria-busy={busy === "news"}
          checked={news}
          onChange={async (e) => {
            const enabled = e.target.checked;
            setBusy("news");
            try {
              if (native) await setNewQuotes(enabled);
              else await setWebPush(enabled);
              setNews(enabled);
              localStorage.setItem("hm-news", String(enabled));
              setPermission(native ? await getPermissions() : Notification.permission);
            } catch (err) {
              setMessage(errorMessage(err));
            } finally {
              setBusy(null);
            }
          }}
        />
      </label>
      {busy === "news" && <p className="setting-progress" role="status"><span className="spinner" aria-hidden="true" /> Ukládám nastavení…</p>}
      <p className="muted">
        Oprávnění k oznámením: {permission}. Změnit ho můžeš v nastavení zařízení nebo prohlížeče.
      </p>
      <button type="button" className="secondary" onClick={() => void sendTestNotification()}>
        Odeslat testovací upozornění
      </button>
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
          <button
            className="secondary mt-3"
            onClick={() => setEdit(q)}
            aria-label="Upravit moudro"
            title="Upravit moudro"
          >
            <Pencil size={18} />
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
  <HashRouter>
    <App />
  </HashRouter>,
);
if ("serviceWorker" in navigator && !native)
  void navigator.serviceWorker.register("/sw.js").catch((error) =>
    console.warn("Service worker registration failed", error),
  );
