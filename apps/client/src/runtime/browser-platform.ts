import type {
  AuthPort,
  ClientPlatform,
  NavigationListener,
  NavigationPort,
} from "@finpill/contracts";

const NAVIGATION_EVENT = "finpill:navigation";

const anonymousAuth: AuthPort = {
  async getAccessToken() {
    return null;
  },
};

export function createBrowserNavigation(windowObject: Window): NavigationPort {
  return {
    getPathname() {
      return windowObject.location.pathname;
    },
    navigate(pathname) {
      windowObject.history.pushState({ finpillNavigation: true }, "", pathname);
      windowObject.dispatchEvent(new Event(NAVIGATION_EVENT));
    },
    subscribe(listener: NavigationListener) {
      const notify = () => listener(windowObject.location.pathname);
      windowObject.addEventListener("popstate", notify);
      windowObject.addEventListener(NAVIGATION_EVENT, notify);
      return () => {
        windowObject.removeEventListener("popstate", notify);
        windowObject.removeEventListener(NAVIGATION_EVENT, notify);
      };
    },
  };
}

export function createBrowserPlatform(windowObject: Window): ClientPlatform {
  return {
    auth: anonymousAuth,
    navigation: createBrowserNavigation(windowObject),
  };
}
