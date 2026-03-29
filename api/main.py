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
from db.models import Clip, ClipComment, MonitoredSource, PublishAccount, PublishLog, PromptTemplate, VideoTemplate
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
    asyncio.create_task(_start_pipeline_paused())
    log.info("api.started", pipeline="paused")


async def _start_pipeline_paused():
    """Inicia pipeline mas pausa imediatamente (user controla pelo dashboard)."""
    await pipeline.start()
    pipeline._running = False
    log.info("pipeline.auto_paused")


@app.on_event("shutdown")
async def shutdown():
    await pipeline.stop()
    log.info("api.stopped")


# ==================== SSE ====================

# Event bus — notifica SSE quando algo muda
_sse_events: asyncio.Queue = asyncio.Queue()


def notify_sse(event_type: str, data: dict = None):
    """Envia evento pra todos os clientes SSE conectados."""
    try:
        _sse_events.put_nowait({"type": event_type, "data": data or {}})
    except Exception:
        pass


@app.get("/api/sse")
async def sse_stream(request: Request):
    """Server-Sent Events — updates em tempo real."""
    async def event_generator():
        last_analytics = 0
        while True:
            if await request.is_disconnected():
                break

            # Envia analytics a cada 10s
            now = asyncio.get_event_loop().time()
            if now - last_analytics > 10:
                try:
                    analytics = await get_analytics_summary()
                    yield f"data: {json.dumps({'type': 'analytics', 'data': analytics})}\n\n"
                except Exception:
                    pass
                last_analytics = now

            # Checa event bus (non-blocking)
            try:
                event = _sse_events.get_nowait()
                yield f"data: {json.dumps(event)}\n\n"
            except asyncio.QueueEmpty:
                pass

            await asyncio.sleep(1)

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


class ManualClipCreate(BaseModel):
    text: str
    topic: str = "guerra"
    voice: str = "pt-BR-AntonioNeural"
    source: str = "Manual"
    mood: str = "urgente"
    visual_style: str = "news"
    subtitle_style: str = "word_by_word"
    duration: int = 30
    platform: str = "tiktok"
    extra_instructions: str = ""


@app.post("/api/clips/generate")
async def generate_clip_manual(data: ManualClipCreate):
    """Gera um clip manualmente com todas as opções do Studio."""
    log.info("api.clips.generate_manual", topic=data.topic, mood=data.mood, style=data.visual_style)

    from agents.graph import process_content

    try:
        result = await process_content(
            source_type="manual",
            source_id=f"manual-{int(dt.datetime.utcnow().timestamp())}",
            source_url="",
            source_text=data.text,
            source_author=data.source,
            # Campos do Studio — passados pro pipeline
            studio_config={
                "voice": data.voice,
                "mood": data.mood,
                "visual_style": data.visual_style,
                "subtitle_style": data.subtitle_style,
                "duration": data.duration,
                "platform": data.platform,
                "extra_instructions": data.extra_instructions,
            },
        )

        clip_id = result.get("db_clip_id")
        if clip_id:
            notify_sse("new_clip", {"clip_id": clip_id})
            return {
                "status": "ok",
                "clip_id": clip_id,
                "clip_path": result.get("clip_path", ""),
                "topic": result.get("topic", ""),
                "category": result.get("category", ""),
                "summary": result.get("summary", ""),
            }
        else:
            return {
                "status": "skipped",
                "reason": result.get("skip_reason", "Conteúdo não foi considerado relevante pela IA"),
            }
    except Exception as e:
        log.error("api.clips.generate_error", error=str(e))
        raise HTTPException(500, f"Erro ao gerar: {str(e)}")


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


