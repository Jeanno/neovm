#!/usr/bin/env bun

import { GcloudError } from "./gcloud.ts";

const COMMANDS: Record<string, () => Promise<{ run: (args: string[]) => Promise<void> }>> = {
  init:     () => import("./commands/init.ts"),
  create:   () => import("./commands/create.ts"),
  list:     () => import("./commands/list.ts"),
  ssh:      () => import("./commands/ssh.ts"),
  start:    () => import("./commands/start.ts"),
  shutdown: () => import("./commands/shutdown.ts"),
  status:   () => import("./commands/status.ts"),
  ip:       () => import("./commands/ip.ts"),
  delete:   () => import("./commands/delete.ts"),
  upload:   () => import("./commands/upload.ts"),
  doctor:   () => import("./commands/doctor.ts"),
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printUsage();
    process.exit(0);
  }

  if (command === "--version" || command === "-v") {
    const pkg = await Bun.file(new URL("../package.json", import.meta.url)).json();
    console.log(pkg.version);
    process.exit(0);
  }

  const loader = COMMANDS[command];
  if (!loader) {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }

  try {
    const mod = await loader();
    await mod.run(args.slice(1));
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(`Error: ${err.message}`);
    }
    if (err instanceof GcloudError) {
      const hint = err.hint();
      if (hint) console.error(`Hint: ${hint}`);
    }
    process.exit(1);
  }
}

function printUsage() {
  console.log(`neovm — minimalistic remote VM manager (GCP today, more later)

Usage: neovm <command> [args]
       neovm --version

Commands:
  init                Interactive setup (project, billing, region)
  create <name>       Create a VM (flags: --machine-type, --zone, --image, --can-ip-forward)
  list                List all VMs
  ssh <name>          SSH into a VM (auto-starts if stopped; --iap to tunnel via Cloud IAP)
  start <name>        Start a VM
  shutdown <name>     Stop a VM
  status <name>       Show VM status
  ip <name>           Print external IP
  upload <name> <src> Upload files to a VM (optional: [dest], default ~)
  delete <name>       Delete a VM
  doctor              Check setup health (gcloud, auth, config, billing, API)`);
}

main();
