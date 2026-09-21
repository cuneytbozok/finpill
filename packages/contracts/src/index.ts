import { z } from "zod";

export const API_VERSION = "v1" as const;

// Liveness only: this does not report database or provider readiness.
export const HealthResponseSchema = z.strictObject({
  status: z.literal("ok"),
  apiVersion: z.literal(API_VERSION),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
