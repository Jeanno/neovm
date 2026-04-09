import { loadConfig } from "../config.ts";
import { fetchInstances, renderInstancesTable } from "../instances.ts";

export async function run(_args: string[]) {
  const config = await loadConfig();
  const instances = await fetchInstances(config.project);
  renderInstancesTable(instances);
}
