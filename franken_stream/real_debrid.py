"""Real-Debrid integration — premium link unrestriction."""

import asyncio
import logging
from typing import Optional
from urllib.parse import urlparse

import aiohttp

logger = logging.getLogger(__name__)

RD_BASE = "https://api.real-debrid.com/rest/1.0"


class RealDebridClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self._headers = {"Authorization": f"Bearer {api_key}"}

    async def _get(self, path: str) -> Optional[dict]:
        url = f"{RD_BASE}{path}"
        try:
            async with aiohttp.ClientSession() as s:
                async with s.get(url, headers=self._headers, timeout=aiohttp.ClientTimeout(total=10)) as r:
                    if r.status == 200:
                        return await r.json()
        except Exception:
            pass
        return None

    async def _post(self, path: str, data: dict) -> Optional[dict]:
        url = f"{RD_BASE}{path}"
        try:
            async with aiohttp.ClientSession() as s:
                async with s.post(url, headers=self._headers, data=data, timeout=aiohttp.ClientTimeout(total=15)) as r:
                    if r.status in (200, 201):
                        return await r.json()
        except Exception:
            pass
        return None

    async def is_alive(self) -> bool:
        """Return True if the API key is valid."""
        data = await self._get("/user")
        return data is not None and data.get("premium", 0) > 0

    async def get_supported_hosts(self) -> list:
        """Return list of hosts RD can unrestrict."""
        data = await self._get("/hosts")
        if isinstance(data, dict):
            return list(data.keys())
        return []

    async def is_supported(self, url: str) -> bool:
        """Check if this URL's host is supported by Real-Debrid."""
        host = urlparse(url).netloc.lower().lstrip("www.")
        hosts = await self.get_supported_hosts()
        return any(host in h or h in host for h in hosts)

    async def unrestrict(self, url: str) -> Optional[str]:
        """
        Unrestrict a link via Real-Debrid.
        Returns the premium direct download URL, or None on failure.
        """
        data = await self._post("/unrestrict/link", {"link": url})
        if data and data.get("download"):
            logger.info("RD unrestricted: %s → %s", url[:50], data["download"][:50])
            return data["download"]
        return None

    async def unrestrict_many(self, urls: list) -> dict:
        """
        Unrestrict multiple URLs concurrently.
        Returns {original_url: premium_url} for successful ones.
        """
        tasks = [(url, asyncio.create_task(self.unrestrict(url))) for url in urls]
        result = {}
        for url, task in tasks:
            try:
                premium = await task
                if premium:
                    result[url] = premium
            except Exception:
                pass
        return result


# Module-level singleton — initialized lazily from env/settings
_client: Optional[RealDebridClient] = None


def get_client() -> Optional[RealDebridClient]:
    global _client
    if _client is None:
        import os
        key = os.environ.get("REAL_DEBRID_API_KEY", "")
        if key:
            _client = RealDebridClient(key)
    return _client