@app.post("/api/clips/{clip_id}/publish-to/{account_id}")
async def publish_clip_to_account(clip_id: int, account_id: int):
    """Publica clip em conta específica (Telegram, etc)."""
    log.info("api.clips.publish_to", clip_id=clip_id, account_id=account_id)

    async with async_session() as session:
        clip = await session.get(Clip, clip_id)
        if not clip:
            raise HTTPException(404, "Clip nao encontrado")
        account = await session.get(PublishAccount, account_id)
        if not account:
            raise HTTPException(404, "Conta nao encontrada")

    result_url = ""
    error_msg = ""

    try:
        if account.platform == "telegram" and account.access_token:
            import httpx
            # Monta caption
            caption = f"<b>{clip.caption}</b>\n\n{clip.hashtags}" if clip.caption else clip.moment_text

            # Envia vídeo se tiver, senão texto
            video_full_path = ""
            if clip.clip_path:
                from pathlib import Path
                video_full_path = str(settings.clips_output_dir / clip.clip_path.lstrip("/media/"))

            async with httpx.AsyncClient(timeout=60) as client:
                if video_full_path and Path(video_full_path).exists():
                    with open(video_full_path, "rb") as vf:
                        resp = await client.post(
                            f"https://api.telegram.org/bot{account.access_token}/sendVideo",
                            data={"chat_id": account.username, "caption": caption[:1024], "parse_mode": "HTML"},
                            files={"video": ("clip.mp4", vf, "video/mp4")},
                        )
                else:
                    resp = await client.post(
                        f"https://api.telegram.org/bot{account.access_token}/sendMessage",
                        json={"chat_id": account.username, "text": caption[:4096], "parse_mode": "HTML"},
                    )

                if resp.status_code == 200 and resp.json().get("ok"):
                    msg = resp.json()["result"]
                    result_url = f"telegram://msg/{msg.get('message_id', '')}"
                    log.info("publish.telegram.ok", clip_id=clip_id, msg_id=msg.get("message_id"))
                    notify_sse("clip_published", {"clip_id": clip_id, "platform": "telegram"})
                else:
                    error_msg = resp.json().get("description", f"HTTP {resp.status_code}")
                    log.error("publish.telegram.fail", error=error_msg)

        else:
            error_msg = f"Publicacao automatica em {account.platform} ainda nao implementada. Exporte o video e poste manualmente."

    except Exception as e:
        error_msg = str(e)
        log.error("publish.error", error=error_msg)

    # Salva log
    async with async_session() as session:
        pub_log = PublishLog(
            clip_id=clip_id,
            account_id=account_id,
            platform=account.platform,
            post_url=result_url,
            status="published" if result_url else "failed",
            published_at=dt.datetime.utcnow() if result_url else None,
            error=error_msg,
        )
        session.add(pub_log)

        if result_url:
            clip_obj = await session.get(Clip, clip_id)
            if clip_obj:
                clip_obj.published = True
                clip_obj.published_at = dt.datetime.utcnow()

        await session.commit()

    if error_msg:
        return {"status": "error", "error": error_msg}
    return {"status": "published", "url": result_url, "platform": account.platform}


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
        "min_virality_for_video": settings.min_virality_for_video,
        "max_videos_per_hour": settings.max_videos_per_hour,
        "whisper_model": settings.whisper_model,
        "default_clip_duration": settings.default_clip_duration,
    }


class SettingsUpdate(BaseModel):
    auto_publish: bool | None = None
    monitor_topics: list[str] | None = None
    moment_confidence_threshold: float | None = None
    min_virality_for_video: int | None = None
    max_videos_per_hour: int | None = None


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
    if data.min_virality_for_video is not None:
        settings.min_virality_for_video = data.min_virality_for_video
        # Atualiza também no grafo
        from agents.graph import MIN_VIRALITY_FOR_VIDEO
        import agents.graph
        agents.graph.MIN_VIRALITY_FOR_VIDEO = data.min_virality_for_video
    if data.max_videos_per_hour is not None:
        settings.max_videos_per_hour = data.max_videos_per_hour

    return {"status": "updated"}


# ==================== PIPELINE CONTROL ====================

@app.get("/api/pipeline/status")
async def pipeline_status():
    """Status do pipeline."""
    return {
        "running": pipeline._running,
        "stats": pipeline.stats,
    }


@app.post("/api/pipeline/pause")
async def pipeline_pause():
    """Pausa o pipeline (para de processar fila)."""
    log.info("api.pipeline.pause")
    pipeline._running = False
    return {"status": "paused"}


@app.post("/api/pipeline/resume")
async def pipeline_resume():
    """Resume o pipeline."""
    log.info("api.pipeline.resume")
    pipeline._running = True
    return {"status": "resumed"}


# ==================== ACCOUNTS (CONTAS) ====================

class AccountCreate(BaseModel):
    name: str
    platform: str  # tiktok, instagram, youtube, twitter, telegram
    username: str = ""
    topics: list[str] = []
    auto_publish: bool = False
    max_posts_per_day: int = 5
    api_key: str = ""
    api_secret: str = ""
    access_token: str = ""


class AccountUpdate(BaseModel):
    name: str | None = None
    username: str | None = None
    topics: list[str] | None = None
    active: bool | None = None
    auto_publish: bool | None = None
    max_posts_per_day: int | None = None
    api_key: str | None = None
    api_secret: str | None = None
    access_token: str | None = None


@app.get("/api/accounts")
async def list_accounts():
    """Lista contas de publicação."""
    from publisher.platform_specs import get_specs
    async with async_session() as session:
        result = await session.execute(select(PublishAccount).order_by(PublishAccount.id))
        accounts = result.scalars().all()

    return {
        "accounts": [
            {
                "id": a.id,
                "name": a.name,
                "platform": a.platform,
                "username": a.username,
                "topics": json.loads(a.topics) if a.topics else [],
                "active": a.active,
                "auto_publish": a.auto_publish,
                "max_posts_per_day": a.max_posts_per_day,
                "total_posts": a.total_posts,
                "total_views": a.total_views,
                "total_followers": a.total_followers,
                "has_credentials": bool(a.access_token or a.api_key),
                "platform_specs": get_specs(a.platform),
                "created_at": a.created_at.isoformat() if a.created_at else "",
            }
            for a in accounts
        ]
    }


