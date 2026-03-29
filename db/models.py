import datetime as dt

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from db.database import Base


# Prompts padrão do sistema — seed no init_db
DEFAULT_PROMPTS = [
    {
        "key": "classify",
        "name": "Classificador de conteudo",
        "description": "Analisa noticias e decide se vale virar video. Define topico, categoria e viralidade.",
        "system_prompt": "Voce e um classificador de conteudo de midia brasileira. Responda APENAS em JSON.",
        "user_prompt_template": """Analise este conteudo de midia brasileira e classifique:

{context}

Responda neste formato JSON:
{{
    "is_relevant": true/false,
    "category": "gol|polemica|declaracao|treta|analise|humor|breaking",
    "topic": "guerra|futebol|politica|entretenimento",
    "virality_score": 0-10,
    "summary": "resumo em 1 frase",
    "suggested_title": "titulo chamativo pra rede social",
    "urgency": "high|medium|low",
    "confidence": 0.0-1.0
}}

Criterios de viralidade alta (7+): gol importante, polemica explosiva, fala viral, treta entre figuras publicas.
Criterios de urgencia high: eventos ao vivo, breaking news, gol em jogo grande.""",
        "temperature": 0.1,
        "max_tokens": 500,
    },
    {
        "key": "strategy",
        "name": "Estrategista de conteudo",
        "description": "Decide formato (clip, narrated_news), plataforma, voz, duracao e potencial de monetizacao.",
        "system_prompt": """Voce e um estrategista de conteudo viral brasileiro.
Sua missao e maximizar views e receita pra cada conteudo.
Considere: horario, formato, plataforma, voz, anti-strike, monetizacao.
Responda APENAS em JSON.""",
        "user_prompt_template": """Analise este conteudo e defina a estrategia:

Classificacao:
- Categoria: {category}
- Topico: {topic}
- Viralidade: {virality_score}/10
- Urgencia: {urgency}
- Resumo: {summary}

Contexto:
- Tem video: {has_video}
- Fonte: {source_type}

JSON esperado:
{{
    "format_type": "clip|narrated_news|original_video|meme",
    "duration_target": 30-120,
    "primary_platform": "tiktok|instagram|youtube|twitter",
    "secondary_platforms": ["..."],
    "use_voice": true/false,
    "voice_style": "narrador|informal|urgente|humoristico",
    "needs_anti_strike": true/false,
    "optimal_post_time": "HH:MM",
    "estimated_views": 1000-500000,
    "reasoning": "explicacao curta"
}}""",
        "temperature": 0.4,
        "max_tokens": 600,
    },
    {
        "key": "caption_tiktok",
        "name": "Caption TikTok",
        "description": "Gera caption viral otimizada pro TikTok. Maximo 150 chars no titulo, hashtags relevantes.",
        "system_prompt": "Voce e um copywriter viral brasileiro. Responda APENAS em JSON.",
        "user_prompt_template": """Gere uma caption viral pra TikTok:

Conteudo: {summary}
Categoria: {category}
Tema: {topic}

Dicas: Maximo 150 chars no titulo. Hashtags relevantes (5-8). Tom informal, BR, girias ok. Gancho forte nos primeiros 2 segundos.

JSON: {{"title": "titulo", "caption": "descricao", "hashtags": ["#tag"], "hook": "gancho", "cta": "call to action"}}

REGRAS:
- Portugues BR, informal
- Gancho que prende em 2 segundos
- Polemico mas sem fake news
- Emojis com moderacao""",
        "temperature": 0.7,
        "max_tokens": 400,
    },
    {
        "key": "caption_instagram",
        "name": "Caption Instagram",
        "description": "Caption otimizada pra Instagram Reels. Pode ser mais longa, 20-30 hashtags.",
        "system_prompt": "Voce e um copywriter viral brasileiro. Responda APENAS em JSON.",
        "user_prompt_template": """Gere caption pra Instagram Reels:

Conteudo: {summary}
Categoria: {category}
Tema: {topic}

Dicas: Caption mais longa ok (ate 2200 chars). 20-30 hashtags. Mix de populares + nichados. CTA pro engajamento.

JSON: {{"title": "titulo", "caption": "descricao", "hashtags": ["#tag"], "hook": "gancho", "cta": "call to action"}}""",
        "temperature": 0.7,
        "max_tokens": 500,
    },
    {
        "key": "caption_youtube",
        "name": "Caption YouTube Shorts",
        "description": "Titulo SEO-friendly pro YouTube. Descricao com keywords.",
        "system_prompt": "Voce e um copywriter viral brasileiro. Responda APENAS em JSON.",
        "user_prompt_template": """Gere titulo e descricao pra YouTube Shorts:

Conteudo: {summary}
Categoria: {category}
Tema: {topic}

Dicas: Titulo SEO-friendly (ate 100 chars). Descricao com keywords. 3-5 hashtags.

JSON: {{"title": "titulo", "caption": "descricao", "hashtags": ["#tag"], "hook": "gancho", "cta": "call to action"}}""",
        "temperature": 0.5,
        "max_tokens": 400,
    },
    {
        "key": "growth_hook",
        "name": "Growth Hook Generator",
        "description": "Gera hooks, CTAs e estrategia de crescimento pra canais do zero.",
        "system_prompt": "Voce e um growth hacker de redes sociais brasileiro. Responda APENAS em JSON.",
        "user_prompt_template": """Canal NOVO (poucos seguidores).

Conteudo: {summary}
Tema: {topic}
Plataforma: {platform}

Gere um plano de engajamento:
{{
    "hook_text": "frase de abertura que prende em 2s",
    "cta_text": "call to action pro final",
    "engagement_question": "pergunta pra gerar comentarios",
    "trending_hashtags": ["#tag1"],
    "niche_hashtags": ["#tag1"],
    "series_name": "nome da serie ou null"
}}""",
        "temperature": 0.7,
        "max_tokens": 400,
    },
    {
        "key": "image_search",
        "name": "Busca de imagens",
        "description": "Gera queries de busca especificas pra encontrar imagens relevantes no Pexels.",
        "system_prompt": "Generate 4 specific image search queries for stock photos. Return JSON.",
        "user_prompt_template": """News: {title}. {summary}
Topic: {topic}

Generate 4 SPECIFIC image search queries to find relevant stock photos.
Be specific to the actual event, people, places mentioned.

Return JSON: {{"queries": ["query1", "query2", "query3", "query4"]}}""",
        "temperature": 0.3,
        "max_tokens": 150,
    },
]


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


