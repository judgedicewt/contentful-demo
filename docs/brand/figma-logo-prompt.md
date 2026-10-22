# Strada Nova logo: Figma prompt

The site's logo is hand-drawn SVG in `site/brand/`, `site/favicon.svg`, and
`site/js/brand.js`, and it needs no further design work. This prompt is
optional. Use it if you want Figma AI (Figma Make, or **Actions > Make an
image** for a raster draft) to produce extra variants of the same concept,
such as a stacked lockup or one-color versions. To swap a Figma export into
the site, see [Replace the SVG](#replace-the-svg).

## Prompt

```text
Design a minimal logo for Strada Nova, a fictional Italian supercar maker.
The name means "new road" in Italian. The brand is fast, calm, and quietly
confident. It should not resemble any real car brand, in particular the
McLaren speedmark, the Ferrari prancing horse, or the Lamborghini bull.

Concept: two smooth curves that read as a road sweeping away into the
distance. The main curve is a soft S that rises from lower left to upper
right. A second, thinner and shorter curve runs parallel below it, like the
far edge of the road. Nothing else: no star, no shield, no letters in the
mark.

Create these as separate frames on one page:
1. Mark: the two curves only, on a 64 x 64 grid with 4 px padding. Main
   stroke about 5 px, second stroke about 3 px, round caps.
2. Horizontal lockup: the mark on the left, then the wordmark STRADA NOVA in
   a wide geometric sans serif, uppercase, medium weight, tracked at about
   +300. Mark height equals two times the cap height.
3. Stacked lockup: the mark centred above the wordmark.
4. Favicon: the mark with heavier strokes for 16 px and 32 px, on a #111214
   rounded square with a 14 px corner radius.
5. One-colour versions of the mark and horizontal lockup, in white and in
   #111214.

Colour: stroke both curves with a very subtle linear gradient from #FF7A00
at the lower left to #FFA64D at the upper right. The wordmark is #FFFFFF on
dark backgrounds and #111214 on light backgrounds. Show each frame on both a
#111214 background and a #FFFFFF background.

Style rules: flat vector strokes only, no shadows, bevels, outlines, or 3D
effects. Curves must be smooth, with no corners or kinks. Keep it simple
enough to draw from memory and legible at 16 px. Outline all text.

Export every frame as SVG with the background removed.
```

## Replace the SVG

1. Export the mark from Figma as SVG.
2. Replace `site/brand/strada-nova-mark.svg` with the gradient mark. The
   loading screen and the watermark on "Continue your journey" sections use it.
3. Replace `site/favicon.svg` with the favicon frame.
4. Copy the curve paths and stroke widths into `BRAND_CURVES`, and the two
   gradient colors into `BRAND_GRADIENT`, in `site/js/brand.js`. Keep the
   64 x 64 `viewBox`, or update it to match the export.
