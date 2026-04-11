import { gcloudInteractive } from "../gcloud.ts";
import { resolveZone } from "../resolve.ts";
import { withSpinner } from "../spinner.ts";

export async function run(args: string[]) {
  const name = args[0];
  const localPath = args[1];
  if (!name || !localPath) {
    console.error("Usage: neovm upload <name> <local-path> [remote-path]");
    process.exit(1);
  }

  const remotePath = args[2] || "~";
  const { project, zone } = await resolveZone(name);

  await withSpinner(
    `Uploading to "${name}"`,
    `Uploaded to "${name}:${remotePath}"`,
    `Failed to upload to "${name}"`,
    async () => {
      const exitCode = await gcloudInteractive([
        "compute", "scp",
        "--recurse",
        localPath,
        `${name}:${remotePath}`,
        "--project", project,
        "--zone", zone,
      ]);
      if (exitCode !== 0) {
        throw new Error(`scp exited with code ${exitCode}`);
      }
    },
  );
}
