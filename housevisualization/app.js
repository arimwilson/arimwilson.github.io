// House Color Visualizer — main viewer.
// Depends on: data/sw-colors.js (window.SW_COLORS, window.SW_GROUPS),
//             data/masks.default.js (window.DEFAULT_MASKS),
//             mask-editor.js (window.MaskEditor).
(function () {
  "use strict";

  const SURFACES = ["siding", "trim", "stucco"];
  const SVG_NS = "http://www.w3.org/2000/svg";
  const LS_MASKS = "hv:masks";
  const LS_SEL   = "hv:selections";
  const LS_COMBOS = "hv:combos";

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
    image: { width: 0, height: 0, loaded: false },
  };

  // Restore selections from localStorage on top of defaults.
  const savedSel = loadJSON(LS_SEL, null);
  if (savedSel) {
    for (const s of SURFACES) {
      if (savedSel[s]) Object.assign(state.selections[s], savedSel[s]);
    }
  }

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const stage = $("stage");
  const photoNote = $("photo-note");

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

  // ---------- Image loading ----------
  function loadBaseImage() {
    const probe = new Image();
    probe.onload = () => {
      state.image = { width: probe.naturalWidth, height: probe.naturalHeight, loaded: true };
      setupStage();
      applyAllSelections();
      renderMasks();
    };
    probe.onerror = () => {
      photoNote.hidden = false;
    };
    probe.src = "house.jpg";
  }

  function setupStage() {
    const { width, height } = state.image;
    stage.setAttribute("viewBox", `0 0 ${width} ${height}`);
    // Set width/height on every <image> inside the SVG so they render correctly.
    const imgs = stage.querySelectorAll("image");
    imgs.forEach(img => {
      img.setAttribute("width", width);
      img.setAttribute("height", height);
      // Force-refresh href in case it was stale
      const href = img.getAttribute("href");
      img.setAttribute("href", href);
    });
    // Expand filter regions so they cover the full image.
    stage.querySelectorAll("filter").forEach(f => {
      f.setAttribute("x", "0");
      f.setAttribute("y", "0");
      f.setAttribute("width", width);
      f.setAttribute("height", height);
      f.setAttribute("filterUnits", "userSpaceOnUse");
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

  // ---------- Tint filter update ----------
  // The tint filter's third child (index 2) is the second feColorMatrix,
  // which holds target color rows. Its first child (index 0) is the
  // grayscale feColorMatrix. Index 1 is the feComponentTransfer used for
  // brightness/exposure.
  function updateSurfaceFilter(surface) {
    const sel = state.selections[surface];
    const filter = document.getElementById("tint-" + surface);
    if (!filter) return;

    const children = filter.children;
    const transfer = children[1];
    const tintMatrix = children[2];

    if (!sel.hex) {
      // No color chosen for this surface yet — render identity
      // (passes grayscale + then passes through). We hide the layer instead.
      document.getElementById("layer-" + surface).style.display = "none";
      return;
    }
    document.getElementById("layer-" + surface).style.display = "";

    const [r, g, b] = hexToRgb01(sel.hex);
    tintMatrix.setAttribute("values", [
      r, 0, 0, 0, 0,
      0, g, 0, 0, 0,
      0, 0, b, 0, 0,
      0, 0, 0, 1, 0,
    ].join(" "));

    // Brightness: apply a linear slope on the grayscale so that very dark
    // regions can be lifted when recoloring dark-to-light.
    const slope = sel.exposure || 1.0;
    for (const fnName of ["feFuncR", "feFuncG", "feFuncB"]) {
      const fn = transfer.getElementsByTagName(fnName)[0];
      if (fn) {
        fn.setAttribute("slope", slope);
        fn.setAttribute("intercept", "0");
      }
    }
  }

  function applyAllSelections() {
    for (const s of SURFACES) updateSurfaceFilter(s);
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
    $("sel-code").textContent = sel.code || "\u00A0";
    const exp = $("exposure");
    const expVal = $("exposure-val");
    exp.value = sel.exposure || 1.0;
    expVal.textContent = (sel.exposure || 1.0).toFixed(2);
  }

  // ---------- UI: palette ----------
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
        grid.appendChild(el);
      }
      section.appendChild(grid);
      container.appendChild(section);
    }
    ensureSwatchTooltip(container);
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
      // Clamp horizontally so it stays in the viewport.
      const tr = tip.getBoundingClientRect();
      const margin = 4;
      if (tr.left < margin) {
        tip.style.left = (x + (margin - tr.left)) + "px";
      } else if (tr.right > window.innerWidth - margin) {
        tip.style.left = (x - (tr.right - (window.innerWidth - margin))) + "px";
      }
      // Flip below if it would clip the top.
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
    updateSurfaceFilter(s);
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

  function wireSearch() {
    const input = $("color-search");
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      document.querySelectorAll(".palette-group").forEach(section => {
        let visible = 0;
        section.querySelectorAll(".swatch").forEach(el => {
          const hit = !q
            || el.dataset.name.toLowerCase().includes(q)
            || el.dataset.code.toLowerCase().includes(q);
          el.style.display = hit ? "" : "none";
          if (hit) visible++;
        });
        section.style.display = visible ? "" : "none";
      });
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
      updateSurfaceFilter(s);
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
      hint.textContent = "None yet — use \u201CSave combo\u201D";
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
    // Deep clone selections
    const snap = {};
    for (const s of SURFACES) snap[s] = { ...state.selections[s] };
    state.combos.push({ name: name.trim(), selections: snap });
    saveJSON(LS_COMBOS, state.combos);
    renderCombos();
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
        },
        onExit: () => {
          document.body.dataset.mode = "view";
          $("mode-hint").textContent = "Pick colors for siding, trim, and stucco →";
          persistMasks();
          renderMasks();
          applyAllSelections();
        },
      });
      document.body.dataset.mode = "edit";
      $("mode-hint").textContent = "Editing masks — click to add points, Enter to close polygon.";
    });
    $("btn-done-editing").addEventListener("click", () => {
      window.MaskEditor.exit();
    });
  }

  // ---------- Init ----------
  function init() {
    // Surface tabs
    document.querySelectorAll("#surface-tabs .surface-tab").forEach(b => {
      b.addEventListener("click", () => setActiveSurface(b.dataset.surface));
    });
    buildPalette();
    wireSearch();
    wireExposure();
    wireBeforeAfter();
    $("btn-save-combo").addEventListener("click", saveCurrentCombo);
    wireEditMode();

    renderCombos();
    updateSelectionReadout();
    updateSurfaceSwatches();
    markSelectedSwatch();
    loadBaseImage();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
