import { gcloud } from "../gcloud.ts";
import { resolveZone } from "../resolve.ts";
import { loadConfig } from "../config.ts";
import { fetchInstances, renderInstancesTable } from "../instances.ts";

export async function run(args: string[]) {
  const name = args[0];

  if (!name) {
    const config = await loadConfig();
    const instances = await fetchInstances(config.project);
    renderInstancesTable(instances);
    return;
  }

  const { project, zone } = await resolveZone(name);
  const result = await gcloud([
    "compute", "instances", "describe", name,
    "--project", project,
    "--zone", zone,
    "--format", "value(status)",
  ]);
  console.log(result.stdout);
}
