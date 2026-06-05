"""Async content scraper using aiohttp for maximum throughput."""

import asyncio
import re
import time
from typing import AsyncIterator, Dict, List, Optional, Tuple
from urllib.parse import quote_plus, urlparse, urljoin

import aiohttp
from aiohttp import ClientTimeout, TCPConnector
from bs4 import BeautifulSoup

from franken_stream.circuit_breaker import CircuitBreaker

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/119.0.0.0 Safari/537.36"
)

EMBED_PATTERNS = [
    (r'iframe[^>]*src=["\']([^"\']+)["\']', "iframe src"),
    (r'<a[^>]*href=["\']([^"\']*(?:embed|player)[^"\']*)["\']', "embed link"),
    (r'src=["\']([^"\']*\.m3u8[^"\']*)["\']', "HLS stream"),
    (r'src=["\']([^"\']*\.mp4[^"\']*)["\']', "MP4 video"),
    (r'data-url=["\']([^"\']+)["\']', "data-url attribute"),
]

# Ordered from most specific (streaming sites) to broadest fallback
RESULT_SELECTORS = [
    # Named class selectors used by major streaming sites
    "a.film-name",
    "a.title",
    "a.name",
    "a.ml-mask",
    ".movie-card a",
    ".film-poster a",
    ".item a",
    ".mli-info a",
    "h2 a",
    "h3 a",
    # URL-pattern based — only grab content links, not nav
    "a[href*='/watch/']",
    "a[href*='/movie/']",
    "a[href*='/tv/']",
    "a[href*='/show/']",
    "a[href*='/series/']",
]

# Words that indicate a link is navigation/UI, not a search result
_NAV_WORDS = frozenset([
    "home", "search", "menu", "nav", "login", "sign in", "sign up",
    "register", "contact", "about", "faq", "terms", "privacy",
    "cookie", "dmca", "request", "genre", "top", "trending",
    "new release", "most viewed", "coming soon", "all movies",
    "all series", "filter", "sort", "page", "next", "previous",
    "load more", "see all", "view all", "subscribe", "download app",
])

# Substrings that mark a result as a trailer/clip rather than a full film
_TRAILER_SUBSTRINGS = (
    "trailer", "teaser", "official trailer", "sneak peek", "first look",
    "behind the scenes", "making of", "featurette", "deleted scene",
    "bloopers", "gag reel", "tv spot", "promo", "extended clip",
    "clip:", " clip ", "| clip", "reaction", "review", "ending explained",
    "scene breakdown", "watch before", "everything you missed",
)


def _is_trailer_title(title: str) -> bool:
    """Return True if the title looks like a trailer, teaser, or short clip."""
    t = title.lower()
    return any(sub in t for sub in _TRAILER_SUBSTRINGS)


def _movie_query(query: str) -> str:
    """
    Append 'full movie' to a query unless it already implies full-length content.
    Used when searching movie-specific provider bases.
    """
    q = query.lower()
    if any(w in q for w in ("full movie", "watch online", "documentary",
                             "season ", " s0", "episode", " ep ", "series")):
        return query
    return f"{query} full movie"


def _relevance_score(title: str, query: str) -> int:
    """
    Score how relevant a title is to a query (0 = irrelevant).
    Higher is better.
    """
    t = title.lower().strip()
    q = query.lower().strip()

    # Exact match
    if t == q:
        return 100

    # Title starts with query
    if t.startswith(q):
        return 80

    # Title contains full query as substring
    if q in t:
        return 60

    # Count how many query words appear in the title
    query_words = [w for w in re.split(r'\W+', q) if len(w) > 2]
    if not query_words:
        return 0

    matched = sum(1 for w in query_words if w in t)
    if matched == len(query_words):
        return 50
    if matched >= len(query_words) * 0.6:
        return 30
    if matched >= 1:
        return 10

    return 0


def _is_nav_link(title: str, href: str) -> bool:
    """Return True if this link looks like navigation/UI rather than content."""
    t = title.lower().strip()
    if any(t == nav for nav in _NAV_WORDS):
        return True
    if len(t) < 2 or len(t) > 120:
        return True
    # Href points to homepage or generic page
    if href in ("/", "#", ""):
        return True
    return False


