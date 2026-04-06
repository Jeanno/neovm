import { gcloud } from "../gcloud.ts";
import { resolveZone } from "../resolve.ts";

export async function run(args: string[]) {
  const name = args[0];
  if (!name) {
    console.error("Usage: neovm ip <name>");
    process.exit(1);
  }

  const { project, zone } = await resolveZone(name);
  const result = await gcloud([
    "compute", "instances", "describe", name,
    "--project", project,
    "--zone", zone,
    "--format", "value(networkInterfaces[0].accessConfigs[0].natIP)",
  ]);

  const ip = result.stdout.trim();
  if (!ip) {
    console.log("No external IP assigned.");
  } else {
    console.log(ip);
  }
}
