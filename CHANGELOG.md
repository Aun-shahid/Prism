# Changelog

All notable changes to Prism are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); dates are ISO-8601.

## [Unreleased]

### Added — scraper stealth: TLS fingerprint impersonation + JS-render fallback
Previously the scraper's only "anti-detection" measure was a single hardcoded,
already-stale User-Agent string (Chrome/120) — no TLS-level spoofing, no
signature hiding, no JS rendering. Researched current (2026) best-in-class
options and verified each live before adopting:
- **`curl_cffi`** (TLS/JA3/HTTP2 browser fingerprint impersonation) now backs
  every scraper HTTP call — `scraper_service.py` (career pages + RSS
  validation), `general_scraper_service.py` (LinkedIn guest search,
  applicant-count lookups, Arbeitnow, RSS), `web_research_service.py` (company
  research page fetches), and `ats_service.py` (Greenhouse/Lever/Ashby APIs).
  New shared `services/stealth_http.py::new_session()`, impersonating
  `chrome146` (the newest profile available) — confirmed via a live request
  against a Cloudflare-fronted site that the impersonation profile sends a
  single, internally-consistent Chrome header set (matching `user-agent`,
  `sec-ch-ua`, `sec-fetch-*`, TLS handshake all agree) rather than a
  hand-picked User-Agent that could mismatch the TLS layer — a mismatch is
  itself a bot signal, worse than no spoofing at all.
- **`zendriver`** (async, CDP-direct headless Chrome — successor to
  `undetected-chromedriver`) added as a last-resort fallback for JS-rendered
  career pages: `scraper_service.py::_fetch_html_jobs_with_browser`, only
  invoked when the static fetch finds zero candidate links. Bounded by a
  dedicated semaphore (max 2 concurrent browser instances app-wide, shared
  across manual scans and the background sweep) since a real browser is far
  heavier than an HTTP request. Verified live: correctly renders JS-injected
  content in a controlled test, and cleanly degrades to an empty list (never
  crashes a scrape) if no browser is found.
  - **Deployment requirement — handled:** zendriver has no auto-download, it
    only locates an existing system Chrome/Chromium/Brave binary, so
    `backend/Dockerfile` now installs `chromium` via `apt-get`. Verified with
    a real `docker build` + container run: `/usr/bin/chromium` resolves and
    `zendriver.start(headless=True)` successfully launches and renders as the
    container's default (root) user with no extra sandbox flags needed.
- Honest finding from verification, not hidden: the JS-render fallback was
  tested against the one confirmed-broken company from earlier work
  (OBS Pharma) expecting it to recover hidden job listings — it didn't,
  because that page genuinely has no job-listing content at all (just a
  `mailto:` contact link), independently confirmed via a controlled synthetic
  test that the render mechanism itself does correctly pick up JS-injected
  links when they exist.