@app.post("/api/accounts")
async def create_account(data: AccountCreate):
    """Cria nova conta de publicação."""
    log.info("api.accounts.create", name=data.name, platform=data.platform)

    async with async_session() as session:
        account = PublishAccount(
            name=data.name,
            platform=data.platform,
            username=data.username,
            topics=json.dumps(data.topics),
            auto_publish=data.auto_publish,
            max_posts_per_day=data.max_posts_per_day,
            api_key=data.api_key,
            api_secret=data.api_secret,
            access_token=data.access_token,
        )
        session.add(account)
        await session.commit()

    return {"status": "created", "id": account.id}


@app.patch("/api/accounts/{account_id}")
async def update_account(account_id: int, data: AccountUpdate):
    """Atualiza conta."""
    async with async_session() as session:
        account = await session.get(PublishAccount, account_id)
        if not account:
            raise HTTPException(404, "Conta nao encontrada")

        if data.name is not None: account.name = data.name
        if data.username is not None: account.username = data.username
        if data.topics is not None: account.topics = json.dumps(data.topics)
        if data.active is not None: account.active = data.active
        if data.auto_publish is not None: account.auto_publish = data.auto_publish
        if data.max_posts_per_day is not None: account.max_posts_per_day = data.max_posts_per_day
        if data.api_key is not None: account.api_key = data.api_key
        if data.api_secret is not None: account.api_secret = data.api_secret
        if data.access_token is not None: account.access_token = data.access_token

        await session.commit()
        log.info("api.accounts.update", id=account_id)

    return {"status": "updated"}


@app.delete("/api/accounts/{account_id}")
async def delete_account(account_id: int):
    """Remove conta."""
    async with async_session() as session:
        account = await session.get(PublishAccount, account_id)
        if not account:
            raise HTTPException(404)
        await session.delete(account)
        await session.commit()
        log.info("api.accounts.delete", id=account_id)

    return {"status": "deleted"}


@app.get("/api/accounts/{account_id}/log")
async def account_publish_log(account_id: int, limit: int = 20):
    """Histórico de publicações de uma conta."""
    async with async_session() as session:
        result = await session.execute(
            select(PublishLog)
            .where(PublishLog.account_id == account_id)
            .order_by(desc(PublishLog.created_at))
            .limit(limit)
        )
        logs = result.scalars().all()

    return {
        "logs": [
            {
                "id": l.id,
                "clip_id": l.clip_id,
                "platform": l.platform,
                "status": l.status,
                "post_url": l.post_url,
                "published_at": l.published_at.isoformat() if l.published_at else None,
                "views": l.views,
                "likes": l.likes,
                "error": l.error,
            }
            for l in logs
        ]
    }


# ==================== ACCOUNT SYNC ====================

