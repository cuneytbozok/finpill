import { ApiTransportError } from "@finpill/contracts";

import type { Profile } from "@finpill/contracts";

export type AccountState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly profile: Profile | null }
  | { readonly kind: "ineligible" }
  | { readonly kind: "error" };

/** Account data always belongs to exactly one verified identity. */
export interface OwnedAccountState {
  readonly userId: string;
  readonly state: AccountState;
}

/**
 * Returns what may be shown for the current identity. Data loaded for a
 * previous identity is never shown after sign-out or an account switch.
 */
export function accountViewFor(
  owned: OwnedAccountState | null,
  currentUserId: string | null,
): AccountState | null {
  if (!currentUserId) return null;
  if (!owned || owned.userId !== currentUserId) return { kind: "loading" };
  // A profile row that is not the caller's is treated as a failure.
  if (
    owned.state.kind === "ready" &&
    owned.state.profile &&
    owned.state.profile.user_id !== currentUserId
  )
    return { kind: "error" };
  return owned.state;
}

export function accountStateForError(error: unknown): AccountState {
  if (error instanceof ApiTransportError && error.status === 403)
    return { kind: "ineligible" };
  return { kind: "error" };
}
