import type { ThemePreference } from "./ui-model";

export function getThemePreference(): ThemePreference {
  const value = window.localStorage.getItem("finpill-theme");
  return value === "light" || value === "dark" ? value : "system";
}

export function subscribeThemePreference(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener("finpill-theme-change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("finpill-theme-change", onChange);
  };
}

export function setThemePreference(preference: ThemePreference): void {
  window.localStorage.setItem("finpill-theme", preference);
  window.dispatchEvent(new Event("finpill-theme-change"));
}
