import { describe, expect, it } from "vitest";

import {
  isNavigationCurrent,
  navigationItems,
  resolveTheme,
} from "../apps/client/src/app/ui-model";

describe("design system model", () => {
  it("keeps the approved three primary destinations", () => {
    expect(navigationItems.map((item) => item.label)).toEqual([
      "Ana Sayfa",
      "İzleme",
      "Daha Fazla",
    ]);
  });

  it("marks only its matching fixed route current", () => {
    expect(
      isNavigationCurrent(navigationItems[1]!, { kind: "watchlist" }),
    ).toBe(true);
    expect(isNavigationCurrent(navigationItems[1]!, { kind: "home" })).toBe(
      false,
    );
    expect(isNavigationCurrent(navigationItems[0]!, { kind: "search" })).toBe(
      false,
    );
    expect(
      isNavigationCurrent(navigationItems[0]!, {
        kind: "company",
        ticker: "KUYAS",
        section: "overview",
      }),
    ).toBe(false);
  });

  it("resolves the system setting without guessing a user preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
  });
});
