"use client";

import { parseAppRoute } from "@finpill/contracts";
import { useEffect, useState, useSyncExternalStore } from "react";

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
import type { MouseEvent, ReactNode } from "react";
import type { ThemePreference } from "./ui-model";

function routeTitle(route: AppRoute): string {
  switch (route.kind) {
    case "home":
      return "Ana Sayfa";
    case "search":
      return "Ara";
    case "watchlist":
      return "İzleme Listesi";
    case "ai":
      return "Yapay Zekâ";
    case "settings":
      return "Ayarlar";
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

function RouteContent({ route }: { route: AppRoute }) {
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

  return (
    <main className="content" id="main-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {route.kind === "company" ? "Şirket" : "Finpill"}
          </p>
          <h1>{routeTitle(route)}</h1>
          <p className="lede">Bu bölüm hazırlanıyor.</p>
        </div>
      </div>
      <EmptyState
        description="Veri kaynakları bağlandığında araştırma içeriği burada yer alacak."
        title="Henüz gösterilecek veri yok"
      />
    </main>
  );
}

export function ClientApp() {
  const [route, setRoute] = useState<AppRoute>({ kind: "home" });
  const theme = useSyncExternalStore(
    subscribeThemePreference,
    getThemePreference,
    (): ThemePreference => "system",
  );

  useEffect(() => {
    const platform = createBrowserPlatform(window);
    // Creating the transport validates the enabled public API boundary without issuing a request.
    void createClientApi(platform);
    const update = (pathname: string) => setRoute(parseAppRoute(pathname));
    update(platform.navigation.getPathname());
    return platform.navigation.subscribe(update);
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
          <AppLink className="search-shortcut" href="/search">
            Şirket ara
          </AppLink>
          <label className="sr-only" htmlFor="theme">
            Tema
          </label>
          <select
            className="theme-select"
            id="theme"
            onChange={(event) => {
              const preference = event.target.value as ThemePreference;
              setThemePreference(preference);
            }}
            value={theme}
          >
            <option value="system">Sistem</option>
            <option value="light">Açık</option>
            <option value="dark">Koyu</option>
          </select>
        </div>
      </header>
      <RouteContent route={route} />
      <nav aria-label="Mobil ana navigasyon" className="mobile-nav">
        <Navigation route={route} />
      </nav>
    </div>
  );
}
