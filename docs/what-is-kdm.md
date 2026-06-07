# What Is KDM?

KDM, short for Kubernetes Docker Monitor, is a terminal-based monitoring CLI for developers and DevOps engineers who work with both Docker and Kubernetes.

It gives you one command-line tool for checking local Docker containers, Kubernetes pods, Minikube status, workload health, logs, live dashboards, and alert notifications.

> Note: The project is named **KDM** and the executable command is `kdm`. If you see “KDC” in notes or conversations, it usually refers to this KDM CLI.

## Why KDM Exists

Many local development and DevOps workflows involve more than one runtime:

- Docker containers running locally.
- Kubernetes pods running in a local or remote cluster.
- Minikube profiles for local Kubernetes testing.
- Services that need quick health checks and logs.

Tools such as `docker ps`, `kubectl get pods`, and `kubectl logs` are powerful, but they focus on separate layers. KDM combines the most common monitoring actions into one CLI so you can inspect Docker and Kubernetes workloads from a single terminal interface.

## What KDM Can Do

KDM currently supports:

- Auto-detecting Docker and Kubernetes availability.
- Showing Docker containers.
- Showing Kubernetes pods.
- Showing a unified runner view of containers and pods.
- Showing Minikube profile status.
- Checking workload health.
- Watching health in refresh mode.
- Opening a live terminal dashboard.
- Fetching logs from containers or pods.
- Sending alert notifications through Discord or email SMTP.
- Storing local configuration for notification and runtime behavior.

## Core Commands

### Welcome And Connection Check

Run:

```bash
kdm
```

KDM checks:

- Docker connection.
- Kubernetes connection.
- Minikube availability.
- Running container count.
- Running pod count.

It then prints a small dashboard and command summary.

### Show Workloads

```bash
kdm show runners
kdm show pods
kdm show containers
kdm show minikube
```

`kdm show runners` combines Docker containers and Kubernetes pods in one table.

### Health Checks

```bash
kdm health all
kdm health pods
kdm health containers
```

Watch mode:

```bash
kdm health all -w
kdm health pods -w -i 2
```

The `-w` flag keeps refreshing the health output. The `-i` flag controls the refresh interval in seconds.

### Live Dashboard

```bash
kdm watch
```

This opens an Ink-based terminal UI that refreshes workload data automatically.

### Logs

```bash
kdm logs <name>
```

KDM attempts to fetch logs for the given workload name. Docker is tried first, and Kubernetes can be used as a fallback depending on the workload.

### Configuration

```bash
kdm config setup
kdm config list
kdm config set <key> <value>
kdm config clear
```

Use `kdm config setup` to configure notifications interactively.

## How KDM Works

KDM is a Node.js and TypeScript CLI. It uses a command-based architecture where each top-level feature is registered as a Commander command.

At a high level:

```text
User runs kdm command
        |
        v
Commander parses command and flags
        |
        v
KDM calls Docker, Kubernetes, or Minikube modules
        |
        v
Data is normalized into tables, health output, logs, or dashboard state
        |
        v
Alerts may be triggered for failure states
```

## Main Internal Components

### CLI Layer

KDM uses Commander.js to define commands such as:

- `show`
- `health`
- `watch`
- `logs`
- `config`

The CLI entrypoint registers these commands and handles the default no-argument dashboard.

### Docker Layer

KDM uses `dockerode` to communicate with the Docker daemon.

It can:

- Check whether Docker is reachable.
- List containers.
- Read container status.
- Detect restart or failed-exit states.
- Trigger alerts for unhealthy Docker conditions.

Docker must be running for Docker-based features to work.

### Kubernetes Layer

KDM uses `@kubernetes/client-node` to communicate with Kubernetes.

It loads Kubernetes configuration from the default kubeconfig location, usually:

```text
~/.kube/config
```

It can:

- Check whether the Kubernetes API is reachable.
- List pods across namespaces.
- Read pod phase and restart counts.
- Detect common failure states such as `Failed`, `CrashLoopBackOff`, `ImagePullBackOff`, and `CreateContainerConfigError`.

### Minikube Layer

KDM can check whether Minikube is installed and whether profiles are running.

This is useful for local Kubernetes development where Docker and Minikube are both part of the workflow.

### UI Layer

KDM uses:

- `chalk` for terminal colors.
- `cli-table3` for tables.
- `Ink` and `React` for the live dashboard.

### Config Layer

KDM stores local configuration with the `conf` package.

Common config values include:

- Notification service.
- Discord webhook URL.
- SMTP host and user.
- Alert cooldown.

Config locations:

| OS | Location |
|---|---|
| macOS | `~/Library/Application Support/kdm-cli` |
| Linux | `~/.config/kdm-cli` |
| Windows | `%APPDATA%\kdm-cli` |

### Alert Layer

KDM can send alerts when it detects failure states.

Supported notification targets:

- Discord webhook.
- Email SMTP.

Examples of alert-worthy states:

- Docker container restarting.
- Docker container exited with non-zero code.
- Kubernetes pod phase is `Failed`.
- Kubernetes container is in `CrashLoopBackOff`.
- Kubernetes container is in `ImagePullBackOff`.

SMTP passwords should be provided through:

```bash
KDM_SMTP_PASSWORD
```

This avoids storing plaintext SMTP credentials in local config.

## Requirements

KDM requires:

- Node.js 18 or newer.
- npm or another compatible Node package manager.
- Docker Desktop or Docker Engine for Docker features.
- Kubernetes access for Kubernetes features.
- Optional: Minikube for local Kubernetes status checks.

Check Node:

```bash
node --version
npm --version
```

Check Docker:

```bash
docker version
docker ps
```

Check Kubernetes:

