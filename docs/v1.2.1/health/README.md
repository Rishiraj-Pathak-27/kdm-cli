# `kdm health` — Health Status

**Version:** v1.2.1

## Overview

The `kdm health` command checks and reports the health status of Kubernetes pods or Docker containers. It provides insights into readiness, crash loops, and other health conditions.

## Syntax

```bash
kdm health <target>
```

## Parameters

| Parameter | Description | Valid Values |
|-----------|-------------|--------------|
| `target` | The workload type to check | `pods`, `containers`, `all` |

## Usage

### `kdm health pods`

Checks the health status of all Kubernetes pods.

**Example:**

```bash
kdm health pods
```

**Expected Output:**

```
Checking health for pods...
Showing health for pods...
```

**Health Indicators:**

- **Ready** — Pod is running and accepting traffic.
- **Unhealthy** — Pod is running but probes are failing.
- **CrashLoopBackOff** — Pod is repeatedly crashing and restarting.

**Use Cases:**

- Monitor pod health in real time.
- Identify failing services before they cause outages.

---

### `kdm health containers`

Checks the health status of all Docker containers.

**Example:**

```bash
kdm health containers
```

**Expected Output:**

```
Checking health for containers...
Showing health for containers...
```

**Use Cases:**

- Verify container health.
- Detect containers that are unhealthy or restarting.

---

### `kdm health all`

Checks health for both pods and containers in a single call.

**Example:**

```bash
kdm health all
```

## Common Errors

- **Invalid target** — Use `pods`, `containers`, or `all`.
- **Docker daemon not running** — Start Docker before running `kdm health containers`.
- **Kubernetes context not found** — Run `kubectl config get-contexts` to verify your cluster connection.
