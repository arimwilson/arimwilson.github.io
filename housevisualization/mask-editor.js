// House Color Visualizer — mask editor.
// Exposes window.MaskEditor.enter(opts) / exit().
(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const SURFACES = ["siding", "trim", "stucco"];

  let ctx = null; // active session context

  function enter(opts) {
    if (ctx) exit();
    ctx = {
      state: opts.state,
      stage: opts.stage,
      onChange: opts.onChange || (() => {}),
      onExit:   opts.onExit   || (() => {}),
      activeSurface: "siding",
      draft: [],                  // in-progress polygon points
      originalViewBox: opts.stage.getAttribute("viewBox"),
      viewBox: parseViewBox(opts.stage.getAttribute("viewBox")),
      spaceDown: false,
      panning: false,
      panStart: null,
      panStartVB: null,
      handlers: {},
    };

    const editorLayer = document.getElementById("editor-layer");
    editorLayer.textContent = "";

    wireSurfaceTabs();
    wireActions();
    attachStageHandlers();
    attachKeyHandlers();

    redraw();
    updateCounts();
  }

  function exit() {
    if (!ctx) return;
    detachStageHandlers();
    detachKeyHandlers();
    detachSurfaceTabs();
    detachActions();
    const editorLayer = document.getElementById("editor-layer");
    editorLayer.textContent = "";
    const cb = ctx.onExit;
    ctx = null;
    cb();
  }

  function parseViewBox(vb) {
    if (!vb) return { x: 0, y: 0, w: 1, h: 1 };
    const [x, y, w, h] = vb.split(/\s+/).map(Number);
    return { x, y, w, h };
  }

  // ---------- Surface tabs (edit mode) ----------
  function wireSurfaceTabs() {
    const tabs = document.querySelectorAll(".edit-surface-tabs .surface-tab");
    const handler = (e) => {
      const s = e.currentTarget.dataset.editSurface;
      ctx.activeSurface = s;
      tabs.forEach(t => t.classList.toggle("is-active", t.dataset.editSurface === s));
    };
    tabs.forEach(t => {
      t.addEventListener("click", handler);
      t.classList.toggle("is-active", t.dataset.editSurface === ctx.activeSurface);
    });
    ctx.handlers.surfaceTabs = { tabs, handler };
  }

  function detachSurfaceTabs() {
    if (!ctx || !ctx.handlers.surfaceTabs) return;
    const { tabs, handler } = ctx.handlers.surfaceTabs;
    tabs.forEach(t => t.removeEventListener("click", handler));
  }

  // ---------- Buttons ----------
  function wireActions() {
    const clear = document.getElementById("btn-clear-surface");
    const exp = document.getElementById("btn-export-masks");
    const imp = document.getElementById("btn-import-masks");
    const impFile = document.getElementById("import-file");

    const onClear = () => {
      if (!confirm(`Clear all masks for "${ctx.activeSurface}"?`)) return;
      ctx.state.masks[ctx.activeSurface] = [];
      ctx.draft = [];
      ctx.onChange();
      redraw();
      updateCounts();
    };
    const onExport = () => {
      const blob = new Blob(
        [JSON.stringify(ctx.state.masks, null, 2)],
        { type: "application/json" }
      );
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "masks.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    const onImport = () => impFile.click();
    const onImportFile = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          const next = {};
          for (const s of SURFACES) {
            next[s] = Array.isArray(parsed[s]) ? parsed[s] : [];
          }
          ctx.state.masks = next;
          ctx.draft = [];
          ctx.onChange();
          redraw();
          updateCounts();
        } catch (err) {
          alert("Invalid masks JSON: " + err.message);
        }
      };
      reader.readAsText(file);
      impFile.value = ""; // allow re-import of same file
    };

    clear.addEventListener("click", onClear);
    exp.addEventListener("click", onExport);
    imp.addEventListener("click", onImport);
    impFile.addEventListener("change", onImportFile);

    ctx.handlers.actions = { clear, exp, imp, impFile, onClear, onExport, onImport, onImportFile };
  }

  function detachActions() {
    if (!ctx || !ctx.handlers.actions) return;
    const { clear, exp, imp, impFile, onClear, onExport, onImport, onImportFile } = ctx.handlers.actions;
    clear.removeEventListener("click", onClear);
    exp.removeEventListener("click", onExport);
    imp.removeEventListener("click", onImport);
    impFile.removeEventListener("change", onImportFile);
  }

  // ---------- Stage input ----------
  function attachStageHandlers() {
    const stage = ctx.stage;
    const onClick = (e) => {
      if (ctx.spaceDown || ctx.panning) return;
      // Only count primary button
      if (e.button !== 0) return;
      const pt = clientToSvg(e.clientX, e.clientY);
      ctx.draft.push([Math.round(pt.x), Math.round(pt.y)]);
      redraw();
    };
    const onContextMenu = (e) => {
      // If the target is a completed polygon, delete it. Else suppress menu.
      e.preventDefault();
      const target = e.target;
      if (target && target.classList && target.classList.contains("mask-polygon")) {
        const surface = target.dataset.surface;
        const idx = parseInt(target.dataset.index, 10);
        if (Number.isFinite(idx)) {
          ctx.state.masks[surface].splice(idx, 1);
          ctx.onChange();
          redraw();
          updateCounts();
        }
      }
    };
    const onWheel = (e) => {
      e.preventDefault();
      const scale = Math.pow(1.0015, e.deltaY); // scroll down -> zoom out
      const pt = clientToSvg(e.clientX, e.clientY);
      const vb = ctx.viewBox;
      vb.x = pt.x - (pt.x - vb.x) * scale;
      vb.y = pt.y - (pt.y - vb.y) * scale;
      vb.w *= scale;
      vb.h *= scale;
      stage.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    };
    const onMouseDown = (e) => {
      if (ctx.spaceDown && e.button === 0) {
        ctx.panning = true;
        ctx.panStart = { x: e.clientX, y: e.clientY };
        ctx.panStartVB = { ...ctx.viewBox };
        document.body.dataset.panning = "true";
        e.preventDefault();
      }
    };
    const onMouseMove = (e) => {
      if (ctx.panning) {
        const rect = stage.getBoundingClientRect();
        const sx = ctx.viewBox.w / rect.width;
        const sy = ctx.viewBox.h / rect.height;
        ctx.viewBox.x = ctx.panStartVB.x - (e.clientX - ctx.panStart.x) * sx;
        ctx.viewBox.y = ctx.panStartVB.y - (e.clientY - ctx.panStart.y) * sy;
        stage.setAttribute("viewBox",
          `${ctx.viewBox.x} ${ctx.viewBox.y} ${ctx.viewBox.w} ${ctx.viewBox.h}`);
      }
    };
    const onMouseUp = () => {
      if (ctx.panning) {
        ctx.panning = false;
        document.body.dataset.panning = "false";
      }
    };

    stage.addEventListener("click", onClick);
    stage.addEventListener("contextmenu", onContextMenu);
    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    ctx.handlers.stage = { onClick, onContextMenu, onWheel, onMouseDown, onMouseMove, onMouseUp };
  }

  function detachStageHandlers() {
    if (!ctx.handlers.stage) return;
    const { onClick, onContextMenu, onWheel, onMouseDown, onMouseMove, onMouseUp } = ctx.handlers.stage;
    ctx.stage.removeEventListener("click", onClick);
    ctx.stage.removeEventListener("contextmenu", onContextMenu);
    ctx.stage.removeEventListener("wheel", onWheel);
    ctx.stage.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    // Restore original viewBox
    if (ctx.originalViewBox) ctx.stage.setAttribute("viewBox", ctx.originalViewBox);
    document.body.dataset.panning = "false";
  }

  function attachKeyHandlers() {
    const onKeyDown = (e) => {
      // Don't interfere with text inputs
      const tag = (e.target && e.target.tagName) || "";
      const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(tag);

      if (e.code === "Space" && !inField) {
        ctx.spaceDown = true;
        document.body.dataset.panning = "true";
        e.preventDefault();
        return;
      }
      if (inField) return;

      if (e.key === "Enter") {
        e.preventDefault();
        commitDraft();
      } else if (e.key === "Escape") {
        e.preventDefault();
        ctx.draft = [];
        redraw();
      } else if (e.key === "Backspace") {
        if (ctx.draft.length) {
          e.preventDefault();
          ctx.draft.pop();
          redraw();
        }
      }
    };
    const onKeyUp = (e) => {
      if (e.code === "Space") {
        ctx.spaceDown = false;
        if (!ctx.panning) document.body.dataset.panning = "false";
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    ctx.handlers.keys = { onKeyDown, onKeyUp };
  }

  function detachKeyHandlers() {
    if (!ctx.handlers.keys) return;
    const { onKeyDown, onKeyUp } = ctx.handlers.keys;
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  }

  // ---------- Commit / rendering ----------
  function commitDraft() {
    if (ctx.draft.length < 3) {
      ctx.draft = [];
      redraw();
      return;
    }
    ctx.state.masks[ctx.activeSurface].push(ctx.draft.slice());
    ctx.draft = [];
    ctx.onChange();
    redraw();
    updateCounts();
  }

  function redraw() {
    const layer = document.getElementById("editor-layer");
    layer.textContent = "";

    // All saved polygons
    for (const surface of SURFACES) {
      const polys = ctx.state.masks[surface] || [];
      polys.forEach((pts, idx) => {
        if (!pts || pts.length < 3) return;
        const poly = document.createElementNS(SVG_NS, "polygon");
        poly.setAttribute("points", pts.map(p => `${p[0]},${p[1]}`).join(" "));
        poly.setAttribute("class", `mask-polygon surface-${surface}`);
        poly.dataset.surface = surface;
        poly.dataset.index = idx;
        layer.appendChild(poly);
      });
    }

    // Draft (in-progress) polyline
    if (ctx.draft.length) {
      if (ctx.draft.length > 1) {
        const pl = document.createElementNS(SVG_NS, "polyline");
        pl.setAttribute("points", ctx.draft.map(p => `${p[0]},${p[1]}`).join(" "));
        pl.setAttribute("class", "in-progress-line");
        layer.appendChild(pl);
      }
      // Vertex handles
      for (const p of ctx.draft) {
        const c = document.createElementNS(SVG_NS, "circle");
        c.setAttribute("cx", p[0]);
        c.setAttribute("cy", p[1]);
        // Radius scales with viewBox so handles stay visible when zoomed
        const r = Math.max(3, ctx.viewBox.w / 400);
        c.setAttribute("r", r);
        c.setAttribute("class", "vertex");
        layer.appendChild(c);
      }
    }
  }

  function updateCounts() {
    const el = document.getElementById("edit-counts");
    if (!el) return;
    el.textContent = "";
    for (const s of SURFACES) {
      const cell = document.createElement("div");
      cell.className = "edit-count";
      const num = document.createElement("div");
      num.className = "edit-count-num";
      num.textContent = (ctx.state.masks[s] || []).length;
      const lbl = document.createElement("div");
      lbl.className = "edit-count-label";
      lbl.textContent = s;
      cell.appendChild(num);
      cell.appendChild(lbl);
      el.appendChild(cell);
    }
  }

  // ---------- Coord conversion ----------
  function clientToSvg(cx, cy) {
    const stage = ctx.stage;
    const pt = stage.createSVGPoint();
    pt.x = cx; pt.y = cy;
    const ctm = stage.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const sp = pt.matrixTransform(ctm.inverse());
    return { x: sp.x, y: sp.y };
  }

  // ---------- Public API ----------
  window.MaskEditor = { enter, exit };
})();
