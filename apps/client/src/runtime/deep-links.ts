import { parseAppRoute, routePath } from "@finpill/contracts";

/** Resolve only routes from the app's explicitly configured HTTPS origin. */
export function resolveDeepLink(
  incomingUrl: string,
  trustedOrigin: string | undefined,
): string | null {
  if (!trustedOrigin) return null;
  let incoming: URL;
  try {
    incoming = new URL(incomingUrl);
  } catch {
    return null;
  }
  if (
    incoming.protocol !== "https:" ||
    incoming.origin !== trustedOrigin ||
    incoming.username ||
    incoming.password ||
    incoming.search ||
    incoming.hash
  )
    return null;

  const route = parseAppRoute(incoming.pathname);
  if (route.kind === "not-found") return null;
  // The old global AI entry is a compatibility alias, never a company selector.
  return route.kind === "ai" ? "/search" : routePath(route);
}
