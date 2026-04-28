import { homedir } from "os";
import { join } from "path";
import { gcloud, gcloudJson, checkGcloud } from "../gcloud.ts";
import { configExists } from "../config.ts";
import type { NeoVMConfig } from "../config.ts";

const CONFIG_PATH = join(homedir(), ".neovm.json");

async function check(label: string, fn: () => Promise<string | null>): Promise<boolean> {
  try {
    const hint = await fn();
    if (hint === null) {
      console.log(`✓ ${label}`);
      return true;
    }
    console.log(`✗ ${label}\n    ${hint}`);
    return false;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`✗ ${label}\n    ${msg}`);
    return false;
  }
}

export async function run(_args: string[]) {
  let config: NeoVMConfig | null = null;

  await check("gcloud installed", async () =>
    (await checkGcloud()) ? null : "Install: https://cloud.google.com/sdk/docs/install");

  await check("gcloud authenticated", async () => {
    const r = await gcloud(["auth", "list", "--filter=status:ACTIVE", "--format=value(account)"]);
    return r.stdout.trim() ? null : "Run `gcloud auth login`.";
  });

  const cfgOk = await check("config exists at ~/.neovm.json", async () => {
    if (!(await configExists())) return "Run `neovm init`.";
    config = await Bun.file(CONFIG_PATH).json();
    return null;
  });

  if (!cfgOk || !config) return;

  await check(`project "${config.project}" accessible`, async () => {
    await gcloud(["projects", "describe", config!.project]);
    return null;
  });

  await check("Compute Engine API enabled", async () => {
    const r = await gcloud([
      "services", "list",
      "--filter=config.name:compute.googleapis.com",
      "--enabled",
      "--project", config!.project,
      "--format=value(config.name)",
    ]);
    return r.stdout.trim()
      ? null
      : `Run \`gcloud services enable compute.googleapis.com --project ${config!.project}\`.`;
  });

  await check("billing linked & active", async () => {
    interface B { billingEnabled?: boolean }
    const b = await gcloudJson<B>(["billing", "projects", "describe", config!.project]);
    return b.billingEnabled
      ? null
      : "Re-run `neovm init` or link billing in the Cloud Console.";
  });
}
