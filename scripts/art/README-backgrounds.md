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

1. Paints a flat blurred patch of the local colours over every face and sign listed in `CONFIG[...]["patches"]` (source-pixel ellipses), before anything else.
2. Crops the explicit 16:9 box from `CONFIG[...]["crop"]` and resizes to 640x360.
3. Mild blur, optional partial white balance, auto-levels, gamma, contrast and saturation (per-background values in `CONFIG`).
4. Median smoothing, with a stronger median on low-detail areas so large surfaces read as painted flats, then a light unsharp mask for crisp edges.
5. One shared palette of at most 32 colours: k-means in Lab over equal-sized samples from all six images, fixed seed, sorted dark to light, written to `palette.json`.
6. 4x4 Bayer ordered dither against that palette, saved as a palette-indexed PNG (each file stays well under 150 KB).

The result is deterministic: the same photos and versions give byte-identical output. Edit the PNGs by hand in Pixelorama afterwards; they are plain indexed PNGs using the shared palette (import `palette.json` colours, or load the PNG's own palette).

To change a crop, a patch or the grading, edit `CONFIG` at the top of the script and rerun.
