"""Pipeline principal — orquestra fontes + grafo LangGraph.

Fontes (RSS, Twitter, YouTube) coletam conteúdo → fila → workers processam via LangGraph.

CONCEITO LANGGRAPH:
O pipeline.py agora é só o "motorista" — quem faz o trabalho pesado é o grafo
em agents/graph.py. O pipeline cuida de:
1. Iniciar/parar fontes
2. Gerenciar a fila de conteúdo
3. Chamar o grafo pra cada item
4. Monitorar trending topics
"""

import asyncio
import time

import structlog

from agents.graph import process_content
from config.settings import settings
from db.database import init_db
from detection.trending import get_all_trends
from sources.base import RawContent
from sources.rss import RSSSource
from sources.twitter import TwitterSource
from sources.youtube import YouTubeSource

log = structlog.get_logger()


class Pipeline:
    """Orquestrador — conecta fontes ao grafo LangGraph."""

    def __init__(self):
        self.sources: list = []
        self._running = False
        self._queue: asyncio.Queue[RawContent] = asyncio.Queue()
        self._workers: list[asyncio.Task] = []
        self._trends_task: asyncio.Task | None = None
        self._stats = {"processed": 0, "relevant": 0, "errors": 0, "skipped": 0}

    async def start(self):
        """Inicia todo o pipeline."""
        start_time = time.monotonic()
        log.info("pipeline.starting")

        await init_db()
        log.info("pipeline.db_ready")

        settings.clips_output_dir.mkdir(parents=True, exist_ok=True)
        settings.temp_dir.mkdir(parents=True, exist_ok=True)

        # Registra fontes
        self.sources = [
            TwitterSource(),
            YouTubeSource(),
            RSSSource(),
        ]

        for source in self.sources:
            source.on_content(self._on_new_content)
            await source.start()

        log.info("pipeline.sources_started", count=len(self.sources))

        # Workers que processam a fila via LangGraph
        self._running = True
        for i in range(3):
            task = asyncio.create_task(self._worker(i))
            self._workers.append(task)

        # Trending monitor
        self._trends_task = asyncio.create_task(self._trending_loop())

        elapsed = time.monotonic() - start_time
        log.info("pipeline.started", elapsed_ms=round(elapsed * 1000))

    async def stop(self):
        """Para tudo gracefully."""
        log.info("pipeline.stopping")
        self._running = False

        for source in self.sources:
            await source.stop()

        if self._trends_task:
            self._trends_task.cancel()

        for worker in self._workers:
            worker.cancel()

        log.info("pipeline.stopped", stats=self._stats)

    async def _on_new_content(self, content: RawContent):
        """Callback de nova conteúdo detectado."""
        log.info(
            "pipeline.new_content",
            source=content.source_type,
            id=content.source_id,
            topics=content.topic_hints,
        )
        await self._queue.put(content)

    async def _worker(self, worker_id: int):
        """Worker que processa conteúdo via grafo LangGraph."""
        log.info("pipeline.worker.started", worker=worker_id)

        while True:
            # Se pausado, espera sem processar (mas mantém loop vivo pra poder resumir)
            if not self._running:
                await asyncio.sleep(2)
                continue

            try:
                content = await asyncio.wait_for(self._queue.get(), timeout=5)
            except asyncio.TimeoutError:
                continue

            try:
                start = time.monotonic()
                self._stats["processed"] += 1

                # CONCEITO LANGGRAPH: process_content() roda todo o grafo
                # O grafo decide internamente se o conteúdo é relevante,
                # qual estratégia usar, gera captions, growth plan, etc.
                result = await process_content(
                    source_type=content.source_type,
                    source_id=content.source_id,
                    source_url=content.source_url,
                    source_text=content.text,
                    source_media_url=content.media_url,
                    source_author=content.author,
                    source_topic_hints=content.topic_hints,
                )

                elapsed = time.monotonic() - start

                if result.get("db_clip_id"):
                    self._stats["relevant"] += 1
                    log.info(
                        "pipeline.worker.processed",
                        worker=worker_id,
                        uid=result.get("uid"),
                        clip_id=result.get("db_clip_id"),
                        topic=result.get("topic"),
                        category=result.get("category"),
                        channels=result.get("target_channels"),
                        elapsed_s=round(elapsed, 1),
                    )
                else:
                    self._stats["skipped"] += 1
                    log.info(
                        "pipeline.worker.skipped",
                        worker=worker_id,
                        reason=result.get("skip_reason", "not_relevant"),
                        elapsed_s=round(elapsed, 1),
                    )

            except Exception as e:
                self._stats["errors"] += 1
                log.error(
                    "pipeline.worker.error",
                    worker=worker_id,
                    source=content.source_type,
                    id=content.source_id,
                    error=str(e),
                )

    async def _trending_loop(self):
        """Monitora trending topics a cada 10min."""
        while self._running:
            try:
                trends = await get_all_trends()
                hot = [t for t in trends if t.should_monitor]
                log.info(
                    "pipeline.trending.update",
                    total=len(trends),
                    hot=len(hot),
                    top3=[t.name for t in hot[:3]],
                )
            except Exception as e:
                log.error("pipeline.trending.error", error=str(e))

            await asyncio.sleep(600)

    @property
    def stats(self) -> dict:
        return {**self._stats, "queue_size": self._queue.qsize()}
