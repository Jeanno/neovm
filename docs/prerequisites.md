# Prerequisites — detailed install

## Bun

- **macOS / Linux**: `curl -fsSL https://bun.sh/install | bash`
- **Windows (PowerShell)**: `powershell -c "irm bun.sh/install.ps1 | iex"`

## gcloud CLI

- **macOS (Homebrew)**: `brew install --cask google-cloud-sdk`
- **macOS / Linux (interactive script)**:
  ```bash
  curl https://sdk.cloud.google.com | bash
  exec -l $SHELL
  ```
- **Debian / Ubuntu (apt)**: see https://cloud.google.com/sdk/docs/install#deb
- **RHEL / Fedora (yum/dnf)**: see https://cloud.google.com/sdk/docs/install#rpm
- **Windows**: download the installer from https://cloud.google.com/sdk/docs/install#windows

After install, authenticate:

```bash
gcloud auth login
```

## Google Cloud account

- Sign up: https://console.cloud.google.com/
- Set up billing: https://console.cloud.google.com/billing
- You do **not** need to create a project — `neovm init` creates one and links your billing account automatically.
