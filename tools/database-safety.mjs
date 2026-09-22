// Only local daemon sockets are eligible; no TCP/SSH Docker hosts.
export function localDockerEndpoint(endpoint) {
  if (typeof endpoint !== "string" || !endpoint.startsWith("unix:///")) {
    throw new Error(
      "Database checks require a local Docker Unix socket; remote endpoints are forbidden",
    );
  }
  return endpoint;
}

export function databaseTestEnvironment(source, endpoint) {
  const env = {
    DOCKER_HOST: localDockerEndpoint(endpoint),
    CI: "true",
    NO_COLOR: "1",
  };
  // Explicit allowlist: no database URLs, provider keys, hosted project IDs or Docker context override.
  for (const name of [
    "PATH",
    "HOME",
    "TMPDIR",
    "TMP",
    "TEMP",
    "DOCKER_CONFIG",
  ]) {
    if (source[name] !== undefined) env[name] = source[name];
  }
  return env;
}
