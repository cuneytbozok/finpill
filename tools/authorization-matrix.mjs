// Two-account authorization/RLS matrix for task 01.10.
//
// Runs as the signed-in account against the protected API and directly against
// the Supabase Data API, using real Clerk-issued session tokens. It is
// dependency-free so it can run inside a signed-in browser page, where
// `getToken` is `() => window.Clerk.session.getToken()`. Results name checks
// and statuses only; tokens and response bodies are never returned.

const denied = [401, 403];

export async function runAuthorizationMatrix({
  getToken,
  apiOrigin,
  supabaseUrl,
  publishableKey,
  userId,
  otherUserId,
  eligible,
  fetch: fetcher = globalThis.fetch,
}) {
  const results = [];
  const record = (check, pass, actual) =>
    results.push({ check, pass: Boolean(pass), actual });

  async function call(url, { token, method = "GET", body, headers = {} }) {
    const response = await fetcher(url, {
      method,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json;
    try {
      json = await response.json();
    } catch {
      json = null;
    }
    return { status: response.status, json };
  }
  const api = async (path, options = {}) =>
    call(`${apiOrigin}/api/v1/${path}`, {
      ...options,
      token: "token" in options ? options.token : await getToken(),
    });
  const data = async (path, options = {}) =>
    call(`${supabaseUrl}/rest/v1/${path}`, {
      ...options,
      token: "token" in options ? options.token : await getToken(),
      headers: {
        apikey: publishableKey,
        Prefer: "return=representation",
        ...options.headers,
      },
    });
  const rows = (result) => (Array.isArray(result.json) ? result.json : null);
  const onlyOwn = (result) =>
    result.status === 200 &&
    rows(result)?.every((row) => row.user_id === userId);
  const noRows = (result) =>
    denied.includes(result.status) ||
    (result.status === 200 && rows(result)?.length === 0);
  const other = encodeURIComponent(otherUserId);
  const self = encodeURIComponent(userId);
  const invalidToken = "invalid.token.value";

  // Identity: the API derives the caller only from the verified token.
  const session = await api("session");
  record(
    "api: session resolves to the signed-in account",
    session.status === 200 && session.json?.userId === userId,
    session.status,
  );

  // Anonymous and invalid tokens.
  for (const [label, token] of [
    ["anonymous", null],
    ["invalid token", invalidToken],
  ]) {
    const profile = await api("profile", { token });
    record(
      `api: ${label} profile read is 401`,
      profile.status === 401,
      profile.status,
    );
    const read = await data("user_profiles?select=user_id", { token });
    record(
      `data: ${label} profile read returns no rows`,
      noRows(read),
      read.status,
    );
  }

  if (!eligible) {
    const read = await api("profile");
    record("api: ineligible read is 403", read.status === 403, read.status);
    const create = await api("profile", {
      method: "POST",
      body: { displayName: "Ineligible" },
    });
    record(
      "api: ineligible create is 403",
      create.status === 403,
      create.status,
    );
    const own = await data(`user_profiles?select=user_id&user_id=eq.${self}`);
    record("data: ineligible cannot read a profile", noRows(own), own.status);
    const insert = await data("user_profiles", {
      method: "POST",
      body: { user_id: userId, display_name: "Ineligible" },
    });
    record(
      "data: ineligible insert is denied",
      denied.includes(insert.status),
      insert.status,
    );
  } else {
    const read = await api("profile");
    record(
      "api: eligible reads own profile or none",
      read.status === 200 &&
        (read.json?.profile === null || read.json?.profile?.user_id === userId),
      read.status,
    );
    const exists = Boolean(read.json?.profile);
    const write = await api("profile", {
      method: exists ? "PATCH" : "POST",
      body: { displayName: `Matrix ${userId.slice(-4)}` },
    });
    record(
      `api: eligible ${exists ? "updates" : "creates"} own profile`,
      [200, 201].includes(write.status) &&
        write.json?.profile?.user_id === userId,
      write.status,
    );
    const duplicate = await api("profile", {
      method: "POST",
      body: { displayName: "Duplicate" },
    });
    record(
      "api: second create is 409",
      duplicate.status === 409,
      duplicate.status,
    );
    const readBack = await data("user_profiles?select=user_id");
    record(
      "data: profile read returns only own row",
      onlyOwn(readBack) && rows(readBack).length === 1,
      readBack.status,
    );
  }

  // Cross-user and privilege checks apply to every signed-in account.
  const readOther = await data(
    `user_profiles?select=user_id&user_id=eq.${other}`,
  );
  record(
    "data: cannot read the other account's profile",
    noRows(readOther),
    readOther.status,
  );
  const updateOther = await data(`user_profiles?user_id=eq.${other}`, {
    method: "PATCH",
    body: { display_name: "Hijacked" },
  });
  record(
    "data: cannot update the other account's profile",
    noRows(updateOther),
    updateOther.status,
  );
  const insertOther = await data("user_profiles", {
    method: "POST",
    body: { user_id: otherUserId, display_name: "Hijacked" },
  });
  record(
    "data: cannot create a profile for the other account",
    denied.includes(insertOther.status),
    insertOther.status,
  );
  const reassign = await data(`user_profiles?user_id=eq.${self}`, {
    method: "PATCH",
    body: { user_id: otherUserId },
  });
  record(
    "data: cannot reassign own profile",
    denied.includes(reassign.status),
    reassign.status,
  );
  const remove = await data(`user_profiles?user_id=eq.${self}`, {
    method: "DELETE",
  });
  record(
    "data: cannot delete a profile",
    denied.includes(remove.status),
    remove.status,
  );

  const eligibility = await data("pilot_eligibility?select=user_id,enabled");
  record(
    "data: eligibility read returns only own row",
    onlyOwn(eligibility),
    eligibility.status,
  );
  const selfEnable = await data(`pilot_eligibility?user_id=eq.${self}`, {
    method: "PATCH",
    body: { enabled: true },
  });
  record(
    "data: cannot change own eligibility",
    denied.includes(selfEnable.status),
    selfEnable.status,
  );
  const grant = await data("pilot_eligibility", {
    method: "POST",
    body: { user_id: userId, enabled: true },
  });
  record(
    "data: cannot grant eligibility",
    denied.includes(grant.status),
    grant.status,
  );

  return results;
}
