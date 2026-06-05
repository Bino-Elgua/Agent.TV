"""Web scraping and content discovery."""

import json
import re
import subprocess
import time as _time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Optional, Tuple
from urllib.parse import parse_qs, quote_plus, unquote, urlparse

import requests
from bs4 import BeautifulSoup
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

console = Console()

# Default User-Agent to avoid blocking
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/119.0.0.0 Safari/537.36"
)

# Known streaming domains — DDG results are filtered to these
_STREAMING_DOMAINS = frozenset([
    "gomovies.sx", "fmovies.ps", "bflix.gg", "bflix.sh", "hurawatch.cc",
    "cataz.net", "hdtoday.cc", "hdtoday.tv", "myflixerz.to", "myflixerz.me",
    "myflixer.cx", "cineby.ru", "lookmovie2.to", "cinezone.to", "goojara.to",
    "afdah2.cyou", "2flix.com", "flixbaba.com", "123moviesfree.net",
    "wootly.ch", "vexmovies.to", "yesmovies.ag", "yesmovies.to",
    "azm.to", "youtube.com", "archive.org", "tubi.tv", "pluto.tv",
])

# Title substrings that indicate a trailer/clip not a full film
_TRAILER_SUBS = (
    " trailer", " teaser", "official trailer", "sneak peek", "first look",
    "behind the scenes", "making of", "featurette", "deleted scene",
    "bloopers", "gag reel", "tv spot", " promo", "extended clip",
    "reaction:", "| reaction", " explained", "breakdown",
)


def _is_trailer_title(title: str) -> bool:
    t = title.lower()
    return any(s in t for s in _TRAILER_SUBS)


def _decode_ddg_url(href: str) -> Optional[str]:
    """Decode a DuckDuckGo redirect URL to the actual destination."""
    if href.startswith("//duckduckgo.com/l/"):
        href = "https:" + href
    parsed = urlparse(href)
    if parsed.netloc in ("duckduckgo.com",):
        uddg = parse_qs(parsed.query).get("uddg", [""])[0]
        if uddg:
            return unquote(uddg)
    if href.startswith("http"):
        return href
    return None

# Regex patterns for robust embed extraction
EMBED_PATTERNS = [
    (r'iframe[^>]*src=["\']([^"\']+)["\']', "iframe src"),
    (r'<a[^>]*href=["\']([^"\']*(?:embed|player)[^"\']*)["\']', "embed link"),
    (r'src=["\']([^"\']*\.m3u8[^"\']*)["\']', "HLS stream"),
    (r'src=["\']([^"\']*\.mp4[^"\']*)["\']', "MP4 video"),
    (r'data-url=["\']([^"\']+)["\']', "data-url attribute"),
]


