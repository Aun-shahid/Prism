"""
Import project details from docs/Projects/*.md into a user's Prism profile.

Each markdown file is a README-style write-up of one project. This script uses
the user's own configured AI provider (BYOK) to extract clean, resume-ready
project entries (name / description / technologies / url / dates), then appends
the NEW ones to the user's profile — deduping both among the docs and against
projects already on the profile.

Safe by design:
  * DRY-RUN by default — prints exactly what it would add/skip and writes nothing.
    Pass --apply to actually persist.
  * Non-destructive — only appends; never edits or deletes existing projects.
  * Idempotent — re-running skips anything already present (by normalized name).

Usage (from repo root, with the backend venv):
    backend/venv/Scripts/python.exe backend/scripts/import_projects_from_docs.py
    backend/venv/Scripts/python.exe backend/scripts/import_projects_from_docs.py --apply
    ... --email someone@example.com   (defaults to aun.shahid113@gmail.com)
"""
import argparse
import asyncio
import os
import re
import sys

# Make `src` importable whether run from repo root or the scripts dir.
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO_ROOT = os.path.dirname(BACKEND_DIR)
sys.path.insert(0, BACKEND_DIR)

# The Windows console defaults to cp1252 and chokes on em-dashes / accents in
# project names; force UTF-8 so progress output never crashes the run.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

from src.database import get_users_collection, get_profiles_collection  # noqa: E402
from src.services.profile_service import ProfileService  # noqa: E402
from src.services.ai_service import AIService  # noqa: E402
from src.models.profile import Project, ProfileUpdateRequest  # noqa: E402

DOCS_DIR = os.path.join(REPO_ROOT, "docs", "Projects")
DEFAULT_EMAIL = "aun.shahid113@gmail.com"
MAX_DOC_CHARS = 12000  # title/overview/tech-stack live near the top

EXTRACT_SYSTEM_PROMPT = """You extract ONE software project's structured data from its README/markdown, for a developer's professional profile. Respond with ONLY a valid JSON object — no markdown, no code fences:

{
  "name": "a concise, brand-style project name (e.g. 'ANTLIX' or 'DevIA — Construction CRM'). Strip badges, taglines, and markdown. If the heading has a 'Name – Tagline' form, keep just the name plus a very short qualifier.",
  "description": "2-4 plain-text sentences: what the project does and its most notable features/architecture. No markdown, no bullet lists, no headings.",
  "technologies": ["the meaningful stack actually used — frameworks, languages, databases, AI models, key services (e.g. 'FastAPI', 'React', 'TypeScript', 'MongoDB', 'LangGraph', 'OpenAI GPT-4o', 'Stripe'). Max ~12, most important first."],
  "url": "a real live-demo or repository URL if clearly present; else null. Ignore placeholder/example URLs (e.g. containing 'YourOrg', 'example.com', 'your-').",
  "start_date": null,
  "end_date": "only if a real completion date is explicitly stated in the doc, else null"
}

Rules: use ONLY information present in the document — never invent employers, dates, metrics, or tools. Output ONLY the raw JSON object."""


def norm(name: str) -> str:
    """Normalize a project name for dedup: lowercase alphanumeric tokens."""
    return re.sub(r"[^a-z0-9]+", " ", (name or "").lower()).strip()


STOPWORDS = {
    "ai", "app", "the", "for", "and", "platform", "application", "based",
    "powered", "system", "real", "time", "multi", "tenant", "api", "saas",
    "web", "smart", "using", "with", "of", "a", "an",
}


def tokens(name: str) -> set:
    return {t for t in norm(name).split() if len(t) >= 5 and t not in STOPWORDS}


def same_project(a: str, b: str) -> bool:
    """Heuristic: are these two names the same project?"""
    na, nb = norm(a), norm(b)
    if not na or not nb:
        return False
    if na == nb or na in nb or nb in na:
        return True
    ta, tb = tokens(a), tokens(b)
    if ta & tb:                       # share a distinctive (len>=5, non-stopword) token
        return True
    # token as substring of a token on the other side (DevIA vs DeviaOne)
    for x in ta:
        for y in tb:
            if x in y or y in x:
                return True
    return False


