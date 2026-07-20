"""
Pure, side-effect-free helpers shared by the company-target scraper and the
general-feed scraper. Keeping these free of I/O makes them trivial to unit-test
and safe to reuse in both scraping paths.

Responsibilities:
  * normalize_job_url        — stable de-duplication key for a posting URL
  * is_excluded               — apply a user's job_preferences.exclusions list
  * looks_like_job_link       — filter navigation/footer noise out of HTML scrapes
  * keyword_matches           — relevance match between a job title and search keywords
  * extract_years_experience — pull a "years of experience" requirement out of a
                                 job description via a small regex dictionary (no AI)
"""

import re
from typing import Optional
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

_STOPWORDS = {"a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "at", "with", "&"}


def _tokenize(text: str) -> set:
    return {w for w in re.findall(r"[a-z0-9+#]+", text.lower()) if w not in _STOPWORDS and len(w) > 1}


def keyword_matches(title: str, keywords) -> list:
    """
    Return the subset of `keywords` that are a meaningful match for a job title.

    Real employer-posted titles rarely phrase things identically to a user's
    target role (e.g. profile keyword "Software Engineer" vs a posting titled
    "Software Solution Architect" or "Senior Backend Developer") — a naive
    "is the whole keyword phrase a substring of the title" check silently
    drops nearly every real posting. Instead: a keyword matches if the whole
    phrase appears verbatim (strongest signal), OR if it shares at least one
    significant word with the title.

    Deliberately permissive (recall over precision, one-word overlap is
    enough regardless of keyword phrase length) — a job search tool should
    err toward surfacing a plausible posting over silently hiding a real one,
    especially for compound profile titles like "Software & AI Engineer"
    where requiring most/all words to overlap misses obvious matches like
    "Software Solution Architect".
    """
    if not keywords:
        return []
    title_lower = title.lower()
    title_tokens = _tokenize(title)
    matched = []
    for kw in keywords:
        kw_lower = (kw or "").lower().strip()
        if not kw_lower:
            continue
        if kw_lower in title_lower:
            matched.append(kw)
            continue
        kw_tokens = _tokenize(kw_lower)
        if kw_tokens and (kw_tokens & title_tokens):
            matched.append(kw)
    return matched


# Matches "N years", "N-M years", "N+ yrs", etc. — the context check below
# requires "experience"/"exp" nearby so this doesn't fire on unrelated mentions
# like "we've been in business for 10 years".
_YOE_NUMBER_RE = re.compile(r"(\d{1,2})\s*(?:(?:-|to|–|—)\s*(\d{1,2}))?\s*\+?\s*(?:years?|yrs?)\b", re.I)
_EXPERIENCE_CONTEXT_RE = re.compile(r"experience|exp\b", re.I)
_YOE_CONTEXT_WINDOW = 40  # chars to look either side of a years-match for "experience"
_YOE_MAX_PLAUSIBLE = 30   # ignore obvious typos/unrelated numbers above this


def extract_years_experience(text: str) -> Optional[dict]:
    """
    Pull a "years of experience" requirement out of free text via a small
    regex dictionary — pure code, no AI ([[prism-cost-constraint]]).

    Returns the FIRST plausible match as {"min": int, "max": Optional[int],
    "display": str}, or None if no requirement is found. A number+"years"
    match only counts if "experience"/"exp" appears within ~40 characters of
    it, which is what keeps this from matching things like "founded 15 years
    ago" or "10 years in business".
    """
    if not text:
        return None
    for m in _YOE_NUMBER_RE.finditer(text):
        start, end = m.span()
        window = text[max(0, start - _YOE_CONTEXT_WINDOW): end + _YOE_CONTEXT_WINDOW]
        if not _EXPERIENCE_CONTEXT_RE.search(window):
            continue
        low = int(m.group(1))
        high = int(m.group(2)) if m.group(2) else None
        if high is not None and high < low:
            low, high = high, low
        if low > _YOE_MAX_PLAUSIBLE or (high and high > _YOE_MAX_PLAUSIBLE):
            continue
        display = f"{low}-{high} years" if high is not None else f"{low}+ years"
        return {"min": low, "max": high, "display": display}
    return None


# Section headers that typically mark where a job posting's real content
# starts, after a page's nav/header chrome — used to keep a truncated
# description snippet from being pure "About Services Blog Contact..." junk.
_CONTENT_MARKERS = (
    "about the role", "about this role", "the role", "job description",
    "role & responsibilities", "role and responsibilities", "responsibilities",
    "what you'll do", "what you will do", "key responsibilities",
    "requirements", "qualifications", "who you are", "about you",
    "the opportunity", "your mission",
)


def extract_description_snippet(text: str, max_chars: int = 600) -> str:
    """
    Truncate raw page text to a display snippet, skipping past nav/header
    boilerplate when possible. A full-page text fetch (used to also scan for
    a years-of-experience requirement) usually starts with menu/nav text
    before the actual posting content — naively taking the first `max_chars`
    would show almost nothing but that.
    """
    if not text:
        return ""
    lowered = text.lower()
    best_pos = None
    for marker in _CONTENT_MARKERS:
        pos = lowered.find(marker)
        if pos != -1 and pos > 30 and (best_pos is None or pos < best_pos):
            best_pos = pos
    start = best_pos if best_pos is not None else 0
    return text[start:start + max_chars].strip()


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
