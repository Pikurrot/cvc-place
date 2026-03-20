#!/usr/bin/env python3
import http.server
import json
import os
import re
import base64
import uuid
import urllib.request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PORT = 8080
IMAGES_DIR = os.path.join(BASE_DIR, "images")
PLACEMENTS_FILE = os.path.join(BASE_DIR, "placements.json")
CONFIG_FILE = os.path.join(BASE_DIR, "config.yaml")

MIME_TO_EXT = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "image/bmp": ".bmp",
}


def read_placements():
    if not os.path.exists(PLACEMENTS_FILE):
        return []
    with open(PLACEMENTS_FILE, "r") as f:
        return json.load(f)


def write_placements(data):
    with open(PLACEMENTS_FILE, "w") as f:
        json.dump(data, f, indent=2)


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


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_GET(self):
        if self.path == "/api/placements":
            _json_response(self, 200, read_placements())
            return
        if self.path == "/api/config":
            _json_response(self, 200, parse_config())
            return
        super().do_GET()

    def do_POST(self):
        if self.path == "/api/place":
            self._handle_place()
            return
        if self.path == "/api/proxy-image":
            self._handle_proxy_image()
            return
        self.send_error(404)

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

        placements = read_placements()
        placements.append({"file": filename, "x": x, "y": y, "w": w, "h": h})
        write_placements(placements)

        _json_response(self, 200, {"ok": True, "file": filename})

    def _handle_proxy_image(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
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


if __name__ == "__main__":
    with http.server.HTTPServer(("", PORT), Handler) as httpd:
        print(f"Serving on http://localhost:{PORT}")
        httpd.serve_forever()
