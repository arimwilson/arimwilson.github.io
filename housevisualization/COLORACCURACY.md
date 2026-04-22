## Color accuracy under mixed lighting

The recoloring math is: `output_pixel = target_color_rgb × grayscale_of_original`. That's a cheap 2D trick, not a lighting model. Implications:

- **Dark→light swaps are misleading.** Your siding is brown because brown paint absorbs most incoming light. My filter can't brighten a shadow past the luminance that was already captured in that pixel. So if you preview siding in Alabaster (LRV ~82), the preview will look muted/dim — real Alabaster on that wall would reflect *much* more light than the photo can represent. The Brightness slider partially compensates but lifts shadows in a non-physical way. Rule of thumb: **preview undersells lightness when going dark→light by maybe 15–25%.** Trust the *relative* comparison between candidates more than the absolute look.
- **Light→dark and similar-LRV swaps are decent** (±10% appearance). The photo's trim is bright enough to carry a dark tint convincingly. Brown → a similar-LRV neutral like Poised Taupe or Studio Taupe previews pretty well.
- **Warm golden-hour cast is baked in.** Your photo was shot in warm low-angle sun; shadows have blue skylight fill. Every color I show inherits that lighting. The same paint at noon or under overcast would look perceptibly different. I can't neutralize this.
- **Shadows get color-shifted** — a shadow on brown siding has a bit of sky blue in it; when grayscale'd and multiplied by, say, Naval, the result gets darker than it would in reality because real ambient fill isn't modeled.
- **Saturated colors (reds, deep blues, greens) preview worst** — they depend on gloss, specular highlights, and spectrum, none of which the filter simulates. A "Real Red" door in the preview will look duller than real.
- **No spatial relighting.** Real architectural visualization (SW's own ColorSnap, or a Blender/Unreal PBR setup) would recompute shading for the new albedo. I'm not doing that.

**Practical takeaway:** good for narrowing 80 candidates to ~5. Not good for final decisions. Buy Samplize peel-and-stick samples (or real SW chips) and look at them on the actual house at morning, noon, and golden hour.
