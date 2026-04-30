import { gcloud } from "../gcloud.ts";
import { loadConfig } from "../config.ts";
import { withSpinner } from "../spinner.ts";

export async function run(args: string[]) {
  const config = await loadConfig();

  const name = args[0];
  if (!name || name.startsWith("--")) {
    console.error("Usage: neovm create <name> [--machine-type TYPE] [--zone ZONE] [--image IMAGE] [--can-ip-forward]");
    process.exit(1);
  }

  const rest = args.slice(1);
  const canIpForward = rest.includes("--can-ip-forward");
  const flags = parseFlags(rest.filter((a) => a !== "--can-ip-forward"));
  const machineType = flags["machine-type"] || config.machineType;
  const zone = flags["zone"] || config.zone;
  const imageFamily = flags["image"] || "ubuntu-2404-lts-amd64";

  const gcloudArgs = [
    "compute", "instances", "create", name,
    "--project", config.project,
    "--zone", zone,
    "--machine-type", machineType,
    "--image-family", imageFamily,
    "--image-project", "ubuntu-os-cloud",
  ];
  if (canIpForward) gcloudArgs.push("--can-ip-forward");

  await withSpinner(
    `Creating VM "${name}" (${machineType} in ${zone})`,
    `VM "${name}" created`,
    `Failed to create VM "${name}"`,
    () => gcloud(gcloudArgs),
  );
}

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return flags;
}
