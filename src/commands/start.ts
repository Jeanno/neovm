import { gcloud } from "../gcloud.ts";
import { resolveZone } from "../resolve.ts";

export async function run(args: string[]) {
  const name = args[0];
  if (!name) {
    console.error("Usage: neovm start <name>");
    process.exit(1);
  }

  const { project, zone } = await resolveZone(name);
  console.log(`Starting "${name}"...`);
  await gcloud(["compute", "instances", "start", name, "--project", project, "--zone", zone]);
  console.log(`"${name}" started.`);
}
