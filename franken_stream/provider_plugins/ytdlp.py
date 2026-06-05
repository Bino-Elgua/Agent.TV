"""yt-dlp plugin — YouTube + Internet Archive, with trailer filtering."""

import asyncio
import json
import shutil
from typing import List, Optional

from .base import MediaItem, ProviderPlugin

# Title substrings that indicate a trailer/clip rather than full content
_SKIP_TITLE = (
    " trailer", " teaser", "official trailer", "sneak peek", "first look",
    "behind the scenes", "making of", "featurette", "deleted scene",
    "bloopers", "gag reel", "tv spot", " promo", "extended clip",
    "reaction:", "| reaction", "explained", "breakdown", "everything you missed",
    "watch before", "things you", "easter egg",
)


def _looks_like_trailer(title: str, duration: Optional[float], media_type: str) -> bool:
    """Return True if this entry should be excluded as a trailer/short clip."""
    t = title.lower()
    if any(s in t for s in _SKIP_TITLE):
        return True
    # Duration-based filter: for movie searches skip anything under 40 min
    if media_type == "movie" and duration is not None and duration < 2400:
        return True
    return False


class YtDlpProvider(ProviderPlugin):
    name = "yt_dlp"
    base_url = "https://www.youtube.com"
    legal = True
    requires_js = False

    async def search(self, query: str, media_type: str = "any") -> List[MediaItem]:
        if not shutil.which("yt-dlp"):
            return []

        results: List[MediaItem] = []

        # YouTube — great for documentaries, concerts, public-domain films, etc.
        yt_results = await self._search_youtube(query, media_type)
        results.extend(yt_results)

        # Internet Archive — public domain feature films
        archive_results = await self._search_archive(query, media_type)
        results.extend(archive_results)

        return results

    # ── YouTube ────────────────────────────────────────────────────────────

    async def _search_youtube(self, query: str, media_type: str) -> List[MediaItem]:
        # For movie searches, add "full movie" to find actual films not trailers
        if media_type == "movie" or media_type == "any":
            search_q = f"ytsearch12:{query} full movie"
        else:
            search_q = f"ytsearch10:{query}"

        cmd = [
            "yt-dlp", "--dump-json", "--flat-playlist",
            "--no-warnings", "--quiet", search_q,
        ]
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
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
            duration = data.get("duration")
            if not vid_id or not title:
                continue
            if _looks_like_trailer(title, duration, media_type):
                continue

            url = f"https://www.youtube.com/watch?v={vid_id}"
            thumbnail = data.get("thumbnail") or f"https://img.youtube.com/vi/{vid_id}/hqdefault.jpg"

            items.append(MediaItem(
                id=f"yt:{vid_id}",
                title=title,
                url=url,
                provider=self.name,
                year=self._parse_year(data.get("upload_date", "")),
                media_type=media_type if media_type != "any" else "movie",
                quality="varies",
                thumbnail=thumbnail,
                description=(data.get("description") or "")[:200],
            ))
        return items

    # ── Internet Archive ───────────────────────────────────────────────────

    async def _search_archive(self, query: str, media_type: str) -> List[MediaItem]:
        from urllib.parse import quote_plus
        search_url = (
            f"https://archive.org/search?query={quote_plus(query)}"
            f"+feature+length&and[]=mediatype%3Amovies&sort=-downloads"
            f"&output=json"
        )
        cmd = [
            "yt-dlp", "--no-check-certificate", "--flat-playlist",
            "--dump-json", "--no-warnings", "--quiet",
            "--playlist-end", "6",
            search_url,
        ]
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
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
            duration = data.get("duration")
            if not vid_id or not title:
                continue
            # Skip very short clips
            if duration and duration < 2400:
                continue

            url = data.get("url") or f"https://archive.org/details/{vid_id}"
            items.append(MediaItem(
                id=f"archive:{vid_id}",
                title=title,
                url=url,
                provider="archive_org",
                year=self._parse_year(data.get("upload_date", "")),
                media_type="movie",
                quality="varies",
                thumbnail=data.get("thumbnail") or None,
                description=(data.get("description") or "")[:200],
            ))
        return items

    async def extract_embed(self, page_url: str) -> Optional[str]:
        return page_url

    @staticmethod
    def _parse_year(upload_date: str) -> Optional[int]:
        if upload_date and len(upload_date) >= 4:
            try:
                return int(upload_date[:4])
            except ValueError:
                pass
        return None
