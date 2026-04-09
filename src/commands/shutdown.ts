import { gcloud } from "../gcloud.ts";
import { resolveZone } from "../resolve.ts";
import { withSpinner } from "../spinner.ts";

export async function run(args: string[]) {
  const name = args[0];
  if (!name) {
    console.error("Usage: neovm shutdown <name>");
    process.exit(1);
  }

  const { project, zone } = await resolveZone(name);
  await withSpinner(
    `Stopping "${name}"`,
    `"${name}" stopped`,
    `Failed to stop "${name}"`,
    () => gcloud(["compute", "instances", "stop", name, "--project", project, "--zone", zone]),
  );
}