@app.post("/api/accounts/{account_id}/sync")
async def sync_account(account_id: int):
    """Sincroniza dados reais do canal (followers, views, videos)."""
    async with async_session() as session:
        account = await session.get(PublishAccount, account_id)
        if not account:
            raise HTTPException(404)

    if not account.access_token and not account.api_key:
        return {"status": "error", "error": "Sem credenciais configuradas"}

    import httpx
    sync_data = {"followers": 0, "views": 0, "posts": 0, "channel_name": "", "channel_url": ""}

    try:
        if account.platform == "youtube":
            # YouTube Data API v3 — busca stats do canal
            api_key = account.api_key or account.access_token
            async with httpx.AsyncClient(timeout=15) as client:
                # Primeiro pega o channel ID do usuário autenticado
                resp = await client.get(
                    "https://www.googleapis.com/youtube/v3/channels",
                    params={"part": "statistics,snippet", "mine": "true", "key": api_key},
                    headers={"Authorization": f"Bearer {account.access_token}"} if account.access_token else {},
                )

                if resp.status_code != 200:
                    # Tenta buscar por username
                    resp = await client.get(
                        "https://www.googleapis.com/youtube/v3/channels",
                        params={"part": "statistics,snippet", "forHandle": account.username.lstrip("@"), "key": api_key},
                    )

                if resp.status_code == 200:
                    items = resp.json().get("items", [])
                    if items:
                        ch = items[0]
                        stats = ch.get("statistics", {})
                        snippet = ch.get("snippet", {})
                        sync_data = {
                            "followers": int(stats.get("subscriberCount", 0)),
                            "views": int(stats.get("viewCount", 0)),
                            "posts": int(stats.get("videoCount", 0)),
                            "channel_name": snippet.get("title", ""),
                            "channel_url": f"https://youtube.com/channel/{ch['id']}",
                            "thumbnail": snippet.get("thumbnails", {}).get("default", {}).get("url", ""),
                        }
                else:
                    return {"status": "error", "error": f"YouTube API: {resp.status_code} — {resp.text[:200]}"}

        elif account.platform == "telegram":
            async with httpx.AsyncClient(timeout=10) as client:
                # Get bot info
                resp = await client.get(f"https://api.telegram.org/bot{account.access_token}/getMe")
                if resp.status_code == 200 and resp.json().get("ok"):
                    bot = resp.json()["result"]
                    sync_data["channel_name"] = bot.get("first_name", "")

                # Get chat member count (se username é um channel/group)
                if account.username:
                    chat_id = account.username
                    resp2 = await client.get(
                        f"https://api.telegram.org/bot{account.access_token}/getChatMemberCount",
                        params={"chat_id": chat_id},
                    )
                    if resp2.status_code == 200 and resp2.json().get("ok"):
                        sync_data["followers"] = resp2.json()["result"]

        elif account.platform == "twitter":
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://api.twitter.com/2/users/me",
                    headers={"Authorization": f"Bearer {account.access_token}"},
                    params={"user.fields": "public_metrics,profile_image_url"},
                )
                if resp.status_code == 200:
                    user = resp.json().get("data", {})
                    metrics = user.get("public_metrics", {})
                    sync_data = {
                        "followers": metrics.get("followers_count", 0),
                        "posts": metrics.get("tweet_count", 0),
                        "channel_name": user.get("name", ""),
                        "channel_url": f"https://twitter.com/{user.get('username', '')}",
                    }

        elif account.platform in ("tiktok", "instagram"):
            # Essas precisam de OAuth flow mais complexo
            return {"status": "manual", "message": f"Sync automatico de {account.platform} requer OAuth. Atualize os dados manualmente."}

    except Exception as e:
        log.error("sync.error", platform=account.platform, error=str(e))
        return {"status": "error", "error": str(e)}

    # Salva no DB
    async with async_session() as session:
        acc = await session.get(PublishAccount, account_id)
        if acc:
            acc.total_followers = sync_data.get("followers", 0)
            acc.total_views = sync_data.get("views", 0)
            acc.total_posts = sync_data.get("posts", 0)
            if sync_data.get("channel_name"):
                acc.name = sync_data["channel_name"]
            await session.commit()

    log.info("sync.ok", platform=account.platform, followers=sync_data.get("followers"), views=sync_data.get("views"))
    return {"status": "synced", "data": sync_data}


# ==================== PLATFORM SPECS ====================

@app.get("/api/platforms")
async def list_platforms():
    """Retorna specs de todas as plataformas."""
    from publisher.platform_specs import PLATFORM_SPECS
    return {"platforms": PLATFORM_SPECS}


@app.get("/api/clips/{clip_id}/compatibility")
async def clip_compatibility(clip_id: int):
    """Verifica compatibilidade de um clip com cada plataforma."""
    from publisher.platform_specs import validate_clip_for_platform, get_all_platforms
    import os

    async with async_session() as session:
        clip = await session.get(Clip, clip_id)
        if not clip:
            raise HTTPException(404)

    file_size_mb = 0
    if clip.clip_path:
        full_path = str(settings.clips_output_dir / clip.clip_path.lstrip("/media/"))
        if os.path.exists(full_path):
            file_size_mb = os.path.getsize(full_path) / (1024 * 1024)

    results = {}
    for platform in get_all_platforms():
        results[platform] = validate_clip_for_platform(
            clip.duration_seconds, file_size_mb, platform
        )

    return {"clip_id": clip_id, "compatibility": results}


# ==================== PROMPTS ====================

@app.get("/api/prompts")
async def list_prompts():
    """Lista todos os prompts editáveis."""
    async with async_session() as session:
        result = await session.execute(select(PromptTemplate).order_by(PromptTemplate.key))
        prompts = result.scalars().all()

    return {
        "prompts": [
            {
                "id": p.id,
                "key": p.key,
                "name": p.name,
                "description": p.description,
                "system_prompt": p.system_prompt,
                "user_prompt_template": p.user_prompt_template,
                "temperature": p.temperature,
                "max_tokens": p.max_tokens,
                "active": p.active,
                "updated_at": p.updated_at.isoformat() if p.updated_at else "",
            }
            for p in prompts
        ]
    }


class PromptUpdate(BaseModel):
    system_prompt: str | None = None
    user_prompt_template: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    active: bool | None = None


@app.patch("/api/prompts/{prompt_id}")
async def update_prompt(prompt_id: int, data: PromptUpdate):
    """Atualiza um prompt."""
    async with async_session() as session:
        prompt = await session.get(PromptTemplate, prompt_id)
        if not prompt:
            raise HTTPException(404, "Prompt nao encontrado")

        if data.system_prompt is not None: prompt.system_prompt = data.system_prompt
        if data.user_prompt_template is not None: prompt.user_prompt_template = data.user_prompt_template
        if data.temperature is not None: prompt.temperature = data.temperature
        if data.max_tokens is not None: prompt.max_tokens = data.max_tokens
        if data.active is not None: prompt.active = data.active

        await session.commit()
        log.info("api.prompts.update", id=prompt_id, key=prompt.key)

    # Limpa cache pra pipeline usar prompt atualizado
    from config.prompts import clear_cache
    clear_cache()

    return {"status": "updated"}


