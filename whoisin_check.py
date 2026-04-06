"""
Shared Playwright fetch + name matching for IcarWAC WhoIsIn (select#whoIsInSelect).
Used by presence_worker.py and server admin debug endpoint.

Matching: every *token* from the user's name (after normalization) must appear as a
substring of the same option line. Tokens are derived from splitting on whitespace and
common separators (comma, etc.); order does not matter ("Liu Youchen" vs "Youchen Liu").
Comparison is case-insensitive and **accent-insensitive** (Spanish tíldes / agudos / diéresis,
e.g. José vs Jose, López vs Lopez, García vs Garcia). Both the user's tokens and each
WhoIsIn option line are normalized the same way before substring checks.
"""
from __future__ import annotations

import time
import unicodedata
from typing import Any


def _fold_for_name_match(s: str) -> str:
    """
    NFKC then NFD, strip all combining marks (Unicode Mn: acute, tilde, umlaut, etc.),
    then casefold. So "López" and "Lopez" both become "lopez" for matching.
    """
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", s)
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.casefold()


def _name_tokens(name: str) -> list[str]:
    """
    Split a registered or queried name into folded tokens (no empty entries).
    Commas / semicolons / slashes count as separators so "Liu,Youchen" works.
    """
    raw = (name or "").strip()
    if not raw:
        return []
    s = unicodedata.normalize("NFKC", raw)
    for ch in ",;|/\u00b7":
        s = s.replace(ch, " ")
    tokens: list[str] = []
    for part in s.split():
        t = part.strip("._-•·:()[]\"'«»")
        if not t:
            continue
        fold = _fold_for_name_match(t)
        if fold:
            tokens.append(fold)
    return tokens


def _line_matches_tokens(line_folded: str, tokens: list[str]) -> bool:
    if not tokens:
        return False
    return all(tok in line_folded for tok in tokens)


def _wait_until_options_ready(page: Any, *, timeout_ms: int = 90_000) -> None:
    """WhoIsIn fills <option>s after the <select> exists; poll instead of 'visible' waits."""
    deadline = time.monotonic() + timeout_ms / 1000.0
    loc = page.locator("select#whoIsInSelect option")
    while time.monotonic() < deadline:
        if loc.count() > 0:
            return
        page.wait_for_timeout(150)


def fetch_whoisin_option_entries(whoisin_url: str) -> list[tuple[str, str]]:
    """Return (folded_match_string, original_stripped) for each non-empty option."""
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
            out.append((_fold_for_name_match(orig), orig))
    return out


def fetch_whoisin_options_lower(whoisin_url: str) -> list[str]:
    """Folded strings suitable for real_name_present (kept name for callers)."""
    return [e[0] for e in fetch_whoisin_option_entries(whoisin_url)]


def real_name_present(real_name: str, options_text_lower: list[str]) -> bool:
    """
    True if some option line contains every name token as a substring.
    options_text_lower: folded strings (same as first element of fetch_whoisin_option_entries).
    """
    tokens = _name_tokens(real_name)
    if not tokens:
        return False
    for line in options_text_lower:
        if _line_matches_tokens(line, tokens):
            return True
    return False


def check_name_present(query_name: str, entries: list[tuple[str, str]]) -> tuple[bool, str | None]:
    """
    Same token rule as real_name_present. Returns (present, matched_original_line).
    """
    tokens = _name_tokens(query_name)
    if not tokens:
        return False, None
    for low, orig in entries:
        if _line_matches_tokens(low, tokens):
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
