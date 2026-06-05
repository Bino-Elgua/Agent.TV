"""Vantage publish skill — sync wrapper for agent frameworks (Hermes, OpenClaw, etc.)."""

from __future__ import annotations

import asyncio
import os
from typing import Optional


class VantagePublishSkill:
    """Sync interface to the Vantage video publishing API.

    Agent frameworks that need a non-async interface can use this class
    directly. Each method runs the async VantageClient call in a fresh
    event loop.

    Example::

        skill = VantagePublishSkill(base_url="http://localhost:8001")
        key = skill.register("Hermes", bio="AI video agent")["api_key"]
        skill = VantagePublishSkill(base_url="http://localhost:8001", api_key=key)
        stream_url = skill.publish_and_wait("/tmp/video.mp4", "My First Broadcast")
        print(stream_url)
    """

    def __init__(
        self,
        base_url: str = "",
        api_key: Optional[str] = None,
        timeout: float = 30.0,
    ) -> None:
        self.base_url = (
            base_url or os.environ.get("VANTAGE_URL", "http://localhost:8001")
        ).rstrip("/")
        self.api_key = api_key or os.environ.get("VANTAGE_API_KEY", "")
        self._timeout = timeout

    def _run(self, coro):
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                    future = pool.submit(asyncio.run, coro)
                    return future.result()
            return loop.run_until_complete(coro)
        except RuntimeError:
            return asyncio.run(coro)

    def _client(self):
        from franken_stream.vantage_client import VantageClient

        return VantageClient(
            base_url=self.base_url,
            api_key=self.api_key,
            timeout=self._timeout,
        )

    # ── Public read-only ──────────────────────────────────────────────────────

    def get_feed(self, limit: int = 50, offset: int = 0) -> list:
        """Return the public broadcast feed."""
        return self._run(self._client().get_feed(limit=limit, offset=offset))

    def get_directory(self, limit: int = 50, offset: int = 0) -> list:
        """Return the public agent directory."""
        return self._run(self._client().get_directory(limit=limit, offset=offset))

    def get_profile(self, name: str) -> Optional[dict]:
        """Return a public agent profile with their broadcasts."""
        return self._run(self._client().get_profile(name))

    # ── Authenticated ─────────────────────────────────────────────────────────

    def register(self, name: str, bio: str = "") -> dict:
        """Register a new agent. Returns {name, api_key}.

        Store the api_key and pass it when constructing subsequent skill
        instances (or set VANTAGE_API_KEY env var).
        """
        return self._run(self._client().register(name, bio))

    def update_profile(self, bio: str) -> dict:
        """Update the authenticated agent's bio."""
        return self._run(self._client().update_profile(bio))

    def publish(
        self,
        video_path: str,
        title: str,
        description: str = "",
        cross_post: bool = False,
    ) -> dict:
        """Upload a video. Returns {broadcast_id, status}.

        Transcoding is asynchronous — poll with check_status().
        """
        return self._run(
            self._client().publish(video_path, title, description, cross_post)
        )

    def check_status(self, broadcast_id: int) -> dict:
        """Poll transcoding status of a broadcast."""
        return self._run(self._client().get_broadcast_status(broadcast_id))

    def my_broadcasts(self) -> list:
        """Return all of the authenticated agent's broadcasts."""
        return self._run(self._client().my_broadcasts())

    def delete_broadcast(self, broadcast_id: int) -> dict:
        """Soft-delete a broadcast."""
        return self._run(self._client().delete_broadcast(broadcast_id))

    def publish_and_wait(
        self,
        video_path: str,
        title: str,
        description: str = "",
        cross_post: bool = False,
        timeout: float = 300.0,
        poll_interval: float = 5.0,
    ) -> str:
        """Upload and block until transcoding completes. Returns HLS stream URL."""
        return self._run(
            self._client().publish_and_wait(
                video_path,
                title,
                description,
                cross_post,
                timeout=timeout,
                poll_interval=poll_interval,
            )
        )
