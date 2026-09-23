"use client";

import { companyRoute, parseAppRoute } from "@finpill/contracts";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { createClientApi } from "@/runtime/api";
import { createBrowserPlatform } from "@/runtime/browser-platform";

import { EmptyState, ErrorState } from "./ui-primitives";
import {
  getThemePreference,
  setThemePreference,
  subscribeThemePreference,
} from "./theme-preference";
import { isNavigationCurrent, navigationItems, resolveTheme } from "./ui-model";

import type { AppRoute } from "@finpill/contracts";
import type { FormEvent, MouseEvent, ReactNode } from "react";
import type { ThemePreference } from "./ui-model";

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

export function ClientApp() {
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
    const platform = createBrowserPlatform(window);
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
  }, []);

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
      <RouteContent route={route} searchPageRef={searchPageRef} />
      <nav aria-label="Mobil ana navigasyon" className="mobile-nav">
        <Navigation route={route} />
      </nav>
    </div>
  );
}
