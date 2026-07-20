"""
One-time dev script: build the offline job-title dataset used by
`services/title_taxonomy.py` to power autocomplete suggestions on the
Target Job Titles / watchlist keyword fields, from the public O*NET database
(US Dept of Labor, O*NET 30.3, CC BY 4.0 — https://www.onetcenter.org/database.html).

Downloads "Occupation Data.txt" (canonical occupation titles) and
"Job Titles.txt" (real-world alternate/lay titles), and writes a flat,
deduplicated, display-cased, sorted JSON array of title strings to
backend/src/data/onet_job_titles.json. This output is what ships with the
app; this script itself is not run in production.

This is a plain lookup list for the USER to pick from on the frontend — not
an automated backend relevance-matching signal. (A single word like
"Programmer" genuinely spans unrelated occupations in this data — e.g. both
a software role and a CNC-machining role — which is fine for a human
choosing a title, but unsound as an automatic equivalence for filtering.)

Usage:
    backend/venv/Scripts/python.exe backend/scripts/build_title_taxonomy.py
"""

import csv
import json
import os
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

OCCUPATION_DATA_URL = "https://www.onetcenter.org/dl_files/database/db_30_3_text/Occupation%20Data.txt"
JOB_TITLES_URL = "https://www.onetcenter.org/dl_files/database/db_30_3_text/Job%20Titles.txt"

OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "src", "data", "onet_job_titles.json")


def _fetch_tsv(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        text = resp.read().decode("utf-8")
    return list(csv.DictReader(text.splitlines(), delimiter="\t"))


def main():
    print("Fetching O*NET Occupation Data...")
    occupations = _fetch_tsv(OCCUPATION_DATA_URL)
    print(f"  {len(occupations)} occupations")

    print("Fetching O*NET Job Titles (alternate titles)...")
    job_titles = _fetch_tsv(JOB_TITLES_URL)
    print(f"  {len(job_titles)} alternate titles")

    seen_lower = set()
    titles = []

    def _add(raw: str):
        t = (raw or "").strip()
        if not t:
            return
        key = t.lower()
        if key in seen_lower:
            return
        seen_lower.add(key)
        titles.append(t)

    # Canonical occupation titles first (cleanest, most standard phrasing),
    # then real-world alternates.
    for row in occupations:
        _add(row["Title"])
    for row in job_titles:
        _add(row["Job Title"])
        short = row.get("Short Title") or ""
        if short.strip().lower() != "n/a":
            _add(short)

    titles.sort(key=str.lower)

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(titles, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = os.path.getsize(OUT_PATH) / 1024
    print(f"Wrote {len(titles)} unique titles ({size_kb:.0f} KB) to {OUT_PATH}")


if __name__ == "__main__":
    main()
