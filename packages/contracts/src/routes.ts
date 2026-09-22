import { z } from "zod";

export const CompanySectionSchema = z.enum([
  "overview",
  "financials",
  "ratios",
  "disclosures",
  "ai",
]);

export type CompanySection = z.infer<typeof CompanySectionSchema>;

export type AppRoute =
  | { readonly kind: "home" }
  | { readonly kind: "search" }
  | { readonly kind: "watchlist" }
  | { readonly kind: "ai" }
  | { readonly kind: "settings" }
  | {
      readonly kind: "company";
      readonly ticker: string;
      readonly section: CompanySection;
    }
  | { readonly kind: "not-found"; readonly pathname: string };

export const CANONICAL_ROUTE_PATTERNS = [
  "/",
  "/search",
  "/watchlist",
  "/ai",
  "/settings",
  "/company/[ticker]",
  "/company/[ticker]/financials",
  "/company/[ticker]/ratios",
  "/company/[ticker]/disclosures",
  "/company/[ticker]/ai",
] as const;

const FIXED_ROUTES = new Map<string, Exclude<AppRoute, { kind: "company" }>>([
  ["/", { kind: "home" }],
  ["/search", { kind: "search" }],
  ["/watchlist", { kind: "watchlist" }],
  ["/ai", { kind: "ai" }],
  ["/settings", { kind: "settings" }],
]);

const TICKER_PATTERN = /^[A-Z0-9.-]{1,24}$/;

function cleanPathname(pathname: string): string {
  if (!pathname.startsWith("/")) {
    return pathname;
  }
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function decodeSegment(value: string): string | undefined {
  try {
    const decoded = decodeURIComponent(value).toUpperCase();
    return TICKER_PATTERN.test(decoded) ? decoded : undefined;
  } catch {
    return undefined;
  }
}

export function parseAppRoute(pathname: string): AppRoute {
  const clean = cleanPathname(pathname);
  const fixed = FIXED_ROUTES.get(clean);
  if (fixed) {
    return fixed;
  }

  const match = /^\/company\/([^/]+)(?:\/([^/]+))?$/.exec(clean);
  if (!match) {
    return { kind: "not-found", pathname: clean };
  }

  const ticker = decodeSegment(match[1] ?? "");
  const section = CompanySectionSchema.safeParse(match[2] ?? "overview");
  if (!ticker || !section.success) {
    return { kind: "not-found", pathname: clean };
  }

  return { kind: "company", ticker, section: section.data };
}

export function companyRoute(
  ticker: string,
  section: CompanySection = "overview",
): string {
  const normalizedTicker = ticker.trim().toUpperCase();
  if (!TICKER_PATTERN.test(normalizedTicker)) {
    throw new Error(
      "Ticker must contain 1–24 uppercase letters, numbers, dots, or hyphens",
    );
  }

  const base = `/company/${encodeURIComponent(normalizedTicker)}`;
  return section === "overview" ? base : `${base}/${section}`;
}

export function routePath(
  route: Exclude<AppRoute, { kind: "not-found" }>,
): string {
  switch (route.kind) {
    case "home":
      return "/";
    case "search":
      return "/search";
    case "watchlist":
      return "/watchlist";
    case "ai":
      return "/ai";
    case "settings":
      return "/settings";
    case "company":
      return companyRoute(route.ticker, route.section);
  }
}
