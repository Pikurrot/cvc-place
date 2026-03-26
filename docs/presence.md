# CVC presence points (WhoIsIn)

Approved users with a non-empty **real name** can earn **1 point every 15 minutes** (configurable) while their name appears on the IcarWAC [WhoIsIn](http://158.109.8.17/icarwac/whoIsIn.php) page, using the same matching rules as the WhoIsIn CLI (every word in `real_name` must appear as a substring in some `<select id="whoIsInSelect">` option).

The **admin** account (`admin_username` in `config.yaml`) is excluded.

## Components

1. **cvc-place server** — stores users and points; exposes secret-protected APIs:
   - `GET /api/presence-targets?secret=...`
   - `POST /api/presence-report` with JSON `{"secret":"...","present":["username",...]}`
2. **`presence_worker.py`** — runs on a machine that can reach both the app HTTP server and WhoIsIn (usually your home server + SSH tunnel into CVC).

The browser-visible `GET /api/config` response **does not** include `presence_worker_secret`.

## What the secret is (and is not)

- **`CVC_PRESENCE_SECRET` / `presence_worker_secret`** — A shared secret so only your **presence worker** can call `GET /api/presence-targets` and `POST /api/presence-report`. It has **nothing to do with SSH** or your CVC tunnel password.
- **SSH tunnel** — Authenticate with **SSH keys** (recommended) or your normal SSH password in the terminal; that is separate from the presence API secret.

## Configuration

**Recommended:** create `.env` in the project root (already gitignored), same directory as `server.py`:

```bash
cp .env.example .env
# Edit .env and set CVC_PRESENCE_SECRET to a long random value (openssl rand -hex 32)
```

The server loads `.env` on startup (without extra Python packages). The worker can use the same file: it also loads `.env` from the repo root when you run `presence_worker.py`.

Alternatively, export variables in your shell or systemd `Environment=`.

Fallback: you may set `presence_worker_secret` in `config.yaml`, but that file may be tracked by git — **prefer `.env`** for secrets.

```yaml
cvc_presence_interval_seconds: 900
```

If no secret is set (env or yaml), the presence API returns 403.

## Worker setup

```bash
pip install -r requirements-presence.txt
playwright install chromium
```

Environment (or CLI flags):

| Variable | Meaning |
|----------|---------|
| `CVC_PRESENCE_SECRET` | Same value the server expects (prefer `.env`; optional yaml `presence_worker_secret`) |
| `CVC_PLACE_BASE` | e.g. `http://127.0.0.1:8123` |
| `WHOISIN_URL` | e.g. `http://127.0.0.1:8080/icarwac/whoIsIn.php` (via tunnel) |
| `CVC_PRESENCE_POLL_SECONDS` | Default `60` |

Run continuously:

```bash
export CVC_PRESENCE_SECRET='your-secret'
export CVC_PLACE_BASE='http://127.0.0.1:8123'
export WHOISIN_URL='http://127.0.0.1:8080/icarwac/whoIsIn.php'
python3 presence_worker.py
```

One-shot (e.g. cron every minute):

```bash
python3 presence_worker.py --once
```

## SSH tunnel

WhoIsIn is only reachable on the CVC network. From home, use a **local port forward**. Then set `WHOISIN_URL` to `http://127.0.0.1:8080/icarwac/whoIsIn.php` (or whatever local port you choose).

### Interactive (password typed in terminal)

```bash
ssh -N -L 8080:158.109.8.17:80 -p 22345 elopezc@tunnel.cvc.uab.es
```

Adjust user/host/port/forward to match your `~/.ssh/config` (e.g. `Host cvc_server_tunnel`).

### Non-interactive password (no SSH keys) — `sshpass`

OpenSSH does not let a script “answer” the password prompt safely. The usual approach is **`sshpass`**, which passes the password to `ssh` as a child process **`sshpass -e`** reads the **`SSHPASS`** environment variable (avoid `sshpass -p` on the command line — it shows up in `ps`).

1. Install: `sudo apt install sshpass` (or your distro’s package).
2. Put in **`.env`** (gitignored):

   ```bash
   SSHPASS=your-ssh-account-password
   ```

   This is your **SSH login password**, not `CVC_PRESENCE_SECRET`.

3. Start the tunnel from the repo:

   ```bash
   chmod +x scripts/cvc_tunnel.sh
   ./scripts/cvc_tunnel.sh
   ```

   Defaults match `tunnel.cvc.uab.es` / port `22345` and forward `8080 → 158.109.8.17:80`. Override with env vars (see `.env.example`).

**Risks:** password stored in plaintext in `.env`; anyone with disk or backup access can read it. Prefer SSH keys if the gateway ever supports them.

### Keys (recommended when possible)

With **SSH keys**, run plain `ssh -N -L ...` under systemd or `autossh` without `sshpass`.

Start the tunnel **before** the worker. Use `After=` in systemd so the presence worker starts after the tunnel unit.

## Systemd example (user service)

`~/.config/systemd/user/cvc-presence-worker.service`:

```ini
[Unit]
Description=cvc-place WhoIsIn presence worker
After=network-online.target

[Service]
Type=simple
Environment=CVC_PRESENCE_SECRET=your-secret-here
Environment=CVC_PLACE_BASE=http://127.0.0.1:8123
Environment=WHOISIN_URL=http://127.0.0.1:8080/icarwac/whoIsIn.php
WorkingDirectory=/path/to/cvc-place
ExecStart=/usr/bin/python3 /path/to/cvc-place/presence_worker.py
Restart=on-failure
RestartSec=30

[Install]
WantedBy=default.target
```

Then: `systemctl --user daemon-reload && systemctl --user enable --now cvc-presence-worker`

Safer than embedding the secret in the unit file: add `EnvironmentFile=/path/to/cvc-place/.env` under `[Service]` (point at your gitignored `.env`).
