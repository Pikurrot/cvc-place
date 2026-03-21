# cvc-place -- Project Summary

## What It Is

**cvc-place** is an interactive, collaborative canvas web application inspired by Reddit's r/place. Users can upload images (from files or URLs), draw custom artwork, and place them permanently on a large shared canvas. A points system governs how much canvas real estate each user can claim.

The app runs as a single-page web application served by a lightweight Python HTTP server that also handles persistence (saving images to disk and metadata to JSON).

---

## How It Works

### Architecture

```
Browser (HTML/CSS/JS)  <--->  Python HTTP Server (server.py, port 8080)
                                  |
                                  ├── config.yaml      (app configuration)
                                  ├── placements.json   (placed image metadata)
                                  └── images/           (saved image files)
```

- **Frontend:** Pure HTML/CSS/JS, no frameworks. Single `index.html` + `style.css` + `app.js`.
- **Backend:** Python `http.server` with custom handler. Serves static files and exposes API endpoints. No external dependencies.
- **Persistence:** Images saved as files in `images/` with UUIDs. Metadata (position, size, filename) stored in `placements.json`.
- **Configuration:** `config.yaml` parsed by the server and served as JSON to the frontend at startup.

### Running

```bash
python3 server.py
# Open http://localhost:8080
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/placements` | Returns array of placed image metadata |
| POST | `/api/place` | Saves a new image (base64 data) and its position/size |
| GET | `/api/config` | Returns parsed config.yaml as JSON |
| POST | `/api/proxy-image` | Fetches an external image URL server-side (bypasses CORS), returns as data URL |

---

## Core Features (Implemented)

### Canvas System
- A large square canvas (default 5000x5000 world pixels) with a semi-transparent grid and visible border.
- Gray background outside the canvas boundary; white inside.
- Pan by click-and-drag in spectate mode. Zoom with scroll wheel (centered on cursor).
- Offset clamping prevents scrolling too far away from the canvas.
- On load, the view auto-centers to show the entire canvas.

### Image Upload
- **From file:** File picker, reads as data URL, enters edit mode.
- **From URL:** Sends URL to `/api/proxy-image` server endpoint which fetches and returns a data URL. Preserves original format (including GIFs). Bypasses CORS.

### Drawing
- A modal with a 400x400 drawing canvas. Pen and eraser tools with configurable sizes.
- "Ready" converts the drawing to a transparent PNG data URL and enters edit mode.

### Edit Mode
- The image/drawing appears centered on screen with a dashed border at 85% opacity.
- **Dragging:** Click and drag moves the canvas background (image stays centered). Velocity is proportional to cursor distance from click origin, scaled by `speed_factor`.
- **Resizing:** A custom vertical slider on the right side. Dragging the thumb up/down scales the image. The slider thumb grows/shrinks proportionally to the image size. The slider maps to a percentage of the canvas world size (1% to 50% by default).
- **Cost label:** A number to the left of the slider thumb shows the point cost of placing the image at the current size. Color-coded: black (normal), dark yellow (>= 70% of user points), red (exceeds user points).
- **Place button:** Places the image at the current canvas center position if the user has enough points. Deducts points.
- **Exit button:** Discards the image and returns to spectate mode.

### GIF Support
- Placed images are rendered as `<img>` DOM elements (not drawn on the HTML5 Canvas), so animated GIFs play natively.
- The `#imagesLayer` div mirrors the canvas pan/zoom transforms via CSS `transform`.
- The server saves images with their correct file extension (`.gif`, `.png`, `.jpg`, etc.) based on the data URL MIME type.

### Points System
- Users start with a configurable number of points (default 1000).
- Placing an image costs `ceil(width * height / points_area_divisor)` points.
- If cost exceeds available points, placement is blocked and a warning toast appears.
- Points counter displayed in the top center (`"1000 pts"`).

