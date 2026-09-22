export interface AuthPort {
  /** Returns a current bearer token, or null when the user is not authenticated. */
  getAccessToken(): Promise<string | null>;
}

export type NavigationListener = (pathname: string) => void;

export interface NavigationPort {
  getPathname(): string;
  navigate(pathname: string): void;
  subscribe(listener: NavigationListener): () => void;
}

export interface ClientPlatform {
  auth: AuthPort;
  navigation: NavigationPort;
}
