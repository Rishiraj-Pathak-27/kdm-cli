# `kdm show` — Show Running Workloads

**Version:** v1.2.1

## Overview

The `kdm show` command displays information about running workloads — Docker containers, Kubernetes pods, combined runners, or Minikube status. It provides a unified view of your local development environment.

## Syntax

```bash
kdm show <target>
```

## Parameters

| Parameter | Description | Valid Values |
|-----------|-------------|--------------|
| `target` | The workload type to display | `runners`, `pods`, `containers`, `minikube` |

## Sub-commands

### `kdm show runners`

Shows a combined view of all running Docker containers and Kubernetes pods in a single table.

**Example:**

```bash
kdm show runners
```

**Expected Output:**

```
┌───────────┬──────────────┬──────────────────────┬─────────┬─────────────────┐
│ TYPE      │ NAME / ID    │ NAMESPACE / IMAGE    │ STATUS  │ NODE / STATE    │
├───────────┼──────────────┼──────────────────────┼─────────┼─────────────────┤
│ Pod       │ nginx-abc12  │ default              │ Running │ minikube        │
│ Container │ my-app       │ myregistry/app:v1    │ running │ host            │
└───────────┴──────────────┴──────────────────────┴─────────┴─────────────────┘
```

**Use Cases:**

- Get a quick overview of all services running locally.
- Monitor both Docker and Kubernetes workloads simultaneously.

**Common Errors:**

- `Docker is unreachable` — Docker daemon is not running. Start Docker Desktop or `systemctl start docker`.
- `Kubernetes is unreachable` — No kubeconfig found or cluster is down. Check `kubectl cluster-info`.

---

### `kdm show pods`

Shows all Kubernetes pods in the current namespace.

**Example:**

```bash
kdm show pods
```

**Expected Output:**

```
┌──────────────┬───────────┬─────────┬──────────┬──────────┐
│ POD NAME     │ NAMESPACE │ STATUS  │ RESTARTS │ NODE     │
├──────────────┼───────────┼─────────┼──────────┼──────────┤
│ nginx-abc12  │ default   │ Running │ 0        │ minikube │
│ redis-xyz34  │ default   │ Running │ 2        │ minikube │
└──────────────┴───────────┴─────────┴──────────┴──────────┘
```

**Use Cases:**

- Inspect pod status and restart counts.
- Identify pods in non-Running states.

---

### `kdm show containers`

Shows all running Docker containers.

**Example:**

```bash
kdm show containers
```

**Expected Output:**

```
┌────────────┬────────────┬────────────────┬────────┬─────────┐
│ CONTAINER  │ NAME       │ IMAGE          │ STATUS │ STATE   │
│ ID         │            │                │        │         │
├────────────┼────────────┼────────────────┼────────┼─────────┤
│ a1b2c3d4e5 │ my-app     │ myregistry/app │ Up     │ running │
└────────────┴────────────┴────────────────┴────────┴─────────┘
```

**Use Cases:**

- List all active containers.
- Verify container states at a glance.

---

### `kdm show minikube`

Shows the status of Minikube profiles on the local machine.

**Example:**

```bash
kdm show minikube
```

**Expected Output:**

```
┌─────────┬─────────┬─────────┬─────────────┬─────────┐
│ NAME    │ HOST    │ KUBELET │ APISERVER   │ MESSAGE │
├─────────┼─────────┼─────────┼─────────────┼─────────┤
│ default │ Running │ Running │ Running     │         │
└─────────┴─────────┴─────────┴─────────────┴─────────┘
```

**Common Errors:**

- `Minikube is not installed on this system` — Install Minikube from https://minikube.sigs.k8s.io.