@app.post("/api/prompts/{prompt_id}/test")
async def test_prompt(prompt_id: int):
    """Testa um prompt com conteúdo de exemplo."""
    async with async_session() as session:
        prompt = await session.get(PromptTemplate, prompt_id)
        if not prompt:
            raise HTTPException(404)

    from config.llm import llm_json

    test_vars = {
        "context": "Noticia: Selecao Brasileira convoca Endrick para Copa 2026.",
        "category": "futebol", "topic": "futebol", "virality_score": "7",
        "urgency": "medium", "summary": "Endrick convocado pra Copa 2026",
        "has_video": "false", "source_type": "rss", "title": "Endrick na Copa",
        "platform": "tiktok",
    }

    try:
        user_text = prompt.user_prompt_template.format(**test_vars)
    except KeyError:
        user_text = prompt.user_prompt_template

    try:
        result = await llm_json(
            system=prompt.system_prompt,
            user=user_text,
            temperature=prompt.temperature,
            max_tokens=prompt.max_tokens,
        )
        return {"status": "ok", "result": result}
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ==================== ACCOUNT VERIFICATION ====================

@app.post("/api/accounts/{account_id}/verify")
async def verify_account(account_id: int):
    """Verifica se uma conta está conectada e tem permissões corretas."""
    async with async_session() as session:
        account = await session.get(PublishAccount, account_id)
        if not account:
            raise HTTPException(404)

    checks = {
        "has_credentials": bool(account.access_token or account.api_key),
        "platform": account.platform,
        "permissions": [],
        "status": "not_connected",
        "message": "",
    }

    if not checks["has_credentials"]:
        checks["message"] = f"Sem credenciais. Adicione API key ou Access Token pra {account.platform}."
        checks["permissions"] = _get_platform_auth_guide(account.platform)
        return checks

    # Testa conexão com a plataforma
    import httpx
    try:
        if account.platform == "telegram":
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"https://api.telegram.org/bot{account.access_token}/getMe")
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("ok"):
                        bot = data["result"]
                        checks["status"] = "connected"
                        checks["message"] = f"Conectado como @{bot.get('username', '?')}"
                        checks["permissions"] = ["send_message", "send_video", "send_photo"]
                    else:
                        checks["status"] = "error"
                        checks["message"] = "Token invalido"
                else:
                    checks["status"] = "error"
                    checks["message"] = f"Erro HTTP {resp.status_code}"

        elif account.platform == "twitter":
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://api.twitter.com/2/users/me",
                    headers={"Authorization": f"Bearer {account.access_token}"},
                )
                if resp.status_code == 200:
                    checks["status"] = "connected"
                    checks["message"] = "Conectado ao Twitter/X"
                    checks["permissions"] = ["tweet", "upload_media"]
                else:
                    checks["status"] = "error"
                    checks["message"] = f"Erro: {resp.status_code}"

        elif account.platform == "youtube":
            api_key = account.api_key or account.access_token
            async with httpx.AsyncClient(timeout=10) as client:
                # Testa a API key com uma busca simples
                resp = await client.get(
                    "https://www.googleapis.com/youtube/v3/channels",
                    params={"part": "snippet", "forHandle": account.username.lstrip("@") if account.username else "Google", "key": api_key},
                )
                if resp.status_code == 200:
                    items = resp.json().get("items", [])
                    if items:
                        ch_name = items[0].get("snippet", {}).get("title", "")
                        checks["status"] = "connected"
                        checks["message"] = f"API Key valida! Canal encontrado: {ch_name}"
                        checks["permissions"] = ["Ler dados do canal", "Buscar videos", "Ver estatisticas"]
                    else:
                        checks["status"] = "connected"
                        checks["message"] = "API Key valida! Mas nenhum canal encontrado com esse username. Verifique o @username."
                        checks["permissions"] = ["API Key funciona", "Ajuste o username do canal"]
                elif resp.status_code == 400:
                    error_detail = resp.json().get("error", {}).get("message", "")
                    checks["status"] = "error"
                    if "API key not valid" in error_detail or "invalid" in error_detail.lower():
                        checks["message"] = "API Key invalida. Verifique se copiou corretamente."
                        checks["permissions"] = [
                            "Acesse console.cloud.google.com/apis/credentials",
                            "Verifique se a key esta ativa (nao deletada)",
                            "Verifique se YouTube Data API v3 esta ATIVADA no projeto",
                            "Se criou a key agora, espere 1-2 minutos pra ativar",
                        ]
                    elif "API_KEY_HTTP_REFERRER_BLOCKED" in error_detail:
                        checks["message"] = "API Key bloqueada por restricao de referrer."
                        checks["permissions"] = [
                            "Acesse console.cloud.google.com/apis/credentials",
                            "Clique na sua API Key → Restricoes",
                            "Em 'Restricoes de aplicativo' selecione 'Nenhum'",
                            "Salve e espere 1-2 minutos",
                        ]
                    else:
                        checks["message"] = f"Erro 400: {error_detail[:150]}"
                        checks["permissions"] = [
                            "Verifique se YouTube Data API v3 esta ativada",
                            f"Detalhe: {error_detail[:200]}",
                        ]
                elif resp.status_code == 403:
                    error_detail = resp.json().get("error", {}).get("message", "")
                    checks["status"] = "error"
                    checks["message"] = "API Key sem permissao. YouTube Data API v3 precisa estar ativada."
                    checks["permissions"] = [
                        "Acesse console.cloud.google.com/apis/library",
                        "Busque 'YouTube Data API v3'",
                        "Clique em ATIVAR",
                        "Espere 2-3 minutos e tente novamente",
                        f"Erro: {error_detail[:150]}",
                    ]
                else:
                    checks["status"] = "error"
                    checks["message"] = f"Erro HTTP {resp.status_code}"
                    checks["permissions"] = [resp.text[:200]]

        elif account.platform in ("tiktok", "instagram"):
            checks["status"] = "manual"
            checks["message"] = f"Upload manual pra {account.platform}. Gere o video e baixe pra postar."
            checks["permissions"] = ["Gerar video no Studio", "Baixar o arquivo MP4", f"Postar manualmente no {account.platform}"]

    except Exception as e:
        checks["status"] = "error"
        checks["message"] = f"Erro de conexao: {str(e)}"

    log.info("api.accounts.verify", id=account_id, platform=account.platform, status=checks["status"])
    return checks


