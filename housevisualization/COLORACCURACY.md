Honest answers to both:

## Color accuracy under mixed lighting

The recoloring math is: `output_pixel = target_color_rgb × grayscale_of_original`. That's a cheap 2D trick, not a lighting model. Implications:

- **Dark→light swaps are misleading.** Your siding is brown because brown paint absorbs most incoming light. My filter can't brighten a shadow past the luminance that was already captured in that pixel. So if you preview siding in Alabaster (LRV ~82), the preview will look muted/dim — real Alabaster on that wall would reflect *much* more light than the photo can represent. The Brightness slider partially compensates but lifts shadows in a non-physical way. Rule of thumb: **preview undersells lightness when going dark→light by maybe 15–25%.** Trust the *relative* comparison between candidates more than the absolute look.
- **Light→dark and similar-LRV swaps are decent** (±10% appearance). The photo's trim is bright enough to carry a dark tint convincingly. Brown → a similar-LRV neutral like Poised Taupe or Studio Taupe previews pretty well.
- **Warm golden-hour cast is baked in.** Your photo was shot in warm low-angle sun; shadows have blue skylight fill. Every color I show inherits that lighting. The same paint at noon or under overcast would look perceptibly different. I can't neutralize this.
- **Shadows get color-shifted** — a shadow on brown siding has a bit of sky blue in it; when grayscale'd and multiplied by, say, Naval, the result gets darker than it would in reality because real ambient fill isn't modeled.
- **Saturated colors (reds, deep blues, greens) preview worst** — they depend on gloss, specular highlights, and spectrum, none of which the filter simulates. A "Real Red" door in the preview will look duller than real.
- **No spatial relighting.** Real architectural visualization (SW's own ColorSnap, or a Blender/Unreal PBR setup) would recompute shading for the new albedo. I'm not doing that.

**Practical takeaway:** good for narrowing 80 candidates to ~5. Not good for final decisions. Buy Samplize peel-and-stick samples (or real SW chips) and look at them on the actual house at morning, noon, and golden hour.

## Where the SW data came from

Straight-up: I didn't pull from an authoritative source. Two parts to be honest about:

- **Names and SW codes** (e.g., "Alabaster SW 7008", "Iron Ore SW 7069") — these are real SW colors. Drawn from my training data (design blogs, SW marketing, Houzz/Pinterest discussion) and they're correct to the best of my knowledge. If I got one wrong it's a typo, not an invented color.
- **Hex values** — these are *my approximations*, not from SW's color database. SW publishes Lab values on their site; various third-party color sites (encycolorpedia, colorxs) publish sRGB conversions. I used neither during this build — I wrote hex codes from memory / estimation of what each color looks like. They should be directionally right (Alabaster is a warm off-white, Tricorn Black is a very dark charcoal, Evergreen Fog is a muted sage) but can easily be off by 5–10 RGB units per channel from what SW would print on an actual chip.

This is exactly why I put "Hex values are approximations of Sherwin-Williams colors. Order real paint chips before committing." in the UI — the disclaimer is load-bearing, not boilerplate.

**If you want this tightened up**, options in order of effort:

1. **Scrape encycolorpedia.com** for the ~80 colors in `sw-colors.js` — gives a commonly-used sRGB conversion of each SW Lab value. ~15 minutes of work; I can write the scraper and regenerate the JS file.
2. **Use SW's own published Lab values** from sherwin-williams.com (hand-collect or parse their color pages) and convert Lab→sRGB with a known white point. Most authoritative free path.
3. **Get SW's ColorSnap .ase file** (Adobe Swatch Exchange). SW distributes these to designers. Authoritative, but requires sourcing the file.

Want me to do option 1 and regenerate the palette? It would also be a good place to add LRV (light reflectance value) to each entry, which matters more than hex for predicting how a color will read on a sunlit vs shaded wall.
