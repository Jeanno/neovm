#!/usr/bin/env bun

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
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    printUsage();
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
    process.exit(1);
  }
}

function printUsage() {
  console.log(`neovm — GCP VM Manager

Usage: neovm <command> [args]

Commands:
  init                Interactive setup (project, billing, region)
  create <name>       Create a VM (flags: --machine-type, --zone, --image)
  list                List all VMs
  ssh <name>          SSH into a VM (auto-starts if stopped)
  start <name>        Start a VM
  shutdown <name>     Stop a VM
  status <name>       Show VM status
  ip <name>           Print external IP
  delete <name>       Delete a VM`);
}

main();
