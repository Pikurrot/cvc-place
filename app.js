(function () {
  "use strict";

  // ── DOM refs ──
  const canvas = document.getElementById("mainCanvas");
  const ctx = canvas.getContext("2d");
  const imagesLayer = document.getElementById("imagesLayer");
  const toolbar = document.getElementById("toolbar");
  const uploadModal = document.getElementById("uploadModal");
  const fileInput = document.getElementById("fileInput");
  const urlInput = document.getElementById("urlInput");
  const btnLoadUrl = document.getElementById("btnLoadUrl");
  const btnCloseUpload = document.getElementById("btnCloseUpload");
  const drawModal = document.getElementById("drawModal");
  const drawCanvas = document.getElementById("drawCanvas");
  const drawCtx = drawCanvas.getContext("2d");
  const btnPen = document.getElementById("btnPen");
  const btnEraser = document.getElementById("btnEraser");
  const btnReady = document.getElementById("btnReady");
  const editUI = document.getElementById("editUI");
  const editImage = document.getElementById("editImage");
  const sliderTrack = document.getElementById("sliderTrack");
  const sliderThumb = document.getElementById("sliderThumb");
  const btnPlace = document.getElementById("btnPlace");
  const btnExit = document.getElementById("btnExit");
  const pointsValue = document.getElementById("pointsValue");
  const toastContainer = document.getElementById("toastContainer");
  const sliderCostLabel = document.getElementById("sliderCostLabel");

  // ── Config (loaded from server) ──
  let cfg = {
    speed_factor: 0.04,
    zoom_sensitivity: 0.001,
    min_zoom: 0.05,
    max_zoom: 20,
    world_size: 5000,
    grid_step: 50,
    min_image_pct: 0.01,
    max_image_pct: 0.5,
    pen_size: 4,
    eraser_size: 4,
    starting_points: 1000,
    points_area_divisor: 25000,
    warning_duration: 5,
  };

  // ── Canvas transform state ──
  let offsetX = 0;
  let offsetY = 0;
  let scale = 1;

  // ── App state ──
  let mode = "spectate";
  let placedImages = [];
  let userPoints = 1000;

  // ── Spectate drag state ──
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let panOffsetStartX = 0;
  let panOffsetStartY = 0;

  // ── Edit mode state ──
  let editImg = null;
  let editDataURL = "";
  let editScale = 1;
  let editDragging = false;
  let editClickOriginX = 0;
  let editClickOriginY = 0;
  let editVelocityX = 0;
  let editVelocityY = 0;

  // ── Slider drag state ──
  let sliderDragging = false;
  let sliderT = 0.47;

  // ── Drawing state ──
  let drawTool = "pen";
  let isDrawing = false;
  let lastDrawX = 0;
  let lastDrawY = 0;

  // ── Helpers ──

  function screenToCanvas(sx, sy) {
    return {
      x: (sx - offsetX) / scale,
      y: (sy - offsetY) / scale,
    };
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function clampOffset() {
    const margin = 200;
    const ws = cfg.world_size * scale;
    offsetX = Math.max(-ws + margin, Math.min(canvas.width - margin, offsetX));
    offsetY = Math.max(-ws + margin, Math.min(canvas.height - margin, offsetY));
  }

  // ── Config loading ──

  async function loadConfig() {
    try {
      const r = await fetch("/api/config");
      const data = await r.json();
      Object.assign(cfg, data);
    } catch (err) {
      console.error("Failed to load config, using defaults:", err);
    }
  }

  // ── Persistence (server) ──

  function saveToServer(entry) {
    fetch("/api/place", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: entry.data,
        x: entry.x,
        y: entry.y,
        w: entry.w,
        h: entry.h,
      }),
    }).catch((err) => console.error("Failed to save placement:", err));
  }

  function createPlacedImageEl(src, x, y, w, h) {
    const el = document.createElement("img");
    el.src = src;
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.width = w + "px";
    el.style.height = h + "px";
    imagesLayer.appendChild(el);
    placedImages.push({ el, x, y, w, h });
  }

  async function loadFromServer() {
    try {
      const r = await fetch("/api/placements");
      const arr = await r.json();
      arr.forEach((entry) => {
        createPlacedImageEl("images/" + entry.file, entry.x, entry.y, entry.w, entry.h);
      });
    } catch (err) {
      console.error("Failed to load placements:", err);
    }
  }

  // ── Render Loop ──

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#e8e8e8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cfg.world_size, cfg.world_size);

    ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
    ctx.lineWidth = 1 / scale;
    ctx.beginPath();
    for (let x = 0; x <= cfg.world_size; x += cfg.grid_step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cfg.world_size);
    }
    for (let y = 0; y <= cfg.world_size; y += cfg.grid_step) {
      ctx.moveTo(0, y);
      ctx.lineTo(cfg.world_size, y);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.lineWidth = 2 / scale;
    ctx.strokeRect(0, 0, cfg.world_size, cfg.world_size);

    // Update DOM images layer transform to match canvas
    imagesLayer.style.transform = "translate(" + offsetX + "px," + offsetY + "px) scale(" + scale + ")";

    if (mode === "edit" && editDragging) {
      offsetX -= editVelocityX;
      offsetY -= editVelocityY;
      clampOffset();
    }

    requestAnimationFrame(render);
  }

  // ── Zoom ──

  function handleWheel(e) {
    if (mode === "drawing") return;
    e.preventDefault();

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const delta = -e.deltaY * cfg.zoom_sensitivity;
    const newScale = Math.min(cfg.max_zoom, Math.max(cfg.min_zoom, scale * (1 + delta)));
    const ratio = newScale / scale;

    offsetX = mouseX - ratio * (mouseX - offsetX);
    offsetY = mouseY - ratio * (mouseY - offsetY);
    scale = newScale;
    clampOffset();

    updateEditImageSize();
  }

  // ── Spectate Panning ──

  function startPan(e) {
    if (mode !== "spectate") return;
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    panOffsetStartX = offsetX;
    panOffsetStartY = offsetY;
    canvas.classList.add("grabbing");
  }

  function movePan(e) {
    if (!isPanning) return;
    offsetX = panOffsetStartX + (e.clientX - panStartX);
    offsetY = panOffsetStartY + (e.clientY - panStartY);
    clampOffset();
  }

  function endPan() {
    isPanning = false;
    canvas.classList.remove("grabbing");
  }

  // ── Edit Mode ──

  function enterEditMode(img, dataURL) {
    mode = "edit";
    editImg = img;
    editDataURL = dataURL;
    editVelocityX = 0;
    editVelocityY = 0;
    editDragging = false;

    editImage.src = dataURL;
    sliderT = 0.47;
    editScale = sliderTToScale(sliderT);
    updateEditImageSize();
    updateSliderVisuals();
    sliderCostLabel.style.display = "";
    toolbar.classList.add("hidden");
    editUI.classList.remove("hidden");
    canvas.classList.add("edit-cursor");
  }

  function exitEditMode() {
    mode = "spectate";
    editImg = null;
    editDataURL = "";
    editDragging = false;

    sliderCostLabel.style.display = "none";
    editUI.classList.add("hidden");
    toolbar.classList.remove("hidden");
    canvas.classList.remove("edit-cursor");
  }

  function updateEditImageSize() {
    if (!editImg) return;
    const w = editImg.naturalWidth * editScale * scale;
    const h = editImg.naturalHeight * editScale * scale;
    editImage.style.width = w + "px";
    editImage.style.height = h + "px";
  }

  function computeCost(w, h) {
    return Math.ceil((w * h) / cfg.points_area_divisor);
  }

  function updateSliderVisuals() {
    const minThumb = 14;
    const maxThumb = 34;
    const size = minThumb + sliderT * (maxThumb - minThumb);
    sliderTrack.style.setProperty("--slider-t", sliderT);
    sliderTrack.style.setProperty("--thumb-size", size + "px");

    if (editImg) {
      const w = editImg.naturalWidth * editScale;
      const h = editImg.naturalHeight * editScale;
      const cost = computeCost(w, h);
      sliderCostLabel.textContent = cost;
      sliderCostLabel.style.bottom = "calc(" + sliderT * 100 + "%)";
      if (cost > userPoints) {
        sliderCostLabel.style.color = "#c62828";
      } else if (cost >= userPoints * 0.7) {
        sliderCostLabel.style.color = "#b8860b";
      } else {
        sliderCostLabel.style.color = "#333";
      }
    }
  }

  function showToast(message, type) {
    const el = document.createElement("div");
    el.className = "toast toast-" + type;
    el.textContent = message;
    const bar = document.createElement("div");
    bar.className = "toast-bar";
    bar.style.animationDuration = cfg.warning_duration + "s";
    el.appendChild(bar);
    toastContainer.appendChild(el);
    setTimeout(() => { el.remove(); }, cfg.warning_duration * 1000);
  }

  function sliderTToScale(t) {
    const minPx = cfg.min_image_pct * cfg.world_size;
    const maxPx = cfg.max_image_pct * cfg.world_size;
    const targetPx = minPx + t * (maxPx - minPx);
    const largestDim = Math.max(editImg.naturalWidth, editImg.naturalHeight);
    return targetPx / largestDim;
  }

  function placeImage() {
    if (!editImg) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const pos = screenToCanvas(cx, cy);
    const w = editImg.naturalWidth * editScale;
    const h = editImg.naturalHeight * editScale;
    const cost = computeCost(w, h);

    if (cost > userPoints) {
      showToast("Not enough points to place this image", "warning");
      return;
    }

    userPoints -= cost;
    pointsValue.textContent = userPoints;

    const x = Math.max(0, Math.min(cfg.world_size - w, pos.x - w / 2));
    const y = Math.max(0, Math.min(cfg.world_size - h, pos.y - h / 2));

    createPlacedImageEl(editDataURL, x, y, w, h);
    saveToServer({ data: editDataURL, x, y, w, h });
    exitEditMode();
  }

  function editMouseDown(e) {
    if (mode !== "edit") return;
    editDragging = true;
    editClickOriginX = e.clientX;
    editClickOriginY = e.clientY;
    editVelocityX = 0;
    editVelocityY = 0;
  }

  function editMouseMove(e) {
    if (mode !== "edit" || !editDragging || sliderDragging) return;
    const dx = e.clientX - editClickOriginX;
    const dy = e.clientY - editClickOriginY;
    editVelocityX = dx * cfg.speed_factor;
    editVelocityY = dy * cfg.speed_factor;
  }

  function editMouseUp() {
    if (mode !== "edit") return;
    editDragging = false;
    editVelocityX = 0;
    editVelocityY = 0;
  }

  // ── Upload Flow ──

  function openUploadModal() {
    uploadModal.classList.remove("hidden");
    fileInput.value = "";
    urlInput.value = "";
  }

  function closeUploadModal() {
    uploadModal.classList.add("hidden");
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        closeUploadModal();
        enterEditMode(img, ev.target.result);
      };
      img.onerror = () => showToast("Failed to load image from file.", "error");
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function handleUrlLoad() {
    const url = urlInput.value.trim();
    if (!url) return;
    fetch("/api/proxy-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    })
      .then((r) => r.json())
      .then((result) => {
        if (result.error) {
          showToast("Failed to fetch image: " + result.error, "error");
          return;
        }
        const img = new Image();
        img.onload = () => {
          closeUploadModal();
          enterEditMode(img, result.dataUrl);
        };
        img.onerror = () => showToast("Failed to load image.", "error");
        img.src = result.dataUrl;
      })
      .catch(() => showToast("Failed to fetch image from URL.", "error"));
  }

  // ── Drawing Flow ──

  function openDrawModal() {
    mode = "drawing";
    drawTool = "pen";
    btnPen.classList.add("active");
    btnEraser.classList.remove("active");
    toolbar.classList.add("hidden");
    drawModal.classList.remove("hidden");

    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  }

  function closeDrawModal() {
    drawModal.classList.add("hidden");
    toolbar.classList.remove("hidden");
    mode = "spectate";
  }

  function drawStart(e) {
    isDrawing = true;
    const rect = drawCanvas.getBoundingClientRect();
    lastDrawX = e.clientX - rect.left;
    lastDrawY = e.clientY - rect.top;
  }

  function drawMove(e) {
    if (!isDrawing) return;
    const rect = drawCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    drawCtx.lineCap = "round";
    drawCtx.lineJoin = "round";

    if (drawTool === "pen") {
      drawCtx.globalCompositeOperation = "source-over";
      drawCtx.strokeStyle = "#000";
      drawCtx.lineWidth = cfg.pen_size;
    } else {
      drawCtx.globalCompositeOperation = "destination-out";
      drawCtx.strokeStyle = "rgba(0,0,0,1)";
      drawCtx.lineWidth = cfg.eraser_size;
    }

    drawCtx.beginPath();
    drawCtx.moveTo(lastDrawX, lastDrawY);
    drawCtx.lineTo(x, y);
    drawCtx.stroke();

    lastDrawX = x;
    lastDrawY = y;
  }

  function drawEnd() {
    isDrawing = false;
  }

  function finishDrawing() {
    const dataURL = drawCanvas.toDataURL("image/png");
    const img = new Image();
    img.onload = () => {
      closeDrawModal();
      enterEditMode(img, dataURL);
    };
    img.src = dataURL;
  }

  // ── Center on world ──

  function centerOnWorld() {
    const fitScale = Math.min(canvas.width / cfg.world_size, canvas.height / cfg.world_size) * 0.95;
    scale = fitScale;
    offsetX = (canvas.width - cfg.world_size * scale) / 2;
    offsetY = (canvas.height - cfg.world_size * scale) / 2;
  }

  // ── Event Wiring ──

  window.addEventListener("resize", resizeCanvas);
  canvas.addEventListener("wheel", handleWheel, { passive: false });

  canvas.addEventListener("mousedown", (e) => {
    if (mode === "spectate") startPan(e);
    else if (mode === "edit") editMouseDown(e);
  });
  window.addEventListener("mousemove", (e) => {
    if (mode === "spectate") movePan(e);
    else if (mode === "edit") editMouseMove(e);
  });
  window.addEventListener("mouseup", () => {
    if (mode === "spectate") endPan();
    else if (mode === "edit") editMouseUp();
  });

  document.getElementById("btnUpload").addEventListener("click", openUploadModal);
  document.getElementById("btnDraw").addEventListener("click", openDrawModal);

  fileInput.addEventListener("change", handleFileUpload);
  btnLoadUrl.addEventListener("click", handleUrlLoad);
  urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleUrlLoad();
  });
  btnCloseUpload.addEventListener("click", closeUploadModal);
  uploadModal.addEventListener("click", (e) => {
    if (e.target === uploadModal) closeUploadModal();
  });

  sliderThumb.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    sliderDragging = true;
  });
  window.addEventListener("mousemove", (e) => {
    if (!sliderDragging) return;
    const rect = sliderTrack.getBoundingClientRect();
    const rawT = 1 - (e.clientY - rect.top) / rect.height;
    sliderT = Math.max(0, Math.min(1, rawT));
    editScale = sliderTToScale(sliderT);
    updateEditImageSize();
    updateSliderVisuals();
  });
  window.addEventListener("mouseup", () => {
    sliderDragging = false;
  });
  btnPlace.addEventListener("click", placeImage);
  btnExit.addEventListener("click", exitEditMode);

  btnPen.addEventListener("click", () => {
    drawTool = "pen";
    btnPen.classList.add("active");
    btnEraser.classList.remove("active");
  });
  btnEraser.addEventListener("click", () => {
    drawTool = "eraser";
    btnEraser.classList.add("active");
    btnPen.classList.remove("active");
  });
  drawCanvas.addEventListener("mousedown", drawStart);
  drawCanvas.addEventListener("mousemove", drawMove);
  drawCanvas.addEventListener("mouseup", drawEnd);
  drawCanvas.addEventListener("mouseleave", drawEnd);
  btnReady.addEventListener("click", finishDrawing);

  drawModal.addEventListener("click", (e) => {
    if (e.target === drawModal) closeDrawModal();
  });

  // ── Init ──

  async function init() {
    resizeCanvas();
    await loadConfig();
    userPoints = cfg.starting_points;
    pointsValue.textContent = userPoints;
    centerOnWorld();
    await loadFromServer();
    requestAnimationFrame(render);
  }

  init();
})();
