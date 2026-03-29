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
    {
        "key": "narration",
        "name": "Texto de narracao",
        "description": "Gera o texto que sera narrado no video. Controla tom, estilo, duracao da fala.",
        "system_prompt": "Voce e um narrador de noticias brasileiro. Escreva texto pra ser falado em voz alta. Responda APENAS em JSON.",
        "user_prompt_template": """Escreva um texto de narracao pra este video:

Titulo: {title}
Resumo: {summary}
Topico: {topic}
Categoria: {category}

JSON: {{"narration": "texto completo pra narrar (60-120 palavras, tom urgente e envolvente)", "hook_opening": "frase de abertura impactante (2-3 segundos)"}}

REGRAS:
- Portugues BR natural, como se fosse falando pra camera
- Comece com gancho que prende atencao
- Tom urgente pra guerra/breaking, empolgante pra futebol, analitico pra politica
- Frases curtas e diretas
- Sem termos tecnicos
- 60-120 palavras no total""",
        "temperature": 0.6,
        "max_tokens": 400,
    },
    {
        "key": "scriptwriter",
        "name": "Redator / Roteirista",
        "description": "Escreve o roteiro completo do video com inicio, meio e fim. Garante contexto e narrativa.",
        "system_prompt": "Voce e um redator de conteudo digital brasileiro. Escreve roteiros curtos pra videos virais. Cada video precisa ter INICIO (gancho), MEIO (desenvolvimento) e FIM (conclusao/CTA). Responda em JSON.",
        "user_prompt_template": """Escreva um roteiro completo pra este video:

Titulo: {title}
Resumo: {summary}
Topico: {topic}
Categoria: {category}
Duracao alvo: {duration}s
Tom: {mood}

JSON: {{
    "hook": "frase de abertura que prende nos primeiros 3 segundos (pergunta, numero chocante, ou provocacao)",
    "intro": "contextualizacao rapida do assunto (10-15% do tempo)",
    "body": "desenvolvimento principal com fatos, dados ou historia (60-70% do tempo)",
    "climax": "momento de maior impacto ou revelacao (10-15% do tempo)",
    "outro": "conclusao + call to action (segue, comenta, compartilha)",
    "full_narration": "texto completo pra narrar, juntando tudo numa fala natural e fluida"
}}

REGRAS:
- Portugues BR natural, como se falasse pra camera
- INICIO: gancho forte, curiosidade, urgencia
- MEIO: fatos concretos, numeros, contexto
- FIM: opiniao ou CTA que gera engajamento
- Frases curtas e diretas
- Tom adequado ao tema""",
        "temperature": 0.6,
        "max_tokens": 600,
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


class VideoTemplate(Base):
    """Templates visuais editáveis — layout do vídeo (barras, títulos, posições)."""

    __tablename__ = "video_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow)

    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(30), default="news")  # news, tiktok, cinematic, minimal
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Layout config (JSON) — gerado por IA ou editado manualmente
    layout_json: Mapped[str] = mapped_column(Text, default="{}")


# Templates visuais padrão
DEFAULT_TEMPLATES = [
    {
        "name": "Breaking News",
        "description": "Barra preta no topo com titulo, badge URGENTE vermelho, barra de progresso, fonte no bottom",
        "category": "news",
        "is_default": True,
        "layout_json": """{
    "elements": [
        {"type": "bar", "position": "top", "height": 5, "color": "#ef4444"},
        {"type": "overlay", "position": "top", "height": 400, "color": "black", "opacity": 0.65},
        {"type": "badge", "text": "URGENTE", "x": 50, "y": 60, "color": "#ef4444", "size": 28},
        {"type": "separator", "x": 50, "y": 98, "width": 90, "height": 3, "color": "#ef4444"},
        {"type": "title", "x": 50, "y": 130, "size": 44, "color": "white", "max_chars": 70},
        {"type": "overlay", "position": "center", "y": 700, "height": 350, "color": "black", "opacity": 0.5, "show_after": 1.5},
        {"type": "summary", "x": 50, "y": 740, "size": 28, "color": "#e8e8e8", "line_spacing": 14, "show_after": 1.5},
        {"type": "overlay", "position": "bottom", "height": 100, "color": "black", "opacity": 0.75},
        {"type": "progress_bar", "position": "bottom", "height": 4, "color": "#ef4444"},
        {"type": "source", "x": 50, "y": 1850, "size": 18, "color": "#999999"},
        {"type": "branding", "text": "NEXUS CLIPS", "x": 880, "y": 1852, "size": 14, "color": "#555555"}
    ]
}""",
    },
    {
        "name": "TikTok Viral",
        "description": "Texto grande central, fundo escuro minimo, foco na legenda word-by-word",
        "category": "tiktok",
        "is_default": False,
        "layout_json": """{
    "elements": [
        {"type": "overlay", "position": "top", "height": 300, "color": "black", "opacity": 0.4},
        {"type": "title", "x": 50, "y": 100, "size": 52, "color": "white", "max_chars": 50, "bold": true},
        {"type": "overlay", "position": "bottom", "height": 200, "color": "black", "opacity": 0.6},
        {"type": "source", "x": 50, "y": 1800, "size": 20, "color": "#cccccc"},
        {"type": "progress_bar", "position": "bottom", "height": 3, "color": "#818cf8"}
    ]
}""",
    },
    {
        "name": "Cinematic",
        "description": "Imagens grandes, texto minimo, barras finas em cima e embaixo (letterbox)",
        "category": "cinematic",
        "is_default": False,
        "layout_json": """{
    "elements": [
        {"type": "letterbox", "height": 120, "color": "black"},
        {"type": "overlay", "position": "bottom", "height": 250, "color": "black", "opacity": 0.7},
        {"type": "title", "x": 50, "y": 1700, "size": 36, "color": "white", "max_chars": 60},
        {"type": "source", "x": 50, "y": 1760, "size": 16, "color": "#888888"}
    ]
}""",
    },
    {
        "name": "Minimal",
        "description": "Fundo limpo, apenas titulo e fonte, sem barras",
        "category": "minimal",
        "is_default": False,
        "layout_json": """{
    "elements": [
        {"type": "overlay", "position": "center", "y": 800, "height": 300, "color": "black", "opacity": 0.4},
        {"type": "title", "x": 80, "y": 880, "size": 38, "color": "white", "max_chars": 55},
        {"type": "source", "x": 80, "y": 1000, "size": 18, "color": "#aaaaaa"}
    ]
}""",
    },
]


class ClipComment(Base):
    """Comentários/feedback em clips — historico do que ficou bom/ruim."""

    __tablename__ = "clip_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow)
    clip_id: Mapped[int] = mapped_column(Integer)
    author: Mapped[str] = mapped_column(String(50), default="Pedro")
    type: Mapped[str] = mapped_column(String(20), default="feedback")  # feedback, fix, note
    text: Mapped[str] = mapped_column(Text)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)


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
