# systemd user units (tunnel + server + worker)

These units assume the repository lives at **`~/cvc-place`** (`%h/cvc-place`). If your clone is elsewhere, replace that path in all three `.service` files (and keep them in sync).

## Install

1. Install dependencies: `openssh-client`, `sshpass`, Python 3, Playwright (`pip install -r requirements-presence.txt` and `playwright install chromium`) on the account that runs the services.
2. Copy units into your user systemd directory:

   ```bash
   mkdir -p ~/.config/systemd/user
   cp systemd/user/*.service ~/.config/systemd/user/
   ```

3. Edit paths in the copies if the repo is not `~/cvc-place`.
4. Ensure `.env` contains at least `CVC_PRESENCE_SECRET`, `SSHPASS`, and (recommended) `WHOISIN_URL` matching `whoisin_url` in `config.yaml`.
5. Ensure `scripts/cvc_tunnel.sh` is executable: `chmod +x scripts/cvc_tunnel.sh`.

```bash
systemctl --user daemon-reload
systemctl --user enable --now cvc-place.service
```

Enabling **`cvc-place.service`** also enables **`cvc-tunnel.service`** and **`cvc-place-worker.service`** (via `Also=`). Starting `cvc-place.service` starts the tunnel first, then the server, then the worker.

## Boot without login

User services stop at logout unless lingering is enabled:

```bash
loginctl enable-linger "$USER"
```

## Optional: `autossh`

If plain `Restart=always` on the tunnel is not enough for your network, replace the tunnel unit’s `ExecStart` with `autossh` (see `man autossh`).
