import { routePath } from "@finpill/contracts";

import type { AppRoute } from "@finpill/contracts";

export type ThemePreference = "system" | "light" | "dark";

export type NavigationItem = {
  href: string;
  label: string;
  route: AppRoute["kind"];
  icon: string;
};

export const navigationItems: readonly NavigationItem[] = [
  {
    href: routePath({ kind: "home" }),
    label: "Ana Sayfa",
    route: "home",
    icon: "⌂",
  },
  {
    href: routePath({ kind: "search" }),
    label: "Ara",
    route: "search",
    icon: "⌕",
  },
  {
    href: routePath({ kind: "watchlist" }),
    label: "İzleme",
    route: "watchlist",
    icon: "☆",
  },
  {
    href: routePath({ kind: "ai" }),
    label: "Yapay Zekâ",
    route: "ai",
    icon: "✦",
  },
  {
    href: routePath({ kind: "settings" }),
    label: "Daha Fazla",
    route: "settings",
    icon: "•••",
  },
];

export function isNavigationCurrent(
  item: NavigationItem,
  route: AppRoute,
): boolean {
  return item.route === route.kind;
}

export function resolveTheme(
  preference: ThemePreference,
  prefersDark: boolean,
): "light" | "dark" {
  if (preference === "system") {
    return prefersDark ? "dark" : "light";
  }
  return preference;
}
