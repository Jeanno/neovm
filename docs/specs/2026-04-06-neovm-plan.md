# neovm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Bun CLI tool (`neovm`) that manages Google Cloud VMs in a dedicated `neovm-*` GCP project.

**Architecture:** Single-binary CLI using only Bun built-ins. All GCP operations shell out to `gcloud` via `Bun.spawn`. Config stored at `~/.neovm.json`. Interactive prompts via raw `process.stdin`/`process.stdout`.

**Tech Stack:** Bun, TypeScript, gcloud CLI

**Spec:** `specs/2026-04-06-neovm-design.md`

---

### Task 1: Scaffold Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`

- [ ] **Step 1: Initialize Bun project**

```bash
cd /Users/jeanno/Projects/cloudvm
bun init -y
```

- [ ] **Step 2: Update package.json**

```json
{
  "name": "neovm",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "neovm": "./src/cli.ts"
  },
  "scripts": {
    "dev": "bun run src/cli.ts"
  }
}
```

- [ ] **Step 3: Verify it runs**

```bash
bun run src/cli.ts
```

Expected: error (file doesn't exist yet) — that's fine, confirms bun is wired up.

- [ ] **Step 4: Commit**

```bash
git init
git add package.json tsconfig.json
git commit -m "scaffold: init bun project with neovm bin entry"
```

---

### Task 2: gcloud Wrapper (`src/gcloud.ts`)

**Files:**
- Create: `src/gcloud.ts`

This is the foundation — every command depends on it.

- [ ] **Step 1: Create gcloud.ts**

```typescript
import { $ } from "bun";

export interface GcloudResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run a gcloud command and return parsed output.
 * Throws on non-zero exit code unless allowFailure is set.
 */
export async function gcloud(args: string[]): Promise<GcloudResult> {
  const proc = Bun.spawn(["gcloud", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new GcloudError(args, exitCode, stderr.trim());
  }

  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

/**
 * Run gcloud with --format=json and parse the result.
 */
export async function gcloudJson<T = unknown>(args: string[]): Promise<T> {
  const result = await gcloud([...args, "--format=json"]);
  return JSON.parse(result.stdout) as T;
}

/**
 * Run gcloud and inherit stdio (for interactive commands like ssh).
 */
export async function gcloudInteractive(args: string[]): Promise<number> {
  const proc = Bun.spawn(["gcloud", ...args], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
  return proc.exited;
}

/**
 * Check if gcloud is installed.
 */
export async function checkGcloud(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["gcloud", "version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    return true;
  } catch {
    return false;
  }
}

export class GcloudError extends Error {
  constructor(
    public args: string[],
    public exitCode: number,
    public stderr: string,
  ) {
    super(`gcloud ${args.join(" ")} failed (exit ${exitCode}): ${stderr}`);
    this.name = "GcloudError";
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
bun build src/gcloud.ts --no-bundle --outdir /tmp/neovm-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/gcloud.ts
git commit -m "feat: add gcloud CLI wrapper with JSON and interactive modes"
```

---

### Task 3: Config Module (`src/config.ts`)

**Files:**
- Create: `src/config.ts`

- [ ] **Step 1: Create config.ts**

```typescript
import { homedir } from "os";
import { join } from "path";

const CONFIG_PATH = join(homedir(), ".neovm.json");

export interface NeoVMConfig {
  project: string;
  zone: string;
  machineType: string;
  billingAccount: string;
}

export async function loadConfig(): Promise<NeoVMConfig> {
  const file = Bun.file(CONFIG_PATH);
  if (!(await file.exists())) {
    console.error('No config found. Run "neovm init" first.');
    process.exit(1);
  }
  return file.json();
}

export async function saveConfig(config: NeoVMConfig): Promise<void> {
  await Bun.write(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

export async function configExists(): Promise<boolean> {
  return Bun.file(CONFIG_PATH).exists();
}
```

- [ ] **Step 2: Verify it compiles**

```bash
bun build src/config.ts --no-bundle --outdir /tmp/neovm-check
```

- [ ] **Step 3: Commit**

```bash
git add src/config.ts
git commit -m "feat: add config read/write for ~/.neovm.json"
```

---

### Task 4: Interactive Prompt Helpers (`src/prompt.ts`)

**Files:**
- Create: `src/prompt.ts`

Used by `init` and `delete` for interactive input. No external deps.

- [ ] **Step 1: Create prompt.ts**

```typescript
import * as readline from "readline/promises";

let rl: readline.Interface | null = null;

function getRL(): readline.Interface {
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return rl;
}

export function closePrompt(): void {
  rl?.close();
  rl = null;
}

/**
 * Ask for text input with an optional default.
 */
export async function ask(question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = await getRL().question(`${question}${suffix}: `);
  return answer.trim() || defaultValue || "";
}

/**
 * Ask a yes/no question. Default is no unless specified.
 */
export async function confirm(question: string, defaultYes = false): Promise<boolean> {
  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  const answer = await getRL().question(`${question} ${hint}: `);
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === "") return defaultYes;
  return trimmed === "y" || trimmed === "yes";
}

/**
 * Show a numbered list and let the user pick one.
 * Returns the index of the selected item.
 */
export async function select(question: string, items: string[], defaultIndex = 0): Promise<number> {
  console.log(question);
  for (let i = 0; i < items.length; i++) {
    const marker = i === defaultIndex ? ">" : " ";
    console.log(`  ${marker} ${i + 1}. ${items[i]}`);
  }
  const answer = await getRL().question(`Choose [${defaultIndex + 1}]: `);
  const trimmed = answer.trim();
  if (trimmed === "") return defaultIndex;
  const num = parseInt(trimmed, 10);
  if (isNaN(num) || num < 1 || num > items.length) {
    console.log("Invalid choice, using default.");
    return defaultIndex;
  }
  return num - 1;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/prompt.ts
git commit -m "feat: add interactive prompt helpers (ask, confirm, select)"
```

---

### Task 5: CLI Entry Point (`src/cli.ts`)

**Files:**
- Create: `src/cli.ts`
- Create: `src/commands/` (directory)

- [ ] **Step 1: Create cli.ts**

```typescript
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
```

- [ ] **Step 2: Verify it runs**

```bash
bun run src/cli.ts --help
```

Expected: prints usage text.

- [ ] **Step 3: Commit**

```bash
mkdir -p src/commands
git add src/cli.ts
git commit -m "feat: add CLI entry point with command routing"
```

---

### Task 6: Zone Resolution Helper (`src/resolve.ts`)

**Files:**
- Create: `src/resolve.ts`

Used by all single-instance commands to find the zone for a named instance.

- [ ] **Step 1: Create resolve.ts**

```typescript
import { gcloud } from "./gcloud.ts";
import { loadConfig } from "./config.ts";

/**
 * Resolve the zone of an instance by querying GCP.
 * Exits with an error if the instance is not found.
 */
export async function resolveZone(name: string): Promise<{ project: string; zone: string }> {
  const config = await loadConfig();
  const result = await gcloud([
    "compute", "instances", "list",
    "--filter", `name=${name}`,
    "--project", config.project,
    "--format", "value(zone)",
  ]);

  const zone = result.stdout.trim();
  if (!zone) {
    console.error(`Instance "${name}" not found in project "${config.project}".`);
    process.exit(1);
  }

  // gcloud returns full zone URL like "projects/.../zones/us-west1-b", extract the zone name
  const zoneName = zone.split("/").pop() || zone;
  return { project: config.project, zone: zoneName };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/resolve.ts
git commit -m "feat: add zone resolution by querying GCP instance list"
```

---

### Task 7: `neovm init` Command

**Files:**
- Create: `src/commands/init.ts`

The most complex command. Handles project setup, billing, API enabling, latency testing, and config writing.

- [ ] **Step 1: Create init.ts**

```typescript
import { checkGcloud, gcloud, gcloudJson } from "../gcloud.ts";
import { saveConfig, configExists } from "../config.ts";
import { ask, confirm, select, closePrompt } from "../prompt.ts";

const GCP_REGIONS = [
  "us-central1",
  "us-west1",
  "us-east1",
  "europe-west1",
  "europe-west4",
  "asia-east1",
  "asia-northeast1",
  "asia-southeast1",
  "australia-southeast1",
  "southamerica-east1",
];

export async function run(_args: string[]) {
  try {
    console.log("neovm init — Setting up your VM environment\n");

    // 1. Check gcloud
    if (!(await checkGcloud())) {
      console.error("gcloud CLI not found. Install it from: https://cloud.google.com/sdk/docs/install");
      process.exit(1);
    }

    // 2. Check auth
    const authResult = await gcloud(["auth", "list", "--format=value(account)", "--filter=status:ACTIVE"]);
    if (!authResult.stdout.trim()) {
      console.error("No active gcloud account. Run: gcloud auth login");
      process.exit(1);
    }
    console.log(`Authenticated as: ${authResult.stdout.trim()}\n`);

    // 3. Find or create project
    const project = await setupProject();

    // 4. Link billing
    const billingAccount = await setupBilling(project);

    // 5. Enable Compute API
    console.log("Enabling Compute Engine API...");
    await gcloud(["services", "enable", "compute.googleapis.com", "--project", project]);
    console.log("Compute Engine API enabled.\n");

    // 6. Region selection
    const zone = await selectRegion();

    // 7. Machine type
    const machineType = await ask("Default machine type", "e2-medium");

    // 8. Write config
    await saveConfig({ project, zone, machineType, billingAccount });
    console.log("\nConfig saved to ~/.neovm.json");
    console.log("Ready! Try: neovm create my-vm");
  } finally {
    closePrompt();
  }
}

async function setupProject(): Promise<string> {
  // Look for existing neovm projects
  interface ProjectInfo {
    projectId: string;
    name: string;
  }
  const projects = await gcloudJson<ProjectInfo[]>([
    "projects", "list",
    "--filter", "projectId:neovm-*",
  ]);

  if (projects.length > 0) {
    console.log("Found existing neovm projects:");
    const items = projects.map((p) => `${p.projectId} (${p.name})`);
    const idx = await select("Use an existing project?", [...items, "Create new project"]);

    if (idx < projects.length) {
      console.log(`Using project: ${projects[idx].projectId}\n`);
      return projects[idx].projectId;
    }
  }

  // Create new project
  const suffix = Math.random().toString(36).substring(2, 8);
  const projectId = `neovm-${suffix}`;
  console.log(`Creating project: ${projectId}`);
  await gcloud(["projects", "create", projectId, "--name", `neovm ${suffix}`]);
  console.log(`Project created: ${projectId}\n`);
  return projectId;
}

async function setupBilling(project: string): Promise<string> {
  interface BillingAccount {
    name: string;
    displayName: string;
    open: boolean;
  }
  const accounts = await gcloudJson<BillingAccount[]>(["billing", "accounts", "list"]);
  const openAccounts = accounts.filter((a) => a.open);

  if (openAccounts.length === 0) {
    console.error("No billing accounts found. Set one up at: https://console.cloud.google.com/billing");
    process.exit(1);
  }

  let account: BillingAccount;
  if (openAccounts.length === 1) {
    account = openAccounts[0];
    console.log(`Using billing account: ${account.displayName}`);
  } else {
    const items = openAccounts.map((a) => a.displayName);
    const idx = await select("Select a billing account:", items);
    account = openAccounts[idx];
  }

  // billing account name is like "billingAccounts/012345-6789AB-CDEF01"
  const accountId = account.name.replace("billingAccounts/", "");
  console.log("Linking billing account...");
  await gcloud(["billing", "projects", "link", project, "--billing-account", accountId]);
  console.log("Billing linked.\n");
  return accountId;
}

async function selectRegion(): Promise<string> {
  console.log("Testing latency to GCP regions...");

  const results = await Promise.all(
    GCP_REGIONS.map(async (region) => {
      const url = `https://${region}-run.googleapis.com`;
      const start = performance.now();
      try {
        await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
        const latency = Math.round(performance.now() - start);
        return { region, latency, ok: true };
      } catch {
        return { region, latency: 9999, ok: false };
      }
    }),
  );

  results.sort((a, b) => a.latency - b.latency);
  const top5 = results.slice(0, 5);

  console.log("\nTop regions by latency:");
  const items = top5.map((r) => `${r.region} (${r.ok ? `${r.latency}ms` : "timeout"})`);
  const idx = await select("Select a region:", items);

  const zone = `${top5[idx].region}-b`;
  console.log(`Using zone: ${zone}\n`);
  return zone;
}
```

- [ ] **Step 2: Verify init runs (will fail at gcloud calls if no auth, but should parse)**

```bash
bun run src/cli.ts init
```

Expected: starts the init flow, prints "neovm init — Setting up your VM environment".

- [ ] **Step 3: Commit**

```bash
git add src/commands/init.ts
git commit -m "feat: add neovm init with project setup, billing, latency test, config"
```

---

### Task 8: `neovm create` Command

**Files:**
- Create: `src/commands/create.ts`

- [ ] **Step 1: Create create.ts**

```typescript
import { gcloud } from "../gcloud.ts";
import { loadConfig } from "../config.ts";

