# neovm

A small CLI for managing GCP VMs. Create, SSH, start, stop, upload files — without memorizing `gcloud` flags.

## Prerequisites

- [Bun](https://bun.com) (runtime)
- [`gcloud` CLI](https://cloud.google.com/sdk/docs/install), authenticated (`gcloud auth login`)

## Install

```bash
bun install -g neovm
```

Then run the one-time setup:

```bash
neovm init
```

This walks you through picking a GCP project, linking billing, and choosing a region.

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
```

`create` accepts `--machine-type`, `--zone`, and `--image` flags to override defaults from `~/.neovm.json`.

## Develop

```bash
bun install
bun run src/cli.ts <command>
```

## License

MIT
