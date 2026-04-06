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
