from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    # --- Google Cloud Vision ---
    google_application_credentials: str = ""

    # --- Anthropic ---
    anthropic_api_key: str = ""

    # --- Twitter/X ---
    twitter_bearer_token: str = ""
    twitter_api_key: str = ""
    twitter_api_secret: str = ""
    twitter_access_token: str = ""
    twitter_access_secret: str = ""

    # --- Telegram ---
    telegram_bot_token: str = ""
    telegram_channel_id: str = ""

    # --- YouTube ---
    youtube_api_key: str = ""

    # --- Paths ---
    db_path: str = "nexus_clips.db"
    clips_output_dir: Path = Path("./output")
    temp_dir: Path = Path("./temp")

    # --- Logging ---
    log_level: str = "INFO"

    # --- Detection ---
    # Confiança mínima pra considerar um momento relevante (0-1)
    moment_confidence_threshold: float = 0.7
    # Duração padrão do corte em segundos
    default_clip_duration: int = 60
    # Segundos antes do momento detectado pra começar o corte
    clip_pre_buffer: int = 10
    # Segundos depois do momento detectado
    clip_post_buffer: int = 50

    # --- Whisper ---
    whisper_model: str = "base"  # tiny, base, small, medium, large

    # --- Publishing ---
    auto_publish: bool = False  # Só publica com aprovação manual por padrão
    publish_platforms: list[str] = ["telegram"]  # telegram, tiktok, instagram, youtube, twitter

    # --- Monitoring ---
    # Temas pra monitorar
    monitor_topics: list[str] = [
        "copa do mundo",
        "seleção brasileira",
        "brasil futebol",
        "política brasil",
        "bolsonaro",
        "lula",
        "congresso",
    ]

    # Contas do Twitter pra monitorar
    monitor_twitter_accounts: list[str] = [
        "ge_globo",
        "UOLEsporte",
        "ESPNBrasil",
        "FolhaPolitica",
        "EstadaoPolitica",
    ]

    # Canais YouTube Live pra monitorar
    monitor_youtube_channels: list[str] = []

    # RSS feeds
    monitor_rss_feeds: list[str] = [
        "https://ge.globo.com/rss/futebol/",
        "https://www.uol.com.br/esporte/futebol/rss.xml",
        "https://rss.folha.uol.com.br/poder/rss091.xml",
    ]


settings = Settings()
