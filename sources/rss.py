"""Coletor de notícias via RSS feeds."""

import asyncio
from datetime import datetime

import feedparser
import httpx
import structlog

from config.settings import settings
from sources.base import BaseSource, RawContent

log = structlog.get_logger()


class RSSSource(BaseSource):
    def __init__(self):
        self._callbacks: list = []
        self._running = False
        self._task: asyncio.Task | None = None

    def on_content(self, callback) -> None:
        self._callbacks.append(callback)

    async def start(self) -> None:
        if not settings.monitor_rss_feeds:
            log.warning("rss.skip", reason="Nenhum feed RSS configurado")
            return
        self._running = True
        self._task = asyncio.create_task(self._poll_loop())
        log.info("rss.started", feeds=len(settings.monitor_rss_feeds))

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
        log.info("rss.stopped")

    async def _poll_loop(self):
        """Poll de feeds RSS a cada 2 minutos."""
        seen_ids: set[str] = set()

        while self._running:
            for feed_url in settings.monitor_rss_feeds:
                try:
                    entries = await self._fetch_feed(feed_url)
                    for entry in entries:
                        entry_id = entry.get("id", entry.get("link", ""))
                        if not entry_id or entry_id in seen_ids:
                            continue
                        seen_ids.add(entry_id)

                        title = entry.get("title", "")
                        summary = entry.get("summary", "")
                        text = f"{title}\n{summary}"

                        topics = self._extract_topics(text)
                        if not topics:
                            continue  # Só processa se bater com algum tópico

                        content = RawContent(
                            source_type="rss",
                            source_id=entry_id,
                            source_url=entry.get("link", ""),
                            text=text,
                            author=entry.get("author", feed_url),
                            topic_hints=topics,
                            extra={
                                "feed_url": feed_url,
                                "published": entry.get("published", ""),
                            },
                        )

                        for cb in self._callbacks:
                            await cb(content)

                        log.info("rss.new_entry", title=title[:60], topics=topics)

                except Exception as e:
                    log.error("rss.feed_error", feed=feed_url, error=str(e))

            # Limita
            if len(seen_ids) > 10000:
                seen_ids = set(list(seen_ids)[-5000:])

            await asyncio.sleep(120)  # Poll a cada 2min

    async def _fetch_feed(self, url: str) -> list[dict]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=15)
            if resp.status_code == 200:
                feed = feedparser.parse(resp.text)
                return feed.entries[:20]
        return []

    def _extract_topics(self, text: str) -> list[str]:
        text_lower = text.lower()
        return [t for t in settings.monitor_topics if t.lower() in text_lower]
