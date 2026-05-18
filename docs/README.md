# KDM CLI — Versioned Command Documentation

**Version:** v1.2.1

This directory contains versioned documentation for all KDM CLI commands. Each section documents a top-level command group with usage, parameters, examples, and troubleshooting.

## Command Index

- [show](./show/README.md) — Show running runners, pods, containers, or minikube
- [health](./health/README.md) — Show health status for pods or containers
- [watch](./watch/README.md) — Live monitoring mode
- [logs](./logs/README.md) — Show logs for a container or pod
- [config](./config/README.md) — Manage KDM configuration

## Quick Start

```bash
# Install globally
npm install -g kdm-cli

# Show all workloads
kdm show runners

# Check pod health
kdm health pods

# Live watch
kdm watch

# View logs
kdm logs <name>

# Configure notifications
kdm config setup
```

## Version History

| Version | Release Date | Notes |
|---------|-------------|-------|
| v1.2.1 | — | Current release. Docker & Kubernetes monitoring, config management. |
| v1.1.0 | — | Initial release with core commands. |
