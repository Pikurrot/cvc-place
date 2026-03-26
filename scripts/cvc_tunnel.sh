#!/usr/bin/env bash
# Non-interactive SSH port forward for WhoIsIn (requires sshpass + SSH password in env).
# Prefer SSH keys if the server ever allows them.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${CVC_SSH_HOST:=tunnel.cvc.uab.es}"
: "${CVC_SSH_USER:=elopezc}"
: "${CVC_SSH_PORT:=22345}"
: "${CVC_TUNNEL_LOCAL_PORT:=8080}"
: "${CVC_TUNNEL_FORWARD_HOST:=158.109.8.17}"
: "${CVC_TUNNEL_FORWARD_PORT:=80}"

if ! command -v sshpass >/dev/null 2>&1; then
  echo "cvc_tunnel.sh: install sshpass (e.g. sudo apt install sshpass)" >&2
  exit 1
fi

if [[ -z "${SSHPASS:-}" ]]; then
  echo "cvc_tunnel.sh: set SSHPASS to your SSH account password (in .env: SSHPASS=...)" >&2
  echo "  sshpass reads it via: sshpass -e ssh ..." >&2
  echo "  Never commit .env. Risk: password in process list with sshpass -p (we use -e only)." >&2
  exit 1
fi

LISTEN="${CVC_TUNNEL_LOCAL_PORT}:${CVC_TUNNEL_FORWARD_HOST}:${CVC_TUNNEL_FORWARD_PORT}"
echo "Forwarding 127.0.0.1:${CVC_TUNNEL_LOCAL_PORT} -> ${CVC_TUNNEL_FORWARD_HOST}:${CVC_TUNNEL_FORWARD_PORT} via ${CVC_SSH_USER}@${CVC_SSH_HOST}:${CVC_SSH_PORT}"

exec sshpass -e ssh -N \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=60 \
  -o ServerAliveCountMax=3 \
  -L "${LISTEN}" \
  -p "${CVC_SSH_PORT}" \
  "${CVC_SSH_USER}@${CVC_SSH_HOST}"
