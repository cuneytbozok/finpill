import { IsoDateSchema } from "@finpill/contracts";

import type {
  FinancialPeriod,
  IsoDate,
  ReportingScope,
} from "@finpill/contracts";

/**
 * Financial context and fact identity (A07). Pure rules over values the parser
 * (04.x) has already read losslessly; nothing here repairs source data.
 */

export type FinancialContractErrorCode =
  | "invalid_date"
  | "invalid_period"
  | "unknown_consolidation"
  | "invalid_subreport"
  | "duplicate_axis"
  | "invalid_dimension"
  | "invalid_publication_time"
  | "unsupported_time_zone_period"
  | "invalid_coverage"
  | "period_label_mismatch"
  | "ambiguous_input";

export class FinancialContractError extends Error {
  readonly code: FinancialContractErrorCode;

  constructor(code: FinancialContractErrorCode, message: string) {
    super(message);
    this.name = "FinancialContractError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Calendar dates. Integer day arithmetic in UTC; no time zones involved.

const DAY_MS = 86_400_000;

export function parseIsoDate(value: unknown): IsoDate {
  const parsed = IsoDateSchema.safeParse(value);
  if (!parsed.success)
    throw new FinancialContractError("invalid_date", "Invalid calendar date");
  return parsed.data;
}

function dateParts(date: IsoDate): [number, number, number] {
  return [
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)),
    Number(date.slice(8, 10)),
  ];
}

