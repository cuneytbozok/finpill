import process from "node:process";
import console from "node:console";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { createServer } from "node:net";
import {
  databaseTestEnvironment,
  localDockerEndpoint,
} from "./database-safety.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
if (process.argv.length !== 2)
  throw new Error("db:test accepts no arguments or target overrides");
const docker = spawnSync("docker", ["context", "inspect"], {
  encoding: "utf8",
});
if (docker.error || docker.status !== 0)
  throw new Error(
    "Docker is required: install and start a local Docker engine before db:test",
  );
const endpoint = localDockerEndpoint(
  process.env.DOCKER_HOST ??
    JSON.parse(docker.stdout)[0]?.Endpoints?.docker?.Host,
);
const env = databaseTestEnvironment(process.env, endpoint);
const info = spawnSync("docker", ["info", "--format", "{{.OSType}}"], {
  env,
  encoding: "utf8",
});
if (info.status !== 0 || info.stdout.trim() !== "linux")
  throw new Error("A running local Linux Docker engine is required");

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
const workdir = await mkdtemp(path.join(tmpdir(), "finpill-db-test-"));
const project = `finpill-test-${randomUUID()}`;
const cli = path.join(root, "node_modules", ".bin", "supabase");
function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: workdir,
    env,
    stdio: "inherit",
    timeout: 600_000,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `Disposable database command failed: ${path.basename(command)} ${args[0]}`,
    );
}
function supabase(...args) {
  run(cli, [...args, "--workdir", workdir, "--yes"]);
}
let cleanupRequired = false;
try {
  await cp(
    path.join(root, "supabase", "migrations"),
    path.join(workdir, "supabase", "migrations"),
    { recursive: true },
  );
  await cp(
    path.join(root, "supabase", "tests"),
    path.join(workdir, "supabase", "tests"),
    { recursive: true },
  );
  const port = await freePort();
  let shadowPort = await freePort();
  while (shadowPort === port) shadowPort = await freePort();
  const config = (
    await readFile(path.join(root, "supabase", "config.toml"), "utf8")
  )
    .replace('project_id = "finpill-local"', `project_id = "${project}"`)
    .replace("port = 54322", `port = ${port}`)
    .replace("shadow_port = 54320", `shadow_port = ${shadowPort}`);
  if (!config.includes(`project_id = "${project}"`))
    throw new Error("Cannot establish disposable project identity");
  await writeFile(path.join(workdir, "supabase", "config.toml"), config);
  cleanupRequired = true;
  supabase("db", "start");
  supabase("db", "reset", "--local", "--no-seed");
  supabase("test", "db", "--local");
  // This container's random name belongs only to this run, never the user's local/pilot database.
  run("docker", [
    "exec",
    `supabase_db_${project}`,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "create table public.finpill_disposable_probe (id integer);",
  ]);
  supabase("db", "reset", "--local", "--no-seed");
  supabase("test", "db", "--local");
  console.log(
    "Disposable Supabase connectivity and two clean migration replays passed.",
  );
} finally {
  // Never use stop --all; delete only this run's generated containers/volumes.
  if (cleanupRequired) supabase("stop", "--project-id", project, "--no-backup");
  await rm(workdir, { recursive: true, force: true });
}