@app.post("/api/accounts/{account_id}/diagnose")
async def diagnose_account_error(account_id: int):
    """IA analisa o erro de conexão e explica pro Pedro como resolver."""
    async with async_session() as session:
        account = await session.get(PublishAccount, account_id)
        if not account:
            raise HTTPException(404)

    # Primeiro faz o verify pra pegar o erro
    verify_result = await verify_account(account_id)

    if verify_result.get("status") == "connected":
        return {"diagnosis": "Tudo certo! A conta esta conectada e funcionando.", "steps": []}

    error = verify_result.get("message", "Erro desconhecido")
    platform = account.platform

    try:
        from config.llm import llm_json
        result = await llm_json(
            system="Voce e um assistente tecnico que ajuda usuarios leigos a configurar APIs de redes sociais. Responda em JSON, em portugues BR, linguagem simples.",
            user=f"""O usuario tentou conectar uma conta de {platform} no nosso sistema e deu erro.

Erro: {error}
Plataforma: {platform}
Tem API Key: {'sim' if account.api_key else 'nao'}
Tem Access Token: {'sim' if account.access_token else 'nao'}
Username: {account.username or 'nao informado'}

Explique de forma SIMPLES o que aconteceu e como resolver. O usuario e leigo.

JSON: {{
    "diagnosis": "explicacao simples do que deu errado (1-2 frases)",
    "steps": ["passo 1 pra resolver", "passo 2", "passo 3"],
    "tip": "dica extra se tiver"
}}""",
            temperature=0.3,
            max_tokens=300,
        )
        return result
    except Exception as e:
        return {
            "diagnosis": f"Erro na conexao: {error}",
            "steps": verify_result.get("permissions", []),
            "tip": "Se o problema persistir, verifique se a API esta ativada no painel da plataforma.",
        }


def _get_platform_auth_guide(platform: str) -> list[str]:
    """Retorna guia de autenticação por plataforma."""
    guides = {
        "tiktok": [
            "1. Crie app em developers.tiktok.com",
            "2. Solicite Content Posting API",
            "3. Copie o Client Key e Client Secret",
            "4. Cole na tela de Contas (API Key + API Secret)",
        ],
        "instagram": [
            "1. Crie app em developers.facebook.com",
            "2. Adicione Instagram Graph API",
            "3. Gere um Page Access Token",
            "4. Cole na tela de Contas (Access Token)",
        ],
        "youtube": [
            "1. Acesse console.cloud.google.com",
            "2. Ative YouTube Data API v3",
            "3. Crie credenciais OAuth 2.0",
            "4. Cole na tela de Contas (API Key + Access Token)",
        ],
        "twitter": [
            "1. Crie app em developer.twitter.com",
            "2. Gere Bearer Token",
            "3. Cole na tela de Contas (Access Token)",
        ],
        "telegram": [
            "1. Abra @BotFather no Telegram",
            "2. Crie bot com /newbot",
            "3. Copie o token do bot",
            "4. Cole na tela de Contas (Access Token)",
        ],
    }
    return guides.get(platform, ["Consulte documentacao da plataforma"])


