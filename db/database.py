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
    import db.models  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
