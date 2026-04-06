import { gcloud, gcloudInteractive } from "../gcloud.ts";
import { resolveZone } from "../resolve.ts";

export async function run(args: string[]) {
  const name = args[0];
  if (!name) {
    console.error("Usage: neovm ssh <name>");
    process.exit(1);
  }

  const { project, zone } = await resolveZone(name);

  const statusResult = await gcloud([
    "compute", "instances", "describe", name,
    "--project", project,
    "--zone", zone,
    "--format", "value(status)",
  ]);

  const status = statusResult.stdout.trim();

  if (status === "TERMINATED" || status === "STOPPED") {
    console.log(`"${name}" is ${status}. Starting...`);
    await gcloud(["compute", "instances", "start", name, "--project", project, "--zone", zone]);

    const timeout = 60_000;
    const interval = 2_000;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      await Bun.sleep(interval);
      const check = await gcloud([
        "compute", "instances", "describe", name,
        "--project", project,
        "--zone", zone,
        "--format", "value(status)",
      ]);
      if (check.stdout.trim() === "RUNNING") {
        console.log(`"${name}" is running.`);
        break;
      }
    }

    if (Date.now() - start >= timeout) {
      console.error("Timed out waiting for VM to start.");
      process.exit(1);
    }
  } else if (status !== "RUNNING") {
    console.error(`"${name}" is in state ${status}. Cannot SSH.`);
    process.exit(1);
  }

  const exitCode = await gcloudInteractive([
    "compute", "ssh", name,
    "--project", project,
    "--zone", zone,
  ]);
  process.exit(exitCode);
}
