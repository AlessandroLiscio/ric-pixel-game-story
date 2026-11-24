#!/usr/bin/env python
"""Turn private reference photos into cohesive 640x360 pixel-art game backgrounds.

Pipeline per photo: face/text patches, 16:9 crop, resize to 640x360, mild pre-blur,
auto-levels + contrast/saturation boost, median smoothing (painted look), extra flattening
of low-detail areas, then ONE shared 32-colour palette (k-means in Lab, fixed seed) and a
4x4 Bayer ordered dither. Output: palette-indexed PNGs + palette.json.

Quiet by default: one status line per stage, full details in logs/backgrounds/<run>.log.
Usage: python scripts/art/backgrounds.py [--src DIR] [--out DIR] [--contact-sheet FILE] [--verbose] [--check-only]
The photo folder defaults to env REF_PHOTOS_DIR. Exit codes: 0 pass, 1 check failed, 2 bad input.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

W, H = 640, 360
N_COLOURS = 32
SEED = 20261124
MAX_BYTES = 150 * 1024
IDS = ["universita", "giuggiu", "giardini", "circe", "cortile", "divano"]

# Per background: source photo (relative to --src), crop box in source pixels after EXIF rotation
# (x0, y0, x1, y1; must be 16:9), patches = ellipses (cx, cy, rx, ry) in source pixels painted over
# with a flat blurred patch of the local colours (faces, signs, text) BEFORE pixelising,
# and grading parameters.
CONFIG: dict[str, dict] = {
    "universita": {
        "file": "universita/aula-lato-cattedra-professore.jpg",
        "crop": (0, 4, 1800, 1016),
        "patches": [],
        "gamma": 0.95, "sat": 1.25, "contrast": 1.15,
    },
    "giuggiu": {
        "file": "casa-giuggiu/casa-giuggiu-salotto-lato-finestra.jpg",
        "crop": (0, 100, 1600, 1000),
        "patches": [],
        "gamma": 0.55, "sat": 1.3, "contrast": 1.1,
    },
    "giardini": {
        "file": "giardini-margherita/giardini-margherita-1.jpeg",
        "crop": (0, 520, 946, 1052),
        "patches": [],
        "gamma": 0.95, "sat": 1.15, "contrast": 1.15,
    },
    "circe": {
        "file": "casa-circe/casa-circe-zona-cucina.jpeg",
        "crop": (0, 150, 1024, 726),
        # five faces and the door sign
        "patches": [(154, 410, 43, 50), (384, 394, 45, 50), (742, 268, 35, 40), (937, 297, 50, 60),
                    (773, 401, 45, 48), (343, 287, 28, 22)],
        "gamma": 1.1, "sat": 1.0, "contrast": 1.1, "wb": 0.6,
    },
    "cortile": {
        "file": "cortile-cafe/cortile-cafe-lato-scale.jpeg",
        "crop": (0, 480, 1170, 1138),
        # balcony faces, a crowd face and the venue sign
        "patches": [(283, 228, 30, 34), (375, 283, 30, 34), (439, 329, 30, 34), (493, 365, 30, 34),
                    (585, 439, 30, 34), (658, 517, 28, 32), (731, 517, 28, 32), (799, 512, 28, 32),
                    (919, 521, 28, 32), (987, 536, 28, 32), (965, 874, 22, 26), (55, 960, 40, 50),
                    (850, 850, 135, 48), (640, 925, 38, 42), (600, 955, 30, 34)],
        "gamma": 0.85, "sat": 1.2, "contrast": 1.05, "wb": 0.5,
    },
    "divano": {
        "file": "casa-circe/casa-circe-tavolo-divano.jpeg",
        "crop": (0, 140, 780, 579),  # leaves the woman at the table (right edge) out of frame
        # the face on the sofa
        "patches": [(872, 415, 70, 80), (558, 374, 38, 45)],
        "gamma": 1.0, "sat": 1.0, "contrast": 1.1, "wb": 0.6,
    },
}

BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32)
DITHER = 22.0  # offset amplitude in 0..255 RGB units around each pixel before nearest-colour lookup


def srgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    c = rgb.astype(np.float64) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750],
                  [0.0193339, 0.1191920, 0.9503041]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def paint_patches(img: Image.Image, patches: list[tuple]) -> Image.Image:
    """Flat blurred patch of the mean colour of the ring around each ellipse."""
    arr = np.asarray(img, dtype=np.float32)
    yy, xx = np.mgrid[0:img.height, 0:img.width]
    out = img.copy()
    for cx, cy, rx, ry in patches:
        d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
        ring = (d > 1.2) & (d < 2.0)
        if not ring.any():
            continue
        colour = tuple(int(v) for v in np.median(arr[ring], axis=0))
        mask = Image.fromarray(((d <= 1.15) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(max(rx, ry) * 0.18))
        out = Image.composite(Image.new("RGB", img.size, colour), out, mask)
    return out


def grade(img: Image.Image, p: dict) -> Image.Image:
    img = img.filter(ImageFilter.GaussianBlur(0.7))  # mild pre-blur at 640x360
    a = np.asarray(img, dtype=np.float32)
    wb = p.get("wb", 0.0)  # partial grey-world white balance (0 = off)
    if wb:
        mean = a.reshape(-1, 3).mean(0)
        a = np.clip(a * ((mean.mean() / mean) ** wb), 0, 255)
    img = ImageOps.autocontrast(Image.fromarray(a.astype(np.uint8)), cutoff=1)
    a = np.asarray(img, dtype=np.float32) / 255.0
    img = Image.fromarray((np.clip(a ** p["gamma"], 0, 1) * 255).astype(np.uint8))
    img = ImageEnhance.Contrast(img).enhance(p["contrast"])
    return ImageEnhance.Color(img).enhance(p["sat"])


def flatten(img: Image.Image) -> Image.Image:
    """Median smoothing, then a stronger median where the picture has little detail (painted flats)."""
    soft = img.filter(ImageFilter.MedianFilter(5))
    soft = soft.filter(ImageFilter.MedianFilter(3))
    strong = soft.filter(ImageFilter.MedianFilter(9)).filter(ImageFilter.GaussianBlur(1.2))
    grey = np.asarray(soft.convert("L"), dtype=np.float32)
    gy, gx = np.gradient(grey)
    g = Image.fromarray(np.clip(np.hypot(gx, gy) * 20, 0, 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(4))
    flat = np.clip(1.0 - np.asarray(g, dtype=np.float32) / 70.0, 0, 1)[..., None]
    mixed = np.asarray(soft, dtype=np.float32) * (1 - flat) + np.asarray(strong, dtype=np.float32) * flat
    out = Image.fromarray(np.clip(mixed, 0, 255).astype(np.uint8))
    return out.filter(ImageFilter.UnsharpMask(radius=1.5, percent=90, threshold=3))  # crisp edges before dithering


def prepare(src_dir: Path, bid: str) -> tuple[Image.Image, int]:
    cfg = CONFIG[bid]
    img = ImageOps.exif_transpose(Image.open(src_dir / cfg["file"])).convert("RGB")
    x0, y0, x1, y1 = cfg["crop"]
    assert abs((x1 - x0) * 9 - (y1 - y0) * 16) <= 16, f"{bid}: crop is not 16:9"
    img = paint_patches(img, cfg["patches"])
    img = img.crop(cfg["crop"]).resize((W, H), Image.LANCZOS)
    return flatten(grade(img, cfg)), len(cfg["patches"])


def kmeans_palette(images: dict[str, Image.Image]) -> np.ndarray:
    rng = np.random.default_rng(SEED)
    per = 12000
    pts = []
    for im in images.values():
        flat = np.asarray(im).reshape(-1, 3)
        pts.append(flat[rng.choice(len(flat), per, replace=False)])
    rgb = np.concatenate(pts)
    lab = srgb_to_lab(rgb)
    # k-means++ init, then Lloyd iterations
    centres = [lab[rng.integers(len(lab))]]
    for _ in range(N_COLOURS - 1):
        d = np.min(((lab[:, None, :] - np.array(centres)[None]) ** 2).sum(-1), axis=1)
        centres.append(lab[rng.choice(len(lab), p=d / d.sum())])
    centres = np.array(centres)
    for _ in range(40):
        idx = ((lab[:, None, :] - centres[None]) ** 2).sum(-1).argmin(1)
        for k in range(N_COLOURS):
            sel = lab[idx == k]
            if len(sel):
                centres[k] = sel.mean(0)
    idx = ((lab[:, None, :] - centres[None]) ** 2).sum(-1).argmin(1)
    pal = np.array([rgb[idx == k].mean(0) if (idx == k).any() else rgb[rng.integers(len(rgb))] for k in range(N_COLOURS)])
    pal = np.clip(np.round(pal), 0, 255).astype(np.uint8)
    pal = np.unique(pal, axis=0)  # drop exact duplicates, then order dark to light
    lum = pal @ np.array([0.299, 0.587, 0.114])
    return pal[np.argsort(lum, kind="stable")]


def dither_to_indices(im: Image.Image, pal: np.ndarray) -> np.ndarray:
    a = np.asarray(im, dtype=np.float32)
    thr = (np.tile(BAYER4, (H // 4, W // 4)) + 0.5) / 16.0 - 0.5
    a = np.clip(a + thr[..., None] * 2 * DITHER, 0, 255)
    lab = srgb_to_lab(a.reshape(-1, 3))
    plab = srgb_to_lab(pal)
    return ((lab[:, None, :] - plab[None]) ** 2).sum(-1).argmin(1).reshape(H, W).astype(np.uint8)


def save_indexed(idx: np.ndarray, pal: np.ndarray, path: Path) -> None:
    out = Image.fromarray(idx, "P")
    flat = [c for rgb in pal for c in rgb] + [0] * 3 * (256 - len(pal))
    out.putpalette(flat)
    out.save(path, optimize=True, compress_level=9)


def check(out_dir: Path) -> tuple[bool, list[str]]:
    errs = []
    try:
        pal = {c.lower() for c in json.loads((out_dir / "palette.json").read_text())}
    except Exception as e:  # noqa: BLE001
        return False, [f"palette.json unreadable: {e}"]
    if not 1 <= len(pal) <= N_COLOURS:
        errs.append(f"palette has {len(pal)} colours")
    for bid in IDS:
        f = out_dir / f"{bid}.png"
        if not f.exists():
            errs.append(f"{bid}: missing")
            continue
        im = Image.open(f)
        if im.size != (W, H):
            errs.append(f"{bid}: size {im.size}")
        cols = {"#%02x%02x%02x" % c for _, c in im.convert("RGB").getcolors(W * H)}
        if len(cols) > N_COLOURS:
            errs.append(f"{bid}: {len(cols)} colours")
        if not cols <= pal:
            errs.append(f"{bid}: colours outside palette.json")
        if f.stat().st_size > MAX_BYTES:
            errs.append(f"{bid}: {f.stat().st_size // 1024} KB > 150 KB")
    return not errs, errs


def contact_sheet(out_dir: Path, dest: Path) -> None:
    sheet = Image.new("RGB", (W * 2 + 30, H * 3 + 40), (30, 30, 30))
    for i, bid in enumerate(IDS):
        sheet.paste(Image.open(out_dir / f"{bid}.png").convert("RGB"), (10 + (i % 2) * (W + 10), 10 + (i // 2) * (H + 10)))
    sheet.save(dest)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", default=os.environ.get("REF_PHOTOS_DIR"), help="reference photos folder (default env REF_PHOTOS_DIR)")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parents[2] / "public" / "assets" / "backgrounds"))
    ap.add_argument("--contact-sheet", help="also write a contact sheet PNG here (keep it outside the repo)")
    ap.add_argument("--check-only", action="store_true", help="only verify existing outputs")
    ap.add_argument("--verbose", action="store_true", help="echo the log to the console")
    args = ap.parse_args()
    out_dir = Path(args.out)
    root = Path(__file__).resolve().parents[2]
    logdir = root / "logs" / "backgrounds"
    logdir.mkdir(parents=True, exist_ok=True)
    for old in sorted(logdir.glob("run_*.log"))[:-9]:
        old.unlink()
    log_path = logdir / f"run_{time.strftime('%Y%m%d_%H%M%S')}.log"
    log = log_path.open("w", encoding="utf-8")

    def say(msg: str, console: bool = False) -> None:
        log.write(msg + "\n")
        if console or args.verbose:
            print(msg)

    if not args.check_only:
        if not args.src or not Path(args.src).is_dir():
            print("FAIL input: pass --src or set REF_PHOTOS_DIR to the reference photos folder")
            return 2
        src = Path(args.src)
        out_dir.mkdir(parents=True, exist_ok=True)
        prepared = {}
        for bid in IDS:
            try:
                prepared[bid], n = prepare(src, bid)
                say(f"prepared {bid}: {CONFIG[bid]['file']}, {n} patches")
            except Exception as e:  # noqa: BLE001
                say(f"FAIL {bid}: {e!r}", True)
                print(f"FAIL logs: {log_path.relative_to(root)}")
                return 2
        pal = kmeans_palette(prepared)
        (out_dir / "palette.json").write_text(json.dumps(["#%02x%02x%02x" % tuple(c) for c in pal], indent=1) + "\n")
        say(f"palette: {len(pal)} colours")
        print(f"OK   palette ({len(pal)} colours)")
        for bid in IDS:
            idx = dither_to_indices(prepared[bid], pal)
            save_indexed(idx, pal, out_dir / f"{bid}.png")
            kb = (out_dir / f"{bid}.png").stat().st_size // 1024
            say(f"{bid}: {kb} KB")
            print(f"OK   {bid} ({kb} KB)")
        if args.contact_sheet:
            contact_sheet(out_dir, Path(args.contact_sheet))
    ok, errs = check(out_dir)
    for e in errs[:5]:
        print(f"     {e}")
    if not ok:
        print(f"FAIL backgrounds: {len(errs)} problems · log: {log_path.relative_to(root)}")
        return 1
    print("PASS backgrounds: 6 files, 640x360, shared 32-colour palette")
    return 0


if __name__ == "__main__":
    sys.exit(main())
