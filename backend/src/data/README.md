# Bundled data

## `onet_job_titles.json`

A flat, deduplicated, display-cased list of ~51k job titles (canonical
occupation titles + real-world alternate/lay titles), used to power
autocomplete suggestions on the Target Job Titles (Profile) and watchlist
keyword fields.

**Source:** [O\*NET 30.3 Database](https://www.onetcenter.org/database.html)
("Occupation Data" + "Job Titles" files), developed by the U.S. Department
of Labor, Employment and Training Administration (USDOL/ETA).

**License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — this
project includes information from the O\*NET 30.3 Database by the U.S.
Department of Labor, Employment and Training Administration (USDOL/ETA).
O\*NET&reg; is a trademark of USDOL/ETA.

**Regenerate:** `backend/venv/Scripts/python.exe backend/scripts/build_title_taxonomy.py`

This is a plain lookup list for a human to pick from — not an automated
backend relevance-matching signal (see `services/title_taxonomy.py` for why).
