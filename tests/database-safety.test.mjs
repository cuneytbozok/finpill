import { describe, expect, it } from "vitest";
import {
  databaseTestEnvironment,
  localDockerEndpoint,
} from "../tools/database-safety.mjs";

describe("disposable database target boundary", () => {
  it.each([
    undefined,
    "",
    "tcp://localhost:2375",
    "tcp://pilot.example.com:2376",
    "ssh://operator@pilot.example.com",
    "https://example.com",
  ])("rejects nonlocal daemon endpoints: %s", (endpoint) => {
    expect(() => localDockerEndpoint(endpoint)).toThrow("local Docker");
  });
  it("retains only process essentials and the checked local socket", () => {
    const env = databaseTestEnvironment(
      {
        PATH: "/bin",
        HOME: "/home/test",
        DATABASE_URL: "pilot",
        SUPABASE_ACCESS_TOKEN: "private",
        SUPABASE_DB_PASSWORD: "private",
        SUPABASE_PROJECT_ID: "pilot",
        PGHOST: "pilot",
        DOCKER_CONTEXT: "remote",
        APP_ENV: "production",
      },
      "unix:///var/run/docker.sock",
    );
    expect(env).toEqual({
      PATH: "/bin",
      HOME: "/home/test",
      DOCKER_HOST: "unix:///var/run/docker.sock",
      CI: "true",
      NO_COLOR: "1",
    });
  });
});
