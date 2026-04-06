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

  const zone = `${top5[idx]!.region}-b`;
  console.log(`Using zone: ${zone}\n`);
  return zone;
}
