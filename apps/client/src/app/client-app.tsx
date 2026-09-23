"use client";

import { ClerkProvider, SignInButton, UserButton, useAuth } from "@clerk/react";
import { Capacitor } from "@capacitor/core";
import { iosClerk } from "@/runtime/ios-clerk";
import {
  SessionResponseSchema,
  companyRoute,
  parseAppRoute,
} from "@finpill/contracts";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { publicEnvironment } from "@/config/environment";
import { createClientApi } from "@/runtime/api";
import { createBrowserPlatform } from "@/runtime/browser-platform";

import { EmptyState, ErrorState } from "./ui-primitives";
import {
  getThemePreference,
  setThemePreference,
  subscribeThemePreference,
} from "./theme-preference";
import { isNavigationCurrent, navigationItems, resolveTheme } from "./ui-model";

import type { AppRoute, AuthPort } from "@finpill/contracts";
import type { FormEvent, MouseEvent, ReactNode } from "react";
import type { ThemePreference } from "./ui-model";

const subscribePlatform = () => () => {};

function routeTitle(route: AppRoute): string {
  switch (route.kind) {
    case "home":
      return "Ana Sayfa";
    case "search":
      return "Şirket Ara";
    case "watchlist":
      return "İzleme";
    case "ai":
      return "Şirket Ara";
    case "settings":
      return "Daha Fazla";
    case "company":
      return route.ticker;
    case "not-found":
      return "Sayfa bulunamadı";
  }
}

function AppLink({
  href,
  children,
  className,
  current,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  current?: boolean;
}) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    createBrowserPlatform(window).navigation.navigate(href);
  };
  return (
    <a
      aria-current={current ? "page" : undefined}
      className={className}
      href={href}
      onClick={onClick}
    >
      {children}
    </a>
  );
}

function Navigation({ route }: { route: AppRoute }) {
  return navigationItems.map((item) => (
    <AppLink
      className="nav-link"
      current={isNavigationCurrent(item, route)}
      href={item.href}
      key={item.href}
    >
      <span aria-hidden="true" className="nav-icon">
        {item.icon}
      </span>
      <span>{item.label}</span>
    </AppLink>
  ));
}

function returnFromDetail() {
  if (window.history.state?.finpillNavigation) window.history.back();
  else createBrowserPlatform(window).navigation.navigate("/");
}

function SearchPage({
  inputRef,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <main className="content" id="main-content">
      <button className="detail-back" onClick={returnFromDetail} type="button">
        ← Geri dön
      </button>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Şirket keşfi</p>
          <h1>Şirket Ara</h1>
          <p className="lede">BIST şirketlerini araştırın.</p>
        </div>
      </div>
      <label className="sr-only" htmlFor="search-page-input">
        Şirket veya kod ara
      </label>
      <input
        autoComplete="off"
        className="search-page-input"
        id="search-page-input"
        placeholder="Şirket veya kod ara"
        ref={inputRef}
        type="search"
      />
      <div style={{ marginTop: "1.5rem" }}>
        <EmptyState
          title="Arama sonuçları hazırlanıyor"
          description="Şirket dizini bağlandığında sonuçlar burada görünecek."
        />
      </div>
    </main>
  );
}

function RouteContent({
  route,
  searchPageRef,
}: {
  route: AppRoute;
  searchPageRef: React.RefObject<HTMLInputElement | null>;
}) {
  if (route.kind === "not-found") {
    return (
      <main className="content" id="main-content">
        <h1 className="sr-only">Sayfa bulunamadı</h1>
        <ErrorState
          action={<AppLink href="/">Ana sayfaya dön</AppLink>}
          description="Bu bağlantı Finpill’in tanımlı bir rotası değil."
          title="Sayfa bulunamadı"
        />
      </main>
    );
  }
  if (route.kind === "search" || route.kind === "ai")
    return <SearchPage inputRef={searchPageRef} />;
  const isCompany = route.kind === "company";
  return (
    <main className="content" id="main-content">
      {isCompany && (
        <button
          className="detail-back"
          onClick={returnFromDetail}
          type="button"
        >
          ← Geri dön
        </button>
      )}
      <div className="page-heading">
        <div>
          <p className="eyebrow">{isCompany ? "Şirket" : "Finpill"}</p>
          <h1>{routeTitle(route)}</h1>
          <p className="lede">Bu bölüm hazırlanıyor.</p>
        </div>
      </div>
      {isCompany && (
        <div className="company-actions">
          <AppLink href={companyRoute(route.ticker, "overview")}>
            Genel Bakış
          </AppLink>
          <AppLink href={companyRoute(route.ticker, "financials")}>
            Finansallar
          </AppLink>
          <AppLink href={companyRoute(route.ticker, "ratios")}>Oranlar</AppLink>
          <AppLink href={companyRoute(route.ticker, "disclosures")}>
            KAP &amp; Olaylar
          </AppLink>
          <AppLink href={companyRoute(route.ticker, "ai")}>
            Analiz ve sorular
          </AppLink>
        </div>
      )}
      <EmptyState
        description="Veri kaynakları bağlandığında araştırma içeriği burada yer alacak."
        title="Henüz gösterilecek veri yok"
      />
    </main>
  );
}