class ContentScraper:
    """Scrapes streaming content from various providers."""

    def __init__(
        self,
        proxy: Optional[str] = None,
        user_agent: Optional[str] = None,
        provider_manager=None,
        llm_client=None,
    ):
        """
        Initialize scraper with optional proxy and custom User-Agent.

        Args:
            proxy: Optional proxy URL (e.g., http://proxy.example.com:8080)
            user_agent: Custom User-Agent header
            provider_manager: Optional ProviderManager for health tracking
            llm_client: Optional LLM helper for selector adaptation
        """
        self.proxy = proxy
        self.user_agent = user_agent or DEFAULT_USER_AGENT
        self.provider_manager = provider_manager
        self.llm_client = llm_client
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": self.user_agent})

        if proxy:
            self.session.proxies = {"http": proxy, "https": proxy}

    def get_page(self, url: str, timeout: int = 10) -> Optional[str]:
        """Fetch a page and return the raw HTML text."""
        try:
            response = self.session.get(url, timeout=timeout)
            response.raise_for_status()
            return response.text
        except Exception:
            return None

    def _validate_url(self, url: str) -> bool:
        """
        Validate URL for security and correctness.

        Args:
            url: URL to validate

        Returns:
            True if URL is safe and valid
        """
        if not url or not isinstance(url, str):
            return False

        try:
            parsed = urlparse(url)
            # Must have scheme and netloc
            if not parsed.scheme or not parsed.netloc:
                return False

            # Only allow http/https
            if parsed.scheme not in ['http', 'https']:
                return False

            # Basic length check
            if len(url) > 2048:
                return False

            # Check for suspicious patterns
            suspicious = ['javascript:', 'data:', 'vbscript:', '<script']
            if any(pattern in url.lower() for pattern in suspicious):
                return False

            return True
        except Exception:
            return False

    def _sanitize_url(self, url: str) -> Optional[str]:
        """
        Sanitize and validate URL.

        Args:
            url: URL to sanitize

        Returns:
            Sanitized URL or None if invalid
        """
        if not self._validate_url(url):
            return None

        # Remove any fragments or query params that might be malicious
        parsed = urlparse(url)
        clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        if parsed.query:
            clean_url += f"?{parsed.query}"

        return clean_url

    def _build_search_url(self, base_url: str, query: str) -> str:
        """Build a full search URL supporting placeholder providers."""
        encoded_query = quote_plus(query)
        if "{query}" in base_url:
            return base_url.format(query=encoded_query)
        if base_url.endswith("=") or base_url.endswith("?") or base_url.endswith("&"):
            return f"{base_url}{encoded_query}"
        return f"{base_url}{encoded_query}"

    def _fetch_provider(
        self, base_url: str, query: str, verbose: bool = False
    ) -> Tuple[str, List[Tuple[str, str]], float]:
        """Fetch results from a single provider (thread-safe)."""
        # Append "full movie" unless query already implies series/documentary
        q_lower = query.lower()
        if not any(w in q_lower for w in ("full movie", "documentary", "season ",
                                           " s0", "episode", " ep ", "series")):
            effective_query = f"{query} full movie"
        else:
            effective_query = query
        full_url = self._build_search_url(base_url, effective_query)
        start = _time.time()
        try:
            if verbose:
                console.log(f"[cyan]→ Searching: {full_url}")

            response = self.session.get(full_url, timeout=10)
            response.raise_for_status()
            elapsed_ms = (_time.time() - start) * 1000

            soup = BeautifulSoup(response.content, "html.parser")
            items = self._extract_results(soup, verbose=verbose, llm_client=self.llm_client, provider_url=base_url, query=query)

            if verbose:
                console.log(
                    f"[green]✓ Found {len(items)} results from "
                    f"{base_url} ({elapsed_ms:.0f}ms)"
                )

            return base_url, items, elapsed_ms

        except Exception as e:
            elapsed_ms = (_time.time() - start) * 1000
            if verbose:
                console.log(f"[yellow]⚠ {base_url}: {e}")
            return base_url, [], elapsed_ms

    def search(
        self, query: str, base_urls: List[str], verbose: bool = False
    ) -> List[Tuple[str, str]]:
        """
        Search for content across multiple providers concurrently.

        Fires all provider requests in parallel via ThreadPoolExecutor,
        records health stats, and returns aggregated results.

        Args:
            query: Search query (e.g., "Inception")
            base_urls: List of base URLs to search
            verbose: Print detailed debug info

        Returns:
            List of (title, url) tuples
        """
        results = []

        if verbose:
            with ThreadPoolExecutor(max_workers=min(len(base_urls), 6)) as executor:
                futures = {
                    executor.submit(self._fetch_provider, url, query, verbose): url
                    for url in base_urls
                }
                for future in as_completed(futures):
                    base_url, items, elapsed_ms = future.result()
                    results.extend(items)
                    if self.provider_manager:
                        self.provider_manager.record_result(base_url, len(items) > 0, elapsed_ms)
            return results

        with Progress(SpinnerColumn(), TextColumn("[cyan]{task.description}"), console=console, transient=True) as progress:
            task = progress.add_task(
                f"Searching {len(base_urls)} provider(s) for '{query}'...",
                total=len(base_urls),
            )
            with ThreadPoolExecutor(max_workers=min(len(base_urls), 6)) as executor:
                futures = {
                    executor.submit(self._fetch_provider, url, query, verbose): url
                    for url in base_urls
                }
                for future in as_completed(futures):
                    base_url, items, elapsed_ms = future.result()
                    results.extend(items)
                    if self.provider_manager:
                        self.provider_manager.record_result(base_url, len(items) > 0, elapsed_ms)
                    progress.advance(task)
                    domain = urlparse(base_url).netloc or base_url
                    if items:
                        progress.console.print(f"[green]✓[/green] {domain[:35]}: {len(items)} result(s)")

        return results

    def search_with_providers(
        self, query: str, base_urls: List[str], verbose: bool = False
    ) -> List[dict]:
        """
        Search for content across multiple providers and include provider metadata.

        Args:
            query: Search query (e.g., "Inception")
            base_urls: List of base URLs to search
            verbose: Print detailed debug info

        Returns:
            List of result dictionaries with title, url, and provider.
        """
        results = []

        def _collect(future_map):
            for future in as_completed(future_map):
                base_url, items, elapsed_ms = future.result()
                for title, item_url in items:
                    results.append({"title": title, "url": item_url, "provider": base_url})
                if self.provider_manager:
                    self.provider_manager.record_result(base_url, len(items) > 0, elapsed_ms)

        with ThreadPoolExecutor(max_workers=min(len(base_urls), 6)) as executor:
            futures = {executor.submit(self._fetch_provider, url, query, verbose): url for url in base_urls}
            _collect(futures)

        return results

    @staticmethod
    def _relevance_score(title: str, query: str) -> int:
        """Score how well a title matches a query. 0 = no match."""
        t = title.lower().strip()
        q = query.lower().strip()
        if not q:
            return 50
        if t == q:
            return 100
        if t.startswith(q):
            return 80
        if q in t:
            return 60
        query_words = [w for w in re.split(r'\W+', q) if len(w) > 2]
        if not query_words:
            return 0
        matched = sum(1 for w in query_words if w in t)
        if matched == len(query_words):
            return 50
        if matched >= max(1, int(len(query_words) * 0.6)):
            return 30
        if matched >= 1:
            return 10
        return 0

    @staticmethod
    def _is_nav_link(text: str, href: str) -> bool:
        nav_words = {
            "home", "search", "menu", "nav", "login", "sign in", "sign up",
            "register", "contact", "about", "faq", "terms", "privacy",
            "cookie", "dmca", "request", "genre", "trending", "new release",
            "most viewed", "coming soon", "all movies", "all series",
            "filter", "sort", "next", "previous", "load more", "see all",
        }
        t = text.lower().strip()
        return (
            t in nav_words
            or len(t) < 2
            or len(t) > 120
            or href in ("/", "#", "")
        )

    @staticmethod
    def _extract_results(
        soup: BeautifulSoup,
        verbose: bool = False,
        llm_client=None,
        provider_url: str = "",
        query: str = "",
    ) -> List[Tuple[str, str]]:
        """
        Extract movie/show titles and links, ranked by relevance to query.
        Collects from all matching selectors instead of stopping at first hit.
        """
        candidates: dict = {}  # url -> (title, url)

        selectors = [
            "a.film-name", "a.title", "a.name", "a.ml-mask",
            ".movie-card a", ".film-poster a", "div.card a",
            ".item a", ".mli-info a", "h2 a", "h3 a",
            "a[href*='/watch/']", "a[href*='/movie/']",
            "a[href*='/tv/']", "a[href*='/show/']", "a[href*='/series/']",
        ]

        base_host = ""
        if provider_url:
            p = urlparse(provider_url)
            base_host = f"{p.scheme}://{p.netloc}"

        for selector in selectors:
            for link in soup.select(selector):
                text = link.get_text(strip=True) or link.get("title", "").strip()
                href = link.get("href", "").strip()
                if not text or not href:
                    continue
                if href.startswith("/") and base_host:
                    href = base_host + href
                elif not href.startswith("http"):
                    continue
                if ContentScraper._is_nav_link(text, href):
                    continue
                if _is_trailer_title(text):
                    continue
                if href not in candidates:
                    candidates[href] = (text, href)

        if verbose:
            console.log(f"[cyan]  Collected {len(candidates)} raw candidates")

        # LLM Selector Healing: If no results and LLM available
        if not candidates and llm_client and llm_client.enabled and provider_url:
            healed_selector = ContentScraper._heal_selector_with_llm(
                llm_client, provider_url, str(soup)[:2000], verbose
            )
            if healed_selector:
                for link in soup.select(healed_selector):
                    text = link.get_text(strip=True)
                    href = link.get("href", "")
                    if text and href and not ContentScraper._is_nav_link(text, href):
                        candidates[href] = (text, href)

        # Score and rank by query relevance
        scored = []
        for title, url in candidates.values():
            score = ContentScraper._relevance_score(title, query)
            if score > 0 or not query:
                scored.append((score, title, url))

        scored.sort(key=lambda x: (-x[0], x[1]))

        if verbose and scored:
            console.log(f"[green]  Top result: {scored[0][1]!r} (score={scored[0][0]})")

        return [(title, url) for _, title, url in scored[:20]]

    @staticmethod
    def _heal_selector_with_llm(llm_client, provider_url: str, html_fragment: str, verbose: bool = False) -> Optional[str]:
        """
        Use LLM to generate a CSS selector when standard selectors fail.

        Args:
            llm_client: LLM client instance
            provider_url: Provider URL for context
            html_fragment: HTML snippet to analyze
            verbose: Print debug info

        Returns:
            CSS selector string or None
        """
        try:
            if verbose:
                console.log("[yellow]  → Asking LLM for selector healing...")

            selector = llm_client.adapt_selector(
                provider=provider_url,
                failed_html=html_fragment,
                target="movie/show title and link pairs"
            )

            if selector and verbose:
                console.log(f"[green]  LLM suggested selector: {selector}")

            return selector
        except Exception as e:
            if verbose:
                console.log(f"[red]  LLM selector healing failed: {e}")
            return None

    def fetch_embed_from_page(self, page_url: str, base_url: Optional[str] = None) -> Optional[str]:
        """
        Fetch a page and extract embedded video URL with multiple strategies.

        Args:
            page_url: URL of the movie/show page
            base_url: Base URL for constructing full URLs from relative paths

        Returns:
            Embed URL if found, None otherwise
        """
        try:
            # Handle relative URLs
            if not page_url.startswith("http"):
                if base_url:
                    page_url = base_url.rstrip("/") + "/" + page_url.lstrip("/")
                else:
                    return None

            console.log(f"[cyan]→ Fetching embed from: {page_url[:60]}...")
            response = self.session.get(page_url, timeout=10)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, "html.parser")
            html_str = str(soup)

            # Strategy 1: Look for iframes with specific selectors
            selectors = [
                ".player-container iframe",
                "#player iframe",
                "#watch-iframe iframe",
                "iframe[src*='embed']",
                "iframe[src*='player']",
                "iframe[src*='watch']",
            ]
            
            for selector in selectors:
                iframes = soup.select(selector)
                for iframe in iframes:
                    src = iframe.get("src", "")
                    if src:
                        embed_url = self._make_absolute_url(src, page_url)
                        console.log(f"[green]✓ Found iframe embed:[/green] {embed_url[:60]}...")
                        return embed_url

            # Strategy 2: All iframes (fallback)
            for iframe in soup.find_all("iframe"):
                src = iframe.get("src", "")
                if src and any(
                    pattern in src.lower()
                    for pattern in ["embed", "player", "watch", "vid", "m3u8", "mp4"]
                ):
                    embed_url = self._make_absolute_url(src, page_url)
                    console.log(f"[green]✓ Found iframe embed:[/green] {embed_url[:60]}...")
                    return embed_url

            # Strategy 3: Look for video tags
            for video in soup.find_all("video"):
                src = video.get("src", "")
                if src:
                    embed_url = self._make_absolute_url(src, page_url)
                    console.log(f"[green]✓ Found video tag:[/green] {embed_url[:60]}...")
                    return embed_url

                # Check source tags inside video
                for source in video.find_all("source"):
                    src = source.get("src", "")
                    if src and any(
                        ext in src.lower() for ext in [".mp4", ".m3u8", "stream"]
                    ):
                        embed_url = self._make_absolute_url(src, page_url)
                        console.log(f"[green]✓ Found video source:[/green] {embed_url[:60]}...")
                        return embed_url

            # Strategy 4: Regex search for direct URLs
            url_pattern = r'(https?://[^\s\'"]+\.(m3u8|mp4))'
            matches = re.findall(url_pattern, html_str)
            if matches:
                embed_url = matches[0][0]
                console.log(f"[green]✓ Found direct URL:[/green] {embed_url[:60]}...")
                return embed_url

            # Strategy 5: Regex fallback on all patterns
            for pattern, pattern_type in EMBED_PATTERNS:
                matches = re.findall(pattern, html_str)
                if matches:
                    embed_url = matches[0]
                    if embed_url.startswith("http"):
                        console.log(f"[green]✓ Found {pattern_type}:[/green] {embed_url[:60]}...")
                        return embed_url

            # Fallback: ask an LLM for a selector if available
            if self.llm_client and self.llm_client.enabled:
                selector = self.llm_client.adapt_selector(
                    page_url,
                    html_str,
                    target="video embed URL",
                )
                if selector:
                    elements = soup.select(selector)
                    for element in elements:
                        src = element.get("src") or element.get("href") or element.get("data-src")
                        if src:
                            embed_url = self._make_absolute_url(src, page_url)
                            console.log(
                                f"[green]✓ LLM selector found embed:[/green] {embed_url[:60]}..."
                            )
                            return embed_url

            console.log("[yellow]⚠ No embed found on detail page")
            return None

        except requests.exceptions.Timeout:
            console.log(f"[yellow]⚠ Timeout fetching {page_url}")
            return None
        except requests.exceptions.HTTPError as e:
            if e.response.status_code in [403, 404]:
                console.log(f"[yellow]⚠ Access denied/not found: {e.response.status_code}")
            else:
                console.log(f"[yellow]⚠ HTTP error: {e.response.status_code}")
            return None
        except Exception as e:
            console.log(f"[yellow]⚠ Could not fetch embed: {e}")
            return None

    @staticmethod
    def _make_absolute_url(url: str, page_url: str) -> str:
        """
        Convert relative URL to absolute URL.

        Args:
            url: URL (relative or absolute)
            page_url: Base page URL for constructing absolute URLs

        Returns:
            Absolute URL
        """
        if url.startswith("http://") or url.startswith("https://"):
            return url
        
        if url.startswith("//"):
            # Protocol-relative URL
            return "https:" + url
        
        if url.startswith("/"):
            # Absolute path
            from urllib.parse import urlparse
            parsed = urlparse(page_url)
            return f"{parsed.scheme}://{parsed.netloc}{url}"
        
        # Relative path
        from urllib.parse import urljoin
        return urljoin(page_url, url)

    def search_duckduckgo(self, query: str) -> List[Tuple[str, str]]:
        """
        Fallback: DuckDuckGo HTML search filtered to known streaming domains.
        Decodes DDG redirect URLs to get actual destination URLs.
        """
        try:
            console.log(f"Searching DuckDuckGo for '{query} full movie'...")
            ddg_query = f"{query} full movie watch online free"
            response = self.session.get(
                "https://duckduckgo.com/html/",
                params={"q": ddg_query},
                timeout=12,
            )
            response.raise_for_status()

            soup = BeautifulSoup(response.content, "html.parser")
            results = []

            for a in soup.find_all("a", class_="result__a"):
                title = a.get_text(strip=True)
                href = a.get("href", "")
                if not href:
                    continue

                # Decode DDG's redirect wrapper  //duckduckgo.com/l/?uddg=...
                actual_url = _decode_ddg_url(href)
                if not actual_url:
                    continue

                # Only keep results from known streaming sites
                domain = urlparse(actual_url).netloc.lstrip("www.")
                if not any(d in domain for d in _STREAMING_DOMAINS):
                    continue

                if title and not _is_trailer_title(title):
                    results.append((title[:80], actual_url))

            return results[:10]

        except Exception as e:
            console.log(f"[yellow]⚠[/yellow] DuckDuckGo search failed: {e}")
            return []

    def search_ytdlp_quick(self, query: str, min_duration: int = 600) -> List[Tuple[str, str]]:
        """
        Fast yt-dlp YouTube search — returns a selectable result list.
        min_duration: minimum seconds (default 10 min; use 2400 for movies only).
        """
        import shutil
        if not shutil.which("yt-dlp"):
            return []

        # Detect TV query to avoid appending "full movie"
        q_lower = query.lower()
        is_tv = any(w in q_lower for w in ("season ", " s0", "s1", "s2", "episode",
                                            " ep ", "series", "show"))
        search_term = query if is_tv else f"{query} full movie"

        try:
            console.log(f"[cyan]→[/cyan] yt-dlp search: '{search_term}'...")
            result = subprocess.run(
                [
                    "yt-dlp", "--dump-json", "--flat-playlist",
                    "--no-warnings", "--quiet",
                    f"ytsearch15:{search_term}",
                ],
                capture_output=True, text=True, timeout=25,
            )
            items = []
            for line in result.stdout.splitlines():
                try:
                    d = json.loads(line)
                except Exception:
                    continue
                vid_id = d.get("id", "")
                title = d.get("title", "")
                duration = d.get("duration")
                if not vid_id or not title:
                    continue
                if _is_trailer_title(title):
                    continue
                if duration is not None and duration < min_duration:
                    continue
                items.append((title, f"https://www.youtube.com/watch?v={vid_id}"))
            if items:
                console.log(f"[green]✓[/green] yt-dlp found {len(items)} results")
            return items[:12]
        except Exception:
            return []

    def _detect_stream_type(self, url: str) -> str:
        """
        Detect stream type to choose the right playback strategy.

        Returns one of: "direct", "hls", "dash", "ytdlp"
        """
        url_path = url.lower().split("?")[0]

        direct_exts = (".mp4", ".mkv", ".avi", ".webm", ".mov", ".ts", ".ogv")
        if any(url_path.endswith(ext) for ext in direct_exts):
            return "direct"

        if ".m3u8" in url_path:
            return "hls"

        if ".mpd" in url_path:
            return "dash"

        try:
            resp = self.session.head(url, timeout=5, allow_redirects=True)
            ct = resp.headers.get("content-type", "").lower()
            if "mpegurl" in ct or "x-mpegurl" in ct:
                return "hls"
            if "dash" in ct:
                return "dash"
            if "video/" in ct or "audio/" in ct:
                return "direct"
        except Exception:
            pass

        return "ytdlp"

    def play_url(self, url: str, is_embed: bool = False, title: str = "") -> bool:
        """
        Play a URL using yt-dlp + mpv for best compatibility.

        Args:
            url: Video URL to play
            is_embed: True if URL is an embed page (use yt-dlp for HLS/subtitles)
            title: Window title shown in mpv

        Returns:
            True if playback started, False otherwise
        """
        import shutil

        try:
            console.log("[cyan]→ Preparing playback...")

            video_url = url
            audio_url = None

            if is_embed:
                stream_type = self._detect_stream_type(url)
                if stream_type in ("direct", "hls", "dash"):
                    console.log(f"[cyan]  Detected {stream_type} stream, playing directly...")
                else:
                    console.log("[cyan]  Extracting stream via yt-dlp...")
                    result = subprocess.run(
                        [
                            "yt-dlp",
                            "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best",
                            "--no-playlist",
                            "--get-url",
                            url,
                        ],
                        capture_output=True,
                        text=True,
                        timeout=30,
                    )

                    if result.returncode == 0 and result.stdout.strip():
                        lines = [ln.strip() for ln in result.stdout.strip().splitlines() if ln.strip()]
                        if len(lines) >= 2:
                            # Adaptive stream: yt-dlp returns video URL then audio URL
                            video_url, audio_url = lines[0], lines[1]
                            console.log("[green]✓ Got separate video+audio streams[/green]")
                        elif lines:
                            video_url = lines[0]
                            console.log("[green]✓ Got merged stream URL[/green]")
                    else:
                        console.log("[yellow]⚠ yt-dlp could not extract stream, trying direct mpv...")

            mpv_path = shutil.which("mpv") or "mpv"
            console.log("[cyan]→ Starting mpv...")
            mpv_cmd = [mpv_path, "--hwdec=auto-safe"]
            if title:
                mpv_cmd.append(f"--title={title}")
            if audio_url:
                mpv_cmd.append(f"--audio-file={audio_url}")
            mpv_cmd.append(video_url)

            subprocess.run(mpv_cmd, timeout=3600)
            return True

        except FileNotFoundError:
            console.log("[yellow]⚠ mpv not found. Install with: pkg install mpv")
            console.log(f"[green]Stream URL:[/green] {url}")
            console.log(f"[cyan]Paste in browser or run:[/cyan] yt-dlp '{url}'")
            return True  # User can play manually
        except subprocess.TimeoutExpired:
            return True  # Normal end of playback
        except Exception as e:
            console.log(f"[red]✗ Playback error: {e}")
            return False

    def stream_with_yt_dlp(self, query: str) -> bool:
        """
        Fallback streaming using yt-dlp with mpv player.

        Args:
            query: Search query

        Returns:
            True if streaming started, False otherwise
        """
        try:
            console.log(f"Attempting to stream '{query}' with yt-dlp...")
            search_query = f"ytsearch:{query} full movie"

            # Get streaming URL using yt-dlp
            result = subprocess.run(
                [
                    "yt-dlp",
                    "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best",
                    "--get-url",
                    search_query,
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode == 0 and result.stdout.strip():
                lines = [ln.strip() for ln in result.stdout.strip().splitlines() if ln.strip()]
                video_url = lines[0]
                audio_url = lines[1] if len(lines) >= 2 else None
                console.log(f"[green]✓[/green] Found stream: {video_url[:60]}...")

                try:
                    mpv_cmd = ["mpv", "--hwdec=auto"]
                    if audio_url:
                        mpv_cmd.append(f"--audio-file={audio_url}")
                    mpv_cmd.append(video_url)
                    subprocess.run(mpv_cmd, timeout=3600)
                    return True
                except FileNotFoundError:
                    console.log(
                        "[yellow]⚠[/yellow] mpv not found. "
                        "Please install mpv or use your player manually."
                    )
                    console.log(f"Stream URL: {video_url}")
                    return True
                except subprocess.TimeoutExpired:
                    return True  # Stream ended normally

            else:
                console.log(
                    "[red]✗[/red] Could not find stream with yt-dlp"
                )
                return False

        except FileNotFoundError:
            console.log(
                "[red]✗[/red] yt-dlp not found. "
                "Install with: pip install yt-dlp"
            )
            return False
        except subprocess.TimeoutExpired:
            console.log("[yellow]⚠[/yellow] yt-dlp search timed out")
            return False
        except Exception as e:
            console.log(f"[red]✗[/red] yt-dlp error: {e}")
            return False

    def download_video(
        self, url: str, output_path: Optional[str] = None
    ) -> bool:
        """
        Download video using yt-dlp.

        Args:
            url: Video URL
            output_path: Output directory (default: ~/Downloads)

        Returns:
            True if download started, False otherwise
        """
        try:
            from pathlib import Path

            if output_path is None:
                output_path = str(Path.home() / "Downloads")

            console.log(f"Downloading to {output_path}...")
            result = subprocess.run(
                [
                    "yt-dlp",
                    "-o",
                    f"{output_path}/%(title)s.%(ext)s",
                    url,
                ],
                timeout=3600,
            )

            if result.returncode == 0:
                console.log(f"[green]✓[/green] Download complete")
                return True
            else:
                console.log("[red]✗[/red] Download failed")
                return False

        except FileNotFoundError:
            console.log(
                "[red]✗[/red] yt-dlp not found. Install: pip install yt-dlp"
            )
            return False
        except subprocess.TimeoutExpired:
            console.log("[yellow]⚠[/yellow] Download timed out")
            return False
        except Exception as e:
            console.log(f"[red]✗[/red] Download error: {e}")
            return False

    def validate_proxy(self, proxy_url: str) -> bool:
        """
        Test if a proxy is reachable with a live HEAD request.

        Args:
            proxy_url: Proxy URL to test (e.g. http://host:port)

        Returns:
            True if proxy responds successfully
        """
        try:
            resp = requests.head(
                "https://www.example.com",
                proxies={"http": proxy_url, "https": proxy_url},
                timeout=6,
            )
            return resp.status_code < 500
        except Exception:
            return False

    def test_provider_url(self, url: str, timeout: int = 10) -> Tuple[bool, float]:
        """
        Test if a provider URL is reachable.

        Args:
            url: Provider URL to test
            timeout: Request timeout in seconds

        Returns:
            Tuple of (is_healthy, response_time_in_seconds)
        """
        try:
            import time

            start = time.time()
            response = self.session.head(url, timeout=timeout)
            elapsed = time.time() - start

            is_healthy = response.status_code < 400
            return is_healthy, elapsed

        except requests.Timeout:
            return False, float(timeout)
        except requests.RequestException:
            return False, 0.0
        except Exception:
            return False, 0.0
