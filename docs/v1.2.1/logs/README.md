# `kdm logs` — Show Logs

**Version:** v1.2.1

## Overview

The `kdm logs` command retrieves and displays logs from a specified Docker container or Kubernetes pod. This is useful for debugging application issues and reviewing runtime events.

## Syntax

```bash
kdm logs <name>
```

## Parameters

| Parameter | Description |
|-----------|-------------|
| `name` | The name of the container or pod to fetch logs from |

## Usage

### `kdm logs <name>`

Fetches and displays logs for the specified workload.

**Example:**

```bash
kdm logs nginx-abc12
```

**Expected Output:**

```
Fetching logs for nginx-abc12...
Logs for nginx-abc12 fetched
[timestamp] GET / 200 12ms
[timestamp] GET /favicon.ico 404 2ms
```

**Use Cases:**

- Debug application errors by reviewing container/pod logs.
- Monitor application events in real time.
- Investigate crash or restart causes.

## Common Errors

- **Name not found** — Verify the container or pod name using `kdm show containers` or `kdm show pods`.
- **Docker daemon not running** — Start Docker before fetching container logs.
- **Kubernetes context not found** — Ensure `kubectl` is configured with a valid cluster context.
