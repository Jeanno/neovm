import { gcloud } from "../gcloud.ts";
import { resolveZone } from "../resolve.ts";
import { confirm, closePrompt } from "../prompt.ts";
import { withSpinner } from "../spinner.ts";

export async function run(args: string[]) {
  const name = args[0];
  if (!name) {
    console.error("Usage: neovm delete <name>");
    process.exit(1);
  }

  const { project, zone } = await resolveZone(name);

  try {
    const yes = await confirm(`Delete VM "${name}"?`);
    if (!yes) {
      console.log("Cancelled.");
      return;
    }
  } finally {
    closePrompt();
  }

  await withSpinner(
    `Deleting "${name}"`,
    `"${name}" deleted`,
    `Failed to delete "${name}"`,
    () => gcloud([
      "compute", "instances", "delete", name,
      "--project", project,
      "--zone", zone,
      "--quiet",
    ]),
  );
}
