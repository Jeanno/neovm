import { gcloud, gcloudInteractive } from "../gcloud.ts";
import { resolveZone } from "../resolve.ts";
import { spinner, withSpinner } from "../spinner.ts";

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
    await withSpinner(
      `Starting "${name}"`,
      `"${name}" is running`,
      `Failed to start "${name}"`,
      () => gcloud(["compute", "instances", "start", name, "--project", project, "--zone", zone]),
    );
  } else if (status !== "RUNNING") {
    console.error(`"${name}" is in state ${status}. Cannot SSH.`);
    process.exit(1);
  }

  const sshSpin = spinner("Waiting for SSH");
  const sshTimeout = 60_000;
  const sshInterval = 3_000;
  const sshStart = Date.now();
  let sshReady = false;
  while (Date.now() - sshStart < sshTimeout) {
    try {
      await gcloud([
        "compute", "ssh", name,
        "--project", project,
        "--zone", zone,
        "--command", "true",
        "--ssh-flag=-o ConnectTimeout=5",
        "--ssh-flag=-o StrictHostKeyChecking=no",
        "--quiet",
      ]);
      sshReady = true;
      break;
    } catch {
      await Bun.sleep(sshInterval);
    }
  }
  if (!sshReady) {
    sshSpin.stop("SSH did not become ready in time", false);
    process.exit(1);
  }
  sshSpin.stop("SSH ready");

  const exitCode = await gcloudInteractive([
    "compute", "ssh", name,
    "--project", project,
    "--zone", zone,
  ]);
  process.exit(exitCode);
}
