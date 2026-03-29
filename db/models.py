import datetime as dt

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from db.database import Base


class Clip(Base):
    """Um corte gerado pelo sistema."""

    __tablename__ = "clips"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow)

    # Fonte
    source_type: Mapped[str] = mapped_column(String(20))  # twitter, youtube, rss, tv
    source_url: Mapped[str] = mapped_column(Text, default="")
    source_id: Mapped[str] = mapped_column(String(100), default="")  # tweet_id, video_id, etc

    # Detecção
    topic: Mapped[str] = mapped_column(String(50))  # futebol, política
    category: Mapped[str] = mapped_column(String(50))  # gol, polêmica, declaração, treta
    moment_text: Mapped[str] = mapped_column(Text, default="")  # transcrição do momento
    confidence: Mapped[float] = mapped_column(Float, default=0.0)

    # Corte
    clip_path: Mapped[str] = mapped_column(Text, default="")
    thumbnail_path: Mapped[str] = mapped_column(Text, default="")
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    caption: Mapped[str] = mapped_column(Text, default="")
    hashtags: Mapped[str] = mapped_column(Text, default="")

    # Publicação
    published: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    published_platforms: Mapped[str] = mapped_column(Text, default="")  # json list
    tiktok_url: Mapped[str] = mapped_column(Text, default="")
    instagram_url: Mapped[str] = mapped_column(Text, default="")
    youtube_url: Mapped[str] = mapped_column(Text, default="")
    twitter_url: Mapped[str] = mapped_column(Text, default="")

    # Métricas (atualizado depois)
    views: Mapped[int] = mapped_column(Integer, default=0)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    shares: Mapped[int] = mapped_column(Integer, default=0)


class MonitoredSource(Base):
    """Fontes sendo monitoradas ativamente."""

    __tablename__ = "monitored_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_type: Mapped[str] = mapped_column(String(20))  # twitter, youtube, rss
    identifier: Mapped[str] = mapped_column(String(200))  # @handle, channel_id, feed_url
    topic: Mapped[str] = mapped_column(String(50))  # futebol, política
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_checked: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
