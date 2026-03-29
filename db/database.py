from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config.settings import settings

# Usa path absoluto pra garantir que o DB é sempre o mesmo independente do cwd
_db_path = Path(__file__).parent.parent / settings.db_path
engine = create_async_engine(f"sqlite+aiosqlite:///{_db_path}", echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    # Importa models pra registrar as tabelas no Base.metadata
    from db.models import DEFAULT_PROMPTS, PromptTemplate
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed prompts padrão
    from sqlalchemy import select
    async with async_session() as session:
        existing = await session.execute(select(PromptTemplate.key))
        existing_keys = {r[0] for r in existing.all()}
        for p in DEFAULT_PROMPTS:
            if p["key"] not in existing_keys:
                session.add(PromptTemplate(**p))
        await session.commit()

    # Seed templates visuais
    from db.models import DEFAULT_TEMPLATES, VideoTemplate
    async with async_session() as session:
        existing = await session.execute(select(VideoTemplate.name))
        existing_names = {r[0] for r in existing.all()}
        for t in DEFAULT_TEMPLATES:
            if t["name"] not in existing_names:
                session.add(VideoTemplate(**t))
        await session.commit()

    # Seed fontes padrão
    from db.models import MonitoredSource
    async with async_session() as session:
        existing = await session.execute(select(MonitoredSource.identifier))
        existing_ids = {r[0] for r in existing.all()}

        default_sources = [
            {"source_type": "rss", "identifier": "https://feeds.bbci.co.uk/portuguese/rss.xml", "topic": "guerra"},
            {"source_type": "rss", "identifier": "https://g1.globo.com/rss/g1/", "topic": "guerra"},
            {"source_type": "rss", "identifier": "https://ge.globo.com/rss/futebol/", "topic": "futebol"},
            {"source_type": "rss", "identifier": "https://rss.uol.com.br/feed/noticias.xml", "topic": "política"},
        ]
        for s in default_sources:
            if s["identifier"] not in existing_ids:
                session.add(MonitoredSource(**s))
        await session.commit()
