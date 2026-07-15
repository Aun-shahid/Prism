# Changelog

All notable changes to Prism are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); dates are ISO-8601.

## [Unreleased]

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
