// House Color Visualizer — main viewer.
// Depends on: data/sw-colors.js (window.SW_COLORS, window.SW_GROUPS),
//             data/sw-colors-full.js (window.SW_COLORS_FULL, full SW dump),
//             data/masks.default.js (window.DEFAULT_MASKS),
//             mask-editor.js (window.MaskEditor).
(function () {
  "use strict";

  const SURFACES = ["siding", "trim", "stucco"];
  const SVG_NS = "http://www.w3.org/2000/svg";
  const LS_MASKS = "hv:masks";
  const LS_SEL   = "hv:selections";
  const LS_COMBOS = "hv:combos";
  const LS_ALBEDOS = "hv:albedos";
  const LS_ALGORITHM = "hv:algorithm";

  const ALGO_ALBEDO = "albedo";
  const ALGO_LEGACY = "legacy";

  // Lower bound per channel before dividing src/albedo — guards against
  // blow-up from a near-black albedo sample.
  const ALBEDO_FLOOR = 0.04;
  const SAMPLE_RADIUS = 2; // 5x5 block for eyedropper averaging

  function defaultAlbedos() {
    const out = {};
    for (const s of SURFACES) out[s] = { auto: null, manual: null };
    return out;
  }

  // ---------- State ----------
  const state = {
    activeSurface: "siding",
    selections: {
      siding: { hex: null, name: null, code: null, exposure: 1.0 },
      trim:   { hex: null, name: null, code: null, exposure: 1.0 },
      stucco: { hex: null, name: null, code: null, exposure: 1.0 },
    },
    masks: loadJSON(LS_MASKS, window.DEFAULT_MASKS),
    combos: loadJSON(LS_COMBOS, []),
    albedos: loadJSON(LS_ALBEDOS, defaultAlbedos()),
    algorithm: loadJSON(LS_ALGORITHM, ALGO_ALBEDO),
    image: { width: 0, height: 0, loaded: false },
    baseImageData: null,   // ImageData of house.jpg at natural resolution
    surfaceMasks: {},      // { siding: Uint8Array, trim: …, stucco: … }
    sampling: null,        // { surface } while eyedropper armed
  };

  // Restore selections from localStorage on top of defaults.
  const savedSel = loadJSON(LS_SEL, null);
  if (savedSel) {
    for (const s of SURFACES) {
      if (savedSel[s]) Object.assign(state.selections[s], savedSel[s]);
    }
  }
  // Repair albedo shape if stored from an older build.
  for (const s of SURFACES) {
    if (!state.albedos[s]) state.albedos[s] = { auto: null, manual: null };
  }
  if (state.algorithm !== ALGO_ALBEDO && state.algorithm !== ALGO_LEGACY) {
    state.algorithm = ALGO_ALBEDO;
  }

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const stage = $("stage");
  const photoNote = $("photo-note");
  const taintNote = $("taint-note");

  // ---------- Helpers ----------
  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : structuredClone(fallback);
    } catch (e) {
      return structuredClone(fallback);
    }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function hexToRgb01(hex) {
    const h = hex.replace("#", "");
    const n = parseInt(h, 16);
    return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
  }
  function rgb01ToHex(rgb) {
    const c = (v) => {
      const n = Math.max(0, Math.min(255, Math.round(v * 255)));
      return n.toString(16).padStart(2, "0");
    };
    return "#" + c(rgb[0]) + c(rgb[1]) + c(rgb[2]);
  }

  // ---------- Image loading ----------
  function loadBaseImage() {
    const probe = new Image();
    probe.onload = () => {
      state.image = { width: probe.naturalWidth, height: probe.naturalHeight, loaded: true };
      // Cache pixel data once so albedo + re-render loops don't re-decode.
      try {
        const c = document.createElement("canvas");
        c.width = probe.naturalWidth;
        c.height = probe.naturalHeight;
        const g = c.getContext("2d", { willReadFrequently: true });
        g.drawImage(probe, 0, 0);
        state.baseImageData = g.getImageData(0, 0, c.width, c.height);
      } catch (e) {
        console.error("Could not read image pixels (canvas tainted?):", e);
        if (taintNote) taintNote.hidden = false;
        return;
      }
      setupStage();
      renderMasks();
      rebuildSurfaceMasks();
      autoComputeAllAlbedos();
      renderAlbedoRows();
      applyAllSelections();
    };
    probe.onerror = () => {
      photoNote.hidden = false;
    };
    probe.src = "house.jpg";
  }

  function setupStage() {
    const { width, height } = state.image;
    stage.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const imgs = stage.querySelectorAll("image");
    imgs.forEach(img => {
      img.setAttribute("width", width);
      img.setAttribute("height", height);
      const href = img.getAttribute("href");
      if (href) img.setAttribute("href", href);
    });
  }

  // ---------- Masks -> clipPaths ----------
  function renderMasks() {
    for (const surface of SURFACES) {
      const clip = $("clip-" + surface);
      clip.textContent = "";
      const polys = state.masks[surface] || [];
      for (const pts of polys) {
        if (!pts || pts.length < 3) continue;
        const poly = document.createElementNS(SVG_NS, "polygon");
        poly.setAttribute("points", pts.map(p => `${p[0]},${p[1]}`).join(" "));
        clip.appendChild(poly);
      }
    }
  }

  function persistMasks() {
    saveJSON(LS_MASKS, state.masks);
  }

  // ---------- Surface masks (bitmap) ----------
  // Rasterize each surface's polygons to a Uint8Array over the base image —
  // 1 = pixel belongs to this surface, 0 = doesn't. Used both for albedo
  // auto-compute and the per-surface recolor pass so we only touch the
  // pixels that matter.
  function rasterizeSurfaceMask(surface) {
    if (!state.image.loaded) return null;
    const { width, height } = state.image;
    const polys = state.masks[surface] || [];
    const mask = new Uint8Array(width * height);
    if (!polys.length) return mask;

    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    const g = c.getContext("2d");
    g.fillStyle = "#fff";
    for (const pts of polys) {
      if (!pts || pts.length < 3) continue;
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.closePath();
      g.fill();
    }
    const d = g.getImageData(0, 0, width, height).data;
    for (let i = 0, j = 0; j < mask.length; i += 4, j++) {
      if (d[i + 3] > 0) mask[j] = 1;
    }
    return mask;
  }

  function rebuildSurfaceMasks() {
    for (const s of SURFACES) state.surfaceMasks[s] = rasterizeSurfaceMask(s);
  }

  // ---------- Albedo auto-compute ----------
  // Per-channel 95th-percentile via histogram: O(N) over the mask pixels, no
  // sort. Using a high percentile (rather than the median) anchors albedo near
  // the brightest diffuse reading on the surface, so `src/albedo` stays in
  // [0,1] across the whole surface without clamping — the 95th (vs 99th/max)
  // trims specular highlights and stray bright outliers.
  const ALBEDO_PERCENTILE = 0.95;
  function computeAutoAlbedo(surface) {
    if (!state.baseImageData || !state.surfaceMasks[surface]) return null;
    const src = state.baseImageData.data;
    const mask = state.surfaceMasks[surface];
    const histR = new Uint32Array(256);
    const histG = new Uint32Array(256);
    const histB = new Uint32Array(256);
    let n = 0;
    for (let j = 0, i = 0; j < mask.length; j++, i += 4) {
      if (!mask[j]) continue;
      histR[src[i]]++;
      histG[src[i + 1]]++;
      histB[src[i + 2]]++;
      n++;
    }
    if (!n) return null;
    return [
      percentileFromHist(histR, n, ALBEDO_PERCENTILE),
      percentileFromHist(histG, n, ALBEDO_PERCENTILE),
      percentileFromHist(histB, n, ALBEDO_PERCENTILE),
    ];
  }
  function percentileFromHist(hist, n, p) {
    const target = n * p;
    let count = 0;
    for (let v = 0; v < 256; v++) {
      count += hist[v];
      if (count >= target) return v / 255;
    }
    return 1;
  }

  function autoComputeAllAlbedos() {
    for (const s of SURFACES) {
      const a = computeAutoAlbedo(s);
      state.albedos[s].auto = a;
    }
    saveJSON(LS_ALBEDOS, state.albedos);
  }

  function effectiveAlbedo(surface) {
    const a = state.albedos[surface];
    return a.manual || a.auto || null;
  }

  // ---------- Per-surface canvas render ----------
  // Offscreen canvases, one per surface, reused between renders.
  const renderCanvases = {};
  const renderGen = { siding: 0, trim: 0, stucco: 0 };
  let rafId = null;
  const pendingRender = new Set();

  function scheduleRender(surface) {
    if (surface) pendingRender.add(surface);
    else for (const s of SURFACES) pendingRender.add(s);
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      const todo = [...pendingRender];
      pendingRender.clear();
      for (const s of todo) renderSurface(s);
    });
  }

  function renderSurface(surface) {
    const sel = state.selections[surface];
    const imgEl = $("recolor-" + surface);
    const layer = $("layer-" + surface);
    if (!imgEl || !layer) return;

    if (!sel.hex || !state.baseImageData) {
      layer.style.display = "none";
      return;
    }
    const mask = state.surfaceMasks[surface];
    if (!mask || !mask.length) {
      layer.style.display = "none";
      return;
    }
    const useAlbedo = state.algorithm === ALGO_ALBEDO;
    const albedo = useAlbedo ? effectiveAlbedo(surface) : null;
    if (useAlbedo && !albedo) {
      // Albedo algorithm selected but nothing to divide out yet.
      layer.style.display = "none";
      return;
    }
    layer.style.display = "";

    const { width, height } = state.image;
    const [tR, tG, tB] = hexToRgb01(sel.hex);
    const exposure = sel.exposure || 1.0;
    const a0 = useAlbedo ? Math.max(ALBEDO_FLOOR, albedo[0]) : 1;
    const a1 = useAlbedo ? Math.max(ALBEDO_FLOOR, albedo[1]) : 1;
    const a2 = useAlbedo ? Math.max(ALBEDO_FLOOR, albedo[2]) : 1;
    const src = state.baseImageData.data;

    let c = renderCanvases[surface];
    if (!c) {
      c = document.createElement("canvas");
      renderCanvases[surface] = c;
    }
    if (c.width !== width || c.height !== height) {
      c.width = width;
      c.height = height;
    }
    const g = c.getContext("2d");
    // Start from a transparent canvas so pixels outside the mask stay clear
    // (the SVG clip-path also clips them, but belt+suspenders keeps output
    // small and lets us drop the clip-path later if we ever want to).
    const out = g.createImageData(width, height);
    const dst = out.data;
    if (useAlbedo) {
      for (let j = 0, i = 0; j < mask.length; j++, i += 4) {
        if (!mask[j]) continue;
        const ilR = Math.min(1, (src[i]     / 255) / a0);
        const ilG = Math.min(1, (src[i + 1] / 255) / a1);
        const ilB = Math.min(1, (src[i + 2] / 255) / a2);
        let r = ilR * tR * exposure * 255;
        let gv = ilG * tG * exposure * 255;
        let b = ilB * tB * exposure * 255;
        if (r > 255) r = 255;
        if (gv > 255) gv = 255;
        if (b > 255) b = 255;
        dst[i]     = r;
        dst[i + 1] = gv;
        dst[i + 2] = b;
        dst[i + 3] = 255;
      }
    } else {
      // Legacy luma-tint: out = luma(src) * target * exposure.
      // Rec.709 weights, same as the original SVG feColorMatrix filter.
      for (let j = 0, i = 0; j < mask.length; j++, i += 4) {
        if (!mask[j]) continue;
        const y = (0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2]) / 255;
        let r = y * tR * exposure * 255;
        let gv = y * tG * exposure * 255;
        let b = y * tB * exposure * 255;
        if (r > 255) r = 255;
        if (gv > 255) gv = 255;
        if (b > 255) b = 255;
        dst[i]     = r;
        dst[i + 1] = gv;
        dst[i + 2] = b;
        dst[i + 3] = 255;
      }
    }
    g.putImageData(out, 0, 0);

    const gen = ++renderGen[surface];
    c.toBlob((blob) => {
      if (!blob) return;
      if (gen !== renderGen[surface]) return; // stale — newer render queued
      const url = URL.createObjectURL(blob);
      const prev = imgEl.dataset.blobUrl;
      imgEl.dataset.blobUrl = url;
      imgEl.setAttribute("href", url);
      if (prev) URL.revokeObjectURL(prev);
    }, "image/png");
  }

  function applyAllSelections() {
    for (const s of SURFACES) scheduleRender(s);
    updateSurfaceSwatches();
    updateSelectionReadout();
  }

  // ---------- UI: surface tabs ----------
  function setActiveSurface(surface) {
    state.activeSurface = surface;
    document.querySelectorAll("#surface-tabs .surface-tab").forEach(b => {
      b.classList.toggle("is-active", b.dataset.surface === surface);
    });
    updateSelectionReadout();
    markSelectedSwatch();
  }

  function updateSurfaceSwatches() {
    for (const s of SURFACES) {
      const node = $("swatch-" + s);
      const hex = state.selections[s].hex;
      if (node) node.style.background = hex || "#bbb";
    }
  }

  function updateSelectionReadout() {
    const sel = state.selections[state.activeSurface];
    const swatch = $("big-swatch");
    swatch.style.background = sel.hex || "#eee";
    $("sel-name").textContent = sel.name || "— no color selected —";
    $("sel-code").textContent = sel.code || " ";
    const exp = $("exposure");
    const expVal = $("exposure-val");
    exp.value = sel.exposure || 1.0;
    expVal.textContent = (sel.exposure || 1.0).toFixed(2);
  }

  // ---------- UI: palette ----------
  function createSwatch(color) {
    const el = document.createElement("button");
    el.className = "swatch";
    el.type = "button";
    el.style.background = color.hex;
    el.dataset.hex = color.hex;
    el.dataset.name = color.name;
    el.dataset.code = color.code;
    el.setAttribute("aria-label", `${color.name} ${color.code}`);
    el.dataset.tip = `${color.name} · ${color.code}`;
    el.addEventListener("click", () => pickColor(color));
    return el;
  }

  function buildPalette() {
    const container = $("palette");
    container.textContent = "";
    const byGroup = new Map();
    for (const c of window.SW_COLORS) {
      if (!byGroup.has(c.group)) byGroup.set(c.group, []);
      byGroup.get(c.group).push(c);
    }
    const ordered = window.SW_GROUPS.filter(g => byGroup.has(g));
    for (const group of ordered) {
      const section = document.createElement("div");
      section.className = "palette-group";
      const title = document.createElement("div");
      title.className = "palette-group-title";
      title.textContent = group;
      section.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "swatch-grid";
      for (const color of byGroup.get(group)) {
        grid.appendChild(createSwatch(color));
      }
      section.appendChild(grid);
      container.appendChild(section);
    }
    ensureSwatchTooltip(container);
    ensureSwatchTooltip($("palette-full"));
  }

  function ensureSwatchTooltip(container) {
    let tip = document.getElementById("swatch-tooltip");
    if (!tip) {
      tip = document.createElement("div");
      tip.id = "swatch-tooltip";
      tip.className = "swatch-tooltip";
      tip.hidden = true;
      document.body.appendChild(tip);
    }
    if (container.dataset.tooltipBound === "1") return;
    container.dataset.tooltipBound = "1";
    const show = (swatch) => {
      tip.textContent = swatch.dataset.tip || "";
      tip.hidden = false;
      const r = swatch.getBoundingClientRect();
      let x = r.left + r.width / 2;
      let y = r.top - 6;
      tip.style.left = x + "px";
      tip.style.top = y + "px";
      const tr = tip.getBoundingClientRect();
      const margin = 4;
      if (tr.left < margin) {
        tip.style.left = (x + (margin - tr.left)) + "px";
      } else if (tr.right > window.innerWidth - margin) {
        tip.style.left = (x - (tr.right - (window.innerWidth - margin))) + "px";
      }
      if (tr.top < margin) {
        tip.style.top = (r.bottom + 6 + tr.height) + "px";
      }
    };
    const hide = () => { tip.hidden = true; };
    container.addEventListener("pointerover", (e) => {
      const s = e.target.closest(".swatch");
      if (s && container.contains(s)) show(s);
    });
    container.addEventListener("pointerout", (e) => {
      const s = e.target.closest(".swatch");
      if (s && (!e.relatedTarget || !s.contains(e.relatedTarget))) hide();
    });
    container.addEventListener("scroll", hide, true);
  }

  function pickColor(color) {
    const s = state.activeSurface;
    state.selections[s].hex = color.hex;
    state.selections[s].name = color.name;
    state.selections[s].code = color.code;
    saveJSON(LS_SEL, state.selections);
    scheduleRender(s);
    updateSurfaceSwatches();
    updateSelectionReadout();
    markSelectedSwatch();
  }

  function markSelectedSwatch() {
    const hex = state.selections[state.activeSurface].hex;
    document.querySelectorAll(".swatch").forEach(el => {
      el.classList.toggle("is-selected", !!hex && el.dataset.hex === hex);
    });
  }

  // ---------- UI: search ----------
  const FULL_CATALOG_LIMIT = 60;

  function normalizeCodeQuery(q) {
    return q.replace(/\s+/g, "").replace(/^sw/i, "").toLowerCase();
  }

  function curatedCodeSet() {
    const s = new Set();
    for (const c of window.SW_COLORS) s.add(c.code.toUpperCase());
    return s;
  }

  function renderFullCatalogMatches(q) {
    const container = $("palette-full");
    container.textContent = "";
    if (!q || !Array.isArray(window.SW_COLORS_FULL)) {
      container.hidden = true;
      return;
    }

    const curated = curatedCodeSet();
    const codeQ = normalizeCodeQuery(q);
    const nameQ = q.toLowerCase();
    const matches = [];
    for (const c of window.SW_COLORS_FULL) {
      if (curated.has(c.code.toUpperCase())) continue;
      const codeDigits = c.code.replace(/^SW/i, "").toLowerCase();
      const nameHit = c.name.toLowerCase().includes(nameQ);
      const codeHit = codeQ && codeDigits.includes(codeQ);
      if (nameHit || codeHit) matches.push(c);
    }

    if (!matches.length) {
      container.hidden = true;
      return;
    }

    const section = document.createElement("div");
    section.className = "palette-group";
    const title = document.createElement("div");
    title.className = "palette-group-title";
    const total = matches.length;
    const shown = Math.min(total, FULL_CATALOG_LIMIT);
    title.textContent = total > FULL_CATALOG_LIMIT
      ? `All SW colors (showing ${shown} of ${total} — refine search)`
      : `All SW colors (${total})`;
    section.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "swatch-grid";
    for (let i = 0; i < shown; i++) grid.appendChild(createSwatch(matches[i]));
    section.appendChild(grid);
    container.appendChild(section);
    container.hidden = false;
    markSelectedSwatch();
  }

  function wireSearch() {
    const input = $("color-search");
    input.addEventListener("input", () => {
      const q = input.value.trim();
      const qLower = q.toLowerCase();
      document.querySelectorAll("#palette .palette-group").forEach(section => {
        let visible = 0;
        section.querySelectorAll(".swatch").forEach(el => {
          const hit = !q
            || el.dataset.name.toLowerCase().includes(qLower)
            || el.dataset.code.toLowerCase().includes(qLower);
          el.style.display = hit ? "" : "none";
          if (hit) visible++;
        });
        section.style.display = visible ? "" : "none";
      });
      renderFullCatalogMatches(q);
    });
  }

  // ---------- UI: exposure ----------
  function wireExposure() {
    const exp = $("exposure");
    const val = $("exposure-val");
    exp.addEventListener("input", () => {
      const s = state.activeSurface;
      const v = parseFloat(exp.value);
      state.selections[s].exposure = v;
      val.textContent = v.toFixed(2);
      saveJSON(LS_SEL, state.selections);
      scheduleRender(s);
    });
  }

  // ---------- UI: before/after ----------
  function wireBeforeAfter() {
    const btn = $("btn-before-after");
    btn.addEventListener("click", () => {
      const on = document.body.classList.toggle("before-active");
      btn.textContent = on ? "Show current colors" : "Show original";
    });
  }

  // ---------- UI: combos ----------
  function renderCombos() {
    const list = $("combos-list");
    const hint = $("combos-hint");
    list.textContent = "";
    if (!state.combos.length) {
      hint.textContent = "None yet — use “Save combo”";
      return;
    }
    hint.textContent = `${state.combos.length} saved`;
    state.combos.forEach((combo, idx) => {
      const row = document.createElement("div");
      row.className = "combo";
      row.title = "Click to apply";
      const sw = document.createElement("div");
      sw.className = "combo-swatches";
      for (const s of SURFACES) {
        const chip = document.createElement("span");
        chip.style.background = combo.selections[s]?.hex || "#ddd";
        sw.appendChild(chip);
      }
      const name = document.createElement("div");
      name.className = "combo-name";
      name.textContent = combo.name;
      const del = document.createElement("button");
      del.className = "combo-delete";
      del.type = "button";
      del.textContent = "×";
      del.title = "Delete";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`Delete combo "${combo.name}"?`)) {
          state.combos.splice(idx, 1);
          saveJSON(LS_COMBOS, state.combos);
          renderCombos();
        }
      });
      row.addEventListener("click", () => applyCombo(combo));
      row.appendChild(sw);
      row.appendChild(name);
      row.appendChild(del);
      list.appendChild(row);
    });
  }

  function applyCombo(combo) {
    for (const s of SURFACES) {
      if (combo.selections[s]) {
        Object.assign(state.selections[s], combo.selections[s]);
      }
    }
    saveJSON(LS_SEL, state.selections);
    applyAllSelections();
    markSelectedSwatch();
  }

  function saveCurrentCombo() {
    const name = prompt("Name this combo:", `Option ${state.combos.length + 1}`);
    if (!name) return;
    const snap = {};
    for (const s of SURFACES) snap[s] = { ...state.selections[s] };
    state.combos.push({ name: name.trim(), selections: snap });
    saveJSON(LS_COMBOS, state.combos);
    renderCombos();
  }

  // ---------- Albedo editor UI ----------
  function renderAlbedoRows() {
    const host = $("albedo-rows");
    if (!host) return;
    host.textContent = "";
    for (const s of SURFACES) {
      const a = state.albedos[s];
      const eff = effectiveAlbedo(s);
      const sampling = state.sampling && state.sampling.surface === s;
      const tagText = sampling ? "sampling…" : (a.manual ? "manual" : (a.auto ? "auto" : "none"));
      const tagClass = sampling ? "is-sampling" : (a.manual ? "is-manual" : "");

      const row = document.createElement("div");
      row.className = "albedo-row";

      const label = document.createElement("div");
      label.className = "albedo-row-label";
      label.textContent = s;

      const swatch = document.createElement("div");
      swatch.className = "albedo-swatch";
      swatch.style.background = eff ? rgb01ToHex(eff) : "#eee";

      const meta = document.createElement("div");
      meta.className = "albedo-meta";
      meta.textContent = eff ? rgb01ToHex(eff).toUpperCase() : "—";
      const tag = document.createElement("span");
      tag.className = "albedo-tag " + tagClass;
      tag.textContent = tagText;
      meta.appendChild(tag);

      const sampleBtn = document.createElement("button");
      sampleBtn.type = "button";
      sampleBtn.className = "btn-small" + (sampling ? " is-armed" : "");
      sampleBtn.textContent = sampling ? "Cancel" : "Sample";
      sampleBtn.title = "Pick a pixel from the photo to set this surface's albedo";
      sampleBtn.addEventListener("click", () => {
        if (sampling) cancelSample();
        else armSample(s);
      });

      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "btn-link";
      resetBtn.textContent = "Reset";
      resetBtn.title = "Drop manual sample and recompute from mask pixels";
      resetBtn.disabled = !a.manual;
      resetBtn.addEventListener("click", () => resetAlbedo(s));

      row.appendChild(label);
      row.appendChild(swatch);
      row.appendChild(meta);
      row.appendChild(sampleBtn);
      row.appendChild(resetBtn);
      host.appendChild(row);
    }
  }

  function armSample(surface) {
    if (state.sampling) cancelSample();
    state.sampling = { surface };
    document.body.dataset.sampling = surface;
    renderAlbedoRows();
    // Capture-phase click on the stage intercepts the click before the
    // mask editor's polygon-point handler sees it.
    const handler = (e) => {
      if (e.button !== 0) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      const pt = clientToImagePx(e.clientX, e.clientY);
      if (pt && state.baseImageData) {
        const rgb = sampleNeighborhood(pt.x, pt.y, SAMPLE_RADIUS);
        if (rgb) {
          state.albedos[surface].manual = rgb;
          saveJSON(LS_ALBEDOS, state.albedos);
          scheduleRender(surface);
        }
      }
      finishSample();
    };
    state._sampleHandler = handler;
    stage.addEventListener("click", handler, true);
  }

  function cancelSample() {
    if (!state.sampling) return;
    finishSample();
  }

  function finishSample() {
    if (state._sampleHandler) {
      stage.removeEventListener("click", state._sampleHandler, true);
      state._sampleHandler = null;
    }
    state.sampling = null;
    delete document.body.dataset.sampling;
    renderAlbedoRows();
  }

  function resetAlbedo(surface) {
    state.albedos[surface].manual = null;
    saveJSON(LS_ALBEDOS, state.albedos);
    renderAlbedoRows();
    scheduleRender(surface);
  }

  function clientToImagePx(cx, cy) {
    const pt = stage.createSVGPoint();
    pt.x = cx; pt.y = cy;
    const ctm = stage.getScreenCTM();
    if (!ctm) return null;
    const sp = pt.matrixTransform(ctm.inverse());
    const { width, height } = state.image;
    const x = Math.round(sp.x);
    const y = Math.round(sp.y);
    if (x < 0 || y < 0 || x >= width || y >= height) return null;
    return { x, y };
  }

  function sampleNeighborhood(cx, cy, radius) {
    const data = state.baseImageData.data;
    const { width, height } = state.image;
    let rSum = 0, gSum = 0, bSum = 0, n = 0;
    const x0 = Math.max(0, cx - radius);
    const y0 = Math.max(0, cy - radius);
    const x1 = Math.min(width - 1, cx + radius);
    const y1 = Math.min(height - 1, cy + radius);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = (y * width + x) * 4;
        rSum += data[i];
        gSum += data[i + 1];
        bSum += data[i + 2];
        n++;
      }
    }
    if (!n) return null;
    return [rSum / n / 255, gSum / n / 255, bSum / n / 255];
  }

  // ---------- UI: edit mode toggle ----------
  function wireEditMode() {
    $("btn-edit-masks").addEventListener("click", () => {
      window.MaskEditor.enter({
        state,
        stage,
        onChange: () => {
          persistMasks();
          renderMasks();
          // Masks changed — rebuild bitmaps, recompute auto albedos (manual
          // overrides persist), re-render every surface.
          rebuildSurfaceMasks();
          autoComputeAllAlbedos();
          renderAlbedoRows();
          scheduleRender();
        },
        onExit: () => {
          cancelSample();
          document.body.dataset.mode = "view";
          $("mode-hint").textContent = "Pick colors for siding, trim, and stucco →";
          persistMasks();
          renderMasks();
          rebuildSurfaceMasks();
          autoComputeAllAlbedos();
          applyAllSelections();
        },
      });
      document.body.dataset.mode = "edit";
      $("mode-hint").textContent = "Options — rendering algorithm, masks, albedos.";
      renderAlbedoRows();
    });
    $("btn-done-editing").addEventListener("click", () => {
      window.MaskEditor.exit();
    });
  }

  // ---------- UI: rendering algorithm toggle ----------
  function wireAlgorithmToggle() {
    const radios = document.querySelectorAll('input[name="algorithm"]');
    for (const r of radios) {
      r.checked = r.value === state.algorithm;
      r.addEventListener("change", () => {
        if (!r.checked) return;
        state.algorithm = r.value;
        saveJSON(LS_ALGORITHM, state.algorithm);
        scheduleRender();
      });
    }
  }

  // ---------- Init ----------
  function init() {
    document.querySelectorAll("#surface-tabs .surface-tab").forEach(b => {
      b.addEventListener("click", () => setActiveSurface(b.dataset.surface));
    });
    buildPalette();
    wireSearch();
    wireExposure();
    wireBeforeAfter();
    $("btn-save-combo").addEventListener("click", saveCurrentCombo);
    wireEditMode();
    wireAlgorithmToggle();

    renderCombos();
    updateSelectionReadout();
    updateSurfaceSwatches();
    markSelectedSwatch();
    renderAlbedoRows();
    loadBaseImage();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
