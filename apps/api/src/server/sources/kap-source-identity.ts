/**
 * Logical identity of a KAP (MKK VYK) response, derived from its request path.
 * Representations (`fileType`) and subreport filters are part of the identity,
 * so their bodies are separate documents and never become each other's revisions.
 */
export type SourceIdentity = {
  source: "kap_vyk";
  resource: KapResource;
  externalKey: string;
  representation: string;
  subreportScope: string;
  requestPath: string;
};

export type KapResource =
  | "members"
  | "member_detail"
  | "member_securities"
  | "funds"
  | "fund_detail"
  | "last_disclosure_index"
  | "disclosure_list"
  | "disclosure_detail"
  | "attachment"
  | "blocked_disclosures"
  | "ca_event_status";

const singletons: Record<string, KapResource> = {
  "/members": "members",
  "/memberSecurities": "member_securities",
  "/funds": "funds",
  "/lastDisclosureIndex": "last_disclosure_index",
  "/blockedDisclosures": "blocked_disclosures",
};
const byId: Record<string, [KapResource, string]> = {
  memberDetail: ["member_detail", "json"],
  fundDetail: ["fund_detail", "json"],
  downloadAttachment: ["attachment", "file"],
};
const queried: Record<string, KapResource> = {
  "/disclosures": "disclosure_list",
  "/caEventStatus": "ca_event_status",
};

const externalKeyPattern = /^[A-Za-z0-9_.,:=&-]{1,256}$/;
const requestPathPattern = /^\/[A-Za-z0-9_.,:=&?/%+-]{0,1023}$/;
const subreportListPattern =
  /^[A-Za-z0-9_.-]{1,64}(,[A-Za-z0-9_.-]{1,64}){0,63}$/;

function invalid(): never {
  throw new Error("Unsupported KAP source request");
}

function parameters(search: URLSearchParams) {
  const entries = [...search.entries()];
  if (new Set(entries.map(([name]) => name)).size !== entries.length) invalid();
  return new Map(entries);
}

export function kapSourceIdentity(requestPath: string): SourceIdentity {
  if (!requestPathPattern.test(requestPath)) invalid();
  const url = new URL(requestPath, "https://kap.invalid");
  if (url.host !== "kap.invalid" || url.hash) invalid();
  const params = parameters(url.searchParams);
  const identity = (
    resource: KapResource,
    externalKey: string,
    representation = "json",
    subreportScope = "all",
  ): SourceIdentity => {
    if (!externalKeyPattern.test(externalKey)) invalid();
    return {
      source: "kap_vyk",
      resource,
      externalKey,
      representation,
      subreportScope,
      requestPath,
    };
  };

  const singleton = Object.hasOwn(singletons, url.pathname)
    ? singletons[url.pathname]
    : undefined;
  if (singleton) {
    if (params.size) invalid();
    return identity(singleton, "all");
  }

  const list = Object.hasOwn(queried, url.pathname)
    ? queried[url.pathname]
    : undefined;
  if (list) {
    if (!params.size) invalid();
    // Parameter order is not meaningful; values are kept exactly as requested.
    const key = [...params]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([name, value]) => `${name}=${value}`)
      .join("&");
    return identity(list, key);
  }

  const detail = /^\/disclosureDetail\/([0-9]{1,12})$/.exec(url.pathname);
  if (detail) {
    const fileType = params.get("fileType");
    const subReportList = params.get("subReportList");
    if (!fileType || !/^[a-z]{1,16}$/.test(fileType)) invalid();
    if (
      [...params.keys()].some((k) => k !== "fileType" && k !== "subReportList")
    )
      invalid();
    if (
      subReportList !== undefined &&
      !subreportListPattern.test(subReportList)
    )
      invalid();
    // Kept exactly as requested; a reordered list is a separate document.
    return identity("disclosure_detail", detail[1]!, fileType, subReportList);
  }

  const item = /^\/([A-Za-z]+)\/([A-Za-z0-9_.-]{1,128})$/.exec(url.pathname);
  const target = item && Object.hasOwn(byId, item[1]!) && byId[item[1]!];
  if (item && target) {
    if (params.size) invalid();
    return identity(target[0], item[2]!, target[1]);
  }
  invalid();
}
