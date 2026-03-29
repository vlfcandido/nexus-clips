"""Scheduler inteligente — decide melhor horário baseado em dados históricos."""

import datetime as dt
from collections import defaultdict

import structlog
from sqlalchemy import func, select

from db.database import async_session
from db.models import Clip

log = structlog.get_logger()


async def get_best_post_time(
    platform: str,
    topic: str,
    day_of_week: int | None = None,
) -> str:
    """Analisa histórico de posts e retorna melhor horário.

    Baseado em:
    1. Dados históricos de views por horário
    2. Horários de pico conhecidos por plataforma
    3. Dia da semana
    """
    # Pega dados históricos
    async with async_session() as session:
        result = await session.execute(
            select(Clip.published_at, Clip.views, Clip.topic)
            .where(
                Clip.published == True,
                Clip.views > 0,
                Clip.topic == topic,
            )
            .order_by(Clip.published_at.desc())
            .limit(200)
        )
        clips = result.all()

    if len(clips) < 10:
        # Sem dados suficientes, usa horários default
        defaults = {
            "tiktok": "21:00",
            "instagram": "19:00",
            "youtube": "18:00",
            "twitter": "12:00",
        }
        return defaults.get(platform, "20:00")

    # Agrupa views por hora
    hour_views: dict[int, list[int]] = defaultdict(list)
    for clip in clips:
        if clip.published_at:
            hour = clip.published_at.hour
            hour_views[hour].append(clip.views)

    # Média de views por hora
    hour_avg = {
        h: sum(views) / len(views)
        for h, views in hour_views.items()
        if views
    }

    if not hour_avg:
        return "21:00"

    # Melhor hora
    best_hour = max(hour_avg, key=hour_avg.get)
    log.info("scheduler.best_time", platform=platform, topic=topic, hour=best_hour, avg_views=hour_avg[best_hour])

    return f"{best_hour:02d}:00"


async def get_posting_schedule(
    platform: str,
    count: int = 5,
) -> list[dt.datetime]:
    """Gera schedule de postagens pro dia, espaçando pra não saturar."""
    now = dt.datetime.now()

    # Horários base (espaçados de ~3h)
    base_hours = {
        "tiktok": [9, 12, 15, 18, 21],
        "instagram": [8, 11, 14, 19, 21],
        "youtube": [10, 14, 18, 20, 22],
        "twitter": [7, 10, 13, 17, 21],
    }

    hours = base_hours.get(platform, [10, 14, 18, 21])[:count]

    schedule = []
    for h in hours:
        target = now.replace(hour=h, minute=0, second=0, microsecond=0)
        if target <= now:
            # Se já passou, agenda pro próximo dia
            target += dt.timedelta(days=1)
        schedule.append(target)

    return sorted(schedule)


async def get_analytics_summary() -> dict:
    """Retorna resumo de analytics pra o dashboard."""
    async with async_session() as session:
        # Total de clips
        total = await session.scalar(select(func.count(Clip.id)))

        # Publicados
        published = await session.scalar(
            select(func.count(Clip.id)).where(Clip.published == True)
        )

        # Views totais
        total_views = await session.scalar(
            select(func.sum(Clip.views)).where(Clip.published == True)
        ) or 0

        # Likes totais
        total_likes = await session.scalar(
            select(func.sum(Clip.likes)).where(Clip.published == True)
        ) or 0

        # Média de views
        avg_views = await session.scalar(
            select(func.avg(Clip.views)).where(Clip.published == True, Clip.views > 0)
        ) or 0

        # Top categorias
        top_cats = await session.execute(
            select(Clip.category, func.avg(Clip.views).label("avg_v"))
            .where(Clip.published == True, Clip.views > 0)
            .group_by(Clip.category)
            .order_by(func.avg(Clip.views).desc())
            .limit(5)
        )

    return {
        "total_clips": total or 0,
        "published": published or 0,
        "total_views": total_views,
        "total_likes": total_likes,
        "avg_views": round(avg_views, 0),
        "top_categories": [{"category": r[0], "avg_views": round(r[1], 0)} for r in top_cats.all()],
    }
