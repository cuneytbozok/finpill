"use client";

import { ProfileResponseSchema } from "@finpill/contracts";
import { useEffect, useId, useState } from "react";

import { accountStateForError, accountViewFor } from "./account-model";
import { EmptyState, ErrorState, LoadingSkeleton } from "./ui-primitives";

import type { ApiTransport } from "@finpill/contracts";
import type { FormEvent } from "react";
import type { OwnedAccountState } from "./account-model";

const noStore: RequestInit = { cache: "no-store" };

/**
 * The signed-in user's own profile, read through the protected API. Render it
 * with `key={userId}` so an identity change discards all previous state.
 */
export function AccountPanel({
  api,
  userId,
}: {
  api: ApiTransport | undefined;
  userId: string | null;
}) {
  const [owned, setOwned] = useState<OwnedAccountState | null>(null);
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const inputId = useId();

  useEffect(() => {
    if (!api || !userId) return;
    let active = true;
    void api
      .request({
        path: "/api/v1/profile",
        response: ProfileResponseSchema,
        init: noStore,
      })
      .then(({ profile }) => {
        if (active) setOwned({ userId, state: { kind: "ready", profile } });
      })
      .catch((error: unknown) => {
        if (active) setOwned({ userId, state: accountStateForError(error) });
      });
    return () => {
      active = false;
    };
  }, [api, userId, reload]);

  if (!api) return null;
  const view = accountViewFor(owned, userId);
  if (!view)
    return (
      <EmptyState
        description="Hesap bilgilerinizi görmek için giriş yapın."
        title="Oturum açılmadı"
      />
    );
  if (view.kind === "loading")
    return <LoadingSkeleton label="Hesap bilgileri yükleniyor" />;
  if (view.kind === "ineligible")
    return (
      <ErrorState
        description="Bu hesap özel pilot kullanımına henüz açılmadı."
        title="Hesap yetkili değil"
      />
    );
  if (view.kind === "error")
    return (
      <ErrorState
        action={
          <button onClick={() => setReload((value) => value + 1)} type="button">
            Tekrar dene
          </button>
        }
        description="Hesap bilgileri alınamadı. Bağlantınızı kontrol edip tekrar deneyin."
        title="Hesap bilgileri alınamadı"
      />
    );

  const profile = view.profile;
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const displayName = draft.trim();
    if (!displayName || !userId) return;
    setSaving(true);
    void api
      .request({
        path: "/api/v1/profile",
        response: ProfileResponseSchema,
        init: {
          ...noStore,
          method: profile ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName }),
        },
      })
      .then(({ profile: saved }) => {
        setOwned((current) =>
          current?.userId === userId
            ? { userId, state: { kind: "ready", profile: saved } }
            : current,
        );
        setDraft("");
      })
      .catch((error: unknown) => {
        setOwned((current) =>
          current?.userId === userId
            ? { userId, state: accountStateForError(error) }
            : current,
        );
      })
      .finally(() => setSaving(false));
  };

  return (
    <section aria-labelledby={`${inputId}-title`} className="state-card">
      <p className="eyebrow">Hesap</p>
      <h2 id={`${inputId}-title`}>
        {profile ? profile.display_name : "Profil oluşturulmadı"}
      </h2>
      <p>
        {profile
          ? "Bu profil yalnızca sizin hesabınıza aittir."
          : "Görünen adınızı belirleyerek profilinizi oluşturun."}
      </p>
      <form className="account-form" onSubmit={save}>
        <label htmlFor={inputId}>Görünen ad</label>
        <input
          autoComplete="nickname"
          id={inputId}
          maxLength={80}
          onChange={(event) => setDraft(event.target.value)}
          value={draft}
        />
        <button disabled={saving || !draft.trim()} type="submit">
          {profile ? "Güncelle" : "Oluştur"}
        </button>
      </form>
    </section>
  );
}
