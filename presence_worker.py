#!/usr/bin/env python3
"""
Poll IcarWAC WhoIsIn (JS-rendered) and report matched users to cvc-place.

Requires: pip install playwright && playwright install chromium
Env: CVC_PRESENCE_SECRET (API shared secret; not SSH — use .env), CVC_PLACE_BASE, WHOISIN_URL.

See docs/presence.md for tunnel and systemd setup.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

import whoisin_check

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def _load_dotenv() -> None:
    """Load repo-root .env into os.environ if present (does not override existing env)."""
    path = os.path.join(_SCRIPT_DIR, ".env")
    if not os.path.isfile(path):
        return
    with open(path, "r") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[7:].strip()
            if "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            if not key or key in os.environ:
                continue
            val = val.strip()
            if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
                val = val[1:-1]
            os.environ[key] = val


def fetch_targets(base_url: str, secret: str, timeout: float = 30.0) -> list[dict[str, str]]:
    qs = urllib.parse.urlencode({"secret": secret})
    url = f"{base_url.rstrip('/')}/api/presence-targets?{qs}"
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode()
    data = json.loads(body)
    if not isinstance(data, list):
        raise ValueError(f"Unexpected targets response: {data!r}")
    return data


def post_report(base_url: str, secret: str, present: list[str], timeout: float = 30.0) -> dict[str, Any]:
    payload = json.dumps({"secret": secret, "present": present}).encode()
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/api/presence-report",
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def run_once(
    base_url: str, secret: str, whoisin_url: str
) -> tuple[list[str], dict[str, Any]]:
    targets = fetch_targets(base_url, secret)
    options_lower = whoisin_check.fetch_whoisin_options_lower(whoisin_url)
    present = whoisin_check.compute_present_usernames(targets, options_lower)
    result = post_report(base_url, secret, present)
    return present, result


def main() -> None:
    _load_dotenv()
    parser = argparse.ArgumentParser(description="WhoIsIn / cvc-place presence worker")
    parser.add_argument(
        "--base-url",
        default=os.environ.get("CVC_PLACE_BASE", "http://127.0.0.1:8123"),
        help="cvc-place root URL",
    )
    parser.add_argument(
        "--secret",
        default=os.environ.get("CVC_PRESENCE_SECRET", ""),
        help="Must match server (CVC_PRESENCE_SECRET in .env or presence_worker_secret in yaml)",
    )
    parser.add_argument(
        "--whoisin-url",
        default=os.environ.get(
            "WHOISIN_URL", "http://127.0.0.1:8080/icarwac/whoIsIn.php"
        ),
        help="WhoIsIn page URL (via SSH tunnel to CVC if needed)",
    )
    parser.add_argument(
        "--poll-seconds",
        type=int,
        default=int(os.environ.get("CVC_PRESENCE_POLL_SECONDS", "60")),
        help="Sleep between successful polls",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run a single cycle and exit (for cron)",
    )
    args = parser.parse_args()

    if not args.secret:
        print("Missing secret: set --secret or CVC_PRESENCE_SECRET", file=sys.stderr)
        sys.exit(1)

    if args.once:
        try:
            present, result = run_once(args.base_url, args.secret, args.whoisin_url)
            print(f"Present: {present!r} -> {result}")
        except urllib.error.HTTPError as e:
            body = e.read().decode() if e.fp else ""
            print(f"HTTP {e.code}: {body}", file=sys.stderr)
            sys.exit(1)
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)
        return

    backoff = args.poll_seconds
    while True:
        try:
            present, result = run_once(args.base_url, args.secret, args.whoisin_url)
            print(
                f"[{time.strftime('%H:%M:%S')}] present={present!r} awarded={result.get('points_awarded', '?')}"
            )
            backoff = args.poll_seconds
        except urllib.error.HTTPError as e:
            body = e.read().decode() if e.fp else ""
            print(f"[{time.strftime('%H:%M:%S')}] HTTP {e.code}: {body}", file=sys.stderr)
            backoff = min(backoff * 2, 600)
        except Exception as e:
            print(f"[{time.strftime('%H:%M:%S')}] {e}", file=sys.stderr)
            backoff = min(backoff * 2, 600)
        time.sleep(backoff)


if __name__ == "__main__":
    main()
