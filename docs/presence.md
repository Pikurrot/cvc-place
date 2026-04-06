# CVC presence points (WhoIsIn)

Approved users with a non-empty **real name** can earn **1 point every 15 minutes** (configurable) while their name appears on the IcarWAC [WhoIsIn](http://158.109.8.17/icarwac/whoIsIn.php) page, using the same matching rules as the WhoIsIn CLI (every word in `real_name` must appear as a substring in some `<select id="whoIsInSelect">` option).

The **admin** account (`admin_username` in `config.yaml`) is excluded.

## Components

1. **cvc-place server** — stores users and points; exposes secret-protected APIs:
   - `GET /api/presence-targets?secret=...`
   - `POST /api/presence-report` with JSON `{"secret":"...","present":["username",...]}`
2. **`presence_worker.py`** — runs on a machine that can reach both the app HTTP server and WhoIsIn (usually your home server + SSH tunnel into CVC).

The browser-visible `GET /api/config` response **does not** include `presence_worker_secret` or `whoisin_url`.

**Admin debug:** signed-in admins can use the in-app **WhoIsIn** control to type an arbitrary name and call `POST /api/admin/check-whoin`, which runs the same Playwright fetch and word-part matching as the worker. Configure `whoisin_url` in `config.yaml` (commented example) or set `WHOISIN_URL` on the server; the **machine running `server.py`** must reach that URL (often the same host where your SSH tunnel listens). If Playwright/Chromium is missing or the page is unreachable, the endpoint returns 503 with an error message.

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

## Full stack: tunnel + server + worker (systemd)

Versioned unit files live under [`systemd/user/`](../systemd/user/) in the repo. They assume the clone is at **`~/cvc-place`**. Copy them to `~/.config/systemd/user/` and adjust paths if needed (see [`systemd/user/README.md`](../systemd/user/README.md)).

**Runtime dependencies**

- **Tunnel:** `openssh-client`, `sshpass`; `.env` must define **`SSHPASS`** (SSH login password) if you use `scripts/cvc_tunnel.sh` non-interactively.
- **Server (`server.py`):** Python 3 and stdlib + sqlite. For the in-app **WhoIsIn admin debug** (`POST /api/admin/check-whoin`), install the same Playwright stack as the worker on the host that runs the server: `pip install -r requirements-presence.txt` and `playwright install chromium`.
- **Worker (`presence_worker.py`):** same Playwright install as above.

**Configuration (`.env` in repo root, gitignored)**

| Variable | Used by | Purpose |
|----------|---------|---------|
| `CVC_PRESENCE_SECRET` | server + worker | Presence API secret (not SSH) |
| `SSHPASS` | `cvc_tunnel.sh` | SSH password for `sshpass -e` |
| `CVC_PLACE_BASE` | worker | App base URL (e.g. `http://127.0.0.1:8123`) |
| `WHOISIN_URL` | worker + server | Tunneled WhoIsIn URL; should match `whoisin_url` in `config.yaml` if set |

Units load `.env` via `EnvironmentFile=-%h/cvc-place/.env` (adjust path if your clone is not `~/cvc-place`).

**Install and start (user session)**

```bash
mkdir -p ~/.config/systemd/user
cp /path/to/cvc-place/systemd/user/cvc-tunnel.service ~/.config/systemd/user/
cp /path/to/cvc-place/systemd/user/cvc-place.service ~/.config/systemd/user/
cp /path/to/cvc-place/systemd/user/cvc-place-worker.service ~/.config/systemd/user/
# Edit the three files if the repo is not ~/cvc-place
chmod +x /path/to/cvc-place/scripts/cvc_tunnel.sh
systemctl --user daemon-reload
systemctl --user enable --now cvc-place.service
```

`cvc-place.service` **requires** the tunnel and **wants** the worker; its `[Install] Also=` enables **`cvc-tunnel.service`** and **`cvc-place-worker.service`** when you enable the server, so one `enable` wires the trio.

**Sanity check after the tunnel is up**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8080/icarwac/whoIsIn.php"
```

Expect `200` (or your chosen local port/path).

**Boot without logging in**

User services stop at logout unless lingering is enabled:

```bash
loginctl enable-linger "$USER"
```

**Status**

```bash
systemctl --user status cvc-tunnel.service cvc-place.service cvc-place-worker.service
```

The tunnel unit uses **`Restart=always`** so SSH disconnects are retried. For stubborn NAT issues you can switch the tunnel unit to **`autossh`** instead of plain `ssh` (see `man autossh`).
