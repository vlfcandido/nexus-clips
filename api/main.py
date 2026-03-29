"""FastAPI — API + SSE do Nexus Clips."""

import asyncio
import json
import datetime as dt

import structlog
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import desc, func, select, update

from config.logging import setup_logging
from config.settings import settings
from db.database import async_session, init_db
from db.models import Clip, MonitoredSource
from detection.trending import get_all_trends
from pipeline import Pipeline
from strategy.scheduler import get_analytics_summary

setup_logging()
log = structlog.get_logger()

app = FastAPI(title="Nexus Clips", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pipeline = Pipeline()

# Serve arquivos de mídia (vídeos, thumbnails, áudio)
settings.clips_output_dir.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(settings.clips_output_dir)), name="media")


# ==================== LIFECYCLE ====================

@app.on_event("startup")
async def startup():
    await init_db()
    asyncio.create_task(pipeline.start())
    log.info("api.started")


@app.on_event("shutdown")
async def shutdown():
    await pipeline.stop()
    log.info("api.stopped")


# ==================== SSE ====================

@app.get("/api/sse")
async def sse_stream(request: Request):
    """Server-Sent Events — updates em tempo real."""
    async def event_generator():
        while True:
            if await request.is_disconnected():
                break
            # Pega últimos clips e analytics
            analytics = await get_analytics_summary()
            yield f"data: {json.dumps({'type': 'analytics', 'data': analytics})}\n\n"
            await asyncio.sleep(10)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ==================== CLIPS ====================

class ClipResponse(BaseModel):
    id: int
    created_at: str
    source_type: str
    source_url: str
    topic: str
    category: str
    moment_text: str
    confidence: float
    clip_path: str
    thumbnail_path: str
    duration_seconds: int
    caption: str
    hashtags: str
    published: bool
    published_at: str | None
    views: int
    likes: int
    shares: int
    tiktok_url: str
    instagram_url: str
    youtube_url: str
    twitter_url: str


@app.get("/api/clips")
async def list_clips(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    topic: str | None = None,
    category: str | None = None,
    published: bool | None = None,
):
    """Lista clips com filtros e paginação."""
    log.info("api.clips.list", page=page, topic=topic, category=category)

    async with async_session() as session:
        query = select(Clip).order_by(desc(Clip.created_at))

        if topic:
            query = query.where(Clip.topic == topic)
        if category:
            query = query.where(Clip.category == category)
        if published is not None:
            query = query.where(Clip.published == published)

        query = query.offset((page - 1) * limit).limit(limit)
        result = await session.execute(query)
        clips = result.scalars().all()

        # Total
        count_query = select(func.count(Clip.id))
        if topic:
            count_query = count_query.where(Clip.topic == topic)
        if category:
            count_query = count_query.where(Clip.category == category)
        if published is not None:
            count_query = count_query.where(Clip.published == published)
        total = await session.scalar(count_query)

    return {
        "clips": [
            {
                "id": c.id,
                "created_at": c.created_at.isoformat() if c.created_at else "",
                "source_type": c.source_type,
                "source_url": c.source_url,
                "topic": c.topic,
                "category": c.category,
                "moment_text": c.moment_text[:200],
                "confidence": c.confidence,
                "clip_path": c.clip_path,
                "thumbnail_path": c.thumbnail_path,
                "duration_seconds": c.duration_seconds,
                "caption": c.caption,
                "hashtags": c.hashtags,
                "published": c.published,
                "published_at": c.published_at.isoformat() if c.published_at else None,
                "views": c.views,
                "likes": c.likes,
                "shares": c.shares,
                "tiktok_url": c.tiktok_url,
                "instagram_url": c.instagram_url,
                "youtube_url": c.youtube_url,
                "twitter_url": c.twitter_url,
            }
            for c in clips
        ],
        "total": total or 0,
        "page": page,
        "limit": limit,
    }


@app.post("/api/clips/{clip_id}/publish")
async def publish_clip(clip_id: int):
    """Publica um clip manualmente."""
    log.info("api.clips.publish", clip_id=clip_id)

    async with async_session() as session:
        clip = await session.get(Clip, clip_id)
        if not clip:
            raise HTTPException(404, "Clip não encontrado")
        if clip.published:
            raise HTTPException(400, "Clip já publicado")

        # TODO: chamar pipeline._publish()
        clip.published = True
        clip.published_at = dt.datetime.utcnow()
        await session.commit()

    return {"status": "published", "clip_id": clip_id}


