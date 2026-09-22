import { describe, expect, it } from "vitest";

import {
  isNavigationCurrent,
  navigationItems,
  resolveTheme,
} from "../apps/client/src/app/ui-model";

describe("design system model", () => {
  it("keeps the approved five global mobile destinations", () => {
    expect(navigationItems.map((item) => item.label)).toEqual([
      "Ana Sayfa",
      "Ara",
      "İzleme",
      "Yapay Zekâ",
      "Daha Fazla",
    ]);
  });

  it("marks only its matching fixed route current", () => {
    expect(isNavigationCurrent(navigationItems[1]!, { kind: "search" })).toBe(
      true,
    );
    expect(isNavigationCurrent(navigationItems[1]!, { kind: "home" })).toBe(
      false,
    );
  });

  it("resolves the system setting without guessing a user preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
  });
});