class AsyncContentScraper:
    """
    Async scraper with connection pooling, circuit breakers, and streaming results.
    """

    def __init__(
        self,
        proxy: Optional[str] = None,
        user_agent: Optional[str] = None,
        provider_manager=None,
        max_connections: int = 100,
        max_per_host: int = 20,
    ):
        self.proxy = proxy
        self.user_agent = user_agent or DEFAULT_USER_AGENT
        self.provider_manager = provider_manager
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=5,
            recovery_timeout=300.0,
        )
        self._connector: Optional[TCPConnector] = None
        self._session: Optional[aiohttp.ClientSession] = None
        self._max_connections = max_connections
        self._max_per_host = max_per_host

    async def _ensure_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._connector = TCPConnector(
                limit=self._max_connections,
                limit_per_host=self._max_per_host,
                ttl_dns_cache=300,
                enable_cleanup_closed=True,
                force_close=False,
            )
            self._session = aiohttp.ClientSession(
                connector=self._connector,
                timeout=ClientTimeout(total=15, connect=5),
                headers={
                    "User-Agent": self.user_agent,
                    "Accept": "text/html,application/xhtml+xml",
                    "Accept-Language": "en-US,en;q=0.9",
                },
            )
        return self._session

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()

    async def _get_page(self, url: str, retries: int = 3) -> Optional[str]:
        """Fetch a URL with exponential backoff retry."""
        import random
        session = await self._ensure_session()
        for attempt in range(retries):
            try:
                kwargs: Dict = {}
                if self.proxy:
                    kwargs["proxy"] = self.proxy
                async with session.get(url, **kwargs) as resp:
                    if resp.status == 200:
                        return await resp.text()
                    return None
            except (aiohttp.ClientError, asyncio.TimeoutError):
                if attempt == retries - 1:
                    return None
                wait = (2 ** attempt) + random.uniform(0, 0.5)
                await asyncio.sleep(wait)
        return None

    def _extract_results(self, html: str, base_url: str, query: str = "") -> List[Tuple[str, str]]:
        """
        Extract results using multiple CSS selectors, then rank by relevance to query.
        Returns results sorted by match quality — exact/close matches first.
        """
        if not html:
            return []
        soup = BeautifulSoup(html, "html.parser")
        parsed_base = urlparse(base_url)
        host = f"{parsed_base.scheme}://{parsed_base.netloc}"

        # Collect candidates from all selectors (not just first that matches)
        candidates: Dict[str, Tuple[str, str]] = {}  # url -> (title, url)

        for selector in RESULT_SELECTORS:
            for el in soup.select(selector):
                # Get title from element text or title attribute
                title = el.get_text(strip=True)
                if not title:
                    title = el.get("title", "").strip()
                if not title:
                    continue

                href = el.get("href", "").strip()
                if not href or href.startswith("#") or href.startswith("javascript"):
                    continue

                # Resolve relative URLs properly
                href = urljoin(base_url, href)

                if _is_nav_link(title, href):
                    continue
                if _is_trailer_title(title):
                    continue

                if href not in candidates:
                    candidates[href] = (title, href)

        if not candidates:
            return []

        # Score and sort by query relevance
        scored = []
        for title, url in candidates.values():
            score = _relevance_score(title, query) if query else 50
            if score > 0:
                scored.append((score, title, url))

        # Sort: highest score first, then alphabetical for ties
        scored.sort(key=lambda x: (-x[0], x[1]))

        return [(title, url) for _, title, url in scored[:20]]

    def _build_search_url(self, base_url: str, query: str) -> str:
        """Build full search URL handling both placeholder and append-style providers."""
        encoded = quote_plus(query)
        if "{query}" in base_url:
            return base_url.format(query=encoded)
        if base_url.endswith(("=", "?", "&", "/")):
            return base_url + encoded
        return base_url + encoded

    async def _search_provider(
        self, base_url: str, query: str
    ) -> List[Tuple[str, str]]:
        """Search one provider, returning (title, url) pairs ranked by relevance."""
        provider_name = urlparse(base_url).netloc
        if self.circuit_breaker.is_open(provider_name):
            return []

        # Append "full movie" for movie-specific provider queries
        effective_query = _movie_query(query)
        search_url = self._build_search_url(base_url, effective_query)
        start = time.monotonic()
        try:
            html = await self._get_page(search_url)
            elapsed_ms = (time.monotonic() - start) * 1000

            if html is None:
                self.circuit_breaker.record_failure(provider_name)
                if self.provider_manager:
                    self.provider_manager.record_result(base_url, False, elapsed_ms)
                return []

            results = self._extract_results(html, base_url, query)  # score against original query
            self.circuit_breaker.record_success(provider_name)
            if self.provider_manager:
                self.provider_manager.record_result(base_url, True, elapsed_ms)
            return results

        except Exception:
            self.circuit_breaker.record_failure(provider_name)
            elapsed_ms = (time.monotonic() - start) * 1000
            if self.provider_manager:
                self.provider_manager.record_result(base_url, False, elapsed_ms)
            return []

    async def search_streaming(
        self, query: str, bases: List[str]
    ) -> AsyncIterator[Tuple[str, str]]:
        """
        Yield (title, url) pairs as each provider responds, best matches first.
        """
        tasks = {
            asyncio.create_task(self._search_provider(base, query)): base
            for base in bases
        }
        seen_urls: set = set()

        for coro in asyncio.as_completed(list(tasks)):
            try:
                results = await coro
                for title, url in results:
                    if url not in seen_urls:
                        seen_urls.add(url)
                        yield title, url
            except Exception:
                continue

    async def search(
        self, query: str, bases: List[str]
    ) -> List[Tuple[str, str]]:
        """Collect all streaming results and re-rank across all providers."""
        raw: List[Tuple[int, str, str]] = []
        seen_urls: set = set()

        async for title, url in self.search_streaming(query, bases):
            if url not in seen_urls:
                seen_urls.add(url)
                score = _relevance_score(title, query)
                raw.append((score, title, url))

        # Final global sort: exact matches first
        raw.sort(key=lambda x: (-x[0], x[1]))
        return [(title, url) for _, title, url in raw]

    async def fetch_embed_from_page(
        self, page_url: str, base_url: Optional[str] = None
    ) -> Optional[str]:
        """Extract a playable embed URL from a detail page."""
        html = await self._get_page(page_url)
        if not html:
            return None

        host = base_url or (
            urlparse(page_url).scheme + "://" + urlparse(page_url).netloc
        )

        for pattern, _ in EMBED_PATTERNS:
            m = re.search(pattern, html, re.IGNORECASE)
            if m:
                url = m.group(1)
                if url.startswith("/"):
                    url = host + url
                if url.startswith(("http://", "https://", "//")):
                    return url
        return None

    async def validate_proxy(self, proxy_url: str) -> bool:
        """Return True if the proxy is reachable."""
        try:
            timeout = ClientTimeout(total=6)
            conn = TCPConnector()
            async with aiohttp.ClientSession(connector=conn, timeout=timeout) as s:
                async with s.get("https://www.example.com", proxy=proxy_url) as r:
                    return r.status < 500
        except Exception:
            return False


DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/119.0.0.0 Safari/537.36"
)

EMBED_PATTERNS = [
    (r'iframe[^>]*src=["\']([^"\']+)["\']', "iframe src"),
    (r'<a[^>]*href=["\']([^"\']*(?:embed|player)[^"\']*)["\']', "embed link"),
    (r'src=["\']([^"\']*\.m3u8[^"\']*)["\']', "HLS stream"),
    (r'src=["\']([^"\']*\.mp4[^"\']*)["\']', "MP4 video"),
    (r'data-url=["\']([^"\']+)["\']', "data-url attribute"),
]

# Multiple CSS selector fallbacks per extraction type
RESULT_SELECTORS = [
    ("a.ml-mask",       lambda el: (el.get("title", el.get_text(strip=True)), el.get("href", ""))),
    ("a[href]",         lambda el: (el.get_text(strip=True), el.get("href", ""))),
    ("h2 a",            lambda el: (el.get_text(strip=True), el.get("href", ""))),
    (".item a",         lambda el: (el.get_text(strip=True), el.get("href", ""))),
    (".movie-card a",   lambda el: (el.get_text(strip=True), el.get("href", ""))),
]


class AsyncContentScraper:
    """
    Async scraper with connection pooling, circuit breakers, and streaming results.
    """

    def __init__(
        self,
        proxy: Optional[str] = None,
        user_agent: Optional[str] = None,
        provider_manager=None,
        max_connections: int = 100,
        max_per_host: int = 20,
    ):
        self.proxy = proxy
        self.user_agent = user_agent or DEFAULT_USER_AGENT
        self.provider_manager = provider_manager
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=5,
            recovery_timeout=300.0,
        )
        self._connector: Optional[TCPConnector] = None
        self._session: Optional[aiohttp.ClientSession] = None
        self._max_connections = max_connections
        self._max_per_host = max_per_host

    async def _ensure_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._connector = TCPConnector(
                limit=self._max_connections,
                limit_per_host=self._max_per_host,
                ttl_dns_cache=300,
                enable_cleanup_closed=True,
                force_close=False,
            )
            self._session = aiohttp.ClientSession(
                connector=self._connector,
                timeout=ClientTimeout(total=15, connect=5),
                headers={
                    "User-Agent": self.user_agent,
                    "Accept": "text/html,application/xhtml+xml",
                    "Accept-Language": "en-US,en;q=0.9",
                },
            )
        return self._session

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()

    async def _get_page(self, url: str, retries: int = 3) -> Optional[str]:
        """Fetch a URL with exponential backoff retry."""
        import random
        session = await self._ensure_session()
        for attempt in range(retries):
            try:
                kwargs: Dict = {}
                if self.proxy:
                    kwargs["proxy"] = self.proxy
                async with session.get(url, **kwargs) as resp:
                    if resp.status == 200:
                        return await resp.text()
                    return None
            except (aiohttp.ClientError, asyncio.TimeoutError):
                if attempt == retries - 1:
                    return None
                wait = (2 ** attempt) + random.uniform(0, 0.5)
                await asyncio.sleep(wait)
        return None

    def _extract_results(self, html: str, base_url: str) -> List[Tuple[str, str]]:
        """Try multiple CSS selectors in order, return first non-empty set."""
        if not html:
            return []
        soup = BeautifulSoup(html, "html.parser")
        host = urlparse(base_url).scheme + "://" + urlparse(base_url).netloc

        for selector, extractor in RESULT_SELECTORS:
            found = []
            for el in soup.select(selector):
                try:
                    title, href = extractor(el)
                    title = title.strip()
                    if not title or len(title) < 2:
                        continue
                    if href and href.startswith("/"):
                        href = host + href
                    if href and href.startswith("http") and title:
                        found.append((title, href))
                except Exception:
                    continue
            if found:
                return found[:15]
        return []

    async def _search_provider(
        self, base_url: str, query: str
    ) -> List[Tuple[str, str]]:
        """Search one provider, returning (title, url) pairs."""
        provider_name = urlparse(base_url).netloc
        if self.circuit_breaker.is_open(provider_name):
            return []

        search_url = base_url + quote_plus(query)
        start = time.monotonic()
        try:
            html = await self._get_page(search_url)
            elapsed_ms = (time.monotonic() - start) * 1000

            if html is None:
                self.circuit_breaker.record_failure(provider_name)
                if self.provider_manager:
                    self.provider_manager.record_result(base_url, False, elapsed_ms)
                return []

            results = self._extract_results(html, base_url)
            self.circuit_breaker.record_success(provider_name)
            if self.provider_manager:
                self.provider_manager.record_result(base_url, True, elapsed_ms)
            return results

        except Exception:
            self.circuit_breaker.record_failure(provider_name)
            elapsed_ms = (time.monotonic() - start) * 1000
            if self.provider_manager:
                self.provider_manager.record_result(base_url, False, elapsed_ms)
            return []

    async def search_streaming(
        self, query: str, bases: List[str]
    ) -> AsyncIterator[Tuple[str, str]]:
        """
        Yield (title, url) pairs as each provider responds.
        Results arrive within 1-2s instead of waiting for the slowest provider.
        """
        tasks = {
            asyncio.create_task(self._search_provider(base, query)): base
            for base in bases
        }
        seen_urls: set = set()

        for coro in asyncio.as_completed(list(tasks)):
            try:
                results = await coro
                for title, url in results:
                    if url not in seen_urls:
                        seen_urls.add(url)
                        yield title, url
            except Exception:
                continue

    async def search(
        self, query: str, bases: List[str]
    ) -> List[Tuple[str, str]]:
        """Collect all streaming results into a list."""
        results: List[Tuple[str, str]] = []
        async for item in self.search_streaming(query, bases):
            results.append(item)
        return results

    async def fetch_embed_from_page(
        self, page_url: str, base_url: Optional[str] = None
    ) -> Optional[str]:
        """Extract a playable embed URL from a detail page."""
        html = await self._get_page(page_url)
        if not html:
            return None

        host = base_url or (
            urlparse(page_url).scheme + "://" + urlparse(page_url).netloc
        )

        for pattern, _ in EMBED_PATTERNS:
            m = re.search(pattern, html, re.IGNORECASE)
            if m:
                url = m.group(1)
                if url.startswith("/"):
                    url = host + url
                if url.startswith(("http://", "https://", "//")):
                    return url
        return None

    async def validate_proxy(self, proxy_url: str) -> bool:
        """Return True if the proxy is reachable."""
        try:
            timeout = ClientTimeout(total=6)
            conn = TCPConnector()
            async with aiohttp.ClientSession(connector=conn, timeout=timeout) as s:
                async with s.get("https://www.example.com", proxy=proxy_url) as r:
                    return r.status < 500
        except Exception:
            return False