@app.delete("/api/clips/{clip_id}")
async def delete_clip(clip_id: int):
    """Remove um clip."""
    log.info("api.clips.delete", clip_id=clip_id)

    async with async_session() as session:
        clip = await session.get(Clip, clip_id)
        if not clip:
            raise HTTPException(404, "Clip não encontrado")
        await session.delete(clip)
        await session.commit()

    return {"status": "deleted", "clip_id": clip_id}


# ==================== FONTES (SOURCES) ====================

class SourceCreate(BaseModel):
    source_type: str  # twitter, youtube, rss
    identifier: str  # @handle, channel_id, feed_url
    topic: str  # futebol, política


@app.get("/api/sources")
async def list_sources():
    """Lista fontes monitoradas."""
    log.info("api.sources.list")

    async with async_session() as session:
        result = await session.execute(
            select(MonitoredSource).order_by(MonitoredSource.id)
        )
        sources = result.scalars().all()

    return {
        "sources": [
            {
                "id": s.id,
                "source_type": s.source_type,
                "identifier": s.identifier,
                "topic": s.topic,
                "active": s.active,
                "last_checked": s.last_checked.isoformat() if s.last_checked else None,
            }
            for s in sources
        ]
    }


@app.post("/api/sources")
async def add_source(data: SourceCreate):
    """Adiciona nova fonte pra monitorar."""
    log.info("api.sources.add", type=data.source_type, identifier=data.identifier)

    async with async_session() as session:
        source = MonitoredSource(
            source_type=data.source_type,
            identifier=data.identifier,
            topic=data.topic,
        )
        session.add(source)
        await session.commit()

    return {"status": "created", "id": source.id}


@app.delete("/api/sources/{source_id}")
async def remove_source(source_id: int):
    """Remove uma fonte."""
    log.info("api.sources.remove", id=source_id)

    async with async_session() as session:
        source = await session.get(MonitoredSource, source_id)
        if not source:
            raise HTTPException(404, "Fonte não encontrada")
        await session.delete(source)
        await session.commit()

    return {"status": "deleted"}


@app.patch("/api/sources/{source_id}/toggle")
async def toggle_source(source_id: int):
    """Ativa/desativa uma fonte."""
    async with async_session() as session:
        source = await session.get(MonitoredSource, source_id)
        if not source:
            raise HTTPException(404)
        source.active = not source.active
        await session.commit()
        log.info("api.sources.toggle", id=source_id, active=source.active)

    return {"status": "toggled", "active": source.active}


# ==================== TRENDING ====================

@app.get("/api/trending")
async def get_trending():
    """Retorna trending topics atuais."""
    log.info("api.trending.get")
    trends = await get_all_trends()
    return {
        "trends": [
            {
                "name": t.name,
                "source": t.source,
                "volume": t.volume,
                "virality": t.estimated_virality,
                "category": t.category,
                "should_monitor": t.should_monitor,
            }
            for t in trends[:30]
        ]
    }


# ==================== ANALYTICS ====================

@app.get("/api/analytics")
async def get_analytics():
    """Dashboard analytics."""
    log.info("api.analytics.get")
    return await get_analytics_summary()


# ==================== SETTINGS ====================

@app.get("/api/settings")
async def get_settings():
    """Retorna settings editáveis."""
    return {
        "auto_publish": settings.auto_publish,
        "publish_platforms": settings.publish_platforms,
        "monitor_topics": settings.monitor_topics,
        "moment_confidence_threshold": settings.moment_confidence_threshold,
        "whisper_model": settings.whisper_model,
        "default_clip_duration": settings.default_clip_duration,
    }


class SettingsUpdate(BaseModel):
    auto_publish: bool | None = None
    monitor_topics: list[str] | None = None
    moment_confidence_threshold: float | None = None


@app.patch("/api/settings")
async def update_settings(data: SettingsUpdate):
    """Atualiza settings em runtime."""
    log.info("api.settings.update", data=data.model_dump(exclude_none=True))

    if data.auto_publish is not None:
        settings.auto_publish = data.auto_publish
    if data.monitor_topics is not None:
        settings.monitor_topics = data.monitor_topics
    if data.moment_confidence_threshold is not None:
        settings.moment_confidence_threshold = data.moment_confidence_threshold

    return {"status": "updated"}
