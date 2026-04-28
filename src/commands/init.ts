import { checkGcloud, gcloud, gcloudJson } from "../gcloud.ts";
import { saveConfig, configExists, loadConfig } from "../config.ts";
import { ask, select, closePrompt } from "../prompt.ts";
import { withSpinner, spinner } from "../spinner.ts";

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

    if (await configExists()) {
      const existing = await loadConfig();
      console.log("Existing config at ~/.neovm.json:");
      console.log(`  project:      ${existing.project}`);
      console.log(`  zone:         ${existing.zone}`);
      console.log(`  machine type: ${existing.machineType}\n`);
      const idx = await select("Config already exists. What would you like to do?", [
        "Keep existing (exit)",
        "Re-run init (will overwrite)",
      ]);
      if (idx === 0) return;
      console.log();
    }

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

    await withSpinner(
      "Enabling Compute Engine API",
      "Compute Engine API enabled",
      "Failed to enable Compute Engine API",
      () => gcloud(["services", "enable", "compute.googleapis.com", "--project", project]),
    );
    console.log();

    // 6. Region selection
    const zone = await selectRegion();

    // 7. Machine type
    const machineType = await ask("Default machine type", "e2-medium");

    // 8. Write config
    await saveConfig({ project, zone, machineType, billingAccount });
    console.log("\nSetup complete. Config saved to ~/.neovm.json\n");
    console.log("Next steps:");
    console.log("  neovm create <name>   Create your first VM");
    console.log("  neovm list            List your VMs");
    console.log("  neovm doctor          Check setup health");
    console.log("  neovm --help          See all commands");
  } finally {
    closePrompt();
  }
}

async function setupProject(): Promise<string> {
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
      const chosen = projects[idx]!;
      console.log(`Using project: ${chosen.projectId}\n`);
      return chosen.projectId;
    }
  }

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
    account = openAccounts[0]!;
    console.log(`Using billing account: ${account.displayName}`);
  } else {
    const items = openAccounts.map((a) => a.displayName);
    const idx = await select("Select a billing account:", items);
    account = openAccounts[idx]!;
  }

  const accountId = account.name.replace("billingAccounts/", "");
  console.log("Linking billing account...");
  await gcloud(["billing", "projects", "link", project, "--billing-account", accountId]);
  console.log("Billing linked.\n");
  return accountId;
}

async function selectRegion(): Promise<string> {
  const spin = spinner("Testing latency to GCP regions");
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
  spin.stop("Latency test complete");

  results.sort((a, b) => a.latency - b.latency);
  const top5 = results.slice(0, 5);
  const fmt = (r: typeof results[number]) => `${r.region} (${r.ok ? `${r.latency}ms` : "timeout"})`;

  console.log("\nTop regions by latency:");
  const idx = await select("Select a region:", [...top5.map(fmt), "Show all regions sorted by latency"]);

  let chosen: typeof results[number];
  if (idx === top5.length) {
    const allIdx = await select("All regions (sorted by latency):", results.map(fmt));
    chosen = results[allIdx]!;
  } else {
    chosen = top5[idx]!;
  }

  const zone = `${chosen.region}-b`;
  console.log(`Using zone: ${zone}\n`);
  return zone;
}
