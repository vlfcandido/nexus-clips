"""Coletor de tweets em tempo real via Twitter/X API v2."""

import asyncio

import httpx
import structlog

from config.settings import settings
from sources.base import BaseSource, RawContent

log = structlog.get_logger()


class TwitterSource(BaseSource):
    def __init__(self):
        self._callbacks: list = []
        self._running = False
        self._task: asyncio.Task | None = None

    def on_content(self, callback) -> None:
        self._callbacks.append(callback)

    async def start(self) -> None:
        if not settings.twitter_bearer_token:
            log.warning("twitter.skip", reason="TWITTER_BEARER_TOKEN não configurado")
            return
        self._running = True
        self._task = asyncio.create_task(self._poll_loop())
        log.info("twitter.started")

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
        log.info("twitter.stopped")

    async def _poll_loop(self):
        """Polling de tweets recentes das contas monitoradas.

        Usa search/recent pra pegar tweets com as keywords configuradas.
        Intervalo curto (30s) pra pegar conteúdo quase em tempo real.
        """
        headers = {"Authorization": f"Bearer {settings.twitter_bearer_token}"}

        # Monta query com as contas + tópicos
        accounts = " OR ".join(
            f"from:{acc}" for acc in settings.monitor_twitter_accounts
        )
        topics = " OR ".join(f'"{t}"' for t in settings.monitor_topics)
        query = f"({accounts}) ({topics}) -is:retweet"

        seen_ids: set[str] = set()

        while self._running:
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(
                        "https://api.twitter.com/2/tweets/search/recent",
                        headers=headers,
                        params={
                            "query": query,
                            "max_results": 10,
                            "tweet.fields": "created_at,author_id,text,attachments",
                            "expansions": "attachments.media_keys,author_id",
                            "media.fields": "url,preview_image_url,type",
                        },
                    )

                    if resp.status_code == 200:
                        data = resp.json()
                        tweets = data.get("data", [])
                        media_map = {}
                        users_map = {}

                        for inc in data.get("includes", {}).get("media", []):
                            media_map[inc["media_key"]] = inc
                        for inc in data.get("includes", {}).get("users", []):
                            users_map[inc["id"]] = inc

                        for tweet in tweets:
                            tid = tweet["id"]
                            if tid in seen_ids:
                                continue
                            seen_ids.add(tid)

                            # Pega URL de mídia se tiver vídeo
                            media_url = ""
                            if "attachments" in tweet:
                                for mk in tweet["attachments"].get("media_keys", []):
                                    m = media_map.get(mk, {})
                                    if m.get("type") == "video":
                                        media_url = m.get("url", "")

                            author = users_map.get(tweet.get("author_id", ""), {})

                            content = RawContent(
                                source_type="twitter",
                                source_id=tid,
                                source_url=f"https://twitter.com/i/status/{tid}",
                                text=tweet.get("text", ""),
                                media_url=media_url,
                                author=author.get("username", ""),
                                topic_hints=self._extract_topics(tweet.get("text", "")),
                            )

                            for cb in self._callbacks:
                                await cb(content)

                            log.info("twitter.new_tweet", id=tid, author=content.author)
                    elif resp.status_code == 429:
                        log.warning("twitter.rate_limited", retry_after=30)
                        await asyncio.sleep(30)
                    else:
                        log.error("twitter.api_error", status=resp.status_code)

            except Exception as e:
                log.error("twitter.error", error=str(e))

            await asyncio.sleep(30)  # Poll a cada 30s

        # Limita o set de IDs vistos
        if len(seen_ids) > 5000:
            seen_ids = set(list(seen_ids)[-2500:])

    def _extract_topics(self, text: str) -> list[str]:
        text_lower = text.lower()
        return [t for t in settings.monitor_topics if t.lower() in text_lower]
