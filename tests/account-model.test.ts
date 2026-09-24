import { describe, expect, it } from "vitest";

import { ApiTransportError, ProfileResponseSchema } from "@finpill/contracts";

import {
  accountStateForError,
  accountViewFor,
} from "../apps/client/src/app/account-model";

const profile = { user_id: "user_a", display_name: "A" };

describe("account identity isolation", () => {
  it("shows nothing when signed out, even if data was loaded", () => {
    expect(
      accountViewFor(
        { userId: "user_a", state: { kind: "ready", profile } },
        null,
      ),
    ).toBeNull();
  });

  it("never shows a previous identity's data after an account switch", () => {
    expect(
      accountViewFor(
        { userId: "user_a", state: { kind: "ready", profile } },
        "user_b",
      ),
    ).toEqual({ kind: "loading" });
  });

  it("rejects a profile row that is not the caller's", () => {
    expect(
      accountViewFor(
        { userId: "user_b", state: { kind: "ready", profile } },
        "user_b",
      ),
    ).toEqual({ kind: "error" });
  });

  it("shows the caller's own data", () => {
    expect(
      accountViewFor(
        { userId: "user_a", state: { kind: "ready", profile } },
        "user_a",
      ),
    ).toEqual({ kind: "ready", profile });
  });

  it("maps 403 to ineligible and other failures to error", () => {
    expect(
      accountStateForError(new ApiTransportError("x", { status: 403 })),
    ).toEqual({ kind: "ineligible" });
    expect(
      accountStateForError(new ApiTransportError("x", { status: 401 })),
    ).toEqual({ kind: "error" });
    expect(accountStateForError(new Error("offline"))).toEqual({
      kind: "error",
    });
  });
});

describe("profile response contract", () => {
  it("accepts an own profile or null and rejects extra fields", () => {
    expect(ProfileResponseSchema.parse({ profile })).toEqual({ profile });
    expect(ProfileResponseSchema.parse({ profile: null })).toEqual({
      profile: null,
    });
    expect(() =>
      ProfileResponseSchema.parse({ profile: { ...profile, email: "x" } }),
    ).toThrow();
  });
});
