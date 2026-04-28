import { homedir } from "os";
import { join } from "path";

const CONFIG_PATH = join(homedir(), ".neovm.json");

export interface NeoVMConfig {
  project: string;
  zone: string;
  machineType: string;
  billingAccount: string;
}

export async function loadConfig(): Promise<NeoVMConfig> {
  const file = Bun.file(CONFIG_PATH);
  if (!(await file.exists())) {
    console.error(`No config found at ${CONFIG_PATH}.`);
    console.error("Run `neovm init` for one-time setup (project, billing, region). Takes ~30s.");
    process.exit(1);
  }
  return file.json();
}

export async function saveConfig(config: NeoVMConfig): Promise<void> {
  await Bun.write(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

export async function configExists(): Promise<boolean> {
  return Bun.file(CONFIG_PATH).exists();
}