class PublishAccount(Base):
    """Conta de rede social pra publicação."""

    __tablename__ = "publish_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow)

    # Identidade
    name: Mapped[str] = mapped_column(String(100))  # "Guerra Agora", "Gol a Gol"
    platform: Mapped[str] = mapped_column(String(20))  # tiktok, instagram, youtube, twitter
    username: Mapped[str] = mapped_column(String(100), default="")  # @handle

    # Tópicos que essa conta cobre
    topics: Mapped[str] = mapped_column(Text, default="")  # JSON: ["guerra", "política"]

    # Credenciais (encriptadas em prod)
    api_key: Mapped[str] = mapped_column(Text, default="")
    api_secret: Mapped[str] = mapped_column(Text, default="")
    access_token: Mapped[str] = mapped_column(Text, default="")
    refresh_token: Mapped[str] = mapped_column(Text, default="")

    # Config
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    auto_publish: Mapped[bool] = mapped_column(Boolean, default=False)
    max_posts_per_day: Mapped[int] = mapped_column(Integer, default=5)

    # Métricas
    total_posts: Mapped[int] = mapped_column(Integer, default=0)
    total_views: Mapped[int] = mapped_column(Integer, default=0)
    total_followers: Mapped[int] = mapped_column(Integer, default=0)


class PublishLog(Base):
    """Log de publicações — rastreia cada post em cada plataforma."""

    __tablename__ = "publish_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow)

    clip_id: Mapped[int] = mapped_column(Integer)
    account_id: Mapped[int] = mapped_column(Integer)
    platform: Mapped[str] = mapped_column(String(20))
    post_url: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, published, failed, scheduled
    scheduled_at: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    published_at: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    error: Mapped[str] = mapped_column(Text, default="")

    # Métricas do post individual
    views: Mapped[int] = mapped_column(Integer, default=0)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    comments: Mapped[int] = mapped_column(Integer, default=0)
    shares: Mapped[int] = mapped_column(Integer, default=0)


class PromptTemplate(Base):
    """Prompts editáveis do sistema — Pedro gerencia pelo dashboard."""

    __tablename__ = "prompt_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow)

    # Identificação
    key: Mapped[str] = mapped_column(String(50), unique=True)  # ex: "classify", "strategy", "caption_tiktok"
    name: Mapped[str] = mapped_column(String(100))  # nome legível: "Classificador de conteúdo"
    description: Mapped[str] = mapped_column(Text, default="")  # explicação pro Pedro

    # Prompts
    system_prompt: Mapped[str] = mapped_column(Text, default="")
    user_prompt_template: Mapped[str] = mapped_column(Text, default="")  # com {placeholders}

    # Config
    temperature: Mapped[float] = mapped_column(Float, default=0.3)
    max_tokens: Mapped[int] = mapped_column(Integer, default=600)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class MonitoredSource(Base):
    """Fontes sendo monitoradas ativamente."""

    __tablename__ = "monitored_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_type: Mapped[str] = mapped_column(String(20))  # twitter, youtube, rss
    identifier: Mapped[str] = mapped_column(String(200))  # @handle, channel_id, feed_url
    topic: Mapped[str] = mapped_column(String(50))  # futebol, política
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_checked: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