# ==================== CLIP COMMENTS ====================

class CommentCreate(BaseModel):
    text: str
    type: str = "feedback"  # feedback, fix, note
    author: str = "Pedro"


@app.get("/api/clips/{clip_id}/comments")
async def list_comments(clip_id: int):
    async with async_session() as session:
        result = await session.execute(
            select(ClipComment).where(ClipComment.clip_id == clip_id).order_by(desc(ClipComment.created_at))
        )
        comments = result.scalars().all()
    return {"comments": [
        {"id": c.id, "text": c.text, "type": c.type, "author": c.author,
         "resolved": c.resolved, "created_at": c.created_at.isoformat() if c.created_at else ""}
        for c in comments
    ]}


@app.post("/api/clips/{clip_id}/comments")
async def add_comment(clip_id: int, data: CommentCreate):
    async with async_session() as session:
        c = ClipComment(clip_id=clip_id, text=data.text, type=data.type, author=data.author)
        session.add(c)
        await session.commit()
    return {"status": "created", "id": c.id}


# ==================== CLONE + AUTO-FIX ====================

class CloneRequest(BaseModel):
    adjustments: str = ""  # Linguagem natural: "muda o tom pra mais urgente"


@app.post("/api/clips/{clip_id}/clone")
async def clone_clip(clip_id: int, data: CloneRequest):
    """Clona um clip com ajustes em linguagem natural."""
    async with async_session() as session:
        original = await session.get(Clip, clip_id)
        if not original:
            raise HTTPException(404)

    log.info("api.clips.clone", clip_id=clip_id, adjustments=data.adjustments[:100])

    # Se tem ajustes, usa IA pra interpretar e modificar o texto
    text = original.moment_text
    if data.adjustments:
        try:
            from config.llm import llm_json
            result = await llm_json(
                system="Voce recebe um texto de noticia e um pedido de ajuste do usuario. Reescreva o texto aplicando o ajuste. Responda em JSON.",
                user=f"""Texto original: {text}

Ajuste pedido pelo usuario: {data.adjustments}

Reescreva o texto aplicando o ajuste. Mantenha o mesmo fato/noticia, so mude o que o usuario pediu.

JSON: {{"adjusted_text": "texto reescrito", "changes_made": "o que foi mudado"}}""",
                temperature=0.4,
                max_tokens=400,
            )
            text = result.get("adjusted_text", text)
            changes = result.get("changes_made", "")
            log.info("api.clips.clone.adjusted", changes=changes[:100])
        except Exception as e:
            log.warning("api.clips.clone.adjust_failed", error=str(e))

    # Gera novo video com texto ajustado
    from agents.graph import process_content
    new_result = await process_content(
        source_type="clone",
        source_id=f"clone-{clip_id}-{int(dt.datetime.utcnow().timestamp())}",
        source_url=original.source_url,
        source_text=text,
        source_author=f"Clone de #{clip_id}",
    )

    new_id = new_result.get("db_clip_id")
    if new_id:
        notify_sse("new_clip", {"clip_id": new_id})
        return {"status": "ok", "new_clip_id": new_id, "adjustments_applied": data.adjustments}
    return {"status": "error", "error": "Falha ao gerar clone"}


# ==================== VIDEO TEMPLATES ====================

@app.get("/api/templates")
async def list_templates():
    """Lista templates visuais."""
    async with async_session() as session:
        result = await session.execute(select(VideoTemplate).order_by(VideoTemplate.id))
        templates = result.scalars().all()
    return {"templates": [
        {"id": t.id, "name": t.name, "description": t.description, "category": t.category,
         "is_default": t.is_default, "active": t.active, "layout_json": t.layout_json,
         "updated_at": t.updated_at.isoformat() if t.updated_at else ""}
        for t in templates
    ]}


class TemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    layout_json: str | None = None
    is_default: bool | None = None
    active: bool | None = None


@app.patch("/api/templates/{template_id}")
async def update_template(template_id: int, data: TemplateUpdate):
    async with async_session() as session:
        t = await session.get(VideoTemplate, template_id)
        if not t: raise HTTPException(404)
        if data.name is not None: t.name = data.name
        if data.description is not None: t.description = data.description
        if data.layout_json is not None: t.layout_json = data.layout_json
        if data.is_default is not None:
            if data.is_default:
                await session.execute(select(VideoTemplate).where(VideoTemplate.is_default == True))
                for old in (await session.execute(select(VideoTemplate).where(VideoTemplate.is_default == True))).scalars():
                    old.is_default = False
            t.is_default = data.is_default
        if data.active is not None: t.active = data.active
        await session.commit()
    return {"status": "updated"}


class NaturalLayoutRequest(BaseModel):
    instruction: str  # "adicione uma barra preta com titulo no topo"
    base_template_id: int | None = None


