"""yt-dlp plugin — free/legal full-movie sources only (no YouTube trailers)."""

import asyncio
import json
import re
import shutil
from typing import List, Optional

from .base import MediaItem, ProviderPlugin

# Free, legal sources that yt-dlp can extract full films from.
# YouTube is intentionally excluded — it returns trailers, not full movies.
_FREE_SEARCH_PREFIXES = [
    "tubitv:",       # Tubi — large free library with ads
    "pluto:",        # Pluto TV
    "archiveorg:",   # Internet Archive — public domain films
]

# Tubi/Pluto require the actual site URL for search; we use yt-dlp's
# --default-search to try multiple sources at once.
_ARCHIVE_SEARCH = "https://archive.org/search?query={query}+feature+length&and[]=mediatype%3Amovies&sort=-downloads"


class YtDlpProvider(ProviderPlugin):
    name = "yt_dlp"
    base_url = "https://archive.org"
    legal = True
    requires_js = False

    async def search(self, query: str, media_type: str = "any") -> List[MediaItem]:
        if not shutil.which("yt-dlp"):
            return []

        results: List[MediaItem] = []

        # Archive.org — public domain films, free, always works
        archive_results = await self._search_archive(query, media_type)
        results.extend(archive_results)

        return results

    async def _search_archive(self, query: str, media_type: str) -> List[MediaItem]:
        """Search Internet Archive for full-length films."""
        from urllib.parse import quote_plus
        search_url = (
            f"https://archive.org/search?query={quote_plus(query)}"
            f"+feature+length&and[]=mediatype%3Amovies&sort=-downloads&output=json"
        )

        cmd = [
            "yt-dlp",
            "--no-check-certificate",
            "--flat-playlist",
            "--dump-json",
            "--no-warnings",
            "--quiet",
            "--playlist-end", "8",
            search_url,
        ]
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=25)
        except (asyncio.TimeoutError, FileNotFoundError, Exception):
            return []

        items = []
        for line in stdout.decode("utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue

            vid_id = data.get("id", "")
            title = data.get("title", "")
            if not vid_id or not title:
                continue

            duration = data.get("duration")
            # Skip very short clips (less than 40 min) — likely not a full movie
            if duration and duration < 2400:
                continue

            url = data.get("url") or f"https://archive.org/details/{vid_id}"
            thumbnail = data.get("thumbnail", "")

            items.append(
                MediaItem(
                    id=f"archive:{vid_id}",
                    title=title,
                    url=url,
                    provider=self.name,
                    year=self._parse_year(data.get("upload_date", "")),
                    media_type="movie",
                    quality="varies",
                    thumbnail=thumbnail or None,
                    description=data.get("description", "")[:200],
                )
            )
        return items

    async def extract_embed(self, page_url: str) -> Optional[str]:
        """yt-dlp handles extraction at play time via /api/v1/extract."""
        return page_url

    @staticmethod
    def _parse_year(upload_date: str) -> Optional[int]:
        if upload_date and len(upload_date) >= 4:
            try:
                return int(upload_date[:4])
            except ValueError:
                pass
        return None
