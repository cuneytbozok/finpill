import { registerPlugin } from "@capacitor/core";

export interface ClerkState {
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

export interface NativeClerk {
  initialize(publishableKey: string): Promise<ClerkState>;
  state(): Promise<ClerkState>;
  signIn(): Promise<void>;
  signOut(): Promise<ClerkState>;
  getAccessToken(): Promise<string | null>;
}

export const nativeClerk: NativeClerk = {
  initialize: (publishableKey: string) => plugin.initialize({ publishableKey }),
  state: () => plugin.state(),
  signIn: () => plugin.signIn(),
  signOut: () => plugin.signOut(),
  getAccessToken: async () => (await plugin.getToken()).token,
};
