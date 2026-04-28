# neovm

A minimalistic CLI tool for managing remote VMs. Create, SSH, start, stop, upload files — without memorizing `gcloud` flags. (GCP today, more backends later.)

## Quick start

```bash
bun install -g @jeanno/neovm
neovm init                # one-time setup (~30s)
neovm create my-vm        # create your first VM
neovm ssh my-vm           # SSH in
```

## Prerequisites

You'll need three things before running `neovm init`. macOS commands shown — see [docs/prerequisites.md](docs/prerequisites.md) for Linux & Windows.

1. **[Bun](https://bun.com)** — the runtime.
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```
2. **[`gcloud` CLI](https://cloud.google.com/sdk/docs/install)** — install, then authenticate.
   ```bash
   brew install --cask google-cloud-sdk
   gcloud auth login
   ```
3. **A [Google Cloud](https://console.cloud.google.com/) account with an active [billing account](https://console.cloud.google.com/billing)** — no project needed; `neovm init` creates one for you.

## Install

```bash
bun install -g @jeanno/neovm
```

Then run the one-time setup:

```bash
neovm init
```

This creates (or reuses) a GCP project for you, links your billing account, enables the Compute Engine API, and picks a region by latency.

## Usage

```bash
neovm create <name>            # create a VM
neovm list                     # list all VMs
neovm status [name]            # status of one VM, or all if omitted
neovm ssh <name>               # SSH in (auto-starts if stopped)
neovm start <name>             # start a VM
neovm shutdown <name>          # stop a VM
neovm ip <name>                # print external IP
neovm upload <name> <src> [dst]  # scp files to the VM (default dst: ~)
neovm delete <name>            # delete a VM
neovm doctor                   # check setup health
```

`create` accepts `--machine-type`, `--zone`, and `--image` flags to override defaults from `~/.neovm.json`.

## Develop

```bash
bun install
bun run src/cli.ts <command>
```

## License

MIT
