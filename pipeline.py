"""Pipeline principal — orquestra todo o fluxo de conteúdo.

Source → Detection → Strategy → Generator → Publisher → DB
"""

import asyncio
import datetime as dt
import time
import uuid

import structlog
from sqlalchemy import select

from config.settings import settings
from db.database import async_session, init_db
from db.models import Clip
from detection.classifier import classify_moment
from detection.trending import get_all_trends
from detection.whisper_transcriber import transcribe, extract_audio
from detection.google_vision import analyze_frame, extract_frames
from generator.caption import generate_multi_platform_captions
from generator.clipper import create_clip, generate_subtitles_file
from generator.thumbnail import generate_thumbnail
from generator.voice import generate_voice
from publisher.telegram import publish_to_telegram
from publisher.twitter import publish_to_twitter
from publisher.tiktok import publish_to_tiktok, publish_to_instagram_reels
from sources.base import RawContent
from sources.rss import RSSSource
from sources.twitter import TwitterSource
from sources.youtube import YouTubeSource, download_video
from strategy.content_strategist import decide_strategy

log = structlog.get_logger()


class Pipeline:
    """Orquestrador principal do Nexus Clips."""

    def __init__(self):
        self.sources: list = []
        self._running = False
        self._queue: asyncio.Queue[RawContent] = asyncio.Queue()
        self._workers: list[asyncio.Task] = []
        self._trends_task: asyncio.Task | None = None

    async def start(self):
        """Inicia todo o pipeline."""
        start_time = time.monotonic()
        log.info("pipeline.starting")

        # Inicializa DB
        await init_db()
        log.info("pipeline.db_ready")

        # Cria diretórios
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

        # Workers que processam a fila
        self._running = True
        for i in range(3):  # 3 workers paralelos
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

        log.info("pipeline.stopped")

    async def _on_new_content(self, content: RawContent):
        """Callback chamado quando qualquer fonte detecta conteúdo novo."""
        log.info(
            "pipeline.new_content",
            source=content.source_type,
            id=content.source_id,
            topics=content.topic_hints,
        )
        await self._queue.put(content)

    async def _worker(self, worker_id: int):
        """Worker que processa conteúdo da fila."""
        log.info("pipeline.worker.started", worker=worker_id)

        while self._running:
            try:
                content = await asyncio.wait_for(self._queue.get(), timeout=5)
            except asyncio.TimeoutError:
                continue

            try:
                await self._process_content(content, worker_id)
            except Exception as e:
                log.error(
                    "pipeline.worker.error",
                    worker=worker_id,
                    source=content.source_type,
                    id=content.source_id,
                    error=str(e),
                )

    async def _process_content(self, content: RawContent, worker_id: int):
        """Processa um conteúdo: detecta → estratégia → gera → publica."""
        uid = str(uuid.uuid4())[:8]
        start = time.monotonic()
        log.info("pipeline.process.start", uid=uid, source=content.source_type, worker=worker_id)

        # === 1. CLASSIFICAÇÃO ===
        classification = await classify_moment(
            text=content.text,
            source_type=content.source_type,
        )

        if not classification.is_relevant:
            log.info("pipeline.process.skipped", uid=uid, reason="not_relevant")
            return

        if classification.confidence < settings.moment_confidence_threshold:
            log.info(
                "pipeline.process.low_confidence",
                uid=uid,
                confidence=classification.confidence,
                threshold=settings.moment_confidence_threshold,
            )
            return

        log.info(
            "pipeline.process.classified",
            uid=uid,
            category=classification.category,
            virality=classification.virality_score,
        )

        # === 2. DOWNLOAD DE MÍDIA (se tiver) ===
        video_path = None
        if content.media_url:
            video_path = await download_video(content.media_url)
            log.info("pipeline.process.media_downloaded", uid=uid, has_video=video_path is not None)

        # === 3. TRANSCRIÇÃO (se tiver vídeo) ===
        transcription = None
        if video_path:
            audio_path = await extract_audio(video_path)
            if audio_path:
                transcription = await transcribe(audio_path)
                log.info("pipeline.process.transcribed", uid=uid, length=len(transcription.full_text) if transcription else 0)

        # === 4. ESTRATÉGIA ===
        strategy = await decide_strategy(
            classification=classification,
            source_type=content.source_type,
            has_video=video_path is not None,
        )
        log.info(
            "pipeline.process.strategy",
            uid=uid,
            format=strategy.format_type,
            platform=strategy.primary_platform,
            voice=strategy.use_voice,
            urgency=strategy.urgency,
        )

        # === 5. GERAÇÃO DE VOZ (se necessário) ===
        voice_path = None
        if strategy.use_voice and transcription:
            voice_text = classification.summary or transcription.full_text[:500]
            voice_path = await generate_voice(
                text=voice_text,
                output_name=uid,
                voice={"narrador": "pt-BR-AntonioNeural", "informal": "pt-BR-MacerioNeural",
                       "urgente": "pt-BR-HumbertoNeural", "humoristico": "pt-BR-ThalitaNeural"
                       }.get(strategy.voice_style, "pt-BR-AntonioNeural"),
            )
            log.info("pipeline.process.voice_generated", uid=uid, has_voice=voice_path is not None)

        # === 6. LEGENDAS ===
        subtitle_path = None
        if transcription and transcription.segments:
            segments = [{"start": s.start, "end": s.end, "text": s.text} for s in transcription.segments]
            subtitle_path = await generate_subtitles_file(
                segments, str(settings.temp_dir / f"{uid}.ass")
            )

        # === 7. CORTE DO VÍDEO ===
        clip_result = None
        if video_path:
            clip_result = await create_clip(
                video_path=video_path,
                start_seconds=0,
                duration=strategy.duration_target,
                output_name=uid,
                subtitle_file=subtitle_path,
                voice_over_path=voice_path,
                anti_strike=strategy.needs_anti_strike,
            )
            log.info("pipeline.process.clip_created", uid=uid, has_clip=clip_result is not None)

        # === 8. THUMBNAIL ===
        thumb_path = None
        if video_path:
            thumb_path = await generate_thumbnail(
                video_path=video_path,
                title=classification.suggested_title,
                output_name=uid,
                category=classification.topic,
            )

        # === 9. CAPTIONS ===
        captions = await generate_multi_platform_captions(
            summary=classification.summary,
            category=classification.category,
            topic=classification.topic,
        )
        log.info("pipeline.process.captions_generated", uid=uid, platforms=list(captions.keys()))

        # === 10. SALVA NO DB ===
        clip_path = clip_result.output_path if clip_result else ""
        primary_caption = captions.get(strategy.primary_platform, {})

        async with async_session() as session:
            clip = Clip(
                source_type=content.source_type,
                source_url=content.source_url,
                source_id=content.source_id,
                topic=classification.topic,
                category=classification.category,
                moment_text=transcription.full_text if transcription else content.text,
                confidence=classification.confidence,
                clip_path=clip_path,
                thumbnail_path=thumb_path or "",
                duration_seconds=strategy.duration_target,
                caption=primary_caption.get("caption", classification.summary),
                hashtags=" ".join(primary_caption.get("hashtags", [])),
            )
            session.add(clip)
            await session.commit()
            clip_id = clip.id

        log.info("pipeline.process.saved", uid=uid, clip_id=clip_id)

        # === 11. PUBLICAÇÃO ===
        if settings.auto_publish or strategy.urgency == "now":
            await self._publish(clip_id, clip_path, thumb_path, captions, strategy)

        elapsed = time.monotonic() - start
        log.info(
            "pipeline.process.done",
            uid=uid,
            clip_id=clip_id,
            elapsed_s=round(elapsed, 1),
            published=settings.auto_publish or strategy.urgency == "now",
        )

    async def _publish(self, clip_id: int, clip_path: str, thumb_path: str | None,
                       captions: dict, strategy):
        """Publica nas plataformas configuradas."""
        published_urls = {}

        platforms = [strategy.primary_platform] + strategy.secondary_platforms

        for platform in platforms:
            cap = captions.get(platform, {})
            caption_text = f"{cap.get('title', '')}\n\n{cap.get('caption', '')}"

            try:
                url = None
                if platform == "telegram":
                    url = await publish_to_telegram(clip_path or None, caption_text, thumb_path)
                elif platform == "twitter":
                    url = await publish_to_twitter(caption_text[:280], clip_path or None)
                elif platform == "tiktok":
                    if clip_path:
                        url = await publish_to_tiktok(clip_path, caption_text, cap.get("hashtags"))
                elif platform == "instagram":
                    if clip_path:
                        url = await publish_to_instagram_reels(clip_path, caption_text)

                if url:
                    published_urls[platform] = url
                    log.info("pipeline.publish.success", clip_id=clip_id, platform=platform)

                # Delay entre plataformas
                delay = strategy.post_delay_minutes.get(platform, 0)
                if delay > 0:
                    log.info("pipeline.publish.delay", platform=platform, minutes=delay)
                    await asyncio.sleep(delay * 60)

            except Exception as e:
                log.error("pipeline.publish.error", clip_id=clip_id, platform=platform, error=str(e))

        # Atualiza DB
        if published_urls:
            async with async_session() as session:
                clip = await session.get(Clip, clip_id)
                if clip:
                    clip.published = True
                    clip.published_at = dt.datetime.utcnow()
                    clip.tiktok_url = published_urls.get("tiktok", "")
                    clip.instagram_url = published_urls.get("instagram", "")
                    clip.youtube_url = published_urls.get("youtube", "")
                    clip.twitter_url = published_urls.get("twitter", "")
                    await session.commit()

        log.info("pipeline.publish.done", clip_id=clip_id, platforms=list(published_urls.keys()))

    async def _trending_loop(self):
        """Monitora trending topics a cada 10min e loga oportunidades."""
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

                # Emite evento pra API/SSE
                for trend in hot[:5]:
                    log.info(
                        "pipeline.trending.hot",
                        topic=trend.name,
                        source=trend.source,
                        virality=trend.estimated_virality,
                        category=trend.category,
                    )

            except Exception as e:
                log.error("pipeline.trending.error", error=str(e))

            await asyncio.sleep(600)  # 10 min
