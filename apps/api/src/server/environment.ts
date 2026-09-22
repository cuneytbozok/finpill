import "server-only";
import { readServerEnvironment } from "./environment-schema";

export function getServerEnvironment() {
  return readServerEnvironment(process.env);
}
