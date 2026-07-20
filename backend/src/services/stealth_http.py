"""
Shared stealth HTTP client for the scraper — TLS/JA3/HTTP2 browser
fingerprint impersonation via curl_cffi.

A plain httpx/requests client has a TLS handshake signature that's trivially
distinguishable from a real browser, regardless of what User-Agent header is
sent — many anti-bot systems (Cloudflare included; confirmed live against a
Cloudflare-fronted career page during verification) filter on that signature
before HTTP headers are even inspected. curl_cffi replicates a real browser's
handshake via curl-impersonate, closing that gap.
"""

from curl_cffi.requests import AsyncSession
from curl_cffi.requests.exceptions import RequestException  # noqa: F401  (re-exported for callers)

# Keep this current — curl_cffi ships new impersonation profiles as real
# Chrome versions release. Verified live (chrome146 was the newest profile
# available in curl_cffi==0.15.0 at the time this was wired in).
IMPERSONATE = "chrome146"

DEFAULT_TIMEOUT = 20.0


def new_session(**kwargs) -> AsyncSession:
    """
    A curl_cffi AsyncSession pre-configured to impersonate a current Chrome
    browser's TLS/JA3/HTTP2 fingerprint. Use as an async context manager,
    same as httpx.AsyncClient.

    Don't pass a custom User-Agent — the impersonation profile already sends
    a full, internally-consistent Chrome header set (user-agent, sec-ch-ua,
    sec-fetch-*, accept, etc.). Overriding just the User-Agent while the TLS
    layer still fingerprints as a different version is a mismatch that's
    itself a bot signal — worse than sending no spoofed identity at all.
    """
    kwargs.setdefault("impersonate", IMPERSONATE)
    kwargs.setdefault("timeout", DEFAULT_TIMEOUT)
    return AsyncSession(**kwargs)
