import "server-only";
import { API_VERSION, HealthResponseSchema } from "@finpill/contracts";

export function getHealthResponse() {
  return HealthResponseSchema.parse({ status: "ok", apiVersion: API_VERSION });
}