function toDayNumber(date: IsoDate): number {
  const [year, month, day] = dateParts(date);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

function fromDayNumber(days: number): IsoDate {
  return new Date(days * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromDayNumber(toDayNumber(date) + days);
}

/** Adds whole months to a first-of-month date. */
export function addMonthsToMonthStart(date: IsoDate, months: number): IsoDate {
  const [year, month, day] = dateParts(date);
  if (day !== 1)
    throw new FinancialContractError("invalid_period", "Not a month start");
  const index = year * 12 + (month - 1) + months;
  const y = Math.floor(index / 12);
  const m = index - y * 12 + 1;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`;
}

/**
 * Length of a duration in whole calendar months, or null when it does not run
 * from a month start to a month end. Irregular periods are never rounded.
 */
export function wholeMonths(start: IsoDate, end: IsoDate): number | null {
  const next = addDays(end, 1);
  if (!start.endsWith("-01") || !next.endsWith("-01") || start > end)
    return null;
  const index = (date: IsoDate) => {
    const [year, month] = dateParts(date);
    return year * 12 + month;
  };
  return index(next) - index(start);
}

// ---------------------------------------------------------------------------
// KAP source contexts and filing attributes.

export type KapContext = {
  id?: unknown;
  key?: unknown;
  Period?: { instant?: unknown; startDate?: unknown; endDate?: unknown };
};

export type NormalizedContext = {
  sourceContextId: string;
  /** Kept for lineage only: `CURR`/`PREV` never decide the period. */
  sourceKey: string | null;
  period: FinancialPeriod;
};

export function normalizeKapContext(context: KapContext): NormalizedContext {
  if (typeof context.id !== "string" || context.id === "")
    throw new FinancialContractError("invalid_period", "Context without id");
  const { instant, startDate, endDate } = context.Period ?? {};
  const hasInstant = instant !== undefined;
  const hasDuration = startDate !== undefined || endDate !== undefined;
  if (hasInstant === hasDuration)
    throw new FinancialContractError(
      "invalid_period",
      "Context must be exactly one of instant or duration",
    );
  let period: FinancialPeriod;
  if (hasInstant) {
    period = { kind: "instant", date: parseIsoDate(instant) };
  } else {
    const start = parseIsoDate(startDate);
    const end = parseIsoDate(endDate);
    if (start > end)
      throw new FinancialContractError("invalid_period", "Start after end");
    period = { kind: "duration", start, end };
  }
  return {
    sourceContextId: context.id,
    sourceKey: typeof context.key === "string" ? context.key : null,
    period,
  };
}

export function reportingScope(consolidation: unknown): ReportingScope {
  if (consolidation === "CS") return "consolidated";
  if (consolidation === "NC") return "standalone";
  throw new FinancialContractError(
    "unknown_consolidation",
    "Filing has no recognized consolidation",
  );
}

/** The taxonomy family of a statement subreport (`banks_role_210011` → `banks`). */
export function taxonomyFamily(subreportId: string): string {
  const family = /^([a-z][a-z-]*)_role_\d+$/.exec(subreportId)?.[1];
  if (!family)
    throw new FinancialContractError(
      "invalid_subreport",
      "Unrecognized subreport id",
    );
  return family;
}

/**
 * KAP publication time (`29.12.2023 18:28:45`, Europe/Istanbul) as UTC.
 * Istanbul has been fixed at UTC+03:00 since 2016-09-07; earlier times are
 * rejected instead of guessing a daylight-saving offset.
 */
export function parseKapPublicationTime(value: unknown): string {
  const match =
    typeof value === "string"
      ? /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(value)
      : null;
  if (!match)
    throw new FinancialContractError(
      "invalid_publication_time",
      "Unrecognized KAP publication time",
    );
  const [, day, month, year, hour, minute, second] = match;
  const date = parseIsoDate(`${year}-${month}-${day}`);
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59)
    throw new FinancialContractError(
      "invalid_publication_time",
      "Unrecognized KAP publication time",
    );
  if (date < "2016-09-08")
    throw new FinancialContractError(
      "unsupported_time_zone_period",
      "Publication times before 2016-09-08 need an explicit offset rule",
    );
  const local = Date.parse(`${date}T${hour}:${minute}:${second}+03:00`);
  return new Date(local).toISOString().replace(".000Z", "Z");
}

// ---------------------------------------------------------------------------
// Facts.

export type Dimension = {
  axis: string;
  /** null: a typed-domain member the source does not identify. */
  member: string | null;
};

export type KapFactOccurrence = {
  /** The value-bearing ReportItem's `name`. */
  itemName: string;
  /** The enclosing ReportItem's `name`, used for typed-domain items. */
  parentName: string | null;
  /** `typedMember: "yes"` on the value-bearing item. */
  typedMember: boolean;
  preferredLabel: string | null;
  measures: { measureName?: unknown; measureValueName?: unknown }[];
  context: NormalizedContext;
  currency: string;
};

export type TemporalRole = "context" | "period_start" | "period_end";

export type FactIdentity = {
  concept: string;
  period: FinancialPeriod;
  temporalRole: TemporalRole;
  dimensions: Dimension[];
  currency: string;
};

/**
 * `periodStartLabel`/`periodEndLabel` (and terse/verbose variants) on a
 * duration context report a balance, not a flow: the start balance is the
 * instant before the period begins, the end balance the period's last day.
 */
export function temporalRole(preferredLabel: string | null): TemporalRole {
  if (preferredLabel && /periodstart/i.test(preferredLabel))
    return "period_start";
  if (preferredLabel && /periodend/i.test(preferredLabel)) return "period_end";
  return "context";
}

export function effectivePeriod(
  period: FinancialPeriod,
  role: TemporalRole,
): FinancialPeriod {
  if (period.kind === "instant" || role === "context") return period;
  return role === "period_start"
    ? { kind: "instant", date: addDays(period.start, -1) }
    : { kind: "instant", date: period.end };
}

const NAME = /^[A-Za-z][A-Za-z0-9_-]*$/;

export function kapFactIdentity(occurrence: KapFactOccurrence): FactIdentity {
  const dimensions: Dimension[] = occurrence.measures.map((measure) => {
    const { measureName: axis, measureValueName: member } = measure;
    if (
      typeof axis !== "string" ||
      typeof member !== "string" ||
      !NAME.test(axis) ||
      !NAME.test(member)
    )
      throw new FinancialContractError(
        "invalid_dimension",
        "Malformed dimension measure",
      );
    return { axis, member };
  });
  let concept = occurrence.itemName;
  if (occurrence.typedMember) {
    // KAP marks the typed-domain item itself (e.g. `ClassesOfShares`) and
    // omits the member; the reported concept is the enclosing item.
    if (!occurrence.parentName)
      throw new FinancialContractError(
        "invalid_dimension",
        "Typed member without an enclosing concept",
      );
    concept = occurrence.parentName;
    dimensions.push({ axis: occurrence.itemName, member: null });
  }
  dimensions.sort((a, b) => (a.axis < b.axis ? -1 : a.axis > b.axis ? 1 : 0));
  for (let i = 1; i < dimensions.length; i += 1)
    if (dimensions[i]?.axis === dimensions[i - 1]?.axis)
      throw new FinancialContractError(
        "duplicate_axis",
        "A fact names one axis twice",
      );
  const role = temporalRole(occurrence.preferredLabel);
  return {
    concept,
    period: effectivePeriod(occurrence.context.period, role),
    temporalRole: role,
    dimensions,
    currency: occurrence.currency,
  };
}

/**
 * Canonical string of a fact identity within one filing build. The temporal
 * role stays in the key: a closing balance and the next period's opening
 * balance share an instant but are separate reported facts, and their
 * agreement is a quality check (04.06), not an identity merge.
 */
export function factIdentityKey(identity: FactIdentity): string {
  const role =
    identity.temporalRole === "context" ? "" : `@${identity.temporalRole}`;
  const period =
    identity.period.kind === "instant"
      ? `i:${identity.period.date}${role}`
      : `d:${identity.period.start}/${identity.period.end}`;
  const dimensions = identity.dimensions
    .map(({ axis, member }) => `${axis}=${member ?? "?"}`)
    .join(",");
  return [identity.concept, period, dimensions, identity.currency].join("|");
}

export type FactGroup<T> = {
  key: string;
  identity: FactIdentity;
  occurrences: T[];
};

/**
 * Groups presentation occurrences into facts. A concept presented twice with
 * the same value is one fact; differing values are a conflict to report, and
 * neither value is chosen.
 */
export function groupFactOccurrences<
  T extends { occurrence: KapFactOccurrence; value: string },
>(items: T[]): { facts: FactGroup<T>[]; conflicts: FactGroup<T>[] } {
  const groups = new Map<string, FactGroup<T>>();
  for (const item of items) {
    const identity = kapFactIdentity(item.occurrence);
    const key = factIdentityKey(identity);
    const group = groups.get(key) ?? { key, identity, occurrences: [] };
    group.occurrences.push(item);
    groups.set(key, group);
  }
  const facts: FactGroup<T>[] = [];
  const conflicts: FactGroup<T>[] = [];
  for (const group of groups.values()) {
    const values = new Set(group.occurrences.map((item) => item.value));
    (values.size === 1 ? facts : conflicts).push(group);
  }
  return { facts, conflicts };
}
