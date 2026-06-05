"""yt-dlp plugin — searches YouTube and 1000+ supported sites."""

import asyncio
import json
import re
import shutil
from typing import List, Optional

from .base import MediaItem, ProviderPlugin


class YtDlpProvider(ProviderPlugin):
    name = "yt_dlp"
    base_url = "https://www.youtube.com"
    legal = True
    requires_js = False

    async def search(self, query: str, media_type: str = "any") -> List[MediaItem]:
        if not shutil.which("yt-dlp"):
            return []

        # Search YouTube for the exact title — limit to 8 results for speed
        search_query = f"ytsearch8:{query}"
        cmd = [
            "yt-dlp",
            "--dump-json",
            "--flat-playlist",
            "--no-warnings",
            "--quiet",
            search_query,
        ]
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=20)
        except (asyncio.TimeoutError, FileNotFoundError):
            return []
        except Exception:
            return []

        results = []
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
            # Skip very short clips (< 20 min) for movie searches to avoid trailers
            # but keep everything for TV shows
            if media_type == "movie" and duration and duration < 1200:
                continue

            url = f"https://www.youtube.com/watch?v={vid_id}"
            thumbnail = data.get("thumbnail") or f"https://img.youtube.com/vi/{vid_id}/hqdefault.jpg"

            results.append(
                MediaItem(
                    id=f"yt:{vid_id}",
                    title=title,
                    url=url,
                    provider=self.name,
                    year=self._parse_year(data.get("upload_date", "")),
                    media_type=media_type if media_type != "any" else "movie",
                    quality="varies",
                    thumbnail=thumbnail,
                    description=data.get("description", "")[:200],
                )
            )
        return results

    async def extract_embed(self, page_url: str) -> Optional[str]:
        """Return the YouTube URL directly — video.js / yt-dlp handles it."""
        return page_url

    @staticmethod
    def _parse_year(upload_date: str) -> Optional[int]:
        if upload_date and len(upload_date) >= 4:
            try:
                return int(upload_date[:4])
            except ValueError:
                pass
        return None
