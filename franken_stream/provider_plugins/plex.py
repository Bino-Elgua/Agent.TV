"""Plex free (Watch Free) provider — no account needed."""

import re
from typing import List, Optional
from urllib.parse import quote

import aiohttp

from .base import MediaItem, ProviderPlugin

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
    "X-Plex-Client-Identifier": "franken-stream",
    "X-Plex-Product": "FrankenStream",
    "X-Plex-Version": "2.0",
}


class PlexFreeProvider(ProviderPlugin):
    name = "plex_free"
    base_url = "https://watch.plex.tv"
    legal = True
    requires_js = False

    SEARCH_URL = (
        "https://metadata.provider.plex.tv/library/search"
        "?query={query}&limit=20&searchTypes=movie,show"
        "&X-Plex-Token=&X-Plex-Client-Identifier=franken-stream"
    )

    async def search(self, query: str, media_type: str = "any") -> List[MediaItem]:
        url = self.SEARCH_URL.format(query=quote(query))
        try:
            async with aiohttp.ClientSession() as s:
                async with s.get(
                    url, headers=_HEADERS, timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status != 200:
                        return []
                    data = await resp.json(content_type=None)
        except Exception:
            return []

        results = []
        hubs = data.get("MediaContainer", {}).get("SearchResult", [])
        for hub in hubs:
            meta = hub.get("Metadata", {})
            if not meta:
                continue
            title = meta.get("title", "")
            mtype_raw = meta.get("type", "movie")
            mtype = "tv" if mtype_raw == "show" else "movie"
            rating_key = meta.get("ratingKey", "")
            if not title or not rating_key:
                continue

            slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
            watch_url = f"https://watch.plex.tv/{'show' if mtype == 'tv' else 'movie'}/{slug}"

            thumb = meta.get("thumb", "")
            if thumb:
                thumb = f"https://metadata.provider.plex.tv{thumb}?X-Plex-Token="

            year = meta.get("year")
            results.append(
                MediaItem(
                    id=f"plex:{rating_key}",
                    title=title,
                    url=watch_url,
                    provider=self.name,
                    year=year,
                    media_type=mtype,
                    quality="1080p",
                    thumbnail=thumb or None,
                    description=meta.get("summary", "")[:200],
                )
            )
        return results

    async def extract_embed(self, page_url: str) -> Optional[str]:
        return page_url
