#!/usr/bin/env python3
"""Runs `pxl lint` (the vendored skill in .claude/skills/pxl) over every frame of every walk sheet.

Usage: python -I scripts/art/pxl/lint_sheets.py [--sheets DIR] [-v]
Rows linted: down, left, right, up (32x32 frames, so 12 per sheet). Needs Node 22.18 or later, nothing else.
Output: one PASS or FAIL line; the full pxl report is written to logs/pxl-lint/lint.log. -v also prints each finding.
Exit codes: 0 = no findings, 1 = findings, 2 = pxl did not run.
"""
import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PXL = ROOT / ".claude" / "skills" / "pxl" / "bin" / "pxl.js"
WORK = ROOT / "logs" / "pxl-lint"
ROWS = (("d", 0), ("l", 1), ("r", 2), ("u", 3))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheets", default=str(ROOT / "public" / "assets" / "characters"))
    ap.add_argument("-v", action="store_true", help="print every finding")
    args = ap.parse_args()
    sheets = sorted(Path(args.sheets).glob("*.png"))
    WORK.mkdir(parents=True, exist_ok=True)
    lines = []
    for sh in sheets:
        (WORK / sh.name).write_bytes(sh.read_bytes())
        for rn, row in ROWS:
            for col in range(3):
                lines.append(f'sprite("{sh.stem}_{rn}{col}", {{ w: 32, h: 32 }}, image("{sh.name}", {-32 * col}, {-32 * row}, {{ scale: 1, palette: false }}))')
    (WORK / "lint.px.js").write_text("\n".join(lines) + "\n", encoding="utf-8")
    r = subprocess.run(["node", str(PXL), "lint", str(WORK / "lint.px.js"), "--no-preview"], capture_output=True, text=True, encoding="utf-8")
    (WORK / "lint.log").write_text(r.stdout + r.stderr, encoding="utf-8")
    if r.returncode:
        print(f"FAIL pxl lint did not run -> {(WORK / 'lint.log').relative_to(ROOT).as_posix()}")
        return 2
    counts, found, cur = {}, [], None
    for ln in r.stdout.splitlines():
        m = re.match(r"^(\S+): \d+ finding", ln)
        if m:
            cur = m.group(1)
            continue
        m = re.match(r"^  (orphan|jaggy|pillow|colors|near-duplicate)\s+(.*)", ln)
        if m and cur:
            counts[m.group(1)] = counts.get(m.group(1), 0) + 1
            found.append(f"{cur} {m.group(1)}: {m.group(2)[:80]}")
    if args.v:
        print("\n".join(found))
    if counts:
        print(f"FAIL pxl lint: {sum(counts.values())} findings {counts} in {len(lines)} frames -> {(WORK / 'lint.log').relative_to(ROOT).as_posix()}")
        return 1
    print(f"PASS pxl lint: {len(lines)} frames of {len(sheets)} sheets, 0 findings")
    return 0


if __name__ == "__main__":
    sys.exit(main())
