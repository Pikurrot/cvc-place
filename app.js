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
  const pointsDisplay = document.getElementById("pointsDisplay");
  const toastContainer = document.getElementById("toastContainer");
  const sliderCostLabel = document.getElementById("sliderCostLabel");
  const btnLogin = document.getElementById("btnLogin");
  const btnLogout = document.getElementById("btnLogout");
  const authModal = document.getElementById("authModal");
  const authTitle = document.getElementById("authTitle");
  const authUsername = document.getElementById("authUsername");
  const authPassword = document.getElementById("authPassword");
  const authRepeatPassword = document.getElementById("authRepeatPassword");
  const authRepeatGroup = document.getElementById("authRepeatGroup");
  const authRealName = document.getElementById("authRealName");
  const authRealNameGroup = document.getElementById("authRealNameGroup");
  const authPasswordHint = document.getElementById("authPasswordHint");
  const authSubmit = document.getElementById("authSubmit");
  const authSwitch = document.getElementById("authSwitch");
  const authClose = document.getElementById("authClose");
  const btnClear = document.getElementById("btnClear");
  const sizeSliderContainer = document.getElementById("sizeSliderContainer");
  const leaderboard = document.getElementById("leaderboard");
  const leaderboardBody = document.getElementById("leaderboardBody");
  const leaderboardHead = document.getElementById("leaderboardHead");
  const btnContributions = document.getElementById("btnContributions");
  const contribModal = document.getElementById("contribModal");
  const contribClose = document.getElementById("contribClose");
  const contribGallery = document.getElementById("contribGallery");
  const contribUploadModal = document.getElementById("contribUploadModal");
  const contribFileInput = document.getElementById("contribFileInput");
  const contribUrlInput = document.getElementById("contribUrlInput");
  const contribBtnLoadUrl = document.getElementById("contribBtnLoadUrl");
  const contribBtnDraw = document.getElementById("contribBtnDraw");
  const contribUploadCancel = document.getElementById("contribUploadCancel");
  const contribCostModal = document.getElementById("contribCostModal");
  const contribCostInput = document.getElementById("contribCostInput");
  const contribCostSubmit = document.getElementById("contribCostSubmit");
  const contribCostCancel = document.getElementById("contribCostCancel");
  const contribSliderModal = document.getElementById("contribSliderModal");
  const contribSlider = document.getElementById("contribSlider");
  const contribSliderInfo = document.getElementById("contribSliderInfo");
  const contribSliderSubmit = document.getElementById("contribSliderSubmit");
  const contribSliderCancel = document.getElementById("contribSliderCancel");
  const pendingNotice = document.getElementById("pendingNotice");
  const btnPending = document.getElementById("btnPending");
  const pendingModal = document.getElementById("pendingModal");
  const pendingClose = document.getElementById("pendingClose");
  const pendingList = document.getElementById("pendingList");
  const mobileTopBar = document.getElementById("mobileTopBar");
  const btnMenu = document.getElementById("btnMenu");
  const btnLeaderboard = document.getElementById("btnLeaderboard");
  const menuPanel = document.getElementById("menuPanel");
  const menuPanelBackdrop = document.getElementById("menuPanelBackdrop");
  const menuClose = document.getElementById("menuClose");
  const menuPointsRow = document.getElementById("menuPointsRow");
  const menuPointsValue = document.getElementById("menuPointsValue");
  const menuBtnLogin = document.getElementById("menuBtnLogin");
  const menuBtnLogout = document.getElementById("menuBtnLogout");
  const menuBtnUpload = document.getElementById("menuBtnUpload");
  const menuBtnDraw = document.getElementById("menuBtnDraw");
  const menuBtnContributions = document.getElementById("menuBtnContributions");
  const menuBtnClear = document.getElementById("menuBtnClear");
  const menuBtnPending = document.getElementById("menuBtnPending");
  const leaderboardModal = document.getElementById("leaderboardModal");
  const leaderboardModalClose = document.getElementById("leaderboardModalClose");
  const leaderboardBodyMobile = document.getElementById("leaderboardBodyMobile");
  const leaderboardHeadMobile = document.getElementById("leaderboardHeadMobile");
  const leaderboardTableMobile = document.getElementById("leaderboardTableMobile");
  const appVersion = document.getElementById("appVersion");

  const compactMq = window.matchMedia("(max-width: 768px)");

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
  let currentUser = null;
  let authMode = "login";

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

  // ── Admin selection state ──
  let adminSelected = null;
  let adminSelectBox = null;
  let adminDragging = false;
  let adminDragStartX = 0;
  let adminDragStartY = 0;
  let adminOrigX = 0;
  let adminOrigY = 0;
  let adminDragPointerId = null;

  let activeCanvasPointerId = null;
  let pinchBase = null;

  let sliderPointerId = null;

  let activeDrawPointerId = null;

  // ── Drawing state ──
  let drawTool = "pen";
  let isDrawing = false;
  let lastDrawX = 0;
  let lastDrawY = 0;

  // ── Contributions state ──
  let contribDrawMode = false;
  let contribPendingDataURL = "";
  let contribPlaceMode = false;
  let contribPlaceId = "";
  let contribPlaceFile = "";
  let contribPlaceW = 0;
  let contribPlaceH = 0;
  let contribSliderTarget = null;

  // ── Helpers ──

  function isAdmin() {
    return currentUser && currentUser.is_admin;
  }

  function isPendingUser() {
    return currentUser && !currentUser.is_admin && currentUser.approved === false;
  }

  function screenToCanvas(sx, sy) {
    return {
      x: (sx - offsetX) / scale,
      y: (sy - offsetY) / scale,
    };
  }

  function resizeCanvas() {
    // Match bitmap size to the canvas element's laid-out CSS size (not innerWidth/100vw),
    // so drawing + offset/scale stay aligned with #imagesLayer on mobile (iOS vw/vh vs layout).
    const w = Math.max(1, Math.round(canvas.clientWidth || window.innerWidth || 1));
    const h = Math.max(1, Math.round(canvas.clientHeight || window.innerHeight || 1));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      clampOffset();
    }
  }

  function clampOffset() {
    const margin = 200;
    const ws = cfg.world_size * scale;
    offsetX = Math.max(-ws + margin, Math.min(canvas.width - margin, offsetX));
    offsetY = Math.max(-ws + margin, Math.min(canvas.height - margin, offsetY));
  }

  function shouldAllowCanvasGestures() {
    if (mode === "drawing") return false;
    if (!drawModal.classList.contains("hidden")) return false;
    if (!authModal.classList.contains("hidden")) return false;
    if (!uploadModal.classList.contains("hidden")) return false;
    if (!contribModal.classList.contains("hidden")) return false;
    if (!contribUploadModal.classList.contains("hidden")) return false;
    if (!contribCostModal.classList.contains("hidden")) return false;
    if (!contribSliderModal.classList.contains("hidden")) return false;
    if (!pendingModal.classList.contains("hidden")) return false;
    if (leaderboardModal && !leaderboardModal.classList.contains("hidden")) return false;
    if (menuPanel && !menuPanel.classList.contains("hidden")) return false;
    return true;
  }

  function closeMenu() {
    if (menuPanel) menuPanel.classList.add("hidden");
  }

  function syncMobileChrome() {
    if (!mobileTopBar || !menuPanel) return;
    const compact = document.body.classList.contains("layout-compact");
    if (!compact) {
      mobileTopBar.classList.add("hidden");
      menuPanel.classList.add("hidden");
      if (leaderboardModal) leaderboardModal.classList.add("hidden");
      return;
    }

    const chromeHidden = mode === "edit" || mode === "drawing";
    if (chromeHidden) {
      mobileTopBar.classList.add("hidden");
      menuPanel.classList.add("hidden");
      if (leaderboardModal) leaderboardModal.classList.add("hidden");
      return;
    }

    mobileTopBar.classList.remove("hidden");

    menuBtnLogin.classList.toggle("hidden", btnLogin.classList.contains("hidden"));
    menuBtnLogout.classList.toggle("hidden", btnLogout.classList.contains("hidden"));
    menuBtnUpload.classList.toggle("hidden", document.getElementById("btnUpload").classList.contains("hidden"));
    menuBtnDraw.classList.toggle("hidden", document.getElementById("btnDraw").classList.contains("hidden"));
    menuBtnContributions.classList.toggle("hidden", btnContributions.classList.contains("hidden"));
    menuBtnClear.classList.toggle("hidden", btnClear.classList.contains("hidden"));
    menuBtnPending.classList.toggle("hidden", btnPending.classList.contains("hidden"));

    if (!pointsDisplay.classList.contains("hidden")) {
      menuPointsRow.classList.remove("hidden");
      menuPointsValue.textContent = pointsValue.textContent;
    } else {
      menuPointsRow.classList.add("hidden");
    }

    btnLeaderboard.classList.toggle("hidden", leaderboard.classList.contains("hidden"));
  }

  function applyCompactLayout() {
    document.body.classList.toggle("layout-compact", compactMq.matches);
    syncMobileChrome();
  }

  // ── Config loading ──

  function applyVersionLabel() {
    if (!appVersion) return;
    const v = cfg.version;
    if (v != null && String(v).length > 0) {
      appVersion.textContent = "v" + String(v);
    } else {
      appVersion.textContent = "";
    }
  }

  async function loadConfig() {
    try {
      const r = await fetch("/api/config");
      const data = await r.json();
      Object.assign(cfg, data);
    } catch (err) {
      console.error("Failed to load config, using defaults:", err);
    }
    applyVersionLabel();
  }

  // ── Auth UI ──

  function updateAuthUI() {
    pendingNotice.classList.add("hidden");
    btnPending.classList.add("hidden");

    if (currentUser) {
      btnLogin.classList.add("hidden");
      btnLogout.classList.remove("hidden");

      if (isPendingUser()) {
        pendingNotice.classList.remove("hidden");
        document.getElementById("btnUpload").classList.add("hidden");
        document.getElementById("btnDraw").classList.add("hidden");
        btnContributions.classList.add("hidden");
        btnClear.classList.add("hidden");
        pointsDisplay.classList.add("hidden");
        leaderboard.classList.add("hidden");
        syncMobileChrome();
        return;
      }

      document.getElementById("btnUpload").classList.remove("hidden");
      document.getElementById("btnDraw").classList.remove("hidden");
      btnContributions.classList.remove("hidden");
      pointsDisplay.classList.remove("hidden");
      leaderboard.classList.remove("hidden");

      if (isAdmin()) {
        pointsValue.textContent = "\u221E";
        btnClear.classList.remove("hidden");
        btnPending.classList.remove("hidden");
      } else {
        pointsValue.textContent = currentUser.points;
        btnClear.classList.add("hidden");
      }
    } else {
      btnLogin.classList.remove("hidden");
      btnLogout.classList.add("hidden");
      document.getElementById("btnUpload").classList.add("hidden");
      document.getElementById("btnDraw").classList.add("hidden");
      btnContributions.classList.add("hidden");
      btnClear.classList.add("hidden");
      pointsDisplay.classList.add("hidden");
      leaderboard.classList.remove("hidden");
    }
    syncMobileChrome();
  }

  async function restoreSession() {
    const saved = localStorage.getItem("cvc_username");
    if (!saved) return;
    try {
      const r = await fetch("/api/user?username=" + encodeURIComponent(saved));
      const data = await r.json();
      if (data.ok) {
        currentUser = {
          username: data.username,
          points: data.points,
          real_name: data.real_name,
          is_admin: !!data.is_admin,
          approved: data.approved !== false,
        };
      } else {
        localStorage.removeItem("cvc_username");
      }
    } catch (err) {
      localStorage.removeItem("cvc_username");
    }
  }

  // ── Persistence (server) ──

  function saveToServer(entry) {
    return fetch("/api/place", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: entry.data,
        x: entry.x,
        y: entry.y,
        w: entry.w,
        h: entry.h,
        username: currentUser ? currentUser.username : "",
      }),
    })
      .then((r) => r.json())
      .catch((err) => {
        console.error("Failed to save placement:", err);
        return null;
      });
  }

  function createPlacedImageEl(src, x, y, w, h, file, username) {
    const el = document.createElement("img");
    el.src = src;
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.width = w + "px";
    el.style.height = h + "px";
    imagesLayer.appendChild(el);
    placedImages.push({ el, x, y, w, h, file: file || "", username: username || "" });
  }

  async function loadFromServer() {
    try {
      const r = await fetch("/api/placements");
      const arr = await r.json();
      arr.forEach((entry) => {
        createPlacedImageEl("images/" + entry.file, entry.x, entry.y, entry.w, entry.h, entry.file, entry.username);
      });
    } catch (err) {
      console.error("Failed to load placements:", err);
    }
  }

  // ── Render Loop ──

  function render() {
    resizeCanvas();
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
    updateAdminSelectScale();
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

    if (contribPlaceMode) {
      editScale = contribPlaceW / img.naturalWidth;
    } else {
      sliderT = 0.47;
      editScale = sliderTToScale(sliderT);
      updateSliderVisuals();
      sliderCostLabel.style.display = "";
      sizeSliderContainer.classList.remove("hidden");
    }
    updateEditImageSize();
    toolbar.classList.add("hidden");
    leaderboard.classList.add("hidden");
    if (mobileTopBar) mobileTopBar.classList.add("hidden");
    closeMenu();
    if (leaderboardModal) leaderboardModal.classList.add("hidden");
    editUI.classList.remove("hidden");
    canvas.classList.add("edit-cursor");
    syncMobileChrome();
  }

  function exitEditMode() {
    const wasContribPlace = contribPlaceMode;
    mode = "spectate";
    editImg = null;
    editDataURL = "";
    editDragging = false;
    contribPlaceMode = false;

    sliderCostLabel.style.display = "none";
    editUI.classList.add("hidden");
    sizeSliderContainer.classList.add("hidden");
    toolbar.classList.remove("hidden");
    canvas.classList.remove("edit-cursor");

    if (wasContribPlace) {
      openContribModal();
    }
    updateAuthUI();
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

    if (editImg && currentUser) {
      const w = editImg.naturalWidth * editScale;
      const h = editImg.naturalHeight * editScale;
      const cost = computeCost(w, h);
      sliderCostLabel.textContent = cost;
      sliderCostLabel.style.bottom = "calc(" + sliderT * 100 + "%)";
      if (isAdmin()) {
        sliderCostLabel.style.color = "#333";
      } else if (cost > currentUser.points) {
        sliderCostLabel.style.color = "#c62828";
      } else if (cost >= currentUser.points * 0.7) {
        sliderCostLabel.style.color = "#b8860b";
      } else {
        sliderCostLabel.style.color = "#333";
      }
    }
  }

  function updateSliderFromClientY(clientY) {
    const rect = sliderTrack.getBoundingClientRect();
    const rawT = 1 - (clientY - rect.top) / rect.height;
    sliderT = Math.max(0, Math.min(1, rawT));
    editScale = sliderTToScale(sliderT);
    if (adminSelected !== null) {
      const img = placedImages[adminSelected];
      img.w = editImg.naturalWidth * editScale;
      img.h = editImg.naturalHeight * editScale;
      img.el.style.width = img.w + "px";
      img.el.style.height = img.h + "px";
      if (adminSelectBox) {
        adminSelectBox.style.width = img.w + "px";
        adminSelectBox.style.height = img.h + "px";
      }
    } else {
      updateEditImageSize();
    }
    updateSliderVisuals();
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

  function setLeaderboardPtsHeader(showPts, headEl) {
    if (!headEl) return;
    if (showPts) {
      if (!headEl.querySelector(".lb-pts")) {
        const th = document.createElement("span");
        th.className = "lb-pts";
        th.textContent = "Pts";
        headEl.appendChild(th);
      }
    } else {
      const existing = headEl.querySelector(".lb-pts");
      if (existing) existing.remove();
    }
  }

  function appendLeaderboardRow(container, entry, i, showPts) {
    const row = document.createElement("div");
    row.className = "lb-row";

    const rank = document.createElement("span");
    rank.className = "lb-rank";
    if (i < 3) {
      const badge = document.createElement("span");
      badge.className = "lb-rank-badge lb-rank-" + (i + 1);
      badge.textContent = i + 1;
      rank.appendChild(badge);
    } else {
      rank.textContent = i + 1;
    }
    row.appendChild(rank);

    const user = document.createElement("span");
    user.className = "lb-user";
    user.textContent = entry.username;
    row.appendChild(user);

    const total = document.createElement("span");
    total.className = "lb-total";
    total.textContent = entry.total_spent;
    row.appendChild(total);

    const imgs = document.createElement("span");
    imgs.className = "lb-imgs";
    imgs.textContent = entry.images;
    row.appendChild(imgs);

    if (showPts) {
      const pts = document.createElement("span");
      pts.className = "lb-pts";
      pts.textContent = entry.points;
      row.appendChild(pts);
    }

    container.appendChild(row);
  }

  async function refreshLeaderboard() {
    try {
      const r = await fetch("/api/leaderboard");
      const data = await r.json();
      leaderboardBody.innerHTML = "";
      if (leaderboardBodyMobile) leaderboardBodyMobile.innerHTML = "";

      const showPts = isAdmin();
      if (showPts) {
        leaderboard.classList.add("show-pts");
        if (leaderboardTableMobile) leaderboardTableMobile.classList.add("show-pts");
        setLeaderboardPtsHeader(true, leaderboardHead);
        setLeaderboardPtsHeader(true, leaderboardHeadMobile);
      } else {
        leaderboard.classList.remove("show-pts");
        if (leaderboardTableMobile) leaderboardTableMobile.classList.remove("show-pts");
        setLeaderboardPtsHeader(false, leaderboardHead);
        setLeaderboardPtsHeader(false, leaderboardHeadMobile);
      }

      data.forEach((entry, i) => {
        appendLeaderboardRow(leaderboardBody, entry, i, showPts);
        if (leaderboardBodyMobile) {
          appendLeaderboardRow(leaderboardBodyMobile, entry, i, showPts);
        }
      });
    } catch (err) {
      console.error("Failed to refresh leaderboard:", err);
    }
  }

  function sliderTToScale(t) {
    const minPx = cfg.min_image_pct * cfg.world_size;
    const maxPx = cfg.max_image_pct * cfg.world_size;
    const targetPx = minPx + t * (maxPx - minPx);
    const largestDim = Math.max(editImg.naturalWidth, editImg.naturalHeight);
    return targetPx / largestDim;
  }

  async function placeImage() {
    if (!editImg || !currentUser) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const pos = screenToCanvas(cx, cy);
    const w = editImg.naturalWidth * editScale;
    const h = editImg.naturalHeight * editScale;

    const x = pos.x - w / 2;
    const y = pos.y - h / 2;

    if (x < 0 || y < 0 || x + w > cfg.world_size || y + h > cfg.world_size) {
      showToast("Image is outside the canvas boundaries", "error");
      return;
    }

    if (contribPlaceMode) {
      try {
        const r = await fetch("/api/contributions/place", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: currentUser.username, id: contribPlaceId, x, y, w, h }),
        });
        const data = await r.json();
        if (!data.ok) {
          showToast(data.error || "Failed to place contribution", "error");
          return;
        }
        createPlacedImageEl("images/" + contribPlaceFile, x, y, w, h, contribPlaceFile, currentUser.username);
      } catch (err) {
        showToast("Failed to place contribution", "error");
        return;
      }
      contribPlaceMode = false;
      mode = "spectate";
      editImg = null;
      editDataURL = "";
      editDragging = false;
      editUI.classList.add("hidden");
      sizeSliderContainer.classList.add("hidden");
      toolbar.classList.remove("hidden");
      leaderboard.classList.remove("hidden");
      canvas.classList.remove("edit-cursor");
      refreshLeaderboard();
      syncMobileChrome();
      return;
    }

    const cost = computeCost(w, h);
    if (!isAdmin() && cost > currentUser.points) {
      showToast("Not enough points to place this image", "warning");
      return;
    }

    const result = await saveToServer({ data: editDataURL, x, y, w, h });
    if (!result || result.error) {
      showToast(result ? result.error : "Failed to place image", "error");
      return;
    }

    if (isAdmin()) {
      pointsValue.textContent = "\u221E";
    } else {
      currentUser.points = result.points;
      pointsValue.textContent = currentUser.points;
    }

    createPlacedImageEl(editDataURL, x, y, w, h, result.file, currentUser.username);
    exitEditMode();
    refreshLeaderboard();
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
    closeMenu();
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
      body: JSON.stringify({ url, username: currentUser ? currentUser.username : "" }),
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
    if (mobileTopBar) mobileTopBar.classList.add("hidden");
    closeMenu();
    if (leaderboardModal) leaderboardModal.classList.add("hidden");
    drawModal.classList.remove("hidden");

    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    syncMobileChrome();
  }

  function closeDrawModal() {
    drawModal.classList.add("hidden");
    if (!contribDrawMode) {
      toolbar.classList.remove("hidden");
    }
    mode = "spectate";
    syncMobileChrome();
  }

  function drawClientToCanvas(clientX, clientY) {
    const rect = drawCanvas.getBoundingClientRect();
    const w = rect.width || 1;
    const h = rect.height || 1;
    return {
      x: (clientX - rect.left) * (drawCanvas.width / w),
      y: (clientY - rect.top) * (drawCanvas.height / h),
    };
  }

  function drawStart(e) {
    isDrawing = true;
    const p = drawClientToCanvas(e.clientX, e.clientY);
    lastDrawX = p.x;
    lastDrawY = p.y;
  }

  function drawMove(e) {
    if (!isDrawing) return;
    const p = drawClientToCanvas(e.clientX, e.clientY);
    const x = p.x;
    const y = p.y;

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
    if (contribDrawMode) {
      contribDrawMode = false;
      contribPendingDataURL = dataURL;
      drawModal.classList.add("hidden");
      mode = "spectate";
      contribUploadModal.classList.add("hidden");
      contribCostInput.value = "";
      contribCostModal.classList.remove("hidden");
      syncMobileChrome();
      return;
    }
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

  // ── Auth Modal ──

  function openAuthModal() {
    closeMenu();
    authMode = "login";
    syncAuthMode();
    clearAuthFields();
    authModal.classList.remove("hidden");
  }

  function closeAuthModal() {
    authModal.classList.add("hidden");
    clearAuthFields();
  }

  function clearAuthFields() {
    authUsername.value = "";
    authPassword.value = "";
    authRepeatPassword.value = "";
    authRealName.value = "";
    authUsername.classList.remove("input-error");
    authPassword.classList.remove("input-error");
    authRepeatPassword.classList.remove("input-error");
  }

  function syncAuthMode() {
    if (authMode === "register") {
      authTitle.textContent = "Register";
      authSubmit.textContent = "Register";
      authSwitch.textContent = "or Login";
      authRepeatGroup.classList.remove("hidden");
      authRealNameGroup.classList.remove("hidden");
      authPasswordHint.classList.remove("hidden");
    } else {
      authTitle.textContent = "Login";
      authSubmit.textContent = "Login";
      authSwitch.textContent = "or Register";
      authRepeatGroup.classList.add("hidden");
      authRealNameGroup.classList.add("hidden");
      authPasswordHint.classList.add("hidden");
    }
  }

  function isAlphanumeric(str) {
    return /^[a-zA-Z0-9]+$/.test(str);
  }

  async function handleAuthSubmit() {
    if (authMode === "register") {
      const username = authUsername.value.trim();
      const password = authPassword.value;
      const repeat = authRepeatPassword.value;
      const realName = authRealName.value.trim();
      let valid = true;

      authUsername.classList.remove("input-error");
      authPassword.classList.remove("input-error");
      authRepeatPassword.classList.remove("input-error");

      if (!username) {
        authUsername.classList.add("input-error");
        showToast("Username is required", "error");
        valid = false;
      }
      if (password.length < 8) {
        authPassword.classList.add("input-error");
        if (valid) showToast("Password must be at least 8 characters", "error");
        valid = false;
      } else if (!isAlphanumeric(password)) {
        authPassword.classList.add("input-error");
        if (valid) showToast("Password must be alphanumeric only", "error");
        valid = false;
      }
      if (password !== repeat) {
        authRepeatPassword.classList.add("input-error");
        if (valid) showToast("Passwords do not match", "error");
        valid = false;
      }
      if (!valid) return;

      try {
        const r = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, repeat_password: repeat, real_name: realName }),
        });
        const data = await r.json();
        if (data.error) {
          if (data.field === "username") authUsername.classList.add("input-error");
          else if (data.field === "password") authPassword.classList.add("input-error");
          else if (data.field === "repeat_password") authRepeatPassword.classList.add("input-error");
          showToast(data.error, "error");
          return;
        }
        currentUser = {
          username: data.username,
          points: data.points,
          real_name: realName,
          is_admin: !!data.is_admin,
          approved: data.approved !== false,
        };
        localStorage.setItem("cvc_username", data.username);
        closeAuthModal();
        updateAuthUI();
        refreshLeaderboard();
        showToast("Welcome, " + data.username + "!", "info");
      } catch (err) {
        showToast("Registration failed", "error");
      }
    } else {
      const username = authUsername.value.trim();
      const password = authPassword.value;

      authUsername.classList.remove("input-error");
      authPassword.classList.remove("input-error");

      if (!username) {
        authUsername.classList.add("input-error");
        showToast("Username is required", "error");
        return;
      }

      try {
        const r = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await r.json();
        if (data.error) {
          if (data.field === "username") authUsername.classList.add("input-error");
          else if (data.field === "password") authPassword.classList.add("input-error");
          showToast(data.error, "error");
          return;
        }
        currentUser = {
          username: data.username,
          points: data.points,
          real_name: data.real_name,
          is_admin: !!data.is_admin,
          approved: data.approved !== false,
        };
        localStorage.setItem("cvc_username", data.username);
        closeAuthModal();
        updateAuthUI();
        refreshLeaderboard();
        showToast("Welcome back, " + data.username + "!", "info");
      } catch (err) {
        showToast("Login failed", "error");
      }
    }
  }

  function handleLogout() {
    if (!confirm("Are you sure you want to logout?")) return;
    closeMenu();
    adminDeselectImage();
    currentUser = null;
    localStorage.removeItem("cvc_username");
    updateAuthUI();
    refreshLeaderboard();
  }

  // ── Admin: pending user approvals ──

  async function openPendingModal() {
    closeMenu();
    pendingModal.classList.remove("hidden");
    await refreshPendingList();
  }

  function closePendingModal() {
    pendingModal.classList.add("hidden");
  }

  async function refreshPendingList() {
    if (!currentUser || !isAdmin()) return;
    try {
      const r = await fetch("/api/pending-users?username=" + encodeURIComponent(currentUser.username));
      const data = await r.json();
      pendingList.innerHTML = "";
      if (!Array.isArray(data)) {
        const p = document.createElement("p");
        p.className = "pending-empty";
        p.textContent = data.error || "Failed to load pending users.";
        pendingList.appendChild(p);
        return;
      }
      if (data.length === 0) {
        const p = document.createElement("p");
        p.className = "pending-empty";
        p.textContent = "No pending registrations.";
        pendingList.appendChild(p);
        return;
      }
      data.forEach((u) => {
        const row = document.createElement("div");
        row.className = "pending-row";
        const info = document.createElement("div");
        info.className = "pending-row-info";
        const uEl = document.createElement("div");
        uEl.className = "pending-row-user";
        uEl.textContent = u.username;
        const nEl = document.createElement("div");
        nEl.className = "pending-row-name";
        nEl.textContent = u.real_name || "(no name)";
        info.appendChild(uEl);
        info.appendChild(nEl);
        const btn = document.createElement("button");
        btn.className = "pending-accept";
        btn.textContent = "Accept";
        btn.addEventListener("click", async () => {
          try {
            const res = await fetch("/api/approve-user", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username: currentUser.username, target_username: u.username }),
            });
            const out = await res.json();
            if (!out.ok) {
              showToast(out.error || "Failed to approve", "error");
              return;
            }
            showToast("Accepted " + u.username, "info");
            await refreshPendingList();
          } catch (e) {
            showToast("Failed to approve", "error");
          }
        });
        row.appendChild(info);
        row.appendChild(btn);
        pendingList.appendChild(row);
      });
    } catch (e) {
      showToast("Failed to load pending users", "error");
    }
  }

  // ── Admin Selection System ──

  function adminSelectImage(index) {
    adminDeselectImage();
    adminSelected = index;
    const img = placedImages[index];

    const box = document.createElement("div");
    box.className = "admin-select-box";
    box.style.left = img.x + "px";
    box.style.top = img.y + "px";
    box.style.width = img.w + "px";
    box.style.height = img.h + "px";

    const label = document.createElement("span");
    label.className = "admin-select-username";
    label.textContent = img.username || "unknown";
    box.appendChild(label);

    const delBtn = document.createElement("button");
    delBtn.className = "admin-select-delete";
    delBtn.textContent = "\u00D7";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      adminDeleteSelected();
    });
    box.appendChild(delBtn);

    box.addEventListener("pointerdown", (e) => {
      if (e.target === delBtn) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      box.setPointerCapture(e.pointerId);
      adminDragging = true;
      adminDragPointerId = e.pointerId;
      adminDragStartX = e.clientX;
      adminDragStartY = e.clientY;
      adminOrigX = img.x;
      adminOrigY = img.y;
    });

    imagesLayer.appendChild(box);
    adminSelectBox = box;

    editImg = img.el;
    const largestDim = Math.max(editImg.naturalWidth, editImg.naturalHeight);
    const currentPx = Math.max(img.w, img.h);
    const minPx = cfg.min_image_pct * cfg.world_size;
    const maxPx = cfg.max_image_pct * cfg.world_size;
    sliderT = Math.max(0, Math.min(1, (currentPx - minPx) / (maxPx - minPx)));
    editScale = currentPx / largestDim;

    updateSliderVisuals();
    sliderCostLabel.style.display = "";
    sizeSliderContainer.classList.remove("hidden");
    updateAdminSelectScale();
  }

  function adminDeselectImage() {
    if (adminSelectBox) {
      adminSelectBox.remove();
      adminSelectBox = null;
    }
    adminSelected = null;
    adminDragging = false;
    adminDragPointerId = null;
    if (mode !== "edit") {
      sizeSliderContainer.classList.add("hidden");
      sliderCostLabel.style.display = "none";
      editImg = null;
    }
  }

  function updateAdminSelectScale() {
    if (!adminSelectBox) return;
    const inv = 1 / scale;
    adminSelectBox.style.borderWidth = (2 * inv) + "px";
    const label = adminSelectBox.querySelector(".admin-select-username");
    if (label) {
      label.style.transform = "translateX(-50%) scale(" + inv + ")";
      label.style.top = (-22 * inv) + "px";
    }
    const del = adminSelectBox.querySelector(".admin-select-delete");
    if (del) {
      del.style.transform = "scale(" + inv + ")";
      del.style.top = (-14 * inv) + "px";
      del.style.right = (-14 * inv) + "px";
    }
  }

  async function adminDeleteSelected() {
    if (adminSelected === null) return;
    const img = placedImages[adminSelected];
    try {
      const r = await fetch("/api/remove-placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: currentUser.username, file: img.file }),
      });
      const data = await r.json();
      if (!data.ok) {
        showToast(data.error || "Failed to delete image", "error");
        return;
      }
    } catch (err) {
      showToast("Failed to delete image", "error");
      return;
    }
    img.el.remove();
    placedImages.splice(adminSelected, 1);
    adminDeselectImage();
    showToast("Image removed", "info");
    refreshLeaderboard();
  }

  async function adminUpdatePlacement(img) {
    try {
      await fetch("/api/update-placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: currentUser.username,
          file: img.file,
          x: img.x, y: img.y, w: img.w, h: img.h,
        }),
      });
    } catch (err) {
      console.error("Failed to update placement:", err);
    }
  }

  async function adminClearAll() {
    closeMenu();
    if (!confirm("Remove ALL images from the canvas?")) return;
    try {
      const r = await fetch("/api/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: currentUser.username }),
      });
      const data = await r.json();
      if (!data.ok) {
        showToast(data.error || "Failed to clear canvas", "error");
        return;
      }
    } catch (err) {
      showToast("Failed to clear canvas", "error");
      return;
    }
    adminDeselectImage();
    placedImages.forEach((img) => img.el.remove());
    placedImages = [];
    showToast("Canvas cleared", "info");
    refreshLeaderboard();
  }

  // ── Contributions System ──

  async function openContribModal() {
    closeMenu();
    try {
      const r = await fetch("/api/contributions");
      const data = await r.json();
      renderContribGallery(data);
    } catch (err) {
      showToast("Failed to load contributions", "error");
      return;
    }
    contribModal.classList.remove("hidden");
  }

  function closeContribModal() {
    contribModal.classList.add("hidden");
  }

  function renderContribGallery(data) {
    contribGallery.innerHTML = "";

    const addCard = document.createElement("div");
    addCard.className = "contrib-add-card";
    addCard.innerHTML = "<span>+</span>";
    addCard.addEventListener("click", () => {
      contribPendingDataURL = "";
      contribFileInput.value = "";
      contribUrlInput.value = "";
      contribUploadModal.classList.remove("hidden");
    });
    contribGallery.appendChild(addCard);

    data.forEach((c) => {
      const card = document.createElement("div");
      card.className = "contrib-card";

      const img = document.createElement("img");
      img.src = "images/" + c.file;
      card.appendChild(img);

      if (isAdmin()) {
        const del = document.createElement("button");
        del.className = "contrib-card-delete";
        del.textContent = "\u00D7";
        del.addEventListener("click", async (e) => {
          e.stopPropagation();
          try {
            const r = await fetch("/api/contributions/remove", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username: currentUser.username, id: c.id }),
            });
            const res = await r.json();
            if (res.ok) {
              openContribModal();
            } else {
              showToast(res.error || "Failed to remove", "error");
            }
          } catch (err) {
            showToast("Failed to remove contribution", "error");
          }
        });
        card.appendChild(del);
      }

      const info = document.createElement("div");
      info.className = "contrib-card-info";

      const stats = document.createElement("div");
      stats.className = "contrib-card-stats";
      const ratio = c.target > 0 ? c.funded / c.target : 0;
      if (c.funded >= c.target) {
        stats.classList.add("fully-funded");
      } else if (ratio >= 0.75) {
        stats.classList.add("near-funded");
      }
      stats.innerHTML = "<span>" + c.funded + " / " + c.target + " pts</span>";
      info.appendChild(stats);

      const actions = document.createElement("div");
      actions.className = "contrib-card-actions";

      const contribBtn = document.createElement("button");
      contribBtn.className = "contrib-btn-contribute";
      contribBtn.textContent = "Contribute";
      if (c.funded >= c.target) {
        contribBtn.disabled = true;
        contribBtn.style.opacity = "0.4";
      }
      contribBtn.addEventListener("click", () => {
        openContribSlider(c);
      });
      actions.appendChild(contribBtn);

      const placeBtn = document.createElement("button");
      placeBtn.className = "contrib-btn-place" + (c.funded >= c.target ? " funded" : "");
      placeBtn.textContent = "Place";
      if (c.funded >= c.target) {
        placeBtn.addEventListener("click", () => {
          startContribPlace(c);
        });
      }
      actions.appendChild(placeBtn);

      info.appendChild(actions);
      card.appendChild(info);
      contribGallery.appendChild(card);
    });
  }

  function openContribSlider(contrib) {
    contribSliderTarget = contrib;
    const remaining = contrib.target - contrib.funded;
    let maxVal;
    if (isAdmin()) {
      maxVal = remaining;
    } else {
      maxVal = Math.min(currentUser.points, remaining);
    }
    contribSlider.min = 0;
    contribSlider.max = maxVal;
    contribSlider.value = 0;
    updateContribSliderInfo(contrib, 0);
    contribSliderModal.classList.remove("hidden");
  }

  function updateContribSliderInfo(contrib, val) {
    contribSliderInfo.innerHTML =
      "Contributed: <b>" + (contrib.funded + val) + "</b>, " +
      "Cost: <b>" + contrib.target + "</b>, " +
      "Remaining: <b>" + (contrib.target - contrib.funded - val) + "</b>";
  }

  async function submitContribution() {
    if (!contribSliderTarget || !currentUser) return;
    const amount = parseInt(contribSlider.value, 10);
    if (amount <= 0) {
      showToast("Choose a positive amount", "warning");
      return;
    }
    try {
      const r = await fetch("/api/contributions/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: currentUser.username, id: contribSliderTarget.id, amount }),
      });
      const data = await r.json();
      if (!data.ok) {
        showToast(data.error || "Contribution failed", "error");
        return;
      }
      if (data.points >= 0) {
        currentUser.points = data.points;
        pointsValue.textContent = currentUser.points;
      }
    } catch (err) {
      showToast("Contribution failed", "error");
      return;
    }
    contribSliderModal.classList.add("hidden");
    contribSliderTarget = null;
    openContribModal();
    refreshLeaderboard();
  }

  function startContribPlace(contrib) {
    closeContribModal();
    contribPlaceMode = true;
    contribPlaceId = contrib.id;
    contribPlaceFile = contrib.file;

    const area = contrib.target * cfg.points_area_divisor;
    const imgEl = new Image();
    imgEl.onload = () => {
      const natW = imgEl.naturalWidth;
      const natH = imgEl.naturalHeight;
      const scaleFactor = Math.sqrt(area / (natW * natH));
      contribPlaceW = natW * scaleFactor;
      contribPlaceH = natH * scaleFactor;
      enterEditMode(imgEl, "images/" + contrib.file);
    };
    imgEl.onerror = () => showToast("Failed to load contribution image", "error");
    imgEl.src = "images/" + contrib.file;
  }

  async function contribCreateFromData(dataURL, target) {
    if (!currentUser || !dataURL || target <= 0) return;
    try {
      const r = await fetch("/api/contributions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: currentUser.username, data: dataURL, target }),
      });
      const data = await r.json();
      if (!data.ok) {
        showToast(data.error || "Failed to create contribution", "error");
        return;
      }
    } catch (err) {
      showToast("Failed to create contribution", "error");
      return;
    }
    contribCostModal.classList.add("hidden");
    contribPendingDataURL = "";
    openContribModal();
  }

  function handleContribFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        contribPendingDataURL = ev.target.result;
        contribUploadModal.classList.add("hidden");
        contribCostInput.value = "";
        contribCostModal.classList.remove("hidden");
      };
      img.onerror = () => showToast("Failed to load image", "error");
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function handleContribUrlLoad() {
    const url = contribUrlInput.value.trim();
    if (!url) return;
    fetch("/api/proxy-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, username: currentUser ? currentUser.username : "" }),
    })
      .then((r) => r.json())
      .then((result) => {
        if (result.error) {
          showToast("Failed to fetch image: " + result.error, "error");
          return;
        }
        const img = new Image();
        img.onload = () => {
          contribPendingDataURL = result.dataUrl;
          contribUploadModal.classList.add("hidden");
          contribCostInput.value = "";
          contribCostModal.classList.remove("hidden");
        };
        img.onerror = () => showToast("Failed to load image", "error");
        img.src = result.dataUrl;
      })
      .catch(() => showToast("Failed to fetch image from URL", "error"));
  }

  // ── Event Wiring ──

  function handleAdminPointerEnd(e) {
    if (!adminDragging || adminSelected === null || e.pointerId !== adminDragPointerId) return;
    try {
      if (adminSelectBox && adminSelectBox.hasPointerCapture(e.pointerId)) {
        adminSelectBox.releasePointerCapture(e.pointerId);
      }
    } catch (err) { /* ignore */ }
    adminDragging = false;
    adminDragPointerId = null;
    adminUpdatePlacement(placedImages[adminSelected]);
  }

  function handleCanvasPointerEnd(e) {
    if (e.pointerId !== activeCanvasPointerId) return;
    try {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    } catch (err) { /* ignore */ }
    activeCanvasPointerId = null;
    if (mode === "spectate") endPan();
    else if (mode === "edit") editMouseUp();
  }

  window.addEventListener("resize", () => {
    resizeCanvas();
    applyCompactLayout();
  });
  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      resizeCanvas();
      applyCompactLayout();
      clampOffset();
    }, 200);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      resizeCanvas();
      clampOffset();
    });
  }
  if (typeof compactMq.addEventListener === "function") {
    compactMq.addEventListener("change", applyCompactLayout);
  } else if (typeof compactMq.addListener === "function") {
    compactMq.addListener(applyCompactLayout);
  }

  window.addEventListener("wheel", handleWheel, { passive: false });

  window.addEventListener("touchstart", (e) => {
    if (!shouldAllowCanvasGestures()) return;
    if (e.touches.length === 2) {
      if (activeCanvasPointerId !== null) {
        try {
          canvas.releasePointerCapture(activeCanvasPointerId);
        } catch (err) { /* ignore */ }
        activeCanvasPointerId = null;
        if (mode === "spectate") endPan();
        else if (mode === "edit") editMouseUp();
      }
      if (adminDragging && adminSelected !== null && adminDragPointerId !== null) {
        try {
          if (adminSelectBox) adminSelectBox.releasePointerCapture(adminDragPointerId);
        } catch (err2) { /* ignore */ }
        adminDragging = false;
        const idx = adminSelected;
        adminDragPointerId = null;
        adminUpdatePlacement(placedImages[idx]);
      }
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const d = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const cx = (t0.clientX + t1.clientX) / 2;
      const cy = (t0.clientY + t1.clientY) / 2;
      pinchBase = { d0: d, s0: scale, ox0: offsetX, oy0: offsetY, cx, cy };
      endPan();
      editMouseUp();
    }
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    if (!pinchBase || !shouldAllowCanvasGestures()) return;
    if (e.touches.length !== 2) return;
    e.preventDefault();
    const t0 = e.touches[0];
    const t1 = e.touches[1];
    const d = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
    const factor = d / pinchBase.d0;
    const newScale = Math.min(cfg.max_zoom, Math.max(cfg.min_zoom, pinchBase.s0 * factor));
    const ratio = newScale / pinchBase.s0;
    offsetX = pinchBase.cx - ratio * (pinchBase.cx - pinchBase.ox0);
    offsetY = pinchBase.cy - ratio * (pinchBase.cy - pinchBase.oy0);
    scale = newScale;
    clampOffset();
    updateEditImageSize();
    updateAdminSelectScale();
  }, { passive: false });

  window.addEventListener("touchend", (e) => {
    if (pinchBase && e.touches.length < 2) pinchBase = null;
  });
  window.addEventListener("touchcancel", () => { pinchBase = null; });

  canvas.addEventListener("pointerdown", (e) => {
    if (!shouldAllowCanvasGestures()) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    if (mode === "spectate") {
      if (isAdmin()) {
        const pt = screenToCanvas(e.clientX, e.clientY);
        let hit = -1;
        for (let i = placedImages.length - 1; i >= 0; i--) {
          const p = placedImages[i];
          if (pt.x >= p.x && pt.x <= p.x + p.w && pt.y >= p.y && pt.y <= p.y + p.h) {
            hit = i;
            break;
          }
        }
        if (hit >= 0) {
          adminSelectImage(hit);
          return;
        }
        adminDeselectImage();
      }
      activeCanvasPointerId = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      startPan(e);
    } else if (mode === "edit") {
      activeCanvasPointerId = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      editMouseDown(e);
    }
  });

  window.addEventListener("pointermove", (e) => {
    if (adminDragging && adminSelected !== null && e.pointerId === adminDragPointerId) {
      const dx = (e.clientX - adminDragStartX) / scale;
      const dy = (e.clientY - adminDragStartY) / scale;
      const img = placedImages[adminSelected];
      img.x = adminOrigX + dx;
      img.y = adminOrigY + dy;
      img.el.style.left = img.x + "px";
      img.el.style.top = img.y + "px";
      if (adminSelectBox) {
        adminSelectBox.style.left = img.x + "px";
        adminSelectBox.style.top = img.y + "px";
      }
      return;
    }
    if (activeCanvasPointerId === null || e.pointerId !== activeCanvasPointerId) return;
    if (sliderDragging) return;
    if (mode === "spectate") movePan(e);
    else if (mode === "edit") editMouseMove(e);
  });

  window.addEventListener("pointerup", (e) => {
    handleAdminPointerEnd(e);
    handleCanvasPointerEnd(e);
  });
  window.addEventListener("pointercancel", (e) => {
    handleAdminPointerEnd(e);
    handleCanvasPointerEnd(e);
  });

  document.getElementById("btnUpload").addEventListener("click", openUploadModal);
  document.getElementById("btnDraw").addEventListener("click", openDrawModal);
  btnClear.addEventListener("click", adminClearAll);
  btnPending.addEventListener("click", openPendingModal);
  pendingClose.addEventListener("click", closePendingModal);
  pendingModal.addEventListener("click", (e) => {
    if (e.target === pendingModal) closePendingModal();
  });

  if (btnMenu && menuPanel) {
    btnMenu.addEventListener("click", () => {
      menuPanel.classList.toggle("hidden");
    });
  }
  if (menuClose) menuClose.addEventListener("click", closeMenu);
  if (menuPanelBackdrop) menuPanelBackdrop.addEventListener("click", closeMenu);

  if (menuBtnLogin) menuBtnLogin.addEventListener("click", openAuthModal);
  if (menuBtnLogout) menuBtnLogout.addEventListener("click", handleLogout);
  if (menuBtnUpload) menuBtnUpload.addEventListener("click", openUploadModal);
  if (menuBtnDraw) menuBtnDraw.addEventListener("click", openDrawModal);
  if (menuBtnContributions) menuBtnContributions.addEventListener("click", openContribModal);
  if (menuBtnClear) menuBtnClear.addEventListener("click", adminClearAll);
  if (menuBtnPending) menuBtnPending.addEventListener("click", openPendingModal);

  if (btnLeaderboard && leaderboardModal) {
    btnLeaderboard.addEventListener("click", () => {
      closeMenu();
      leaderboardModal.classList.toggle("hidden");
    });
  }
  if (leaderboardModalClose && leaderboardModal) {
    leaderboardModalClose.addEventListener("click", () => leaderboardModal.classList.add("hidden"));
  }
  if (leaderboardModal) {
    leaderboardModal.addEventListener("click", (e) => {
      if (e.target === leaderboardModal) leaderboardModal.classList.add("hidden");
    });
  }

  fileInput.addEventListener("change", handleFileUpload);
  btnLoadUrl.addEventListener("click", handleUrlLoad);
  urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleUrlLoad();
  });
  btnCloseUpload.addEventListener("click", closeUploadModal);
  uploadModal.addEventListener("click", (e) => {
    if (e.target === uploadModal) closeUploadModal();
  });

  function endSliderPointer(e) {
    if (e.pointerId !== sliderPointerId) return;
    if (sliderDragging && adminSelected !== null) {
      adminUpdatePlacement(placedImages[adminSelected]);
    }
    try {
      if (sliderThumb.hasPointerCapture(e.pointerId)) sliderThumb.releasePointerCapture(e.pointerId);
    } catch (err) { /* ignore */ }
    try {
      if (sliderTrack.hasPointerCapture(e.pointerId)) sliderTrack.releasePointerCapture(e.pointerId);
    } catch (err2) { /* ignore */ }
    sliderPointerId = null;
    sliderDragging = false;
  }

  sliderThumb.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    sliderPointerId = e.pointerId;
    sliderThumb.setPointerCapture(e.pointerId);
    sliderDragging = true;
  });
  sliderThumb.addEventListener("pointermove", (e) => {
    if (e.pointerId !== sliderPointerId) return;
    updateSliderFromClientY(e.clientY);
  });
  sliderThumb.addEventListener("pointerup", endSliderPointer);
  sliderThumb.addEventListener("pointercancel", endSliderPointer);

  sliderTrack.addEventListener("pointerdown", (e) => {
    if (e.target === sliderThumb) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    updateSliderFromClientY(e.clientY);
    sliderPointerId = e.pointerId;
    sliderTrack.setPointerCapture(e.pointerId);
    sliderDragging = true;
  });
  sliderTrack.addEventListener("pointermove", (e) => {
    if (e.pointerId !== sliderPointerId) return;
    updateSliderFromClientY(e.clientY);
  });
  sliderTrack.addEventListener("pointerup", endSliderPointer);
  sliderTrack.addEventListener("pointercancel", endSliderPointer);
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
  function drawPointerDown(e) {
    if (activeDrawPointerId !== null) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    activeDrawPointerId = e.pointerId;
    drawCanvas.setPointerCapture(e.pointerId);
    drawStart(e);
  }
  function drawPointerMove(e) {
    if (e.pointerId !== activeDrawPointerId) return;
    drawMove(e);
  }
  function drawPointerEnd(e) {
    if (e.pointerId !== activeDrawPointerId) return;
    try {
      if (drawCanvas.hasPointerCapture(e.pointerId)) drawCanvas.releasePointerCapture(e.pointerId);
    } catch (err) { /* ignore */ }
    activeDrawPointerId = null;
    drawEnd();
  }
  drawCanvas.addEventListener("pointerdown", drawPointerDown);
  drawCanvas.addEventListener("pointermove", drawPointerMove);
  drawCanvas.addEventListener("pointerup", drawPointerEnd);
  drawCanvas.addEventListener("pointercancel", drawPointerEnd);
  btnReady.addEventListener("click", finishDrawing);

  drawModal.addEventListener("click", (e) => {
    if (e.target === drawModal) closeDrawModal();
  });

  // Auth events
  btnLogin.addEventListener("click", openAuthModal);
  btnLogout.addEventListener("click", handleLogout);
  authClose.addEventListener("click", closeAuthModal);
  authModal.addEventListener("click", (e) => {
    if (e.target === authModal) closeAuthModal();
  });
  authSwitch.addEventListener("click", () => {
    authMode = authMode === "login" ? "register" : "login";
    syncAuthMode();
    clearAuthFields();
  });
  authSubmit.addEventListener("click", handleAuthSubmit);
  authUsername.addEventListener("keydown", (e) => { if (e.key === "Enter") handleAuthSubmit(); });
  authPassword.addEventListener("keydown", (e) => { if (e.key === "Enter") handleAuthSubmit(); });
  authRepeatPassword.addEventListener("keydown", (e) => { if (e.key === "Enter") handleAuthSubmit(); });

  // Inline validation for register mode
  authPassword.addEventListener("input", () => {
    if (authMode !== "register") return;
    const v = authPassword.value;
    if (v && (v.length < 8 || !isAlphanumeric(v))) {
      authPassword.classList.add("input-error");
    } else {
      authPassword.classList.remove("input-error");
    }
  });
  authUsername.addEventListener("input", () => {
    authUsername.classList.remove("input-error");
  });
  authRepeatPassword.addEventListener("input", () => {
    if (authRepeatPassword.value && authRepeatPassword.value !== authPassword.value) {
      authRepeatPassword.classList.add("input-error");
    } else {
      authRepeatPassword.classList.remove("input-error");
    }
  });

  // Contributions events
  btnContributions.addEventListener("click", openContribModal);
  contribClose.addEventListener("click", closeContribModal);
  contribModal.addEventListener("click", (e) => {
    if (e.target === contribModal) closeContribModal();
  });

  contribFileInput.addEventListener("change", handleContribFileUpload);
  contribBtnLoadUrl.addEventListener("click", handleContribUrlLoad);
  contribUrlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleContribUrlLoad();
  });
  contribBtnDraw.addEventListener("click", () => {
    contribDrawMode = true;
    contribUploadModal.classList.add("hidden");
    openDrawModal();
  });
  contribUploadCancel.addEventListener("click", () => {
    contribUploadModal.classList.add("hidden");
  });

  contribCostSubmit.addEventListener("click", () => {
    const target = parseInt(contribCostInput.value, 10);
    if (!target || target <= 0) {
      showToast("Enter a valid positive number", "warning");
      return;
    }
    contribCreateFromData(contribPendingDataURL, target);
  });
  contribCostCancel.addEventListener("click", () => {
    contribCostModal.classList.add("hidden");
    contribPendingDataURL = "";
  });

  contribSlider.addEventListener("input", () => {
    if (contribSliderTarget) {
      updateContribSliderInfo(contribSliderTarget, parseInt(contribSlider.value, 10) || 0);
    }
  });
  contribSliderSubmit.addEventListener("click", submitContribution);
  contribSliderCancel.addEventListener("click", () => {
    contribSliderModal.classList.add("hidden");
    contribSliderTarget = null;
  });

  // ── Init ──

  async function init() {
    resizeCanvas();
    applyCompactLayout();
    await loadConfig();
    await restoreSession();
    updateAuthUI();
    centerOnWorld();
    await loadFromServer();
    await refreshLeaderboard();
    requestAnimationFrame(render);
  }

  init();
})();
