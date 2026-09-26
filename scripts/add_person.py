#!/usr/bin/env python3
"""Add or update one person in people/people.csv from an approved application.

Reads the `repository_dispatch` event that `scripts/apps-script/Code.gs`
sends when a maintainer approves a row in the applications Google Sheet
(the file at $GITHUB_EVENT_PATH). Its `client_payload` holds:

    name, title, institution, profile_url   plain strings
    email_sha256                            SHA-256 hex of the lower-cased email
    photo_b64, photo_type                   optional, the resized photo

The Apps Script hashes the email, so the plain address never reaches GitHub
(people.csv is published with the site). A row matches an existing row by
email_sha256, else by name.
A match is updated in place, so a person can apply again to change
their details. A new photo is written to images/people/<slug>.<ext>.

Writes `action=added|updated` and `name=<name>` to $GITHUB_OUTPUT.
"""

import base64
import csv
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PEOPLE_CSV = ROOT / "people" / "people.csv"
PHOTO_DIR = ROOT / "images" / "people"

TEXT_FIELDS = ("name", "title", "institution", "profile_url", "email_sha256")
MAX_LEN = 200
PHOTO_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
PHOTO_MAGIC = {"jpg": (b"\xff\xd8\xff",), "png": (b"\x89PNG",), "webp": (b"RIFF",)}


def fail(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def clean(value) -> str:
    # NFC so Vietnamese names typed on different devices compare equal.
    text = unicodedata.normalize("NFC", str(value or "")).strip()
    return re.sub(r"\s+", " ", text)[:MAX_LEN]


def slugify(name: str) -> str:
    # "đ" has no decomposition, so NFKD alone would drop it.
    ascii_name = unicodedata.normalize(
        "NFKD", name.replace("đ", "d").replace("Đ", "D")
    ).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")


def main() -> int:
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text("utf-8"))
    payload = event.get("client_payload") or {}

    person = {field: clean(payload.get(field)) for field in TEXT_FIELDS}
    person["email_sha256"] = person["email_sha256"].lower()
    if person["email_sha256"] and not re.fullmatch(r"[0-9a-f]{64}", person["email_sha256"]):
        fail("email_sha256 is not a SHA-256 hex digest")
    if not person["name"]:
        fail("payload has no name")
    # The URL lands in an <a href>, so only allow http(s) (blocks javascript:).
    if person["profile_url"] and not re.match(r"^https?://", person["profile_url"]):
        print(f"warning: dropping non-http profile_url {person['profile_url']!r}")
        person["profile_url"] = ""

    slug = slugify(person["name"])
    if not slug:
        fail(f"cannot build a file name from {person['name']!r}")

    with PEOPLE_CSV.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        header = reader.fieldnames
        rows = list(reader)

    def same_person(row) -> bool:
        if person["email_sha256"]:
            return (row.get("email_sha256") or "").strip().lower() == person["email_sha256"]
        return clean(row.get("name")).casefold() == person["name"].casefold()

    existing = next((row for row in rows if same_person(row)), None)
    row = existing if existing is not None else {col: "" for col in header}

    # Two different people can share a name; give each their own photo file.
    taken = {
        Path(r.get("photo") or "").stem for r in rows if r is not row
    }
    base, n = slug, 2
    while slug in taken:
        slug, n = f"{base}-{n}", n + 1
    for field in TEXT_FIELDS:
        row[field] = person[field]

    if payload.get("photo_b64"):
        ext = PHOTO_TYPES.get(clean(payload.get("photo_type")).lower())
        if ext is None:
            fail(f"unsupported photo type {payload.get('photo_type')!r}")
        data = base64.b64decode(payload["photo_b64"], validate=True)
        if not data.startswith(PHOTO_MAGIC[ext]):
            fail(f"photo bytes do not look like {ext}")
        PHOTO_DIR.mkdir(parents=True, exist_ok=True)
        # Remove an older photo of this person with another extension.
        for old in PHOTO_DIR.glob(f"{slug}.*"):
            old.unlink()
        (PHOTO_DIR / f"{slug}.{ext}").write_bytes(data)
        row["photo"] = f"/images/people/{slug}.{ext}"

    if existing is None:
        rows.append(row)

    with PEOPLE_CSV.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=header, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    action = "updated" if existing is not None else "added"
    print(f"{action} {person['name']}")
    if "GITHUB_OUTPUT" in os.environ:
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as out:
            out.write(f"action={action}\nname={person['name']}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
