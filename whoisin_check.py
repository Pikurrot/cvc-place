"""
Shared Playwright fetch + name matching for IcarWAC WhoIsIn (select#whoIsInSelect).
Used by presence_worker.py and server admin debug endpoint.
"""
from __future__ import annotations

import time
from typing import Any


def _wait_until_options_ready(page: Any, *, timeout_ms: int = 90_000) -> None:
    """WhoIsIn fills <option>s after the <select> exists; poll instead of 'visible' waits."""
    deadline = time.monotonic() + timeout_ms / 1000.0
    loc = page.locator("select#whoIsInSelect option")
    while time.monotonic() < deadline:
        if loc.count() > 0:
            return
        page.wait_for_timeout(150)


def fetch_whoisin_option_entries(whoisin_url: str) -> list[tuple[str, str]]:
    """Return (lowercase, original_stripped) for each non-empty option."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = browser.new_page()
            # "networkidle" often never completes; "visible" fails if CSS hides the <select>.
            page.goto(whoisin_url, wait_until="domcontentloaded", timeout=120_000)
            page.wait_for_selector(
                "select#whoIsInSelect",
                state="attached",
                timeout=120_000,
            )
            _wait_until_options_ready(page, timeout_ms=90_000)
            texts: list[Any] = page.locator("select#whoIsInSelect option").all_inner_texts()
        finally:
            browser.close()
    out: list[tuple[str, str]] = []
    for t in texts:
        orig = (t or "").strip()
        if orig:
            out.append((orig.lower(), orig))
    return out


def fetch_whoisin_options_lower(whoisin_url: str) -> list[str]:
    return [e[0] for e in fetch_whoisin_option_entries(whoisin_url)]


def real_name_present(real_name: str, options_text_lower: list[str]) -> bool:
    parts = [p for p in real_name.lower().split() if p]
    if not parts:
        return False
    for line in options_text_lower:
        if all(part in line for part in parts):
            return True
    return False


def check_name_present(query_name: str, entries: list[tuple[str, str]]) -> tuple[bool, str | None]:
    """
    Word-part match (same rule as presence worker): every word in query_name must
    appear as substring in the same option line. Returns (present, matched_original_line).
    """
    parts = [p for p in query_name.lower().split() if p]
    if not parts:
        return False, None
    for low, orig in entries:
        if all(part in low for part in parts):
            return True, orig
    return False, None


def compute_present_usernames(
    targets: list[dict[str, str]], options_text_lower: list[str]
) -> list[str]:
    present: list[str] = []
    for row in targets:
        u = row.get("username", "")
        rn = row.get("real_name", "") or ""
        if not u:
            continue
        if real_name_present(rn, options_text_lower):
            present.append(u)
    return present
