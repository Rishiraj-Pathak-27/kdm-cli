# `kdm config` — Configuration Management

**Version:** v1.2.1

## Overview

The `kdm config` command group manages KDM CLI configuration, including notification service setup, custom settings, and credential management. Configuration is stored locally using the `conf` package.

## Syntax

```bash
kdm config <subcommand>
```

## Sub-commands

### `kdm config setup`

Interactively sets up the notification service (Discord webhook or Email SMTP).

**Example:**

```bash
kdm config setup
```

**Interactive Flow:**

1. Select a notification service:
   - **Discord** — Send alerts to a Discord channel via webhook.
   - **Email (SMTP)** — Send alerts via email SMTP.
   - **None** — Disable notifications.

2. For **Discord**, you will be prompted for a webhook URL.
3. For **Email**, you will be prompted for SMTP host, port, user, and recipient email.

**Discord Webhook Setup:**

1. Open your Discord server settings.
2. Go to **Integrations > Webhooks**.
3. Create a new webhook and choose the alert channel.
4. Copy the webhook URL (must start with `https://discord.com/api/webhooks/`).

**Email SMTP Setup:**

| Setting | Default | Description |
|---------|---------|-------------|
| Host | `smtp.gmail.com` | SMTP server address |
| Port | `587` | SMTP port (STARTTLS) |
| User | — | Your email address |
| To | — | Alert recipient email |

> **Note:** SMTP passwords must be set via the `KDM_SMTP_PASSWORD` environment variable.

---

### `kdm config set <key> <value>`

Sets a specific configuration value.

**Example:**

```bash
kdm config set alert_cooldown 300
kdm config set email_port 465
```

**Supported Keys:**

| Key | Type | Description |
|-----|------|-------------|
| `alert_cooldown` | number | Cooldown period between alerts (seconds) |
| `email_port` | number | SMTP port |
| `notification_service` | string | `discord`, `email`, or `none` |
| `discord_webhook` | string | Discord webhook URL |
| `email_host` | string | SMTP host |
| `email_user` | string | SMTP username |
| `email_to` | string | Alert recipient email |

---

### `kdm config list`

Lists all current configuration values.

**Example:**

```bash
kdm config list
```

**Expected Output:**

```
Current KDM Configuration:
──────────────────────────────────────────────────
 notification_service   : discord
 discord_webhook        : https://discord.com/api/webhooks/...
──────────────────────────────────────────────────

 Note: SMTP passwords must be set via KDM_SMTP_PASSWORD env var.
```

---

### `kdm config clear`

Clears all configuration and resets to defaults.

**Example:**

```bash
kdm config clear
```

**Expected Output:**

```
✓ Configuration cleared.
```

## Configuration File Location

Configuration is stored in the default `conf` package location:

- **macOS:** `~/Library/Application Support/kdm-cli`
- **Linux:** `~/.config/kdm-cli`
- **Windows:** `%APPDATA%\kdm-cli`

## Common Errors

- **Invalid webhook URL** — Must match `https://discord.com/api/webhooks/<id>/<token>`.
- **Invalid email address** — Must be a valid email format.
- **Invalid port number** — Must be between 1 and 65535.
