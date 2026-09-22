"use client";

import { parseAppRoute, routePath } from "@finpill/contracts";
import { useEffect, useState } from "react";

import { createBrowserPlatform } from "@/runtime/browser-platform";
import { createClientApi } from "@/runtime/api";

import type { AppRoute } from "@finpill/contracts";
import type { MouseEvent } from "react";

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
      return `${route.ticker} · ${route.section}`;
    case "not-found":
      return "Sayfa bulunamadı";
  }
}

function RouteContent({ route }: { route: AppRoute }) {
  if (route.kind === "not-found") {
    return (
      <main>
        <h1>Sayfa bulunamadı</h1>
        <p>Bu bağlantı Finpill’in tanımlı bir rotası değil.</p>
      </main>
    );
  }

  if (route.kind === "company") {
    return (
      <main>
        <h1>{route.ticker}</h1>
        <p>{route.section} bölümü hazırlanıyor.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>{routeTitle(route)}</h1>
      <p>Uygulama hazırlanıyor.</p>
    </main>
  );
}

function AppLink({ href, children }: { href: string; children: string }) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    createBrowserPlatform(window).navigation.navigate(href);
  };

  return (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  );
}

export function ClientApp() {
  const [route, setRoute] = useState<AppRoute>({ kind: "home" });

  useEffect(() => {
    const platform = createBrowserPlatform(window);
    // Creating the transport validates the enabled public API boundary without
    // issuing a request from the static shell.
    void createClientApi(platform);
    const update = (pathname: string) => setRoute(parseAppRoute(pathname));
    update(platform.navigation.getPathname());
    return platform.navigation.subscribe(update);
  }, []);

  return (
    <>
      <nav aria-label="Ana navigasyon">
        <AppLink href={routePath({ kind: "home" })}>Ana Sayfa</AppLink>
        {" · "}
        <AppLink href={routePath({ kind: "search" })}>Ara</AppLink>
        {" · "}
        <AppLink href={routePath({ kind: "watchlist" })}>
          İzleme Listesi
        </AppLink>
        {" · "}
        <AppLink href={routePath({ kind: "ai" })}>Yapay Zekâ</AppLink>
        {" · "}
        <AppLink href={routePath({ kind: "settings" })}>Ayarlar</AppLink>
      </nav>
      <RouteContent route={route} />
    </>
  );
}