export async function run(args: string[]) {
  const config = await loadConfig();

  // Parse name and flags
  const name = args[0];
  if (!name || name.startsWith("--")) {
    console.error("Usage: neovm create <name> [--machine-type TYPE] [--zone ZONE] [--image IMAGE]");
    process.exit(1);
  }

  const flags = parseFlags(args.slice(1));
  const machineType = flags["machine-type"] || config.machineType;
  const zone = flags["zone"] || config.zone;
  const imageFamily = flags["image"] || "ubuntu-2404-lts";

  console.log(`Creating VM "${name}" (${machineType} in ${zone})...`);

  await gcloud([
    "compute", "instances", "create", name,
    "--project", config.project,
    "--zone", zone,
    "--machine-type", machineType,
    "--image-family", imageFamily,
    "--image-project", "ubuntu-os-cloud",
  ]);

  console.log(`VM "${name}" created.`);
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
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/create.ts
git commit -m "feat: add neovm create with flag overrides for machine-type, zone, image"
```

---

### Task 9: `neovm list` Command

**Files:**
- Create: `src/commands/list.ts`

- [ ] **Step 1: Create list.ts**

```typescript
import { gcloudJson } from "../gcloud.ts";
import { loadConfig } from "../config.ts";

interface Instance {
  name: string;
  zone: string;
  status: string;
  networkInterfaces?: { accessConfigs?: { natIP?: string }[] }[];
}

export async function run(_args: string[]) {
  const config = await loadConfig();

  const instances = await gcloudJson<Instance[]>([
    "compute", "instances", "list",
    "--project", config.project,
  ]);

  if (instances.length === 0) {
    console.log("No VMs found.");
    return;
  }

  // Print table
  const header = ["NAME", "ZONE", "STATUS", "EXTERNAL_IP"];
  const rows = instances.map((i) => {
    const zone = i.zone.split("/").pop() || i.zone;
    const ip = i.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP || "-";
    return [i.name, zone, i.status, ip];
  });

  const widths = header.map((h, idx) =>
    Math.max(h.length, ...rows.map((r) => r[idx].length)),
  );

  const pad = (s: string, w: number) => s.padEnd(w);
  console.log(header.map((h, i) => pad(h, widths[i])).join("  "));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of rows) {
    console.log(row.map((c, i) => pad(c, widths[i])).join("  "));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/list.ts
git commit -m "feat: add neovm list with formatted table output"
```

---

### Task 10: Simple Instance Commands (start, shutdown, status, ip)

**Files:**
- Create: `src/commands/start.ts`
- Create: `src/commands/shutdown.ts`
- Create: `src/commands/status.ts`
- Create: `src/commands/ip.ts`

- [ ] **Step 1: Create start.ts**

```typescript
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
```

- [ ] **Step 2: Create shutdown.ts**

```typescript
import { gcloud } from "../gcloud.ts";
import { resolveZone } from "../resolve.ts";

export async function run(args: string[]) {
  const name = args[0];
  if (!name) {
    console.error("Usage: neovm shutdown <name>");
    process.exit(1);
  }

  const { project, zone } = await resolveZone(name);
  console.log(`Stopping "${name}"...`);
  await gcloud(["compute", "instances", "stop", name, "--project", project, "--zone", zone]);
  console.log(`"${name}" stopped.`);
}
```

- [ ] **Step 3: Create status.ts**

```typescript
import { gcloud } from "../gcloud.ts";
import { resolveZone } from "../resolve.ts";

export async function run(args: string[]) {
  const name = args[0];
  if (!name) {
    console.error("Usage: neovm status <name>");
    process.exit(1);
  }

  const { project, zone } = await resolveZone(name);
  const result = await gcloud([
    "compute", "instances", "describe", name,
    "--project", project,
    "--zone", zone,
    "--format", "value(status)",
  ]);
  console.log(result.stdout);
}
```

- [ ] **Step 4: Create ip.ts**

```typescript
import { gcloud } from "../gcloud.ts";
import { resolveZone } from "../resolve.ts";

export async function run(args: string[]) {
  const name = args[0];
  if (!name) {
    console.error("Usage: neovm ip <name>");
    process.exit(1);
  }

  const { project, zone } = await resolveZone(name);
  const result = await gcloud([
    "compute", "instances", "describe", name,
    "--project", project,
    "--zone", zone,
    "--format", "value(networkInterfaces[0].accessConfigs[0].natIP)",
  ]);

  const ip = result.stdout.trim();
  if (!ip) {
    console.log("No external IP assigned.");
  } else {
    console.log(ip);
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/commands/start.ts src/commands/shutdown.ts src/commands/status.ts src/commands/ip.ts
git commit -m "feat: add start, shutdown, status, ip commands with zone resolution"
```

---

### Task 11: `neovm ssh` Command (with Auto-Start)

**Files:**
- Create: `src/commands/ssh.ts`

- [ ] **Step 1: Create ssh.ts**

```typescript
import { gcloud, gcloudInteractive } from "../gcloud.ts";
import { resolveZone } from "../resolve.ts";

export async function run(args: string[]) {
  const name = args[0];
  if (!name) {
    console.error("Usage: neovm ssh <name>");
    process.exit(1);
  }

  const { project, zone } = await resolveZone(name);

  // Check status
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

    // Wait for RUNNING
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

  // SSH
  const exitCode = await gcloudInteractive([
    "compute", "ssh", name,
    "--project", project,
    "--zone", zone,
  ]);
  process.exit(exitCode);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/ssh.ts
git commit -m "feat: add neovm ssh with auto-start for stopped VMs"
```

---

### Task 12: `neovm delete` Command

**Files:**
- Create: `src/commands/delete.ts`

- [ ] **Step 1: Create delete.ts**

```typescript
import { gcloud } from "../gcloud.ts";
import { resolveZone } from "../resolve.ts";
import { confirm, closePrompt } from "../prompt.ts";

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

  console.log(`Deleting "${name}"...`);
  await gcloud([
    "compute", "instances", "delete", name,
    "--project", project,
    "--zone", zone,
    "--quiet",
  ]);
  console.log(`"${name}" deleted.`);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/delete.ts
git commit -m "feat: add neovm delete with confirmation prompt"
```

---

### Task 13: Make CLI Executable via `bun link`

- [ ] **Step 1: Link the CLI globally**

```bash
cd /Users/jeanno/Projects/cloudvm
bun link
```

- [ ] **Step 2: Verify `neovm` is available**

```bash
neovm --help
```

Expected: prints usage text.

- [ ] **Step 3: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: finalize project for bun link"
```

---

### Task 14: End-to-End Verification

Run through the full lifecycle with a real GCP VM.

- [ ] **Step 1:** `neovm init` — walk through setup
- [ ] **Step 2:** `neovm create test1` — create a VM
- [ ] **Step 3:** `neovm list` — verify table shows test1
- [ ] **Step 4:** `neovm status test1` — should show RUNNING
- [ ] **Step 5:** `neovm ip test1` — should print IP
- [ ] **Step 6:** `neovm ssh test1` — verify SSH works
- [ ] **Step 7:** `neovm shutdown test1` — stop the VM
- [ ] **Step 8:** `neovm ssh test1` — verify auto-start then SSH
- [ ] **Step 9:** `neovm delete test1` — delete the VM
- [ ] **Step 10:** `neovm list` — verify empty
