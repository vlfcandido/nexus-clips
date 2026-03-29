"""Content Strategist Agent — decide a melhor estratégia pra cada conteúdo.

Este é o cérebro do sistema. Pra cada conteúdo detectado, decide:
1. Formato: corte, vídeo original, notícia narrada, meme
2. Plataforma prioritária: TikTok, Reels, Shorts, X
3. Com ou sem voz IA
4. Anti-strike necessário?
5. Melhor horário pra postar
6. Título/caption otimizados
7. Estimativa de rendimento
"""

from dataclasses import dataclass

import structlog

from config.llm import llm_json
from detection.classifier import MomentClassification

log = structlog.get_logger()


@dataclass
class ContentStrategy:
    # Formato
    format_type: str  # "clip", "narrated_news", "original_video", "meme", "thread"
    duration_target: int  # segundos ideais

    # Plataforma
    primary_platform: str  # onde postar primeiro
    secondary_platforms: list[str]  # onde postar depois
    post_delay_minutes: dict[str, int]  # delay entre plataformas

    # Voz
    use_voice: bool
    voice_style: str  # "narrador", "informal", "urgente", "humoristico"
    voice_backend: str  # "edge", "google", "elevenlabs"

    # Anti-strike
    needs_anti_strike: bool
    transformation_level: str  # "light", "medium", "heavy"
    source_is_copyrighted: bool

    # Timing
    optimal_post_time: str  # HH:MM
    urgency: str  # "now", "scheduled", "queue"
    reasoning_time: str  # por que esse horário

    # Monetização
    estimated_views: int
    estimated_revenue_brl: float  # receita estimada
    monetization_method: str  # "adsense", "sponsorship", "traffic", "none"

    # Meta
    confidence: float
    reasoning: str  # explicação da decisão


# Horários de pico por plataforma (BR timezone)
PEAK_HOURS = {
    "tiktok": ["12:00", "18:00", "21:00", "23:00"],
    "instagram": ["11:00", "13:00", "19:00", "21:00"],
    "youtube": ["14:00", "18:00", "20:00"],
    "twitter": ["08:00", "12:00", "18:00", "22:00"],
}

# CPM médio por plataforma (R$ por 1000 views)
CPM_ESTIMATES = {
    "tiktok": 0.15,
    "instagram": 0.30,
    "youtube": 2.50,
    "twitter": 0.05,
}


async def decide_strategy(
    classification: MomentClassification,
    source_type: str,
    has_video: bool,
    trending_score: float = 0,
) -> ContentStrategy:
    """Usa Claude pra decidir a melhor estratégia pra este conteúdo."""
    try:
        data = await llm_json(
            system="""Você é um estrategista de conteúdo viral brasileiro.
Sua missão é maximizar views e receita pra cada conteúdo.
Considere: horário, formato, plataforma, voz, anti-strike, monetização.
Seja prático e direto. Responda APENAS em JSON.""",
            user=f"""Analise este conteúdo e defina a estratégia:

Classificação:
- Categoria: {classification.category}
- Tópico: {classification.topic}
- Viralidade: {classification.virality_score}/10
- Urgência: {classification.urgency}
- Resumo: {classification.summary}
- Título sugerido: {classification.suggested_title}

Contexto:
- Fonte: {source_type}
- Tem vídeo: {has_video}
- Score trending: {trending_score}/10
- Horários pico TikTok: {PEAK_HOURS['tiktok']}
- Horários pico Instagram: {PEAK_HOURS['instagram']}
- CPM TikTok: R${CPM_ESTIMATES['tiktok']}/1k views
- CPM YouTube: R${CPM_ESTIMATES['youtube']}/1k views

Responda em JSON:
{{
    "format_type": "clip|narrated_news|original_video|meme|thread",
    "duration_target": 30-120,
    "primary_platform": "tiktok|instagram|youtube|twitter",
    "secondary_platforms": ["..."],
    "post_delay_minutes": {{"instagram": 30, "youtube": 60}},
    "use_voice": true/false,
    "voice_style": "narrador|informal|urgente|humoristico",
    "needs_anti_strike": true/false,
    "transformation_level": "light|medium|heavy",
    "source_is_copyrighted": true/false,
    "optimal_post_time": "HH:MM",
    "urgency": "now|scheduled|queue",
    "reasoning_time": "explicação do horário",
    "estimated_views": 10000-1000000,
    "estimated_revenue_brl": 0.0,
    "monetization_method": "adsense|sponsorship|traffic|none",
    "confidence": 0.0-1.0,
    "reasoning": "explicação curta da estratégia"
}}""",
            max_tokens=800,
        )

        strategy = ContentStrategy(
            format_type=data.get("format_type", "clip"),
            duration_target=data.get("duration_target", 60),
            primary_platform=data.get("primary_platform", "tiktok"),
            secondary_platforms=data.get("secondary_platforms", []),
            post_delay_minutes=data.get("post_delay_minutes", {}),
            use_voice=data.get("use_voice", False),
            voice_style=data.get("voice_style", "narrador"),
            voice_backend="edge",  # Default grátis
            needs_anti_strike=data.get("needs_anti_strike", True),
            transformation_level=data.get("transformation_level", "light"),
            source_is_copyrighted=data.get("source_is_copyrighted", False),
            optimal_post_time=data.get("optimal_post_time", "21:00"),
            urgency=data.get("urgency", "queue"),
            reasoning_time=data.get("reasoning_time", ""),
            estimated_views=data.get("estimated_views", 0),
            estimated_revenue_brl=data.get("estimated_revenue_brl", 0),
            monetization_method=data.get("monetization_method", "adsense"),
            confidence=data.get("confidence", 0.5),
            reasoning=data.get("reasoning", ""),
        )

        log.info(
            "strategy.decided",
            format=strategy.format_type,
            platform=strategy.primary_platform,
            voice=strategy.use_voice,
            views=strategy.estimated_views,
            urgency=strategy.urgency,
        )
        return strategy

    except Exception as e:
        log.error("strategy.error", error=str(e))
        # Fallback conservador
        return ContentStrategy(
            format_type="clip" if has_video else "narrated_news",
            duration_target=60,
            primary_platform="tiktok",
            secondary_platforms=["instagram", "youtube"],
            post_delay_minutes={"instagram": 30, "youtube": 60},
            use_voice=not has_video,
            voice_style="narrador",
            voice_backend="edge",
            needs_anti_strike=True,
            transformation_level="light",
            source_is_copyrighted=source_type in ("youtube", "tv"),
            optimal_post_time="21:00",
            urgency="queue",
            reasoning_time="horário padrão de pico",
            estimated_views=5000,
            estimated_revenue_brl=0.75,
            monetization_method="adsense",
            confidence=0.3,
            reasoning="Fallback automático",
        )