function AppShell({
  auth,
  accountControl,
  sessionNotice,
}: {
  auth?: AuthPort;
  accountControl?: ReactNode;
  sessionNotice?: ReactNode;
}) {
  const [route, setRoute] = useState<AppRoute>({ kind: "home" });
  const [desktopSearch, setDesktopSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const desktopSearchRef = useRef<HTMLInputElement>(null);
  const searchPageRef = useRef<HTMLInputElement>(null);
  const previousRoute = useRef<AppRoute["kind"]>("home");
  const theme = useSyncExternalStore(
    subscribeThemePreference,
    getThemePreference,
    (): ThemePreference => "system",
  );

  useEffect(() => {
    const platform = createBrowserPlatform(window, auth);
    void createClientApi(platform);
    const update = (pathname: string) => {
      if (pathname === "/ai") {
        window.history.replaceState(window.history.state, "", "/search");
        pathname = "/search";
      }
      const next = parseAppRoute(pathname);
      setRoute((current) => {
        previousRoute.current = current.kind;
        return next;
      });
    };
    update(platform.navigation.getPathname());
    return platform.navigation.subscribe(update);
  }, [auth]);

  useEffect(() => {
    if (previousRoute.current === "search" && route.kind !== "search") {
      if (window.matchMedia("(min-width: 768px)").matches)
        desktopSearchRef.current?.focus();
      else document.querySelector<HTMLAnchorElement>(".mobile-search")?.focus();
    }
    if (route.kind === "search") searchPageRef.current?.focus();
  }, [route]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (window.matchMedia("(min-width: 768px)").matches)
          desktopSearchRef.current?.focus();
        else createBrowserPlatform(window).navigation.navigate("/search");
      }
      if (
        event.key === "Escape" &&
        document.activeElement === desktopSearchRef.current
      ) {
        setSearchFocused(false);
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => {
      document.documentElement.dataset.theme = resolveTheme(
        theme,
        media.matches,
      );
    };
    updateTheme();
    media.addEventListener("change", updateTheme);
    return () => media.removeEventListener("change", updateTheme);
  }, [theme]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchFocused(false);
    createBrowserPlatform(window).navigation.navigate("/search");
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        İçeriğe geç
      </a>
      <aside className="desktop-sidebar">
        <AppLink className="brand" href="/">
          Fin<span className="brand-mark">pill</span>
        </AppLink>
        <nav aria-label="Ana navigasyon">
          <Navigation route={route} />
        </nav>
      </aside>
      <header className="topbar">
        <AppLink className="brand" href="/">
          Fin<span className="brand-mark">pill</span>
        </AppLink>
        <div className="topbar-actions">
          {accountControl}
          <AppLink className="mobile-search" href="/search">
            <span aria-hidden="true">⌕</span> Şirket ara
          </AppLink>
          <form
            className="desktop-search search-control"
            onSubmit={submitSearch}
            role="search"
          >
            <label className="sr-only" htmlFor="desktop-search">
              Şirket veya kod ara
            </label>
            <input
              autoComplete="off"
              className="search-input"
              id="desktop-search"
              onBlur={() => setSearchFocused(false)}
              onChange={(event) => setDesktopSearch(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="Şirket veya kod ara ⌘K"
              ref={desktopSearchRef}
              type="search"
              value={desktopSearch}
            />
            {searchFocused && (
              <div className="search-hint" role="status">
                {desktopSearch
                  ? "Şirket dizini henüz bağlanmadı."
                  : "Şirket veya kod yazarak arayın."}{" "}
                Enter ile aramayı açın.
              </div>
            )}
          </form>
          <label className="sr-only" htmlFor="theme">
            Tema
          </label>
          <select
            className="theme-select"
            id="theme"
            onChange={(event) =>
              setThemePreference(event.target.value as ThemePreference)
            }
            value={theme}
          >
            <option value="system">Sistem</option>
            <option value="light">Açık</option>
            <option value="dark">Koyu</option>
          </select>
        </div>
      </header>
      {sessionNotice && (
        <div className="session-notice" role="status">
          {sessionNotice}
        </div>
      )}
      <RouteContent route={route} searchPageRef={searchPageRef} />
      <nav aria-label="Mobil ana navigasyon" className="mobile-nav">
        <Navigation route={route} />
      </nav>
    </div>
  );
}

function WebAuthApp() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const [verification, setVerification] = useState<{
    userId: string;
    status: "verified" | "error";
  } | null>(null);
  const auth = useMemo<AuthPort>(
    () => ({ getAccessToken: () => getToken() }),
    [getToken],
  );
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;
    const api = createClientApi(createBrowserPlatform(window, auth));
    if (!api) return;
    let active = true;
    void api
      .request({ path: "/api/v1/session", response: SessionResponseSchema })
      .then(({ userId: verifiedUserId }) => {
        if (active)
          setVerification({
            userId,
            status: verifiedUserId === userId ? "verified" : "error",
          });
      })
      .catch(() => {
        if (active) setVerification({ userId, status: "error" });
      });
    return () => {
      active = false;
    };
  }, [auth, isLoaded, isSignedIn, userId]);

  const sessionStatus =
    verification?.userId === userId
      ? verification?.status === "verified"
        ? "Oturum doğrulandı"
        : "Oturum doğrulanamadı"
      : "Oturum doğrulanıyor";
  const accountControl = (
    <div className="account-control">
      {!isLoaded && <span role="status">Oturum yükleniyor</span>}
      {isLoaded && !isSignedIn && (
        <SignInButton mode="modal">
          <button type="button">Giriş yap</button>
        </SignInButton>
      )}
      {isLoaded && isSignedIn && (
        <>
          {publicEnvironment.NEXT_PUBLIC_API_ENABLED && (
            <span aria-live="polite" className="session-status">
              {sessionStatus}
            </span>
          )}
          <UserButton />
        </>
      )}
    </div>
  );
  return <AppShell auth={auth} accountControl={accountControl} />;
}