### Changed — extended the model-tier upgrade to every remaining AI call site
Follow-up to the chat/AI-Tailor tiering below — swept the rest of the backend
so nothing was left on a stale default:
- **Company research brief** (`web_research_service.py`, used by watchlist
  "Watch & Research" and the assistant's company-research/job-fit intents) →
  `purpose="chat"`.
- **HR-reply classify + draft** (`inbound_reply_service.py`) → `purpose="tailor"`
  (real correspondence, sometimes auto-sent).
- **Outbound application email compose** and the (currently unused, but
  updated for consistency) **HR-reply compose** in `email_outreach_service.py`
  → `purpose="tailor"`.
- **CV/resume upload parsing** (`profile_service.py`) → `purpose="tailor"` —
  a one-time-per-upload call whose accuracy seeds the user's entire profile,
  so worth the better tier despite being structured extraction rather than
  prose.
- Every backend `AIService.generate_text/generate_chat/generate_json` call
  site now passes an explicit `purpose`; verified live end-to-end after the
  change (backend import + a real `generate_json(purpose="chat")` call).

### Changed — model upgrade: tiered OpenAI/Gemini models for chat + AI Tailor
- Replaced the single global `OPENAI_MODEL`/`GEMINI_MODEL` constants with a
  **3-tier model map per provider**, selected by a new `purpose` parameter on
  `AIService.generate_text/generate_chat/generate_json` ("fast" | "chat" |
  "tailor"). Every tier was verified with a **real, live API call** (not just
  a models-list lookup) using an actual configured key before being picked:
  - `fast` (intent classification / routing — unchanged): `gpt-5-mini`,
    `gemini-3-flash-preview`.
  - `chat` (the assistant's final user-facing reply): `gpt-5.6-luna`,
    `gemini-3.5-flash`.
  - `tailor` (AI Tailor resume/cover-letter/bullet-coach — all 5 call sites
    in `resume_service.py`): `gpt-5.6-terra`, `gemini-3.1-pro-preview`.
  - Any call site that doesn't pass `purpose=` defaults to "fast" — i.e. the
    exact prior model/behavior — so this only changes the two features asked
    about; company research, inbound-reply drafting, etc. are untouched.
  - Claude wasn't part of this round (scoped to OpenAI/Gemini per request);
    `claude-opus-4-8` unchanged, used for every purpose.
- **Bug found and fixed during verification:** the configured Gemini
  embedding model (`text-embedding-004`) is fully retired — confirmed live
  (404 Not Found) — meaning RAG had been silently degrading to keyword-only
  search for any Gemini-only user. Its listed replacement,
  `gemini-embedding-001`, is also broken (fails on a real embed call despite
  being listed) — only `gemini-embedding-2` actually works, verified with a
  real embedding call. Now the configured `GEMINI_EMBEDDING_MODEL`.

### Added — real job descriptions + years-of-experience extraction
- **Watchlist-scraped jobs now carry a real description**, not just
  "{company} | {location}". Greenhouse/Lever/Ashby (ATS-detected targets)
  already return full descriptions in their API response — now captured
  (`content=true` for Greenhouse; `descriptionPlain` + `lists[]` sections for
  Lever; `descriptionPlain`/`descriptionHtml` for Ashby), with HTML-entity
  unescaping fixed so tags actually strip. For plain HTML-scraped career
  pages (no ATS detected), each **new** posting's own page is now fetched
  (bounded concurrency + a per-scrape cap so a wave of new postings can't
  make one scrape run unboundedly long) and reused for both the description
  and the extraction below.
- **Years-of-experience requirement extraction** — a small regex dictionary
  (`scraper_utils.extract_years_experience`, pure code, no AI —
  [[prism-cost-constraint]]) scans the full description for phrasing like
  "5+ years", "3-5 years of experience", "minimum 2 years", requiring the
  word "experience"/"exp" nearby so it doesn't fire on unrelated mentions
  like "founded 15 years ago". Verified live: 15/15 and 9/15 real postings
  correctly detected across two different companies. Shown as a chip next to
  the job title on both the Watchlist and Browse Jobs feeds.
- **Fixed a snippet-quality bug found during verification:** a raw full-page
  text fetch starts with nav/menu chrome ("About Services Blog Contact...")
  before the real posting content — naively truncating from character 0 for
  the stored snippet showed almost nothing but that. `extract_description_snippet`
  now skips to the first recognizable content marker ("Responsibilities",
  "About the role", "Requirements", etc.) when present. Extraction of the
  years-of-experience requirement itself always runs on the full untruncated
  text first, so this only affects what's *displayed*, not what's found.

### Added — job-title autocomplete (O*NET-backed)
- Target Job Titles (Profile) and the watchlist's "Extra keywords" field now
  offer live autocomplete suggestions from an offline dataset of ~51k real
  occupation titles, built from the public O*NET database (US Dept of Labor,
  CC BY 4.0 — attribution in `backend/src/data/README.md`). New
  `GET /titles/search` endpoint (`title_taxonomy.py`), no network/AI call at
  request time — the dataset ships with the app.
- Deliberately a **human-facing suggestion list only**, not wired into the
  scraper's automated matching: investigation found single words like
  "Programmer" genuinely span unrelated occupations in the source data (a
  software role and a CNC-machining role share that exact alternate title),
  which is fine for a person to choose from but unsound as an automatic
  equivalence for filtering scraped postings — see `title_taxonomy.py`'s
  docstring.

### Fixed — token-overlap matching threshold too strict for real profiles
- Follow-up to the token-overlap fix below: requiring *half* a keyword
  phrase's words to overlap was still too strict for realistic multi-word
  profile titles (e.g. "Software & AI Engineer" no longer matched "Software
  Solution Architect"). Loosened to require just one shared significant word
  — verified this doesn't introduce noise against real data (still correctly
  excludes all irrelevant postings on a live test page).
- Clarified in the UI that Target Job Titles (Profile) are always merged into
  matching by default, alongside any extra per-company keywords — this was
  already true in the backend but not visible, which was part of the
  confusion.

### Fixed — watchlist showing "No matched positions" despite real openings
- **Root cause #1 (keyword matching too strict):** job-title relevance matching
  required a search keyword's *entire phrase* to appear verbatim in a posted
  title (e.g. "Software Engineer" would never match "Software Solution
  Architect" or "Senior Backend Developer"), silently dropping nearly every
  real posting. Replaced with token-overlap matching (`keyword_matches` in
  `backend/src/services/scraper_utils.py`, used by both `scraper_service.py`
  and `general_scraper_service.py`) — verified live: 0 → 4 real matches on a
  company that was previously showing none.
- **Root cause #2 (no way to attach a careers URL):** without a URL field on
  "Watch & Research", the only workaround was pasting the URL into the
  Keywords box — which then got compared against job titles as a search term
  (matching nothing) and never touched `career_url` at all. **`WatchCompanyRequest`
  now accepts an optional `career_url`** — when given, it's stored immediately
  and AI research honors it exactly instead of searching for/guessing one
  (cheaper, and avoids the AI occasionally discovering the wrong page, as
  observed live: one target's AI-discovered "careers page" was a government
  jobs portal, entirely unrelated to the company). Re-running research on an
  existing target now also passes through its current `career_url` so it
  doesn't re-guess from scratch. New optional field on the "Watch a company"
  form.

### Changed — migrated off deprecated `google-generativeai`
- Google sunset the `google-generativeai` package; all Gemini calls
  (`ai_service.py`: chat/JSON generation, embeddings, key validation) now use
  the current `google-genai` SDK (`genai.Client` + native async `client.aio.models.*`
  — no more `asyncio.to_thread` wrapping needed, the new SDK is natively
  async). Removed `google-generativeai` and its Gemini-only dependency
  `google-ai-generativelanguage`; `google-api-core`/`google-auth`/etc. are kept
  since Gmail's `google-api-python-client` still needs them. Verified live
  against all three providers (OpenAI/Gemini/Claude) via `pip check` and the
  key-validation endpoint.

### Added — AI-key gating, key validation, language switcher, tabbed pages
- **App-wide "no API key" gating:** every AI-triggering control (resume AI Tailor,
  bullet coach, Gmail apply-by-email generate, HR-reply check, watchlist
  watch/re-run research, profile CV upload, assistant chat send) is now disabled
  with an explanatory tooltip when no provider key is configured, instead of a
  raw error or — in several cases (watchlist background research, HR-reply poll)
  — total silence. New `useApiKeys` context (`frontend/src/hooks/useApiKeys.tsx`)
  + reusable `NoApiKeyTooltip` wrapper; Settings refreshes it immediately after
  any key change, so gated buttons enable without a page reload.
- **API keys are now verified on save**, via each provider's free, metadata-only
  endpoint (`models.retrieve`/`get_model` — no generation tokens spent). A
  typo'd or revoked key is rejected immediately with a clear reason instead of
  surfacing later inside an unrelated AI action's failure.
  (`AIService.validate_key`, wired into `APIKeyService.store_key`.)
- **Language switcher:** a Google Translate widget in the dashboard top bar
  translates the rendered UI client-side — no per-page string extraction needed.
- **Settings and Gmail Outreach pages reorganized into tabs** (Account / API Keys
  / Email Outreach; Apply by Email / HR Replies / Compose & History) so each
  area is clearly scoped instead of one long stacked-card page.
- Removed the redundant "AI" chip on the resume builder toolbar — the AI Tailor
  button already communicates that capability.
- Fixed the AI Tailor dialog showing a generic Axios error instead of the
  backend's actual failure reason.

### Added — AI email outreach (apply by email + HR auto-reply)
- **Apply by email:** paste a job posting on the Gmail page → Prism extracts the
  recipient (pure regex, no AI), writes a tailored application email in one AI
  call grounded in your profile, and sends it via your connected Gmail. Draft is
  shown for review by default; an **auto-send** toggle (with a cancel window)
  skips review. (`services/email_outreach_service.py`, `routers/outreach.py`,
  `dashboard/gmail/ApplyByEmail.tsx`.)
- **Resume attachment:** optionally attach a chosen resume version as a PDF,
  reusing the builder's browser export — `send_email` now builds `multipart/mixed`
  with a plain-text **and** HTML body plus file attachments (previously HTML-only).
- **HR reply loop (opt-in):** watches only the threads you started, classifies new
  recruiter replies, and either drafts a response for review or auto-sends it
  (per settings). Runs on a 15-min scheduler poll; surfaces via the existing
  notification stream. Needs the wider Gmail read/compose scopes → reconnect once.
  (`services/inbound_reply_service.py`, `dashboard/gmail/HrReplies.tsx`.)
- **Email Outreach settings** (Settings page): custom instructions, tone & length,
  signature & sender name, resume-attach default, auto-send, daily send cap,
  CC-self, already-emailed warning, and the inbound toggles. New per-user
  `email_settings` store mirrors the encrypted `api_keys` pattern.
- **Pipeline link + guardrails:** each sent application is logged to the
  applications pipeline (status → applied); server enforces a daily send cap and
  an already-emailed warning. The assistant and this flow now share one email
  prompt so they write in the same voice. No new AI in hot paths — one call per
  compose, one per HR reply ([[prism-cost-constraint]]).

### Added — scraper
- **Job-preference exclusions are now enforced by the scraper.** The free-text
  `job_preferences.exclusions` list (companies / keywords / locations) is applied
  in both scraping paths so matching postings are never stored. If an exclusion
  term matches a watched company's name, that whole target is skipped.
  (`backend/src/services/scraper_utils.py::is_excluded`, wired into
  `scraper_service.py` and `general_scraper_service.py`.)
- **ATS fast-path for company targets.** When a company's careers/jobs URL is on a
  known applicant-tracking system (Greenhouse, Lever, Ashby), postings are pulled
  from that platform's public JSON API — exact title, canonical URL, location —
  instead of guessing from raw HTML. Falls back to HTML scraping otherwise. No AI
  involved. (`backend/src/services/ats_service.py`.)
- **Reliable new-vs-seen detection.** `ScrapedJob` now carries `dedup_key`
  (normalized URL), `first_seen`, `last_seen`, `company`, `location`, and `source`.
  Postings seen again refresh `last_seen` instead of being re-inserted as "new".
- **Live job-feed refresh.** The Watchlist and Browse Jobs pages now refresh
  automatically when the backend discovers new postings (via a `prism:jobs-updated`
  event dispatched from the notification SSE stream) — no manual reload needed.
- **Brand logos across the app.** The prism mark (`public/prism_logo.png`) now
  appears as the favicon and in the dashboard sidebar, login, register, and landing
  nav; the full wordmark (`public/logo.png`) anchors the landing hero.
- **DB indexes** for `scraped_jobs` and `scraper_targets` are ensured on startup.

### Changed
- **URL de-duplication is now normalization-based**, stripping tracking params
  (utm_*, gclid, ref, …) and fragments while preserving meaningful query params
  (e.g. Greenhouse `?gh_jid=`). Replaces fragile exact-title+URL matching.
- **Per-scrape DB access batched.** The old N+1 `find_one`-per-posting existence
  check is replaced by a single query into a seen-set plus `insert_many`, in both
  the company-target and general-feed scrapers.
- **General sweep fetches each keyword once** and fans results out to all users who
  search it (instead of re-fetching per user), applying each user's exclusions.
- **LinkedIn applicant-count lookups run concurrently** (bounded) instead of one
  blocking request per card.
- **Scheduler**: per-company scrapes now run concurrently (bounded, with jitter),
  skip targets scraped within the last interval, and derive their cadence from the
  `SCRAPER_INTERVAL_HOURS` config knob (previously hard-coded and the config was
  ignored; default set to 4h, general feeds at 2×).
- **Cleanup sweep** now also ages out the `is_new` flag on postings older than
  14 days (in addition to deleting jobs older than 45 days).
- New-profile defaults now include `job_preferences.exclusions` (was omitted).

### Notes
- All scraper matching/parsing remains pure code — no LLM calls were added. AI is
  still used only for one-time, on-demand company research when a company is watched.
