import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawn } from "node:child_process";

const manifestUrl = "https://raw.githubusercontent.com/ronnirodriguez530-jpg/velmora-campaign-engine/main/update-manifest.json";
const archiveUrl = "https://codeload.github.com/ronnirodriguez530-jpg/velmora-campaign-engine/tar.gz/refs/heads/main";

export type UpdateManifest = { version: string; channel: string; notes: string };

export async function readLocalManifest(projectRoot: string): Promise<UpdateManifest> {
  return JSON.parse(await readFile(join(projectRoot, "update-manifest.json"), "utf8")) as UpdateManifest;
}

export async function checkForUpdate(projectRoot: string): Promise<{ current: UpdateManifest; latest: UpdateManifest; available: boolean }> {
  const current = await readLocalManifest(projectRoot);
  const response = await fetch(manifestUrl, { headers: { "user-agent": "Velmora-Campaign-Engine" }, cache: "no-store" });
  if (!response.ok) throw new Error(`Update check failed (${response.status})`);
  const latest = await response.json() as UpdateManifest;
  return { current, latest, available: latest.version !== current.version };
}

export async function installLatestUpdate(projectRoot: string): Promise<UpdateManifest> {
  const check = await checkForUpdate(projectRoot);
  if (!check.available) return check.current;
  const workspace = await mkdtemp(join(tmpdir(), "velmora-update-"));
  const archivePath = join(workspace, "update.tar.gz");
  try {
    const response = await fetch(archiveUrl, { headers: { "user-agent": "Velmora-Campaign-Engine" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Update download failed (${response.status})`);
    await writeBytes(archivePath, new Uint8Array(await response.arrayBuffer()));
    await run("tar", ["-xzf", archivePath, "-C", workspace]);
    const source = join(workspace, "velmora-campaign-engine-main");
    await cp(source, projectRoot, {
      recursive: true,
      force: true,
      filter: (sourcePath) => !["data", ".env", ".git"].includes(basename(sourcePath))
    });
    return check.latest;
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function writeBytes(path: string, bytes: Uint8Array): Promise<void> {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(path, bytes);
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore", windowsHide: true });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)));
  });
}
