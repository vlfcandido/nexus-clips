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
from db.models import Clip, MonitoredSource, PublishAccount, PublishLog, PromptTemplate
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

        elif account.platform in ("tiktok", "instagram", "youtube"):
            # Essas plataformas precisam de OAuth flow
            checks["status"] = "manual"
            checks["message"] = f"Verificacao manual necessaria pra {account.platform}. Credenciais salvas."
            checks["permissions"] = _get_platform_auth_guide(account.platform)

    except Exception as e:
        checks["status"] = "error"
        checks["message"] = f"Erro de conexao: {str(e)}"

    log.info("api.accounts.verify", id=account_id, platform=account.platform, status=checks["status"])
    return checks


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