async def extract_project(user_id: str, filename: str, text: str) -> dict | None:
    try:
        data, provider = await AIService.generate_json(
            user_id, EXTRACT_SYSTEM_PROMPT, text[:MAX_DOC_CHARS],
        )
    except Exception as e:  # noqa: BLE001
        print(f"    ! extraction failed for {filename}: {e}")
        return None
    if not isinstance(data, dict) or not data.get("name"):
        print(f"    ! no usable data from {filename}")
        return None
    techs = data.get("technologies") or []
    if not isinstance(techs, list):
        techs = [str(techs)]
    url = data.get("url")
    if isinstance(url, str) and (not url.strip() or "your" in url.lower() or "example.com" in url.lower()):
        url = None
    # Match the user's existing "Name | Tagline" convention (AI sometimes uses a dash).
    name = re.sub(r"\s+[–—-]\s+", " | ", str(data["name"]).strip())
    return {
        "name": name,
        "description": (data.get("description") or None),
        "technologies": [str(t).strip() for t in techs if str(t).strip()][:12],
        "url": url or None,
        "start_date": data.get("start_date") or None,
        "end_date": data.get("end_date") or None,
        "_provider": provider,
        "_file": filename,
    }


async def main(email: str, apply: bool) -> None:
    print(f"{'APPLY' if apply else 'DRY-RUN'} — importing projects for {email}\n")

    user = await get_users_collection().find_one({"email": email}) or \
        await get_users_collection().find_one({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}})
    if not user:
        print(f"User not found: {email}")
        return
    user_id = str(user["_id"])
    print(f"User: {user.get('name')} <{user.get('email')}>  ({user_id})")

    profile = await ProfileService.get_or_create_profile(user_id)
    existing = [p.name for p in profile.projects]
    print(f"Existing projects ({len(existing)}): " + (", ".join(existing) or "none") + "\n")

    files = sorted(f for f in os.listdir(DOCS_DIR) if f.lower().endswith(".md"))
    print(f"Found {len(files)} doc(s) in {DOCS_DIR}\n")

    to_add: list[dict] = []
    skipped: list[tuple[str, str]] = []
    accepted_names = list(existing)  # grows as we accept, to dedup among docs too

    for fn in files:
        with open(os.path.join(DOCS_DIR, fn), "r", encoding="utf-8", errors="ignore") as fh:
            text = fh.read()
        print(f"  • {fn} … extracting")
        proj = await extract_project(user_id, fn, text)
        if not proj:
            skipped.append((fn, "extraction failed"))
            continue
        match = next((n for n in accepted_names if same_project(proj["name"], n)), None)
        if match:
            print(f"      = '{proj['name']}' matches existing '{match}' — skip")
            skipped.append((fn, f"duplicate of '{match}'"))
            continue
        accepted_names.append(proj["name"])
        to_add.append(proj)
        print(f"      + will add: {proj['name']}  [{', '.join(proj['technologies'][:6])}]")

    print("\n" + "=" * 64)
    print(f"Would add {len(to_add)} project(s); skipped {len(skipped)}.")
    for p in to_add:
        print(f"  + {p['name']}  (from {p['_file']}, via {p['_provider']})")
        if p.get("url"):
            print(f"      url: {p['url']}")
    if skipped:
        print("  skipped:")
        for fn, why in skipped:
            print(f"    - {fn}: {why}")

    if not apply:
        print("\nDRY-RUN — nothing written. Re-run with --apply to persist.")
        return
    if not to_add:
        print("\nNothing new to add.")
        return

    merged = [p.model_dump() for p in profile.projects] + [
        Project(
            name=p["name"], description=p["description"], technologies=p["technologies"],
            url=p["url"], start_date=p["start_date"], end_date=p["end_date"],
        ).model_dump() for p in to_add
    ]
    await ProfileService.update_profile(user_id, ProfileUpdateRequest(projects=merged))
    print(f"\nDone — profile now has {len(merged)} projects.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Import projects from docs/Projects into a Prism profile.")
    ap.add_argument("--email", default=DEFAULT_EMAIL)
    ap.add_argument("--apply", action="store_true", help="actually write (default is dry-run)")
    args = ap.parse_args()
    asyncio.run(main(args.email, args.apply))
