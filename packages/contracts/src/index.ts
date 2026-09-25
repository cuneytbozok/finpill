import { z } from "zod";

export const API_VERSION = "v1" as const;

// Liveness only: this does not report database or provider readiness.
export const HealthResponseSchema = z.strictObject({
  status: z.literal("ok"),
  apiVersion: z.literal(API_VERSION),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export {
  PublicEnvironmentSchema,
  assertCredentialFreePreview,
  parseEnvironment,
} from "./environment";
export {
  CANONICAL_ROUTE_PATTERNS,
  CompanySectionSchema,
  companyRoute,
  parseAppRoute,
  routePath,
} from "./routes";
export type { AppRoute, CompanySection } from "./routes";
export type {
  AuthPort,
  ClientPlatform,
  NavigationListener,
  NavigationPort,
} from "./platform";
export {
  ApiProblemSchema,
  ApiTransportError,
  createApiTransport,
} from "./transport";
export type {
  ApiProblem,
  ApiRequest,
  ApiTransport,
  CreateApiTransportOptions,
} from "./transport";
export {
  ProfileResponseSchema,
  ProfileSchema,
  SessionResponseSchema,
} from "./auth";
export type { Profile } from "./auth";
export {
  DECIMAL_LIMITS,
  DecimalError,
  DecimalStringSchema,
  abs,
  add,
  compare,
  divide,
  isDecimalString,
  multiply,
  negate,
  parseDecimal,
  round,
  roundScaled,
  sign,
  subtract,
  toChartNumber,
} from "./decimal";
export type { DecimalErrorCode, DecimalString, RoundingMode } from "./decimal";
export {
  NumericUnitSchema,
  NumericValueSchema,
  UnavailableNumericStatusSchema,
} from "./numeric";
export type { NumericUnit, NumericValue } from "./numeric";
export {
  formatCompact,
  formatCompactCurrency,
  formatCurrency,
  formatDecimal,
  formatInteger,
  formatMultiple,
  formatPercent,
} from "./format";
export type { FormatOptions, NumberLocale } from "./format";