function IOSAuthApp() {
  const [loaded, setLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<
    "checking" | "ready" | "error"
  >("checking");
  const auth = useMemo<AuthPort>(
    () => ({ getAccessToken: iosClerk.getAccessToken }),
    [],
  );

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const state = await iosClerk.state();
        if (active) {
          setLoaded(state.isLoaded);
          setUserId(state.userId);
          if (state.isLoaded) setError(false);
        }
      } catch {
        if (active) setError(true);
      }
    };
    void iosClerk
      .initialize(publicEnvironment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!)
      .then(() => {
        if (active) void refresh();
      })
      .catch(() => {
        if (active) setError(true);
      });
    const timer = window.setInterval(() => void refresh(), 1500);
    const timeout = window.setTimeout(() => {
      void iosClerk
        .state()
        .then((state) => {
          if (active && !state.isLoaded) setError(true);
        })
        .catch(() => {
          if (active) setError(true);
        });
    }, 15000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    if (!loaded || !userId) return;
    let active = true;
    const checkToken = async () => {
      try {
        const token = await auth.getAccessToken();
        if (active) setTokenStatus(token ? "ready" : "error");
      } catch {
        if (active) setTokenStatus("error");
      }
    };
    const onResume = () => {
      if (!document.hidden) void checkToken();
    };
    void checkToken();
    const timer = window.setInterval(() => void checkToken(), 60000);
    document.addEventListener("visibilitychange", onResume);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onResume);
    };
  }, [auth, loaded, userId]);

  const accountControl = (
    <div className="account-control">
      {!loaded && !error && <span role="status">Oturum yükleniyor</span>}
      {error && <span role="alert">Oturum kullanılamıyor</span>}
      {loaded && !error && !userId && (
        <button
          onClick={() => void iosClerk.signIn().catch(() => setError(true))}
          type="button"
        >
          Giriş yap
        </button>
      )}
      {loaded && !error && userId && (
        <button
          onClick={() =>
            void iosClerk
              .signOut()
              .then(() => {
                setUserId(null);
                setTokenStatus("checking");
              })
              .catch(() => setError(true))
          }
          type="button"
        >
          Çıkış yap
        </button>
      )}
    </div>
  );
  const sessionNotice = userId
    ? tokenStatus === "ready"
      ? "Oturum hazır"
      : tokenStatus === "error"
        ? "Oturum yenilenemedi"
        : "Oturum doğrulanıyor"
    : undefined;
  return (
    <AppShell
      auth={auth}
      accountControl={accountControl}
      sessionNotice={sessionNotice}
    />
  );
}

export function ClientApp() {
  const platform = useSyncExternalStore(
    subscribePlatform,
    () => Capacitor.getPlatform(),
    () => "server",
  );
  if (!publicEnvironment.NEXT_PUBLIC_AUTH_ENABLED) return <AppShell />;
  if (platform === "ios") return <IOSAuthApp />;
  if (platform !== "web") return <AppShell />;
  return (
    <ClerkProvider
      publishableKey={publicEnvironment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}
    >
      <WebAuthApp />
    </ClerkProvider>
  );
}