### Toast / Warning System
- Reusable `showToast(message, type)` function.
- Types: `"warning"` (yellow), `"error"` (red), `"info"` (blue).
- Each toast has a bottom progress bar indicating time until auto-dismissal.
- Duration configurable via `warning_duration` in config.yaml (default 5 seconds).
- Appears in the top-right corner, stacked vertically.
- All former `alert()` calls have been replaced with toast notifications.

---

## File Inventory

| File | Purpose |
|------|---------|
| `index.html` | UI structure: canvas, images layer, toolbar, upload/draw modals, edit mode UI, points display, toast container |
| `style.css` | All styling: canvas, modals, slider, toolbar, points display, toast animations, cost label |
| `app.js` | All frontend logic: rendering, panning, zooming, edit mode, drawing, persistence, points, toasts |
| `server.py` | Python HTTP server: static files, API endpoints for placements, config, image proxy |
| `config.yaml` | Tunable parameters (see below) |
| `placements.json` | Auto-generated. Array of `{ file, x, y, w, h }` entries |
| `images/` | Auto-generated. Saved image files with UUID names |
| `ideas.txt` | Brainstorming notes for future features |
| `.gitignore` | Standard Python gitignore |

---

## Configuration (config.yaml)

```yaml
speed_factor: 0.04          # Edit mode drag velocity multiplier
zoom_sensitivity: 0.001     # Scroll wheel zoom sensitivity
min_zoom: 0.05              # Minimum zoom level
max_zoom: 20                # Maximum zoom level
world_size: 5000            # Canvas world size in pixels (square)
grid_step: 50               # Grid line spacing in world pixels
min_image_pct: 0.01         # Minimum image size as fraction of world_size (1%)
max_image_pct: 0.5          # Maximum image size as fraction of world_size (50%)
pen_size: 4                 # Drawing pen stroke width
eraser_size: 4              # Drawing eraser stroke width
starting_points: 1000       # Initial user point balance
points_area_divisor: 25000  # Cost = ceil(w * h / this_value)
warning_duration: 5         # Toast notification duration in seconds
```

---

## UI Layout

```
┌─────────────────────────────────────────────────────┐
│ [Upload Image]        [1000 pts]       [Toast area] │
│ [Draw]                                              │
│                                                     │
│                                                     │
│                  (Canvas with grid)                  │
│                                                     │
│                                    [Slider + cost]  │ ← only in edit mode
│                                                     │
│                    [Place]              [Exit]       │ ← only in edit mode
└─────────────────────────────────────────────────────┘
```

### App Modes
- **Spectate:** Default. Toolbar visible. Pan and zoom the canvas. View placed images.
- **Edit:** Toolbar hidden. Edit UI visible (centered image preview, slider, Place/Exit buttons). Points display stays visible.
- **Drawing:** Toolbar hidden. Drawing modal visible. Canvas interaction paused.

---

## Key Technical Decisions

1. **DOM images instead of Canvas drawImage:** The HTML5 Canvas API only renders a single GIF frame. All placed images are `<img>` elements in a `#imagesLayer` div that has its CSS `transform` synced with the canvas's pan/zoom state.

2. **Custom slider instead of native `<input type="range">`:** The native vertical range input was visually broken and unreliable across browsers. A custom drag-based slider provides full control over appearance (growing/shrinking thumb) and behavior.

3. **Server-side image proxy:** External URL images are fetched by the Python server (not the browser) to bypass CORS restrictions and preserve original formats (GIFs especially).

4. **Simple YAML parser:** `config.yaml` is parsed with basic string splitting in Python (no PyYAML dependency). Supports `key: numeric_value` lines and comments.

5. **No `overflow: hidden` on images layer:** Previously caused images positioned at large world coordinates to be clipped by the viewport-sized container before CSS transforms were applied. Removing it fixed image visibility across the full canvas.

---

## Known Bugs / Limitations

- Points are not persisted to disk -- refreshing the page resets points to `starting_points`.
- Single-user only -- no authentication or multi-user support yet.
- `placements.json` grows indefinitely; no cleanup mechanism.
- Drawing canvas is fixed at 400x400 pixels.
- No undo/redo in drawing mode.
- No way to delete or edit already-placed images.

---
