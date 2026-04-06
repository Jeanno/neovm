# neovm — GCP VM Manager CLI

A Bun-based CLI tool that simplifies managing Google Cloud VMs. It manages its own GCP project (prefixed `neovm-`), auto-detects the best region via latency testing, and provides a minimal command set for daily VM workflows.

## Commands

| Command | Description |
|---------|-------------|
| `neovm init` | Interactive first-time setup (project, billing, region, defaults) |
| `neovm create <name>` | Create a VM with config defaults (overridable via flags) |
| `neovm list` | List all VMs in the neovm project |
| `neovm ssh <name>` | SSH into a VM (auto-starts if stopped) |
| `neovm start <name>` | Start a stopped VM |
| `neovm shutdown <name>` | Stop a running VM |
| `neovm status <name>` | Show VM status |
| `neovm ip <name>` | Print external IP |
| `neovm delete <name>` | Delete a VM |

## Config

Stored at `~/.neovm.json`:

```json
{
  "project": "neovm-a1b2c3",
  "zone": "us-west1-b",
  "machineType": "e2-medium",
  "billingAccount": "012345-6789AB-CDEF01"
}
```

## Architecture

### Project Structure

```
cloudvm/
├── package.json          # name: "neovm", bin: { neovm: "./src/cli.ts" }
├── tsconfig.json
└── src/
    ├── cli.ts            # Entry point, arg parsing
    ├── commands/
    │   ├── init.ts       # Interactive setup
    │   ├── create.ts
    │   ├── list.ts
    │   ├── ssh.ts
    │   ├── start.ts
    │   ├── shutdown.ts
    │   ├── delete.ts
    │   ├── status.ts
    │   └── ip.ts
    ├── config.ts         # Read/write ~/.neovm.json
    └── gcloud.ts         # Wrapper: Bun.spawn("gcloud", ...)
```

### Dependencies

None — Bun built-ins only (`Bun.spawn`, `Bun.argv`, `Bun.file`, `process.stdin/stdout`).

### GCP Interface

All GCP operations shell out to `gcloud` CLI via `Bun.spawn`. This keeps the codebase simple — no API key management, no token refresh, leverages existing gcloud auth.

## `neovm init` Flow

1. **Check gcloud installed** — fail with install instructions if missing
2. **Check gcloud auth** — `gcloud auth list`; prompt user to run `gcloud auth login` if no active account
3. **Find or create project:**
   - `gcloud projects list --filter="projectId:neovm-*"` to find existing neovm projects
   - If found: show list, ask user if they want to reuse one (default: yes)
   - If none or user declines: generate `neovm-<random-6-chars>`, create with `gcloud projects create`
4. **Link billing:**
   - `gcloud billing accounts list` to enumerate billing accounts
   - If one account: auto-select, confirm with user
   - If multiple: let user pick
   - Link with `gcloud billing projects link`
5. **Enable Compute Engine API:**
   - `gcloud services enable compute.googleapis.com --project=<project>`
6. **Region selection via latency test:**
   - Ping ~10 major GCP regions in parallel via `fetch()` to `https://<region>-run.googleapis.com`
   - Show top 5 ranked by latency, user picks (fastest is default)
   - Derive zone by appending `-b` to chosen region
7. **Machine type** — default `e2-medium`, user can override
8. **Write config** to `~/.neovm.json`

## `neovm create <name>` Behavior

- Requires init (check config exists, prompt if not)
- Creates VM with: project, zone, machine type from config
- Image: Ubuntu 24.04 LTS (`ubuntu-2404-lts` from `ubuntu-os-cloud`)
- Override flags: `--machine-type`, `--zone`, `--image`
- Runs: `gcloud compute instances create <name> --project=... --zone=... --machine-type=... --image-family=... --image-project=...`

## Zone Resolution

All single-instance commands (ssh, start, shutdown, status, ip, delete) resolve the instance's zone dynamically by querying GCP:

```
gcloud compute instances list --filter="name=<name>" --project=... --format="value(zone)"
```

This avoids local state tracking and is always correct even if VMs are created with `--zone` overrides or managed outside neovm. The config `zone` is only used as the default for `neovm create`.

If the query returns no results, exit with: `Instance "<name>" not found in project "<project>"`.

## `neovm ssh <name>` Behavior

- Resolve zone (see Zone Resolution)
- Check VM status first via `gcloud compute instances describe`
- If TERMINATED/STOPPED: auto-start, wait for RUNNING status (poll every 2s, timeout 60s)
- Then: `gcloud compute ssh <name> --project=... --zone=<resolved>`
- Uses gcloud's built-in SSH key management and IAP tunneling

## `neovm list` Behavior

- `gcloud compute instances list --project=...`
- Format output as a clean table: NAME, ZONE, STATUS, EXTERNAL_IP

## `neovm shutdown <name>` Behavior

- `gcloud compute instances stop <name> --project=... --zone=...`

## `neovm start <name>` Behavior

- `gcloud compute instances start <name> --project=... --zone=...`

## `neovm status <name>` Behavior

- `gcloud compute instances describe <name> --project=... --zone=... --format="value(status)"`

## `neovm ip <name>` Behavior

- `gcloud compute instances describe <name> --project=... --zone=... --format="value(networkInterfaces[0].accessConfigs[0].natIP)"`

## `neovm delete <name>` Behavior

- Confirmation prompt: "Delete VM <name>? (y/N)"
- `gcloud compute instances delete <name> --project=... --zone=... --quiet`

## Interactive Prompts

Simple readline-based prompts using `process.stdin`/`process.stdout`. No external prompt libraries.

Prompt types needed:
- **Confirm** (y/N): for delete confirmation, reuse project
- **Select from list**: for billing account, region selection
- **Text input with default**: for machine type override

## Error Handling

- If config missing on any command (except init): print "Run `neovm init` first" and exit
- If gcloud not found: print install instructions and exit
- If gcloud command fails: forward stderr to user, exit with non-zero code
- If VM not found: clear error message with the instance name

## Verification

1. `bun run src/cli.ts init` — walk through setup, verify config written
2. `bun run src/cli.ts create test1` — verify VM appears in GCP console
3. `bun run src/cli.ts list` — verify table output
4. `bun run src/cli.ts ssh test1` — verify SSH connection
5. `bun run src/cli.ts shutdown test1` — verify VM stops
6. `bun run src/cli.ts ssh test1` — verify auto-start then SSH
7. `bun run src/cli.ts delete test1` — verify deletion
