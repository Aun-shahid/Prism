"""
Pure, side-effect-free helpers shared by the company-target scraper and the
general-feed scraper. Keeping these free of I/O makes them trivial to unit-test
and safe to reuse in both scraping paths.

Responsibilities:
  * normalize_job_url  — stable de-duplication key for a posting URL
  * is_excluded        — apply a user's job_preferences.exclusions list
  * looks_like_job_link — filter navigation/footer noise out of HTML scrapes
"""

from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

# Query params that are pure tracking / attribution and never identify a posting.
# We strip these so the same job with different UTM tags de-duplicates cleanly,
# but we KEEP everything else because some ATSs encode the job id in the query
# string (e.g. Greenhouse `?gh_jid=123`, Workday `?jobId=...`).
_TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "utm_id", "utm_name", "gclid", "fbclid", "msclkid", "mc_cid", "mc_eid",
    "ref", "referrer", "source", "src", "trk", "trackingid", "trk_trk",
    "originalsubdomain", "gh_src", "lever-source", "lever-origin",
    "_gl", "igshid",
}

# Link text / URL path fragments that indicate a NON-posting link. Used to prune
# the noise (nav, footer, legal, social) that generic career pages are full of.
_NON_JOB_TERMS = {
    "login", "log in", "sign in", "signin", "sign up", "signup", "register",
    "privacy", "cookie", "cookies", "terms", "gdpr", "legal", "imprint",
    "about", "about us", "contact", "contact us", "home", "homepage",
    "blog", "news", "press", "media", "investor", "investors",
    "sitemap", "help", "support", "faq", "faqs", "search", "menu",
    "facebook", "twitter", "linkedin", "instagram", "youtube", "github",
    "download", "subscribe", "newsletter", "share", "apply now", "learn more",
    "read more", "view all", "see all", "all jobs", "all openings", "back",
    "previous", "next", "cookie policy", "privacy policy", "terms of service",
    "accessibility", "diversity", "benefits", "our team", "leadership",
    "life at", "culture", "values", "mission", "why join", "perks",
}


def _clean_query(query: str) -> str:
    """Drop tracking params from a query string, preserving meaningful ones."""
    if not query:
        return ""
    kept = [(k, v) for k, v in parse_qsl(query, keep_blank_values=True)
            if k.lower() not in _TRACKING_PARAMS]
    return urlencode(kept)


def normalize_job_url(url: str) -> str:
    """
    Produce a stable de-duplication key for a job posting URL.

    Lowercases the scheme+host, drops the fragment and known tracking params,
    and strips a trailing slash from the path. Meaningful query params (job ids)
    are preserved so distinct postings on the same ATS stay distinct.

    Returns the original (stripped) string unchanged if it cannot be parsed.
    """
    if not url:
        return ""
    raw = url.strip()
    try:
        parsed = urlparse(raw)
    except Exception:
        return raw.rstrip("/").lower()

    if not parsed.netloc:
        # Relative or malformed — fall back to a lowercased, trimmed form.
        return raw.rstrip("/").lower()

    scheme = (parsed.scheme or "https").lower()
    netloc = parsed.netloc.lower()
    path = parsed.path.rstrip("/") or "/"
    query = _clean_query(parsed.query)
    return urlunparse((scheme, netloc, path, "", query, ""))


def is_excluded(exclusions, *texts) -> bool:
    """
    True if any exclusion term (case-insensitive substring) appears in any of the
    provided text fields. Exclusions are free-text and may name a company,
    keyword, or location — so we match against a combined haystack built from
    whatever the caller passes (title, company, snippet, url, location).

    Empty/whitespace exclusion terms are ignored so a stray blank never nukes
    every posting.
    """
    if not exclusions:
        return False
    haystack = " ".join(t for t in texts if t).lower()
    if not haystack:
        return False
    for term in exclusions:
        term = (term or "").strip().lower()
        if term and term in haystack:
            return True
    return False


def looks_like_job_link(text: str, url: str) -> bool:
    """
    Heuristic to keep only plausible individual job-posting links when scraping a
    raw career page. Rejects obvious navigation/legal/social links and links with
    trivially short anchor text. This is a best-effort noise filter — the caller
    still applies keyword matching on top.
    """
    text = (text or "").strip()
    if len(text) < 3:
        return False

    lowered_text = text.lower()
    # Reject if the whole anchor text IS a non-job term, or the URL path clearly
    # points at a non-posting section.
    for term in _NON_JOB_TERMS:
        if lowered_text == term or lowered_text.startswith(term + " "):
            return False

    try:
        path = urlparse(url).path.lower()
    except Exception:
        path = url.lower()
    non_job_path_bits = (
        "/privacy", "/cookie", "/terms", "/login", "/signin", "/sign-in",
        "/about", "/contact", "/blog", "/news", "/press", "/legal",
        "/investor", "/help", "/support", "/faq",
    )
    if any(bit in path for bit in non_job_path_bits):
        return False

    return True