```bash
kubectl config current-context
kubectl get pods --all-namespaces
```

## Installing KDM

The easiest installation method on all operating systems is npm:

```bash
npm install -g kdm-cli
```

After installation:

```bash
kdm --help
```

You can also run KDM without global installation:

```bash
npx kdm-cli
```

## Install On macOS

### 1. Install Node.js

Recommended with Homebrew:

```bash
brew install node
```

Or install Node.js from:

```text
https://nodejs.org
```

### 2. Install Docker

Install Docker Desktop for macOS:

```text
https://www.docker.com/products/docker-desktop/
```

Start Docker Desktop, then verify:

```bash
docker ps
```

### 3. Install Kubernetes Tooling

For local Kubernetes with Minikube:

```bash
brew install kubectl minikube
minikube start
```

Verify:

```bash
kubectl get pods --all-namespaces
```

### 4. Install KDM

```bash
npm install -g kdm-cli
```

### 5. Run KDM

```bash
kdm
```

## Install On Linux

The exact package manager depends on the distribution.

### 1. Install Node.js

Ubuntu or Debian:

```bash
sudo apt update
sudo apt install -y nodejs npm
```

If your distro provides an old Node.js version, install a newer release from NodeSource or use `nvm`.

Using `nvm`:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20
```

### 2. Install Docker

Ubuntu or Debian:

```bash
sudo apt update
sudo apt install -y docker.io
sudo systemctl enable --now docker
```

Allow your user to run Docker without `sudo`:

```bash
sudo usermod -aG docker "$USER"
```

Then log out and log back in.

Verify:

```bash
docker ps
```

### 3. Install Kubernetes Tooling

Install `kubectl` using your distro package manager or the official Kubernetes instructions.

For Minikube:

```bash
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube
minikube start
```

Verify:

```bash
kubectl get pods --all-namespaces
```

### 4. Install KDM

```bash
npm install -g kdm-cli
```

If global npm installs require elevated permissions, prefer fixing npm's global prefix or use `nvm`.

### 5. Run KDM

```bash
kdm
```

## Install On Windows

### 1. Install Node.js

Download and install the LTS version from:

```text
https://nodejs.org
```

Verify in PowerShell:

```powershell
node --version
npm --version
```

### 2. Install Docker Desktop

Install Docker Desktop for Windows:

```text
https://www.docker.com/products/docker-desktop/
```

Enable WSL 2 integration if you use WSL-based development.

Verify:

```powershell
docker ps
```

### 3. Install Kubernetes Tooling

Docker Desktop can enable a local Kubernetes cluster from its settings.

Alternatively, install Minikube:

```powershell
winget install Kubernetes.minikube
winget install Kubernetes.kubectl
minikube start
```

Verify:

```powershell
kubectl get pods --all-namespaces
```

### 4. Install KDM

```powershell
npm install -g kdm-cli
```

### 5. Run KDM

```powershell
kdm
```

If PowerShell cannot find `kdm`, restart the terminal and confirm npm's global bin directory is in your `PATH`.

## Install From Source

Use this when contributing to KDM or testing local changes.

```bash
git clone https://github.com/KDM-cli/kdm-cli.git
cd kdm-cli
npm install
npm run build
npm test
```

Run the local CLI:

```bash
node bin/kdm.js --help
```

For development:

```bash
npm run dev
```

## First-Time Setup

After installing, run:

```bash
kdm
```

Then configure notifications if needed:

```bash
kdm config setup
```

For email alerts, set the SMTP password as an environment variable.

macOS or Linux:

```bash
export KDM_SMTP_PASSWORD="your-smtp-password"
```

Windows PowerShell:

```powershell
$env:KDM_SMTP_PASSWORD="your-smtp-password"
```

Then check config:

```bash
kdm config list
```

## Common Troubleshooting

### `kdm: command not found`

The npm global binary directory may not be in your `PATH`.

Check:

```bash
npm bin -g
```

Then add that directory to your shell profile or reinstall Node using a tool like `nvm`.

### Docker Shows Disconnected

Check that Docker is running:

```bash
docker ps
```

On Linux, make sure your user can access the Docker socket:

```bash
sudo usermod -aG docker "$USER"
```

Log out and log back in after changing Docker group membership.

### Kubernetes Shows Disconnected

Check your kubeconfig:

```bash
kubectl config current-context
kubectl get pods --all-namespaces
```

If using Minikube:

```bash
minikube status
minikube start
```

### Email Alerts Do Not Send

Check:

- SMTP host.
- SMTP port.
- SMTP user.
- Recipient email.
- `KDM_SMTP_PASSWORD` environment variable.
- Provider-specific app password requirements.

For Gmail, accounts with two-factor authentication usually require an app password.

### Discord Alerts Do Not Send

Check:

- Webhook URL starts with `https://discord.com/api/webhooks/`.
- The webhook still exists.
- The selected Discord channel allows webhook posts.

## Recommended Daily Workflow

Start with a quick status check:

```bash
kdm
```

Inspect all workloads:

```bash
kdm show runners
```

Check health:

```bash
kdm health all
```

Watch continuously during development:

```bash
kdm watch
```

Inspect logs when something fails:

```bash
kdm logs <container-or-pod-name>
```

## Future Direction

KDM is being prepared to grow from a monitoring CLI into a more AI-assisted Kubernetes and Docker troubleshooting tool.

Planned areas include:

- Kubernetes analyzer engine.
- Docker analyzer engine.
- AI-backed explanations.
- Configurable filters.
- Local and remote cache support.
- Server and MCP modes.

The current KDM foundation already provides the runtime connections, workload discovery, terminal UI, and alerting needed for those future capabilities.
