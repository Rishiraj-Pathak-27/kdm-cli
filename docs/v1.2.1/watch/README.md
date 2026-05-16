# `kdm watch` — Live Monitoring

**Version:** v1.2.1

## Overview

The `kdm watch` command enters a live monitoring mode, continuously updating the terminal with real-time resource usage and status of running Docker containers and Kubernetes pods. Powered by Ink for an interactive terminal UI.

## Syntax

```bash
kdm watch
```

## Parameters

This command takes no arguments.

## Usage

### `kdm watch`

Starts a real-time monitoring dashboard.

**Example:**

```bash
kdm watch
```

**Expected Output:**

The terminal will display an interactive, auto-refreshing table showing:

- Container/pod names
- Current resource usage (CPU, memory)
- Health status
- Restart counts

The view updates automatically. Press `Ctrl+C` to exit.

**Use Cases:**

- Continuously monitor service health during development.
- Watch for resource spikes or pod restarts in real time.
- Debug intermittent failures by observing live status changes.

## Common Errors

- **No workloads found** — Ensure at least one Docker container or Kubernetes pod is running.
- **Docker daemon not running** — Start Docker Desktop or `systemctl start docker`.
- **Kubernetes context not configured** — Verify with `kubectl cluster-info`.
