#!/usr/bin/env python3
"""Generate data/spot_data.sql from data/spot_data.csv.

Source CSV is CP949-encoded public data with 14 columns. Output is a
MariaDB-compatible script that inserts unique works (IDs starting at
1000 to avoid colliding with the hand-maintained seed in data.sql) and
all place rows via auto-increment.
"""
from __future__ import annotations

import csv
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = REPO_ROOT / "data" / "spot_data.csv"
SQL_PATH = REPO_ROOT / "data" / "spot_data.sql"

WORK_ID_START = 1000  # leaves room for the hand-seeded works (id 1~4) in data.sql
PLACE_BATCH = 500     # keep individual INSERTs below max_allowed_packet defaults
TYPE_MAP = {"drama": "DRAMA", "movie": "MOVIE", "show": "SHOW"}


def esc(value: str | None) -> str:
    if value is None or value == "":
        return "NULL"
    escaped = value.replace("\\", "\\\\").replace("'", "\\'")
    return "'" + escaped + "'"


def region_label(address: str | None) -> str | None:
    if not address:
        return None
    parts = address.split()
    if not parts:
        return None
    return parts[0] if len(parts) == 1 else f"{parts[0]} {parts[1]}"


def main() -> int:
    if not CSV_PATH.exists():
        print(f"csv not found: {CSV_PATH}", file=sys.stderr)
        return 1

    works: dict[str, str] = {}
    places: list[dict] = []
    skipped = 0

    with CSV_PATH.open("r", encoding="cp949", newline="") as f:
        reader = csv.reader(f)
        next(reader, None)  # header
        for row in reader:
            if len(row) < 13:
                skipped += 1
                continue
            try:
                _no, media, title, name, place_type, desc, hours, _break, _closed, address, lat, lng, phone = row[:13]
                lat_f = float(lat)
                lng_f = float(lng)
            except (ValueError, IndexError):
                skipped += 1
                continue
            title = title.strip()
            name = name.strip()
            if not title or not name:
                skipped += 1
                continue
            works.setdefault(title, TYPE_MAP.get(media.strip().lower(), "UNKNOWN"))
            places.append({
                "name": name,
                "region": region_label(address),
                "lat": lat_f,
                "lng": lng_f,
                "address": address or None,
                "place_type": place_type or None,
                "phone": phone or None,
                "hours": hours or None,
                "desc": desc or None,
                "work_title": title,
            })

    sorted_titles = sorted(works.keys())
    work_id: dict[str, int] = {t: WORK_ID_START + i for i, t in enumerate(sorted_titles)}

    place_cols = (
        "name, region_label, latitude, longitude, address, place_type, phone, operating_hours, "
        "work_id, scene_description, cover_image_url, trending_score, photo_count, like_count, "
        "comment_count, rating, nearby_restaurant_count, review_count, create_date, update_date"
    )

    with SQL_PATH.open("w", encoding="utf-8") as out:
        out.write("-- Generated from data/spot_data.csv (CP949 -> UTF-8)\n")
        out.write("-- Regenerate: python3 scripts/gen_spot_sql.py\n")
        out.write("-- Import:     mariadb -u $DB_USER -p$DB_PASSWORD $DB_NAME < data/spot_data.sql\n")
        out.write("-- Work IDs start at 1000 to coexist with the hand-seeded 1~4 in data.sql.\n\n")

        # Works
        if sorted_titles:
            out.write("INSERT IGNORE INTO work (id, title, type, create_date, update_date) VALUES\n")
            rows = [
                f"  ({work_id[t]}, {esc(t)}, '{works[t]}', NOW(), NOW())"
                for t in sorted_titles
            ]
            out.write(",\n".join(rows))
            out.write(";\n\n")

        # Places
        for start in range(0, len(places), PLACE_BATCH):
            chunk = places[start:start + PLACE_BATCH]
            out.write(f"INSERT INTO place ({place_cols}) VALUES\n")
            rows = []
            for p in chunk:
                wid = work_id[p["work_title"]]
                rows.append(
                    "  (" + ", ".join([
                        esc(p["name"]),
                        esc(p["region"]),
                        repr(p["lat"]),
                        repr(p["lng"]),
                        esc(p["address"]),
                        esc(p["place_type"]),
                        esc(p["phone"]),
                        esc(p["hours"]),
                        str(wid),
                        esc(p["desc"]),
                        "NULL",
                        "0", "0", "0", "0", "0", "0", "0",
                        "NOW()", "NOW()",
                    ]) + ")"
                )
            out.write(",\n".join(rows))
            out.write(";\n\n")

    size_mb = SQL_PATH.stat().st_size / (1024 * 1024)
    print(
        f"wrote {len(sorted_titles)} works + {len(places)} places to "
        f"{SQL_PATH.relative_to(REPO_ROOT)} ({size_mb:.1f} MB); "
        f"skipped {skipped} malformed rows",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
