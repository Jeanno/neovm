import { gcloud } from "../gcloud.ts";
import { resolveZone } from "../resolve.ts";
import { withSpinner } from "../spinner.ts";

export async function run(args: string[]) {
  const name = args[0];
  if (!name) {
    console.error("Usage: neovm start <name>");
    process.exit(1);
  }

  const { project, zone } = await resolveZone(name);
  await withSpinner(
    `Starting "${name}"`,
    `"${name}" started`,
    `Failed to start "${name}"`,
    () => gcloud(["compute", "instances", "start", name, "--project", project, "--zone", zone]),
  );
}
