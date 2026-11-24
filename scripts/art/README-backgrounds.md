# Background pipeline

`backgrounds.py` turns the private reference photos into the six 640x360 pixel-art backgrounds in `public/assets/backgrounds/`. The photos are never copied into the repository: only the converted PNGs and `palette.json` are committed.

## Run

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r scripts\art\requirements.txt
$env:REF_PHOTOS_DIR = "C:\path\to\reference_photos"
.venv\Scripts\python scripts\art\backgrounds.py
```

Flags: `--src DIR` (instead of the env variable), `--out DIR`, `--contact-sheet FILE` (writes an overview PNG, keep it outside the repository), `--check-only` (only verify the existing outputs), `--verbose`. Output is one line per stage and a final `PASS backgrounds: 6 files, 640x360, shared 32-colour palette`; the full log of each run is in `logs/backgrounds/`. Exit codes: 0 pass, 1 check failed, 2 bad input.

## What it does

1. Covers every face and sign listed in `CONFIG[...]["patches"]` (source-pixel ellipses) before anything else: a sign (index in `CONFIG[...]["signs"]`) becomes a flat disc of the ring colour, a face becomes a simple head (hair-dark ellipse with a small featureless skin-tone face) with nearly hard edges.
2. Crops the explicit 16:9 box from `CONFIG[...]["crop"]` and resizes to 640x360.
3. Mild blur, optional partial white balance, auto-levels, gamma, contrast and saturation (per-background values in `CONFIG`).
4. Median smoothing, with a stronger median on low-detail areas so large surfaces read as painted flats, then a light unsharp mask for crisp edges.
5. Pixelise: another mild sharpen so lines survive, strong box downsample to a 320x180 art-pixel grid, a 3x3 median against noise, and a one-pixel dark outline (80 % brightness) on the darker side of strong luminance edges.
6. One shared palette of at most 32 colours: k-means in Lab over equal-sized samples from the six 320x180 images, fixed seed, sorted dark to light, written to `palette.json`.
7. 4x4 Bayer ordered dither at 320x180 (half the old strength) against that palette, then 2x nearest-neighbour upscale to 640x360, so every art pixel is a 2x2 block. Saved as a palette-indexed PNG (each file stays well under 150 KB).

The check at the end asserts size, the shared palette, the file size and that every 2x2 block of every output is uniform (a true 2x2 pixel grid). Crops, framing and tone grading are unchanged from the earlier blurry version, so the coordinates in `docs/art-backgrounds.md` stay valid (compared edge maps of old and new: no shift at all, within the 1 px search resolution of a +-6 px window).

The result is deterministic: the same photos and versions give byte-identical output. Edit the PNGs by hand in Pixelorama afterwards; they are plain indexed PNGs using the shared palette (import `palette.json` colours, or load the PNG's own palette). Paint at the 320x180 grid (or draw 2x2 blocks) to keep the pixel grid; the check fails otherwise.

To change a crop, a patch or the grading, edit `CONFIG` at the top of the script and rerun.
