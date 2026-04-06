import { gcloud } from "./gcloud.ts";
import { loadConfig } from "./config.ts";

export async function resolveZone(name: string): Promise<{ project: string; zone: string }> {
  const config = await loadConfig();
  const result = await gcloud([
    "compute", "instances", "list",
    "--filter", `name=${name}`,
    "--project", config.project,
    "--format", "value(zone)",
  ]);

  const zone = result.stdout.trim();
  if (!zone) {
    console.error(`Instance "${name}" not found in project "${config.project}".`);
    process.exit(1);
  }

  const zoneName = zone.split("/").pop() || zone;
  return { project: config.project, zone: zoneName };
}
