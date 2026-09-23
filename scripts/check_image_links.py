#!/usr/bin/env python3
"""Check that every image referenced in .qmd files and people.csv exists.

Extracts image paths from:
- `image:` front-matter keys in .qmd files
- markdown image syntax `![alt](path)` in .qmd files
- the `photo` column of people/people.csv

Paths are resolved relative to the referencing file's directory, so
`../images/news/x.jpg` inside `news/` resolves correctly. Absolute
(`/images/...`) paths resolve against the repo root.

Exits 1 with a report if any referenced file is missing.
"""

import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FRONT_MATTER_IMAGE = re.compile(r"^image:\s*(.+?)\s*$", re.MULTILINE)
MARKDOWN_IMAGE = re.compile(r"!\[[^\]]*\]\(([^)\s]+)")


def extract_qmd_images(path: Path):
    text = path.read_text(encoding="utf-8")
    for match in FRONT_MATTER_IMAGE.finditer(text):
        yield match.group(1).strip().strip("'\"")
    for match in MARKDOWN_IMAGE.finditer(text):
        yield match.group(1).strip()


def resolve(ref: str, base: Path) -> Path:
    if ref.startswith("/"):
        return ROOT / ref.lstrip("/")
    return (base / ref).resolve()


def main() -> int:
    broken = []

    for qmd in ROOT.rglob("*.qmd"):
        if "_site" in qmd.parts or "_templates" in qmd.parts:
            continue
        for ref in extract_qmd_images(qmd):
            if ref.startswith(("http://", "https://")):
                continue
            target = resolve(ref, qmd.parent)
            if not target.is_file():
                broken.append(f"{qmd.relative_to(ROOT)}: {ref}")

    people_csv = ROOT / "people" / "people.csv"
    if people_csv.exists():
        with people_csv.open(encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                photo = (row.get("photo") or "").strip()
                if not photo or photo.startswith(("http://", "https://")):
                    continue
                if not resolve(photo, ROOT).is_file():
                    broken.append(f"people/people.csv: {photo}")

    if broken:
        print("Broken image references found:\n")
        for entry in broken:
            print(f"  - {entry}")
        print(f"\n{len(broken)} broken reference(s).")
        return 1

    print("All image references OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
