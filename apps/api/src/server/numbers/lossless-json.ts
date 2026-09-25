import { parseDecimal } from "@finpill/contracts";

import type { DecimalString } from "@finpill/contracts";

/**
 * A JSON number kept as its exact source token. It never becomes a JS number;
 * `toDecimal` converts it to a canonical decimal string or fails explicitly.
 */
export class JsonNumber {
  readonly source: string;

  constructor(source: string) {
    this.source = source;
  }

  toDecimal(): DecimalString {
    return parseDecimal(this.source);
  }
}

export type LosslessJsonValue =
  | null
  | boolean
  | string
  | JsonNumber
  | LosslessJsonValue[]
  | { [key: string]: LosslessJsonValue };

export class LosslessJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LosslessJsonError";
  }
}

type Reviver = (
  this: unknown,
  key: string,
  value: unknown,
  context?: { source?: string },
) => unknown;

/**
 * Parses provider JSON (A06) with every number token preserved verbatim, using
 * the reviver source-text access of Node 24. Fails closed if the runtime does
 * not expose the source token.
 */
export function parseLosslessJson(text: string): LosslessJsonValue {
  const reviver: Reviver = (_key, value, context) => {
    if (typeof value !== "number") return value;
    if (typeof context?.source !== "string")
      throw new LosslessJsonError("Runtime lacks JSON source text access");
    return new JsonNumber(context.source);
  };
  try {
    return JSON.parse(
      text,
      reviver as (key: string, value: unknown) => unknown,
    ) as LosslessJsonValue;
  } catch (error) {
    if (error instanceof LosslessJsonError) throw error;
    throw new LosslessJsonError("Invalid JSON");
  }
}
