[![gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/ca7-cok/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/ca7-cok/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

# Neon Coast Cover Studio

A make.fun entry for [gta6-cover-art-01](https://make.fun/bounty/gta6-cover-art-01): an offline web app that turns any photo and a caption into GTA-style cover art — the multi-panel poster / loading-screen look with a Vice City neon-sunset grade — exported as a PNG to share.

## What it does

- **Any photo, several panels:** upload up to 4 photos (or use the two bundled samples). Six layouts — Hero + 3, Four Panel, Nine Panel, Full Bleed, tilted Snapshots, Split Duo — fill panels from your photos.
- **Crop and position per panel:** click a panel to select it, drag it to pan the photo, scroll to zoom, or use the zoom/pan sliders.
- **Caption in the genre's style:** a bold condensed title with a sunset-gradient fill and a neon-glow subtitle, plus a heat-meter star row and badge ribbon.
- **Five grades:** Vice Sunset, Neon Night, Palm Gold, Teal Noir, Mono Heat — gradient-map washes applied per panel, with film grain, vignette and halftone options.
- **Fast and easy:** one click exports 1080×1080, 1080×1350 or 1920×1080 PNGs; "Export all 3 sizes" saves all three at once. Undo/redo and a shuffle-look button included.
- **Private by design:** everything runs offline in the browser from static files under `app/` — photos are read on your machine and never uploaded. No network requests, no libraries.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

## Hand it in

`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored `vendor/makefun-app.ts` library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots in `screenshots/` are real captures from the running app (`shots.json` lists the `?shot=` scene for each).

## Originality

All art, lettering and code are original. No Rockstar Games logo, official artwork or fonts are used. Title lettering is a system condensed sans (Noto Sans Condensed where installed). The two sample photos in `app/samples/` were made for make.fun with an image model and are free to use.

## License

MIT — see [LICENSE](LICENSE).