@app.post("/api/templates/from-natural")
async def create_template_from_natural(data: NaturalLayoutRequest):
    """IA converte linguagem natural em template visual JSON."""
    from config.llm import llm_json

    base_layout = "{}"
    if data.base_template_id:
        async with async_session() as session:
            base = await session.get(VideoTemplate, data.base_template_id)
            if base: base_layout = base.layout_json

    result = await llm_json(
        system="""Voce converte instrucoes de layout visual em JSON de template de video.
O video e vertical 1080x1920. Responda APENAS em JSON.

Elementos disponveis:
- bar: barra colorida (position: top/bottom, height, color)
- overlay: retangulo semi-transparente (position: top/center/bottom, height, color, opacity, y, show_after)
- badge: texto pequeno com cor (text, x, y, color, size)
- separator: linha horizontal (x, y, width, height, color)
- title: titulo principal (x, y, size, color, max_chars, bold)
- summary: texto do resumo (x, y, size, color, line_spacing, show_after)
- source: fonte/credito (x, y, size, color)
- branding: marca (text, x, y, size, color)
- progress_bar: barra de progresso animada (position: bottom, height, color)
- letterbox: barras pretas em cima e embaixo (height, color)""",
        user=f"""Instrucao do usuario: {data.instruction}

Template base atual:
{base_layout}

Gere o JSON do template visual. Mantenha os elementos do template base e aplique as mudancas pedidas.

JSON: {{
    "name": "nome descritivo do template",
    "description": "descricao do que o usuario pediu",
    "elements": [...]
}}""",
        temperature=0.3,
        max_tokens=800,
    )

    # Salva no DB
    async with async_session() as session:
        t = VideoTemplate(
            name=result.get("name", "Custom"),
            description=result.get("description", data.instruction),
            category="custom",
            layout_json=json.dumps({"elements": result.get("elements", [])}),
        )
        session.add(t)
        await session.commit()
        template_id = t.id

    return {"status": "ok", "template_id": template_id, "template": result}


# ==================== PUBLISH PREPARATION ====================

@app.post("/api/clips/{clip_id}/prepare-publish/{account_id}")
async def prepare_publish(clip_id: int, account_id: int):
    """Gera sugestao de titulo, descricao e tags pra publicacao."""
    async with async_session() as session:
        clip = await session.get(Clip, clip_id)
        if not clip: raise HTTPException(404)
        account = await session.get(PublishAccount, account_id)
        if not account: raise HTTPException(404)

    # Verifica se a plataforma suporta upload automatico
    can_auto_publish = False
    publish_method = "manual"
    setup_needed = []

    if account.platform == "telegram" and account.access_token:
        can_auto_publish = True
        publish_method = "auto"
    elif account.platform == "youtube":
        publish_method = "manual"
        setup_needed = [
            "YouTube requer OAuth2 pra upload de videos",
            "A API Key permite apenas LER dados do canal",
            "Pra upload automatico, seria necessario configurar OAuth2 (etapa futura)",
            "Por enquanto: baixe o video e poste manualmente no YouTube Studio",
        ]
    elif account.platform in ("tiktok", "instagram"):
        publish_method = "manual"
        setup_needed = [
            f"{account.platform} requer aprovacao de app pra upload automatico",
            "Baixe o video e poste manualmente",
        ]
    elif account.platform == "twitter" and account.access_token:
        can_auto_publish = True
        publish_method = "auto"

    # Gera sugestao de titulo/descricao/tags com IA
    suggestion = {"title": clip.caption or clip.moment_text[:100], "description": clip.moment_text, "tags": clip.hashtags}

    try:
        from config.llm import llm_json
        from publisher.platform_specs import get_specs
        specs = get_specs(account.platform)

        result = await llm_json(
            system="Voce e um especialista em SEO de redes sociais. Gere titulo, descricao e tags otimizados. Responda em JSON.",
            user=f"""Conteudo: {clip.moment_text}
Caption atual: {clip.caption}
Hashtags atuais: {clip.hashtags}
Plataforma: {account.platform}
Max chars titulo: {specs.get('caption_max_chars', 100)}
Max hashtags: {specs.get('hashtags_max', 10)}

JSON: {{
    "title": "titulo otimizado pra {account.platform} (SEO, gancho, max {specs.get('caption_max_chars', 100)} chars)",
    "description": "descricao completa com keywords",
    "tags": ["tag1", "tag2", "tag3"]
}}""",
            temperature=0.5,
            max_tokens=300,
        )
        suggestion = result
    except Exception as e:
        log.warning("prepare_publish.suggestion_error", error=str(e))

    return {
        "clip_id": clip_id,
        "account_id": account_id,
        "platform": account.platform,
        "account_name": account.name,
        "can_auto_publish": can_auto_publish,
        "publish_method": publish_method,
        "setup_needed": setup_needed,
        "suggestion": suggestion,
        "video_path": clip.clip_path,
    }
