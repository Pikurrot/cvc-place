#!/usr/bin/env python3
import http.server
import hashlib
import json
import math
import os
import re
import base64
import uuid
import urllib.request

import db_store

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PORT = 8080
IMAGES_DIR = os.path.join(BASE_DIR, "images")
PLACEMENTS_FILE = os.path.join(BASE_DIR, "placements.json")
CONFIG_FILE = os.path.join(BASE_DIR, "config.yaml")
USERS_FILE = os.path.join(BASE_DIR, "users.json")
CONTRIBUTIONS_FILE = os.path.join(BASE_DIR, "contributions.json")

db_store.configure(BASE_DIR)

MIME_TO_EXT = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "image/bmp": ".bmp",
}


def hash_password(password, salt):
    return hashlib.sha256((salt + password).encode()).hexdigest()


def parse_config():
    if not os.path.exists(CONFIG_FILE):
        return {}
    cfg = {}
    with open(CONFIG_FILE, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if ":" not in line:
                continue
            key, val = line.split(":", 1)
            key = key.strip()
            val = val.strip()
            try:
                if "." in val:
                    cfg[key] = float(val)
                else:
                    cfg[key] = int(val)
            except ValueError:
                cfg[key] = val
    return cfg


def _is_admin(username):
    cfg = parse_config()
    return username == cfg.get("admin_username", "")


def ext_from_data_url(data_url):
    m = re.match(r"data:(image/[^;]+);", data_url)
    if m:
        mime = m.group(1)
        return MIME_TO_EXT.get(mime, ".png")
    return ".png"


def _json_response(handler, status, data):
    body = json.dumps(data).encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _approval_error(username):
    """Return (status_code, dict) if request must be blocked, else None."""
    if not username:
        return (400, {"error": "Username is required"})
    if _is_admin(username):
        return None
    conn = db_store.get_conn()
    try:
        u = db_store.user_get(conn, username)
        if not u:
            return (401, {"error": "User not found"})
        if not u["approved"]:
            return (403, {"error": "Account pending approval"})
    finally:
        conn.close()
    return None


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_GET(self):
        if self.path == "/api/placements":
            conn = db_store.get_conn()
            try:
                _json_response(self, 200, db_store.list_placements(conn))
            finally:
                conn.close()
            return
        if self.path == "/api/config":
            _json_response(self, 200, parse_config())
            return
        if self.path == "/api/contributions":
            conn = db_store.get_conn()
            try:
                _json_response(self, 200, db_store.list_contributions_unplaced(conn))
            finally:
                conn.close()
            return
        if self.path == "/api/leaderboard":
            self._handle_leaderboard()
            return
        if self.path.startswith("/api/pending-users"):
            self._handle_pending_users()
            return
        if self.path.startswith("/api/user"):
            self._handle_get_user()
            return
        super().do_GET()

    def do_POST(self):
        if self.path == "/api/place":
            self._handle_place()
            return
        if self.path == "/api/proxy-image":
            self._handle_proxy_image()
            return
        if self.path == "/api/register":
            self._handle_register()
            return
        if self.path == "/api/login":
            self._handle_login()
            return
        if self.path == "/api/remove-placement":
            self._handle_remove_placement()
            return
        if self.path == "/api/update-placement":
            self._handle_update_placement()
            return
        if self.path == "/api/clear":
            self._handle_clear()
            return
        if self.path == "/api/approve-user":
            self._handle_approve_user()
            return
        if self.path == "/api/contributions/create":
            self._handle_contrib_create()
            return
        if self.path == "/api/contributions/contribute":
            self._handle_contrib_contribute()
            return
        if self.path == "/api/contributions/place":
            self._handle_contrib_place()
            return
        if self.path == "/api/contributions/remove":
            self._handle_contrib_remove()
            return
        self.send_error(404)

    def _handle_pending_users(self):
        from urllib.parse import urlparse, parse_qs

        qs = parse_qs(urlparse(self.path).query)
        username = qs.get("username", [""])[0]
        if not username or not _is_admin(username):
            _json_response(self, 403, {"error": "Admin only"})
            return
        admin_name = parse_config().get("admin_username", "")
        conn = db_store.get_conn()
        try:
            pending = db_store.list_pending_users(conn, admin_name)
        finally:
            conn.close()
        _json_response(self, 200, pending)

    def _handle_place(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        data_url = payload.get("data", "")
        x = payload.get("x", 0)
        y = payload.get("y", 0)
        w = payload.get("w", 0)
        h = payload.get("h", 0)
        username = payload.get("username", "")

        err = _approval_error(username)
        if err:
            _json_response(self, err[0], err[1])
            return

        cfg = parse_config()
        divisor = cfg.get("points_area_divisor", 25000)
        cost = math.ceil((w * h) / divisor)

        ext = ext_from_data_url(data_url)
        if "," in data_url:
            b64 = data_url.split(",", 1)[1]
        else:
            b64 = data_url
        try:
            img_bytes = base64.b64decode(b64)
        except Exception:
            self.send_error(400, "Invalid base64 data")
            return

        os.makedirs(IMAGES_DIR, exist_ok=True)
        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(IMAGES_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(img_bytes)

        conn = db_store.get_conn()
        try:
            is_admin = _is_admin(username)
            with db_store.mutating_transaction(conn):
                user = db_store.user_get(conn, username)
                if not user:
                    raise ValueError("user missing")
                if not is_admin:
                    if cost > user["points"]:
                        raise ValueError("points")
                    new_points = user["points"] - cost
                else:
                    new_points = user["points"]
                new_spent = user["total_spent"] + cost
                conn.execute(
                    "UPDATE users SET points = ?, total_spent = ? WHERE username = ?",
                    (new_points, new_spent, username),
                )
                conn.execute(
                    "INSERT INTO placements (file, x, y, w, h, username, contributors_json) VALUES (?, ?, ?, ?, ?, ?, NULL)",
                    (filename, x, y, w, h, username),
                )
        except ValueError as e:
            if os.path.exists(filepath):
                os.remove(filepath)
            if str(e) == "points":
                _json_response(self, 403, {"error": "Not enough points"})
            else:
                _json_response(self, 401, {"error": "User not found"})
            return
        finally:
            conn.close()

        _json_response(self, 200, {
            "ok": True,
            "file": filename,
            "points": -1 if is_admin else new_points,
        })

    def _handle_leaderboard(self):
        cfg = parse_config()
        admin_name = cfg.get("admin_username", "")
        conn = db_store.get_conn()
        try:
            placements = db_store.list_placements(conn)
            img_counts = {}
            for p in placements:
                credited = {p.get("username", "")}
                for cu in p.get("contributors", []):
                    credited.add(cu)
                for u in credited:
                    if u:
                        img_counts[u] = img_counts.get(u, 0) + 1
            board = []
            for row in conn.execute(
                "SELECT username, points, total_spent FROM users WHERE approved = 1 AND username != ?",
                (admin_name,),
            ):
                u = row["username"]
                board.append({
                    "username": u,
                    "total_spent": row["total_spent"],
                    "images": img_counts.get(u, 0),
                    "points": row["points"],
                })
            board.sort(key=lambda e: e["total_spent"], reverse=True)
        finally:
            conn.close()
        _json_response(self, 200, board)

    def _handle_get_user(self):
        from urllib.parse import urlparse, parse_qs

        qs = parse_qs(urlparse(self.path).query)
        username = qs.get("username", [""])[0]
        if not username:
            _json_response(self, 400, {"error": "Missing username"})
            return
        conn = db_store.get_conn()
        try:
            user = db_store.user_get(conn, username)
        finally:
            conn.close()
        if not user:
            _json_response(self, 404, {"error": "User not found"})
            return
        _json_response(self, 200, {
            "ok": True,
            "username": user["username"],
            "points": user["points"],
            "real_name": user["real_name"],
            "is_admin": _is_admin(user["username"]),
            "approved": user["approved"],
        })

    def _handle_register(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        username = payload.get("username", "").strip()
        password = payload.get("password", "")
        repeat_password = payload.get("repeat_password", "")
        real_name = payload.get("real_name", "").strip()

        if not username:
            _json_response(self, 400, {"error": "Username is required", "field": "username"})
            return
        if len(password) < 8:
            _json_response(self, 400, {"error": "Password must be at least 8 characters", "field": "password"})
            return
        if not password.isalnum():
            _json_response(self, 400, {"error": "Password must be alphanumeric only", "field": "password"})
            return
        if password != repeat_password:
            _json_response(self, 400, {"error": "Passwords do not match", "field": "repeat_password"})
            return

        cfg = parse_config()
        starting_points = cfg.get("starting_points", 1000)
        admin_name = cfg.get("admin_username", "")
        approved = 1 if username == admin_name else 0

        conn = db_store.get_conn()
        try:
            if db_store.user_get(conn, username):
                _json_response(self, 409, {"error": "Username is already taken", "field": "username"})
                return
            salt = os.urandom(16).hex()
            ph = hash_password(password, salt)
            with db_store.mutating_transaction(conn):
                conn.execute(
                    """INSERT INTO users (username, password_hash, salt, real_name, points, total_spent, approved)
                       VALUES (?, ?, ?, ?, ?, 0, ?)""",
                    (username, ph, salt, real_name, starting_points, approved),
                )
        finally:
            conn.close()

        _json_response(self, 200, {
            "ok": True,
            "username": username,
            "points": starting_points,
            "is_admin": _is_admin(username),
            "approved": bool(approved),
        })

    def _handle_login(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        username = payload.get("username", "").strip()
        password = payload.get("password", "")

        conn = db_store.get_conn()
        try:
            user = db_store.user_get(conn, username)
        finally:
            conn.close()
        if not user:
            _json_response(self, 401, {"error": "Username does not exist", "field": "username"})
            return

        if hash_password(password, user["salt"]) != user["password_hash"]:
            _json_response(self, 401, {"error": "Incorrect password", "field": "password"})
            return

        _json_response(self, 200, {
            "ok": True,
            "username": user["username"],
            "points": user["points"],
            "real_name": user["real_name"],
            "is_admin": _is_admin(user["username"]),
            "approved": user["approved"],
        })

    def _handle_approve_user(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        admin_u = payload.get("username", "")
        target = payload.get("target_username", "").strip()
        if not _is_admin(admin_u):
            _json_response(self, 403, {"error": "Admin only"})
            return
        if not target:
            _json_response(self, 400, {"error": "Missing target_username"})
            return

        conn = db_store.get_conn()
        try:
            if not db_store.user_get(conn, target):
                _json_response(self, 404, {"error": "User not found"})
                return
            with db_store.mutating_transaction(conn):
                conn.execute("UPDATE users SET approved = 1 WHERE username = ?", (target,))
        finally:
            conn.close()
        _json_response(self, 200, {"ok": True})

    def _handle_remove_placement(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        username = payload.get("username", "")
        file = payload.get("file", "")
        if not _is_admin(username):
            _json_response(self, 403, {"error": "Admin only"})
            return

        conn = db_store.get_conn()
        try:
            with db_store.mutating_transaction(conn):
                conn.execute("DELETE FROM placements WHERE file = ?", (file,))
        finally:
            conn.close()

        filepath = os.path.join(IMAGES_DIR, file)
        if os.path.exists(filepath):
            os.remove(filepath)

        _json_response(self, 200, {"ok": True})

    def _handle_update_placement(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        username = payload.get("username", "")
        file = payload.get("file", "")
        if not _is_admin(username):
            _json_response(self, 403, {"error": "Admin only"})
            return

        conn = db_store.get_conn()
        try:
            row = conn.execute(
                "SELECT x, y, w, h FROM placements WHERE file = ?", (file,)
            ).fetchone()
            if not row:
                _json_response(self, 404, {"error": "Placement not found"})
                return
            nx = payload["x"] if "x" in payload else row["x"]
            ny = payload["y"] if "y" in payload else row["y"]
            nw = payload["w"] if "w" in payload else row["w"]
            nh = payload["h"] if "h" in payload else row["h"]
            with db_store.mutating_transaction(conn):
                conn.execute(
                    "UPDATE placements SET x = ?, y = ?, w = ?, h = ? WHERE file = ?",
                    (nx, ny, nw, nh, file),
                )
        finally:
            conn.close()
        _json_response(self, 200, {"ok": True})

    def _handle_clear(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        username = payload.get("username", "")
        if not _is_admin(username):
            _json_response(self, 403, {"error": "Admin only"})
            return

        conn = db_store.get_conn()
        try:
            with db_store.mutating_transaction(conn):
                conn.execute("DELETE FROM placements")
        finally:
            conn.close()

        if os.path.exists(IMAGES_DIR):
            for f in os.listdir(IMAGES_DIR):
                fp = os.path.join(IMAGES_DIR, f)
                if os.path.isfile(fp):
                    os.remove(fp)

        _json_response(self, 200, {"ok": True})

    def _handle_contrib_create(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        username = payload.get("username", "")
        data_url = payload.get("data", "")
        target = payload.get("target", 0)

        err = _approval_error(username)
        if err:
            _json_response(self, err[0], err[1])
            return

        if not username or target <= 0:
            _json_response(self, 400, {"error": "Invalid parameters"})
            return

        ext = ext_from_data_url(data_url)
        if "," in data_url:
            b64 = data_url.split(",", 1)[1]
        else:
            b64 = data_url
        try:
            img_bytes = base64.b64decode(b64)
        except Exception:
            self.send_error(400, "Invalid base64 data")
            return

        os.makedirs(IMAGES_DIR, exist_ok=True)
        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(IMAGES_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(img_bytes)

        cid = uuid.uuid4().hex
        conn = db_store.get_conn()
        try:
            with db_store.mutating_transaction(conn):
                conn.execute(
                    "INSERT INTO contributions (id, file, target, funded, placed) VALUES (?, ?, ?, 0, 0)",
                    (cid, filename, target),
                )
        except Exception:
            if os.path.exists(filepath):
                os.remove(filepath)
            raise
        finally:
            conn.close()

        _json_response(self, 200, {"ok": True, "id": cid, "file": filename})

    def _handle_contrib_contribute(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        username = payload.get("username", "")
        cid = payload.get("id", "")
        amount = payload.get("amount", 0)

        err = _approval_error(username)
        if err:
            _json_response(self, err[0], err[1])
            return

        if not username or not cid or amount <= 0:
            _json_response(self, 400, {"error": "Invalid parameters"})
            return

        conn = db_store.get_conn()
        try:
            contrib = db_store.contribution_get(conn, cid)
            if not contrib:
                _json_response(self, 404, {"error": "Contribution not found"})
                return
            if contrib["placed"]:
                _json_response(self, 400, {"error": "Already placed"})
                return
            if contrib["funded"] + amount > contrib["target"]:
                _json_response(self, 400, {"error": "Amount exceeds remaining needed"})
                return

            user = db_store.user_get(conn, username)
            if not user:
                _json_response(self, 401, {"error": "User not found"})
                return

            is_admin = _is_admin(username)
            if not is_admin and amount > user["points"]:
                _json_response(self, 403, {"error": "Not enough points"})
                return

            try:
                with db_store.mutating_transaction(conn):
                    user = db_store.user_get(conn, username)
                    contrib = db_store.contribution_get(conn, cid)
                    if contrib["funded"] + amount > contrib["target"]:
                        raise RuntimeError("stale")
                    if not is_admin and amount > user["points"]:
                        raise RuntimeError("stale")
                    new_points = user["points"] if is_admin else user["points"] - amount
                    new_spent = user["total_spent"] + amount
                    conn.execute(
                        "UPDATE users SET points = ?, total_spent = ? WHERE username = ?",
                        (new_points, new_spent, username),
                    )
                    conn.execute(
                        "UPDATE contributions SET funded = funded + ? WHERE id = ?",
                        (amount, cid),
                    )
                    conn.execute(
                        "INSERT INTO contribution_lines (contribution_id, username, amount) VALUES (?, ?, ?)",
                        (cid, username, amount),
                    )
                    funded_after = contrib["funded"] + amount
            except RuntimeError:
                _json_response(self, 403, {"error": "Not enough points"})
                return

            _json_response(self, 200, {
                "ok": True,
                "funded": funded_after,
                "points": -1 if is_admin else new_points,
            })
        finally:
            conn.close()

    def _handle_contrib_place(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        username = payload.get("username", "")
        cid = payload.get("id", "")
        x = payload.get("x", 0)
        y = payload.get("y", 0)
        w = payload.get("w", 0)
        h = payload.get("h", 0)

        err = _approval_error(username)
        if err:
            _json_response(self, err[0], err[1])
            return

        conn = db_store.get_conn()
        try:
            contrib = db_store.contribution_get(conn, cid)
            if not contrib:
                _json_response(self, 404, {"error": "Contribution not found"})
                return
            if contrib["funded"] < contrib["target"]:
                _json_response(self, 403, {"error": "Not fully funded"})
                return

            contributor_names = list({e["username"] for e in contrib["contributors"]})
            cj = json.dumps(contributor_names)

            with db_store.mutating_transaction(conn):
                conn.execute("UPDATE contributions SET placed = 1 WHERE id = ?", (cid,))
                conn.execute(
                    """INSERT INTO placements (file, x, y, w, h, username, contributors_json)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (contrib["file"], x, y, w, h, username, cj),
                )
        finally:
            conn.close()

        _json_response(self, 200, {"ok": True, "file": contrib["file"]})

    def _handle_contrib_remove(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        username = payload.get("username", "")
        cid = payload.get("id", "")
        if not _is_admin(username):
            _json_response(self, 403, {"error": "Admin only"})
            return

        conn = db_store.get_conn()
        try:
            contrib = db_store.contribution_get(conn, cid)
            with db_store.mutating_transaction(conn):
                conn.execute("DELETE FROM contributions WHERE id = ?", (cid,))
        finally:
            conn.close()

        if contrib:
            filepath = os.path.join(IMAGES_DIR, contrib["file"])
            if os.path.exists(filepath):
                os.remove(filepath)

        _json_response(self, 200, {"ok": True})

    def _handle_proxy_image(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        username = payload.get("username", "")
        err = _approval_error(username)
        if err:
            _json_response(self, err[0], err[1])
            return

        url = payload.get("url", "")
        if not url:
            self.send_error(400, "Missing url")
            return

        try:
            req = urllib.request.Request(url, headers={"User-Agent": "cvc-place/1.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                content_type = resp.headers.get("Content-Type", "image/png").split(";")[0].strip()
                img_bytes = resp.read()
        except Exception as e:
            _json_response(self, 502, {"error": str(e)})
            return

        b64 = base64.b64encode(img_bytes).decode()
        data_url = f"data:{content_type};base64,{b64}"
        _json_response(self, 200, {"dataUrl": data_url})

    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {format % args}")


def _init_database():
    conn = db_store.get_conn()
    try:
        db_store.init_schema(conn)
        db_store.migrate_from_legacy_json_if_empty(conn, parse_config().get("admin_username", ""))
    finally:
        conn.close()


_init_database()

if __name__ == "__main__":
    with http.server.HTTPServer(("", PORT), Handler) as httpd:
        print(f"Serving on http://localhost:{PORT}")
        httpd.serve_forever()
