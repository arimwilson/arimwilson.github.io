## Albedo-aware recoloring (plan)

COLORACCURACY.md explains why the current `target × grayscale(original)` trick undersells dark→light swaps: the brown paint in the photo has already absorbed most of the incoming light, so there's no luminance left to redistribute when you paint it Alabaster. This doc is the plan to fix that.

### Core idea

Tell the math what color the surface actually is in real life. Then divide it out of the photo to recover a lighting map, and reapply the new target color:

```
illum  = clamp(src_rgb / source_albedo, 0..1)   // per pixel, per channel
output = illum * target_rgb
```

`illum` ≈ how much light is reaching this pixel, independent of the paint that's already there. Shadows stay shadows; sun stays sun; but the base tone is no longer baked in, so a white target finally reads as white even in the shaded middle of the house.

One albedo per surface type is enough (3 total for this project), not one per mask polygon. All 23 siding polygons are the same brown paint in reality; only the lighting varies, which is exactly what the divide is meant to decode.

### UX — in the Edit masks panel

Default: **zero sampling.** When masks are saved, compute each surface's albedo as the median RGB of all pixels inside that surface's polygons. Median is robust against shadow and specular outliers, and it costs ~nothing since the mask and image are already in memory.

Fallback: **one-click eyedropper.** In Edit mode, next to each surface tab add:

- the current albedo swatch (auto-computed value by default),
- a "sample pixel" button that arms an eyedropper — next click on the photo sets that surface's albedo to the clicked pixel's RGB (or a small neighborhood average to reduce noise),
- a "reset to auto" link.

Albedos persist with the masks (`hv:masks` or a sibling `hv:albedos` key). They recompute automatically whenever the mask for that surface changes, unless the user has overridden with a manual sample.

No new controls in view mode. The brightness slider stays as a final creative nudge.

### Implementation sketch

1. **State.** Add `state.albedos = { siding: [r,g,b], trim: [...], stucco: [...] }` plus a `manual` flag per surface. Persist alongside masks.

2. **Auto-compute.** On mask change (and on load), for each surface: rasterize its polygons to a bitmask over the base image's `ImageData`, collect every covered pixel's RGB, take the per-channel median. ~40 lines. Cache the result.

3. **Swap the SVG tint filter for a canvas pass.** The current `<image href="house.jpg" filter="url(#tint-…)">` stack becomes, per surface, a `<canvas>` (or an `<image>` whose `href` is a canvas-produced data URL) positioned in the same `userSpaceOnUse` coordinate space, still clipped by the existing `clip-path`. Keep the clip-path machinery — it's fine.

   Per-surface render on color/albedo change:
   ```js
   for (let i = 0; i < data.length; i += 4) {
     const il_r = Math.min(1, data[i]   / 255 / albedo[0]);
     const il_g = Math.min(1, data[i+1] / 255 / albedo[1]);
     const il_b = Math.min(1, data[i+2] / 255 / albedo[2]);
     out[i]   = il_r * target[0] * 255 * exposure;
     out[i+1] = il_g * target[1] * 255 * exposure;
     out[i+2] = il_b * target[2] * 255 * exposure;
     out[i+3] = 255;
   }
   ```

4. **Wire it into `updateSurfaceFilter`.** Replace the current feColorMatrix update with a canvas re-render for that surface. Before/after toggle still works by hiding the recolor layers.

5. **Performance.** A 3 MP photo × 3 surfaces ≈ 9 M pixel ops per full refresh — fine for clicks (~100 ms), possibly choppy on continuous slider drag. If so: re-render on `change` not `input`, or push the loop into a Web Worker.

6. **Edit-mode UI.** Three rows in the mask editor, one per surface: auto swatch | eyedropper button | reset. Eyedropper sets `manual=true`; reset clears it and recomputes from the median.

### What this fixes

- Dark→light swaps (the main failure mode in COLORACCURACY.md). Pure white on the shaded middle section now renders as a believable shaded white instead of a muddy gray.
- The brightness slider becomes a taste knob instead of a crutch.

### What this does not fix

- **Golden-hour cast is still baked in.** Dividing out the albedo recovers the *incoming* light including its color temperature. Alabaster at sunset will still look warm. Neutralizing this would require a separate white-balance pre-pass on the lighting map.
- **Saturated colors** (deep reds, blues, greens) still preview duller than real — no gloss or specular model.
- **Clipped highlights** lose information regardless — if the photo's sun-lit siding is at 255, the divide can't recover what the real reflected luminance was. Acceptable.
- **No spatial relighting.** Ambient occlusion, cast shadows from the new color onto trim, etc. — still out of scope. Hover/Renoworks-class tools handle this by reconstructing geometry.

Net: moves the app from "roughly ColorSnap-tier" to "better than ColorSnap on the specific case of dark→light swaps," because the source-albedo input is information ColorSnap's UX doesn't collect.

### Effort

~2–3 hours end to end: state + persistence (~30 min), median auto-compute (~30 min), canvas render pipeline (~1–1.5 h), edit-mode eyedropper UI (~30 min), performance check (~15 min).
