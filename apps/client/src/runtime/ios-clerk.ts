import { registerPlugin } from "@capacitor/core";

interface ClerkState {
  isLoaded: boolean;
  userId: string | null;
}

interface ClerkToken {
  token: string | null;
}

interface FinpillClerkPlugin {
  initialize(options: { publishableKey: string }): Promise<ClerkState>;
  state(): Promise<ClerkState>;
  signIn(): Promise<void>;
  signOut(): Promise<ClerkState>;
  getToken(): Promise<ClerkToken>;
}

const plugin = registerPlugin<FinpillClerkPlugin>("FinpillClerk");

export const iosClerk = {
  initialize: (publishableKey: string) => plugin.initialize({ publishableKey }),
  state: () => plugin.state(),
  signIn: () => plugin.signIn(),
  signOut: () => plugin.signOut(),
  getAccessToken: async () => (await plugin.getToken()).token,
};
