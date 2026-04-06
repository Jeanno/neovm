import { gcloud } from "../gcloud.ts";
import { resolveZone } from "../resolve.ts";

export async function run(args: string[]) {
  const name = args[0];
  if (!name) {
    console.error("Usage: neovm status <name>");
    process.exit(1);
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
